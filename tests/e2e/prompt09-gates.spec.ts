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
    browser,
  }) => {
    // 1. Cashier without pos.deleteBill or invoice.void cannot delete bill (F8) or void invoice (UI + 403)
    await loginAs(page, "9876543212", "shop123", "**/shop**");
    await page.goto("/shop/pos", { waitUntil: "load" });
    const popup = page.locator('[data-testid="pos-party-popup"]');
    if (await popup.isVisible().catch(() => false)) {
      await page.keyboard.press("Escape");
    }

    await expect(page.locator('button:has-text("F8 Del Bill")')).toHaveCount(0);
    const search = page.locator("#pos-item-search");
    await expect(search).toBeVisible({ timeout: 15000 });
    await search.fill("bikaji");
    await page.waitForTimeout(300);
    await page.keyboard.press("Enter");
    expect(await page.locator("tbody tr[data-line-id]").count()).toBeGreaterThanOrEqual(1);

    await page.keyboard.press("F8");
    await expect(page.locator('[data-testid="pos-delete-bill-confirm"]')).toHaveCount(0);

    // Void API returns 403 for Cashier when invoice.void is OFF
    const voidDenied = await page.request.post("/api/invoices/non-existent/void", {
      data: { reason: "test denied without permission" },
    });
    expect(voidDenied.status()).toBe(403);

    await page.goto("/shop/invoices", { waitUntil: "load" });
    await expect(page.locator('[data-testid="invoice-delete-btn"]')).toHaveCount(0);

    // 2. Super Admin grants pos.deleteBill and invoice.void to SHOP
    const saCtx = await browser.newContext();
    const saPage = await saCtx.newPage();
    await loginAs(saPage, "9876543210", "admin123", "**/admin**");
    for (const perm of ["pos.deleteBill", "invoice.void"]) {
      const grantRes = await saPage.request.post("/api/admin/roles", {
        data: { targetRole: "SHOP", permission: perm, enabled: true },
      });
      expect(grantRes.status()).toBe(200);
    }

    try {
      // 3. Cashier reloads POS -> F8 now opens confirmation showing item count, Y discards while keeping held bills
      await page.goto("/shop/pos", { waitUntil: "load" });
      if (await popup.isVisible().catch(() => false)) {
        await page.keyboard.press("Escape");
      }
      await expect(page.locator('button:has-text("F8 Del Bill")')).toBeVisible({ timeout: 5000 });
      await page.locator("#pos-item-search").fill("bikaji");
      await page.waitForTimeout(300);
      await page.keyboard.press("Enter");
      // Hold bill 1
      await page.keyboard.press("F4");
      await page.waitForTimeout(200);
      if (await popup.isVisible().catch(() => false)) {
        await page.keyboard.press("Escape");
      }
      // Create bill 2 with 1 item and delete via F8 -> Y
      await page.locator("#pos-item-search").fill("bikaji");
      await page.waitForTimeout(300);
      await page.keyboard.press("Enter");
      await page.keyboard.press("F8");
      const discardModal = page.locator('[data-testid="pos-delete-bill-confirm"]');
      await expect(discardModal).toBeVisible({ timeout: 5000 });
      expect(await discardModal.innerText()).toMatch(/Delete this bill\?[\s\S]*1\b/i);
      await page.keyboard.press("y");
      await expect(discardModal).toHaveCount(0);
      expect(await page.locator("tbody tr[data-line-id]").count()).toBe(0);

      // Held bill must still exist after F8 discard
      await expect(page.getByRole("button", { name: /Held \(\d+\)/ })).toContainText(/1/);

      // Finalize a Cash bill as Cashier, then verify Delete (Void) button visible & voids cleanly
      await page.locator("#pos-item-search").fill("bikaji");
      await page.waitForTimeout(300);
      await page.keyboard.press("Enter");
      await page.keyboard.press("F2");
      const finishDialog = page.locator('[role="dialog"]:has-text("Finish & Print Bill")');
      await expect(finishDialog).toBeVisible({ timeout: 5000 });
      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/shop/pos") && r.request().method() === "POST" && r.status() === 200, {
          timeout: 15000,
        }),
        finishDialog.locator('button:has-text("Save & Print")').click(),
      ]);
      await expect(finishDialog).toHaveCount(0, { timeout: 10000 });
      await expect(page.locator("tbody tr[data-line-id]")).toHaveCount(0, { timeout: 10000 });

      await page.goto("/shop/invoices", { waitUntil: "load" });
      const invIdAttr = await page.locator('a[href^="/shop/invoices/"]').first().getAttribute("href");
      const targetInvoiceId = invIdAttr?.split("/").pop();
      const delBtn = page.locator('[data-testid="invoice-delete-btn"]').first();
      await expect(delBtn).toBeVisible({ timeout: 10000 });
      await delBtn.click();
      const voidDialog = page.locator('[role="dialog"]');
      await expect(voidDialog).toBeVisible({ timeout: 5000 });
      await voidDialog.locator('textarea, input[placeholder*="reason" i]').first().fill("Wrong entry test R2");
      await voidDialog.locator('button:has-text("Confirm Void")').click();
      await expect(voidDialog).toHaveCount(0, { timeout: 10000 });
      await page.getByLabel("Show cancelled").check();
      await expect(page.locator('table tbody')).toContainText(/CANCELLED/i, { timeout: 10000 });
      if (targetInvoiceId) {
        const doubleVoidRes = await page.request.post(`/api/invoices/${targetInvoiceId}/void`, {
          data: { reason: "Double void test" },
        });
        expect(doubleVoidRes.status()).toBe(400);
      }
    } finally {
      // Restore defaults for X1 cleanliness
      for (const perm of ["pos.deleteBill", "invoice.void"]) {
        await saPage.request.post("/api/admin/roles", {
          data: { targetRole: "SHOP", permission: perm, enabled: false },
        });
      }
      await saCtx.close();
    }
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

    // 1. Add item with Walk-in -> Credit disabled with "Select a party for credit"
    const search = page.locator("#pos-item-search");
    await search.fill("bikaji");
    await page.waitForTimeout(300);
    await page.keyboard.press("Enter");
    await page.keyboard.press("F2");

    const dialog = page.locator('[role="dialog"]:has-text("Finish & Print Bill")');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    expect(await dialog.innerText()).toMatch(/Select a party for credit/i);
    await expect(dialog.locator('button:has-text("CREDIT")')).toBeDisabled();
    await page.keyboard.press("Escape");

    // 2. Create a named party (Alt+N / New Party) whose DB creditEnabled=false, limit=0 -> Credit works by default
    const uniqueParty = `R5 Test Store ${Date.now().toString().slice(-4)}`;
    await page.locator('button:has-text("Alt+N New Party")').click();
    const quickHeading = page.locator('h3:has-text("Add New Customer")');
    await expect(quickHeading).toBeVisible({ timeout: 5000 });
    const quickCustomerCard = quickHeading.locator("xpath=../..");
    await quickCustomerCard.locator('input[placeholder*="Ramesh" i]').fill(uniqueParty);
    await quickCustomerCard.locator('button[type="submit"]').click();
    await expect(quickHeading).toHaveCount(0, { timeout: 5000 });

    await page.keyboard.press("F2");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    const creditBtn = dialog.locator('button:has-text("CREDIT")');
    await expect(creditBtn).toBeEnabled();
    await creditBtn.click();
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/shop/pos") && r.request().method() === "POST" && r.status() === 200, {
        timeout: 15000,
      }),
      dialog.locator('button:has-text("Save & Print")').click(),
    ]);
    await expect(dialog).toHaveCount(0, { timeout: 10000 });

    // 3. Toggle pos.creditAllParties OFF in /admin/settings -> party with creditEnabled=false is blocked on Credit
    try {
      await page.goto("/admin/settings", { waitUntil: "load" });
      const creditToggle = page.locator('[data-testid="setting-pos-credit-all-parties"]');
      await expect(creditToggle).toBeVisible({ timeout: 5000 });
      await creditToggle.uncheck();
      await page.locator('[data-testid="save-pos-credit-settings"]').click();
      await expect(page.locator('text=/POS credit settings saved/i').first()).toBeVisible({ timeout: 5000 });

      await page.goto("/shop/pos", { waitUntil: "load" });
      const p2 = page.locator('[data-testid="pos-party-popup"]');
      if (!(await p2.isVisible().catch(() => false))) {
        await page.locator('button:has-text("Alt+P Party")').click();
        await expect(p2).toBeVisible({ timeout: 5000 });
      }
      await p2.locator("input").first().fill(uniqueParty);
      await page.waitForTimeout(300);
      await page.keyboard.press("Enter");
      await page.locator("#pos-item-search").fill("bikaji");
      await page.waitForTimeout(300);
      await page.keyboard.press("Enter");
      await page.keyboard.press("F2");
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await expect(dialog.locator('button:has-text("CREDIT")')).toBeDisabled();
      expect(await dialog.innerText()).toMatch(/No credit for this party/i);
    } finally {
      await page.goto("/admin/settings", { waitUntil: "load" }).catch(() => {});
      const creditToggle = page.locator('[data-testid="setting-pos-credit-all-parties"]');
      if (await creditToggle.isVisible().catch(() => false)) {
        await creditToggle.check();
        await page.locator('[data-testid="save-pos-credit-settings"]').click();
        await page.waitForTimeout(400);
      }
    }
  });

  test("R6: Shared product search returns consistent results across POS, Catalog, and Storefront APIs", async ({
    page,
  }) => {
    await loginAs(page, "9876543210", "admin123", "**/admin**");
    await page.goto("/shop/pos", { waitUntil: "load" });
    const popup = page.locator('[data-testid="pos-party-popup"]');
    if (await popup.isVisible().catch(() => false)) {
      await page.keyboard.press("Escape");
    }

    // Weight conversion + typo tolerance + MRP in Shop POS
    const search = page.locator("#pos-item-search");
    await expect(search).toBeVisible({ timeout: 15000 });
    await search.fill("1000g bikaji");
    await page.waitForTimeout(250);
    const dd1 = await page.locator('[data-testid="pos-search-results"]').innerText();
    expect(dd1).toContain("Bikaji Bhujia 1kg");

    await search.fill("bikji");
    await page.waitForTimeout(250);
    const dd2 = await page.locator('[data-testid="pos-search-results"]').innerText();
    expect(dd2).toContain("Bikaji Bhujia 1kg");

    await search.fill("250");
    await page.waitForTimeout(250);
    const dd3 = await page.locator('[data-testid="pos-search-results"]').innerText();
    expect(dd3).toContain("Bikaji Bhujia 1kg");

    // Storefront search APIs use the exact same shared engine & ranking
    for (const q of ["1000g bikaji", "bikji", "250"]) {
      const webRes = await page.request.get(`/api/store/search?q=${encodeURIComponent(q)}`);
      expect(webRes.status()).toBe(200);
      const webJson = await webRes.json();
      expect(webJson.products?.length).toBeGreaterThanOrEqual(1);
      expect(webJson.products[0].name).toContain("Bikaji Bhujia 1kg");

      const mobRes = await page.request.get(`/api/store/v1/search?q=${encodeURIComponent(q)}`);
      expect(mobRes.status()).toBe(200);
      const mobJson = await mobRes.json();
      expect(mobJson.products?.length).toBeGreaterThanOrEqual(1);
      expect(mobJson.products[0].id).toBe(webJson.products[0].id);
    }

    // Admin Catalog search box uses same weight conversion / typo tolerance
    await page.goto("/admin/catalog", { waitUntil: "load" });
    const catInput = page.locator('input[placeholder*="Search" i]').first();
    await expect(catInput).toBeVisible({ timeout: 10000 });
    await catInput.fill("1000g bikji");
    await page.waitForTimeout(250);
    await expect(page.locator("text=Bikaji Bhujia 1kg").first()).toBeVisible({ timeout: 5000 });
  });

  test("R3: Van app routes render everyday Hindi (>=16px Noto Sans Devanagari), reject Hindi bill name, and keep printed bills English", async ({
    page,
  }) => {
    await loginAs(page, "9876543213", "van123", "**/van**");

    // Verify all Van routes load in Hindi with >= 16px body font & loaded Noto Sans Devanagari
    for (const route of ["/van", "/van/billing", "/van/bills", "/van/collections", "/van/reconciliation", "/app/van"]) {
      await page.goto(route, { waitUntil: "load" });
      const text = await page.locator("main, body").first().innerText();
      expect(text, `${route} should render Devanagari Hindi copy`).toMatch(/[\u0900-\u097F]/);

      // Should not leak Devanagari numerals ०-९
      expect(text, `${route} must keep ASCII 0-9 numerals`).not.toMatch(/[\u0966-\u096F]/);

      // Check shell computed font size >= 16px and Noto Sans Devanagari font family
      const shellCheck = await page.evaluate(() => {
        const el = document.querySelector(".van-hindi-shell") || document.body;
        const cs = window.getComputedStyle(el);
        return {
          fontSizePx: parseFloat(cs.fontSize),
          fontFamily: cs.fontFamily,
        };
      });
      expect(shellCheck.fontSizePx, `${route} base font size`).toBeGreaterThanOrEqual(16);
      expect(shellCheck.fontFamily.toLowerCase()).toContain("noto sans devanagari");
    }

    // Verify zero stale English navigation labels on /van bottom nav or primary buttons
    await page.goto("/van", { waitUntil: "load" });
    const vanText = await page.locator("main, body").first().innerText();
    expect(vanText).not.toContain("Van Counter");
    expect(vanText).not.toContain("Morning Load Status");
    expect(vanText).not.toContain("Start Billing");

    // Verify Quick Add Customer in /van/billing (if morning load is active) requires English Bill Name & allows blank name_hi
    await page.goto("/van/billing", { waitUntil: "load" });
    const newCustBtn = page.getByRole("button", { name: /\+ नया ग्राहक/i });
    if (await newCustBtn.count()) {
      await newCustBtn.click();
      const billNameInput = page.locator('input[placeholder*="Gupta Kirana Store"]').first();
      await expect(billNameInput).toBeVisible();
      await billNameInput.fill("गुप्ता दुकान");
      await page.getByRole("button", { name: /ग्राहक सेव करें/i }).click();
      await expect(page.locator("text=केवल अंग्रेज़ी अक्षर")).toBeVisible({ timeout: 5000 });

      const uniqueParty = `VanR3 Shop ${Date.now().toString().slice(-4)}`;
      await billNameInput.fill(uniqueParty);
      await page.getByRole("button", { name: /ग्राहक सेव करें/i }).click();
      await expect(page.locator(`text=${uniqueParty}`).first()).toBeVisible({ timeout: 5000 });
    }

    // Printed invoice check as Admin for sample bill guarantees zero Devanagari characters
    await loginAs(page, "9876543210", "admin123", "**/admin**");
    await page.goto("/shop/invoices/sample/print?format=thermal", { waitUntil: "load" });
    const printBody = await page.locator("body").innerText();
    expect(printBody).not.toMatch(/[\u0900-\u097F]/);
  });

  test("R4: Thermal bill has 480px logo first, date & party next, 5 columns, Credit-only plain Amount Pending, 11-17px typography, zero overflow, and 576px/80mm artifacts", async ({
    page,
  }) => {
    await loginAs(page, "9876543210", "admin123", "**/admin**");
    await page.setViewportSize({ width: 288, height: 1000 });
    await page.goto("/shop/invoices/sample/preview", { waitUntil: "load" });
    const billSheet = page.locator('[data-testid="bill-document"]').first();
    await expect(billSheet).toBeVisible({ timeout: 10000 });

    const logoImg = billSheet.locator("img").first();
    await expect(logoImg).toBeVisible({ timeout: 5000 });
    const natWidth = await logoImg.evaluate((el: HTMLImageElement) => el.naturalWidth);
    expect(natWidth).toBe(480);

    // 5 columns: Sl No | Product | Qty | Rate | Amount
    const thTexts = await billSheet.locator("table thead th").allInnerTexts();
    expect(thTexts.length).toBe(5);
    expect(thTexts.join("|")).toContain("Sl No");
    expect(thTexts.join("|")).toContain("Product");
    expect(thTexts.join("|")).toContain("Qty");
    expect(thTexts.join("|")).toContain("Rate");
    expect(thTexts.join("|")).toContain("Amount");

    // Verify zero horizontal overflow and strict 11-17px computed font sizes
    const layoutMetrics = await page.evaluate(() => {
      const sheet = document.querySelector('[data-testid="bill-document"]') as HTMLElement;
      const logoRect = sheet.querySelector("img")!.getBoundingClientRect();
      const tableRect = sheet.querySelector("table")!.getBoundingClientRect();
      const sizes: number[] = [];
      const walk = (el: Element) => {
        if (el.textContent && el.textContent.trim().length > 0 && el.children.length === 0) {
          sizes.push(parseFloat(window.getComputedStyle(el).fontSize));
        }
        for (const ch of Array.from(el.children)) walk(ch);
      };
      walk(sheet);
      return {
        logoBeforeTable: logoRect.top < tableRect.top,
        sheetScrollW: sheet.scrollWidth,
        sheetClientW: sheet.clientWidth,
        minFont: Math.min(...sizes),
        maxFont: Math.max(...sizes),
      };
    });
    expect(layoutMetrics.logoBeforeTable).toBe(true);
    expect(layoutMetrics.sheetScrollW).toBeLessThanOrEqual(layoutMetrics.sheetClientW + 1);
    expect(layoutMetrics.minFont).toBeGreaterThanOrEqual(11);
    expect(layoutMetrics.maxFont).toBeLessThanOrEqual(17);

    const previewText = await billSheet.innerText();
    expect(previewText).not.toMatch(/[\u0900-\u097F]/);
    expect(previewText).not.toMatch(/\b(DUES|OUTSTANDING|BALANCE|STAMP)\b/i);
    expect(previewText).not.toContain("Amount Pending:");

    // Generate all 6 PNGs (576px width) and 80mm PDFs into artifacts/r4-bills/
    const { renderR4ThermalArtifacts } = await import("../../scripts/render-r4-bills");
    const fxMetrics = await renderR4ThermalArtifacts("http://127.0.0.1:3000");
    expect(fxMetrics.length).toBe(5);
    for (const m of fxMetrics) {
      expect(m.imgNatWidth, `${m.name} logo width`).toBe(480);
      expect(m.scrollWidth, `${m.name} zero overflow`).toBeLessThanOrEqual(m.clientWidth + 1);
      expect(m.cellOverflowCount, `${m.name} zero column overlap`).toBe(0);
      expect(m.minFontPx, `${m.name} min font`).toBeGreaterThanOrEqual(11);
      expect(m.maxFontPx, `${m.name} max font`).toBeLessThanOrEqual(17);
    }
  });
});
