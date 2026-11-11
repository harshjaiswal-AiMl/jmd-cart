import { test, expect, Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const SHOTS_DIR =
  process.env.VERIFY_SHOTS_DIR || path.resolve(process.cwd(), "artifacts/verify-shots");
fs.mkdirSync(SHOTS_DIR, { recursive: true });

async function loginAs(page: Page, phone: string, password: string, expectedUrlPattern = "**/*") {
  await page.context().clearCookies();
  await page.goto("/login", { waitUntil: "load" });
  const submit = page.locator('button[type="submit"]');
  await expect(submit).toBeEnabled({ timeout: 15000 });
  await page.fill('input[name="phone"]', phone);
  await page.fill('input[name="password"]', password);
  await submit.click();
  await page.waitForURL(expectedUrlPattern, { timeout: 30000, waitUntil: "commit" });
}

test.describe("User Request Verification Suite (All 7 Features)", () => {
  test("1. Direct Print on Cash/UPI/Credit click, F2 Voucher flow, Print Mode labels, Revision Reverse & A5 Signatories", async ({
    page,
  }) => {
    await loginAs(page, "9876543210", "admin123", "**/admin**");
    await page.goto("/shop/pos", { waitUntil: "load" });
    const popup = page.locator('[data-testid="pos-party-popup"]');
    if (await popup.isVisible().catch(() => false)) {
      await page.keyboard.press("Escape");
    }

    // 1. Check F2 opens SaveVoucherDialog cleanly (voucher modal)
    const search = page.locator("#pos-item-search");
    await search.fill("bikaji");
    await page.waitForTimeout(300);
    await page.keyboard.press("Enter");
    await page.keyboard.press("F2");
    const voucherDialog = page.locator('[role="dialog"]:has-text("Finish & Print Bill")');
    await expect(voucherDialog).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(SHOTS_DIR, "verify-f2-voucher.png") });
    await page.keyboard.press("Escape");

    // 2. Clicking UPI button directly finalizes & prints (without F2 dialog) with Mode : UPI
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/shop/pos") && r.request().method() === "POST" && r.status() === 200,
        { timeout: 15000 }
      ),
      page.locator('[data-testid="pos-mode-upi"]').click(),
    ]);
    await expect(page.locator("text=/Saved .* · ₹/")).toBeVisible({ timeout: 8000 });
    await page.screenshot({ path: path.join(SHOTS_DIR, "verify-pos-upi-direct-print.png") });

    // Wait for first toast to vanish before testing direct Credit click
    await expect(page.locator("text=/Saved .* · ₹/")).toHaveCount(0, { timeout: 6000 });

    // Close party popup if opened after next bill
    if (await popup.isVisible().catch(() => false)) {
      await page.keyboard.press("Escape");
    }

    // 3. Verify Credit click with named party directly saves & prints Mode : CREDIT + Amount Pending
    await page.locator('button:has-text("Alt+P Party")').click();
    await expect(popup).toBeVisible({ timeout: 5000 });
    await popup.locator('button:has-text("Wholesaler")').first().click();
    await expect(popup).toHaveCount(0, { timeout: 5000 });
    await search.focus();
    await search.fill("bikaji");
    await page.waitForTimeout(400);
    await search.press("Enter");
    await expect(page.locator('input[value*="Bikaji" i]').first()).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="pos-mode-credit"]').click();
    await expect(page.locator("text=/Saved .*000002.* · ₹/")).toBeVisible({ timeout: 15000 });

    // 4. Inspect both newly created bills on /shop/invoices -> Print viewer
    await page.goto("/shop/invoices", { waitUntil: "load" });
    await expect(page.locator("table").first()).toBeVisible({ timeout: 10000 });
    const links = page.locator('a[href*="/shop/invoices/"][href*="/print"], a[href^="/shop/invoices/"]');
    const invHrefs: string[] = [];
    const count = await links.count();
    for (let i = 0; i < count && invHrefs.length < 4; i++) {
      const h = await links.nth(i).getAttribute("href");
      if (h && /\/shop\/invoices\/[a-z0-9]+/i.test(h)) {
        const id = h.match(/\/shop\/invoices\/([^/?#]+)/)?.[1];
        if (id && !invHrefs.includes(id)) invHrefs.push(id);
      }
    }
    expect(invHrefs.length).toBeGreaterThanOrEqual(2);
    const creditInvId = invHrefs[0];
    const upiInvId = invHrefs[1];

    await page.goto(`/shop/invoices/${creditInvId}/print?format=cash_receipt`, { waitUntil: "load" });
    const creditDocText = await page.locator('[data-testid="bill-document"]').innerText();
    expect(creditDocText).toContain("CREDIT");
    expect(creditDocText).toContain("Amount Pending: ₹");
    await page.screenshot({ path: path.join(SHOTS_DIR, "verify-credit-direct-bill.png"), fullPage: true });

    await page.goto(`/shop/invoices/${upiInvId}/print?format=cash_receipt`, { waitUntil: "load" });
    const upiDocText = await page.locator('[data-testid="bill-document"]').innerText();
    expect(upiDocText).toContain("UPI");
    expect(upiDocText).not.toContain("Amount Pending:");
    await page.screenshot({ path: path.join(SHOTS_DIR, "verify-upi-bill.png"), fullPage: true });

    // 5. Check A5 Invoice below Amount in words has Receiver's Signatory & Authorised Signatory
    await page.goto(`/shop/invoices/${creditInvId}/print?format=a5`, { waitUntil: "load" });
    const a5Text = await page.locator(".a5-invoice-root").innerText();
    expect(a5Text).toContain("Amount in words:");
    expect(a5Text).toContain("Receiver's Signatory");
    expect(a5Text).toContain("Authorised Signatory");
    expect(a5Text).not.toContain("No signature required");
    await page.screenshot({ path: path.join(SHOTS_DIR, "verify-a5-signatories.png"), fullPage: true });

    // 6. Edit UPI invoice -> click Cash button -> prints CASH Mode
    await page.goto(`/shop/pos?edit=${upiInvId}`, { waitUntil: "load" });
    await page.waitForTimeout(500);
    await Promise.all([
      page.waitForURL(/\/shop\/invoices\/.*\/print/, { timeout: 20000 }),
      page.locator('[data-testid="pos-mode-cash"]').click(),
    ]);
    await expect(page.locator('[data-testid="bill-document"]')).toBeVisible({ timeout: 10000 });
    const editedCashText = await page.locator('[data-testid="bill-document"]').innerText();
    expect(editedCashText).toContain("CASH");
    expect(editedCashText).not.toContain("Amount Pending:");
    await page.screenshot({ path: path.join(SHOTS_DIR, "verify-edit-cash-bill.png"), fullPage: true });

    // 7. Revision History & Reverse button in POS Edit Mode
    await page.goto(`/shop/pos?edit=${upiInvId}`, { waitUntil: "load" });
    const revBtn = page.locator('button:has-text("Revision History")');
    await expect(revBtn).toBeVisible({ timeout: 10000 });
    await revBtn.click();
    const reverseBtn = page.locator('[data-testid^="reverse-revision-"]').first();
    await expect(reverseBtn).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(SHOTS_DIR, "verify-revision-reverse-modal.png") });
    page.once("dialog", (d) => d.accept());
    await Promise.all([
      page.waitForLoadState("load"),
      reverseBtn.click(),
    ]);
    await page.waitForTimeout(800);
    await expect(page.locator('button:has-text("Revision History (2)")')).toBeVisible({ timeout: 10000 });
  });

  test("2. Admin Catalog New Product defaults to Active and Alt+I works on Admin & Cashier dashboards", async ({
    page,
    browser,
  }) => {
    await loginAs(page, "9876543210", "admin123", "**/admin**");
    await page.waitForLoadState("load");
    await expect(page.locator("h1, main").first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(300);

    // Test Alt+I from Admin Dashboard -> /shop/invoices
    await page.keyboard.press("Alt+i");
    await page.waitForURL("**/shop/invoices**", { timeout: 15000 });
    await expect(page.locator("h1:has-text('Invoices'), h1:has-text('Sales')").or(page.locator("table")).first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(SHOTS_DIR, "verify-alt-i-admin.png") });

    // Test New Product default active checkbox & created product stays active
    await page.goto("/admin/catalog", { waitUntil: "load" });
    await page.locator('button:has-text("+ Add Product")').click();
    const addModal = page.locator('form:has(button:has-text("Save Product"))');
    await expect(addModal).toBeVisible({ timeout: 5000 });
    const activeCb = addModal.locator('input[type="checkbox"]');
    await activeCb.scrollIntoViewIfNeeded();
    await expect(activeCb).toBeChecked();

    const uniqueSku = `ACT${Date.now().toString().slice(-6)}`;
    const uniqueName = `Verify Active Prod ${uniqueSku}`;
    await addModal.locator('input[name="name"]').fill(uniqueName);
    await addModal.locator('input[name="shortCode"]').fill(uniqueSku);
    await addModal.locator('input[name="mrpRupees"]').fill("100");
    await activeCb.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS_DIR, "verify-add-product-active.png") });
    await addModal.locator('button[type="submit"]').click();
    await expect(addModal).toHaveCount(0, { timeout: 10000 });

    await page.reload({ waitUntil: "load" });
    const row = page.locator(`tr:has-text("${uniqueSku}")`).first();
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row).toContainText(/Active/i);
    await row.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS_DIR, "verify-added-product-row-active.png") });

    // Test Alt+I from Cashier dashboard (/shop/pos) in fresh Cashier context
    const cashierCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const cashierPage = await cashierCtx.newPage();
    try {
      await loginAs(cashierPage, "9876543212", "shop123", "**/shop**");
      await cashierPage.waitForLoadState("load");
      await expect(cashierPage.locator("#pos-item-search")).toBeVisible({ timeout: 15000 });
      const popup = cashierPage.locator('[data-testid="pos-party-popup"]');
      if (await popup.isVisible().catch(() => false)) {
        await cashierPage.keyboard.press("Escape");
      }
      await cashierPage.keyboard.press("Alt+i");
      await cashierPage.waitForURL("**/shop/invoices**", { timeout: 15000 });
      await expect(cashierPage.locator("h1, table").first()).toBeVisible({ timeout: 10000 });
      await cashierPage.screenshot({ path: path.join(SHOTS_DIR, "verify-alt-i-cashier.png") });
    } finally {
      await cashierCtx.close();
    }
  });
});
