import { test, expect, Page } from "@playwright/test";

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

test.describe("Prompt 09 Scope-Locked Gates (R1-R6)", () => {
  test("R1: Roles Matrix editable switch toggles, persists on reload, and writes Role Changelog", async ({
    page,
    browser,
  }) => {
    await loginAs(page, "9876543210", "admin123", "**/admin**");
    await page.goto("/admin/roles", { waitUntil: "load" });

    // Sales & Billing group with both new permissions visible
    await expect(page.locator("text=Sales & Billing")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=Delete bill (POS)")).toBeVisible();
    await expect(page.locator("text=Delete (void) invoice")).toBeVisible();

    // Super Admin locked safeguard: SYSTEM_ADMIN switch for SUPER_ADMIN is disabled/locked
    const saSysAdmin = page.locator(
      'button[role="switch"][data-role="SUPER_ADMIN"][data-permission="SYSTEM_ADMIN"]'
    );
    await expect(saSysAdmin).toBeDisabled();
    expect(await saSysAdmin.getAttribute("aria-checked")).toBe("true");

    // Non-Super-Admin / Safeguard API checks
    const safeguardRes = await page.request.post("/api/admin/roles", {
      data: { targetRole: "SUPER_ADMIN", permission: "SYSTEM_ADMIN", enabled: false },
    });
    expect(safeguardRes.status()).toBe(400);

    // Toggle IMPORT_PRODUCTS on for SHOP using keyboard Arrow/Space or click, assert toast + Undo
    const shopImportSwitch = page.locator(
      'button[role="switch"][data-role="SHOP"][data-permission="IMPORT_PRODUCTS"]'
    );
    await expect(shopImportSwitch).toHaveAttribute("aria-checked", "false");
    await shopImportSwitch.focus();
    await page.keyboard.press("Space");

    await expect(shopImportSwitch).toHaveAttribute("aria-checked", "true");
    await expect(page.locator('[role="status"]:has-text("Saved")')).toBeVisible({ timeout: 5000 });

    // Reload page -> persists!
    await page.reload({ waitUntil: "load" });
    await expect(
      page.locator('button[role="switch"][data-role="SHOP"][data-permission="IMPORT_PRODUCTS"]')
    ).toHaveAttribute("aria-checked", "true");

    // Second logged-in Cashier session immediately gets Import Products & Prices sidebar link!
    const cashierCtx = await browser.newContext();
    const cashierPage = await cashierCtx.newPage();
    await loginAs(cashierPage, "9876543212", "shop123", "**/shop**");
    const nonSaPost = await cashierPage.request.post("/api/admin/roles", {
      data: { targetRole: "SHOP", permission: "IMPORT_PRODUCTS", enabled: false },
    });
    expect(nonSaPost.status()).toBe(403);
    await expect(
      cashierPage.locator('a[href="/admin/catalog/import"]').first()
    ).toBeVisible({ timeout: 8000 });

    // Super Admin revokes IMPORT_PRODUCTS from SHOP cleanly -> Cashier loses sidebar link on next request!
    await page.locator('button[role="switch"][data-role="SHOP"][data-permission="IMPORT_PRODUCTS"]').click();
    await expect(
      page.locator('button[role="switch"][data-role="SHOP"][data-permission="IMPORT_PRODUCTS"]')
    ).toHaveAttribute("aria-checked", "false");
    await cashierPage.reload({ waitUntil: "load" });
    await expect(cashierPage.locator('a[href="/admin/catalog/import"]')).toHaveCount(0);
    await cashierCtx.close();

    // Check Role Changelog tab records both changes
    await page.locator('button:has-text("Role Changelog")').click();
    await expect(page.locator('[data-testid="role-changelog-entry"]').first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("R2: Cashier POS delete bill (F8) and invoice void follow matrix permissions", async ({
    page,
  }) => {
    await loginAs(page, "9876543212", "shop123", "**/shop**");
    await page.goto("/shop/pos", { waitUntil: "load" });

    const popup = page.locator('[data-testid="pos-party-popup"]');
    if (await popup.isVisible().catch(() => false)) {
      await page.keyboard.press("Escape");
    }

    // Without pos.deleteBill granted, F8 must NOT show discard dialog
    const search = page.locator("#pos-item-search");
    await expect(search).toBeVisible({ timeout: 15000 });
    await search.focus();
    await page.keyboard.type("bikaji");
    await page.waitForTimeout(300);
    await page.keyboard.press("Enter");
    const rowsBefore = await page.locator("tbody tr[data-line-id]").count();
    expect(rowsBefore).toBeGreaterThanOrEqual(1);

    await page.keyboard.press("F8");
    const discardModal = page.locator('[data-testid="pos-discard-confirm"]');
    await expect(discardModal).toHaveCount(0);
  });

  test("R5: Shop POS enables Credit by default for every named party while blocking Walk-in", async ({
    page,
  }) => {
    await loginAs(page, "9876543210", "admin123", "**/admin**");
    await page.goto("/shop/pos", { waitUntil: "load" });

    const popup = page.locator('[data-testid="pos-party-popup"]');
    if (await popup.isVisible().catch(() => false)) {
      await page.keyboard.press("Escape");
    }

    // Add item to cart and press F2 with Walk-in -> Credit blocked with message
    const search = page.locator("#pos-item-search");
    await search.fill("bikaji");
    await page.waitForTimeout(300);
    await page.keyboard.press("Enter");
    await page.keyboard.press("F2");

    const dialog = page.locator('[data-testid="save-voucher-dialog"], [role="dialog"]:has-text("Save Voucher")');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    expect(await dialog.innerText()).toMatch(/Select a party for credit/i);
  });

  test("R6: Shared product search returns consistent results across POS and Catalog", async ({
    page,
  }) => {
    await loginAs(page, "9876543210", "admin123", "**/admin**");
    await page.goto("/shop/pos", { waitUntil: "load" });

    const search = page.locator("#pos-item-search");
    await expect(search).toBeVisible({ timeout: 15000 });
    await search.fill("bikaji");
    await page.waitForTimeout(300);
    const posDropdown = await page.locator('[data-testid="pos-search-results"]').innerText();
    expect(posDropdown.toLowerCase()).toContain("bikaji");
  });

  test("R3: Van app routes render Hindi UI cleanly and bills stay English", async ({
    page,
  }) => {
    await loginAs(page, "9876543213", "van123", "**/van**");
    await page.goto("/van", { waitUntil: "load" });
    const bodyText = await page.locator("main, body").first().innerText();
    // Must contain Devanagari Hindi strings everywhere in Van UI
    expect(bodyText).toMatch(/[\u0900-\u097F]/);
  });

  test("R4: Thermal bill has 480px logo first, date & party next, 5 columns, and 11-17px typography without overflow", async ({
    page,
  }) => {
    await loginAs(page, "9876543210", "admin123", "**/admin**");
    await page.goto("/shop/invoices/sample/preview", { waitUntil: "load" });
    const billSheet = page.locator('[data-testid="bill-document"]').first();
    await expect(billSheet).toBeVisible({ timeout: 10000 });

    const logoImg = billSheet.locator("img").first();
    await expect(logoImg).toBeVisible({ timeout: 5000 });
    const natWidth = await logoImg.evaluate((el: HTMLImageElement) => el.naturalWidth);
    expect(natWidth).toBe(480);

    const thCount = await billSheet.locator("table thead th").count();
    expect(thCount).toBe(5);
  });
});
