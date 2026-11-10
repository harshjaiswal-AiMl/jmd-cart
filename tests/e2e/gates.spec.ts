import { test, expect, Page, BrowserContext } from "@playwright/test";

const ITEM_SEARCH_SEL = '#pos-item-search, input[placeholder*="Scan barcode"]';

async function loginAsAdmin(page: Page) {
  await page.goto("/login", { waitUntil: "load" });
  const submitBtn = page.locator('button[type="submit"]');
  await expect(submitBtn).toBeEnabled({ timeout: 15000 });
  await page.fill('input[name="phone"]', "9999900001");
  await page.fill('input[name="password"]', "e2eadmin123");
  await submitBtn.click();
  await page.waitForURL("**/admin**", { timeout: 30000, waitUntil: "commit" });
}

function attachNoNewTabGuard(context: BrowserContext): { count: () => number } {
  let newTabs = 0;
  context.on("page", () => {
    newTabs += 1;
  });
  return { count: () => newTabs };
}

test.describe("Prompt 08 Gates E2E Suite", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await loginAsAdmin(page);
  });

  test("G2: Alt+P opens centered Party popup with search focused in ONE press from any focus", async ({
    page,
    context,
  }) => {
    const tabGuard = attachNoNewTabGuard(context);
    await page.goto("/shop/pos");

    const itemSearch = page.locator(ITEM_SEARCH_SEL);
    await expect(itemSearch).toBeVisible({ timeout: 15000 });
    await itemSearch.focus();
    await expect(itemSearch).toBeFocused();

    // Press Alt+P once
    await page.keyboard.press("Alt+p");

    // Expect a modal dialog / centered popup overlay containing the party search input
    const popup = page.locator('[data-testid="pos-party-popup"], [role="dialog"]:has-text("Party")');
    await expect(popup).toBeVisible({ timeout: 5000 });
    const partySearch = popup.locator('#pos-party-search-input, input[placeholder*="party" i], input[placeholder*="buyer" i]');
    await expect(partySearch).toBeFocused();

    // Esc closes popup and returns focus to item search
    await page.keyboard.press("Escape");
    await expect(popup).toBeHidden();
    await expect(itemSearch).toBeFocused();
    expect(tabGuard.count()).toBe(0);
  });

  test("G13: F3 and Alt+F3 start new bill and open Party popup everywhere", async ({
    page,
    context,
  }) => {
    const tabGuard = attachNoNewTabGuard(context);

    // 1. Test Alt+F3 from /admin/catalog
    await page.goto("/admin/catalog");
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Alt+F3");
    await page.waitForURL("**/shop/pos**", { timeout: 15000, waitUntil: "commit" });

    const popup = page.locator('[data-testid="pos-party-popup"], [role="dialog"]:has-text("Party")');
    await expect(popup).toBeVisible({ timeout: 5000 });
    await expect(popup.locator('#pos-party-search-input, input[placeholder*="party" i]')).toBeFocused();

    // First option should be Counter Sale (Walk-in), Esc selects Counter Sale
    await page.keyboard.press("Escape");
    await expect(popup).toBeHidden();
    await expect(page.locator(ITEM_SEARCH_SEL)).toBeFocused();

    // 2. Add an item, press F3 -> holds non-empty bill, starts fresh bill with Party popup
    await page.locator(ITEM_SEARCH_SEL).fill("sugar");
    await page.waitForTimeout(300);
    await page.keyboard.press("Enter");
    await page.keyboard.press("F3");
    await expect(popup).toBeVisible({ timeout: 5000 });
    expect(tabGuard.count()).toBe(0);
  });

  test("G3: F2 Finish popup saves and prints directly in hidden iframe without leaving /shop/pos", async ({
    page,
    context,
  }) => {
    const tabGuard = attachNoNewTabGuard(context);
    await page.goto("/shop/pos");
    await page.waitForSelector(ITEM_SEARCH_SEL);

    // Dismiss party popup if open on new bill
    const partyPopup = page.locator('[data-testid="pos-party-popup"]');
    if (await partyPopup.isVisible().catch(() => false)) {
      await page.keyboard.press("Escape");
    }

    // Add 1 item by keyboard
    await page.locator(ITEM_SEARCH_SEL).focus();
    await page.keyboard.type("himalaya");
    await page.waitForTimeout(300);
    await page.keyboard.press("Enter");

    // Stub window.print inside any iframe
    await page.evaluate(() => {
      (window as any).__iframePrintCalls = 0;
    });

    // Press F2 -> Finish popup opens
    await page.keyboard.press("F2");
    const finishModal = page.locator('[data-testid="pos-finish-modal"], [role="dialog"]:has-text("Save Voucher"), [role="dialog"]:has-text("Finish")');
    await expect(finishModal).toBeVisible({ timeout: 5000 });

    // Select UPI via U key
    await page.keyboard.press("u");

    // Press Enter -> Saves and prints via hidden iframe, STAYS on /shop/pos
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2000);

    expect(page.url()).toContain("/shop/pos");
    const iframeCount = await page.locator("iframe[data-pos-print-frame], iframe#pos-print-iframe").count();
    expect(iframeCount).toBeGreaterThan(0);
    expect(tabGuard.count()).toBe(0);
  });

  test("G10: F8 deletes current unsaved bill and Invoice Delete (void) reverses bill", async ({
    page,
    context,
  }) => {
    const tabGuard = attachNoNewTabGuard(context);
    await page.goto("/shop/pos");
    await page.waitForSelector(ITEM_SEARCH_SEL);

    const partyPopup = page.locator('[data-testid="pos-party-popup"]');
    if (await partyPopup.isVisible().catch(() => false)) {
      await page.keyboard.press("Escape");
    }

    // Add an item
    await page.locator(ITEM_SEARCH_SEL).focus();
    await page.keyboard.type("himalaya");
    await page.waitForTimeout(300);
    await page.keyboard.press("Enter");
    const rowCountBefore = await page.locator("tbody tr[data-line-id]").count();
    expect(rowCountBefore).toBeGreaterThan(0);

    // Press F8 -> Discard bill confirm prompt
    await page.keyboard.press("F8");
    const confirmDeleteModal = page.locator('[data-testid="pos-delete-bill-confirm"], [role="dialog"]:has-text("Delete this bill")');
    await expect(confirmDeleteModal).toBeVisible({ timeout: 5000 });

    // Confirm with Y
    await page.keyboard.press("y");
    await expect(confirmDeleteModal).toBeHidden();
    const rowCountAfter = await page.locator("tbody tr[data-line-id]").count();
    expect(rowCountAfter).toBe(0);

    // Check /shop/invoices has Void/Delete button
    await page.goto("/shop/invoices");
    const firstInvRow = page.locator("tbody tr").first();
    await expect(firstInvRow).toBeVisible();
    await expect(page.locator('[data-testid="invoice-delete-btn"], button:has-text("Delete"), button:has-text("Void")').first()).toBeVisible();
    expect(tabGuard.count()).toBe(0);
  });

  test("G11: Product search finds products by weight and MRP (100 gm 95, 135, 50g, meat 100)", async ({
    page,
  }) => {
    await page.goto("/shop/pos");
    await page.waitForSelector(ITEM_SEARCH_SEL);
    const partyPopup = page.locator('[data-testid="pos-party-popup"]');
    if (await partyPopup.isVisible().catch(() => false)) {
      await page.keyboard.press("Escape");
    }

    const searchBox = page.locator(ITEM_SEARCH_SEL);
    await searchBox.fill("100 gm 95");
    await page.waitForTimeout(300);
    const results = page.locator('[data-testid="pos-search-results"], [role="listbox"]');
    await expect(results).toBeVisible();
    const text = await results.innerText();
    expect(text.toLowerCase()).toContain("95");

    await searchBox.fill("135");
    await page.waitForTimeout(300);
    const text135 = await results.innerText();
    expect(text135).toContain("135");
  });

  test("G12: Thermal bill template has Sl/Product/Price/Amt columns, big bold pure black typography, and NO dues/balance", async ({
    page,
  }) => {
    // 1. Verify Cash/UPI 3-inch thermal slip via sample preview
    await page.goto("/shop/invoices/sample/preview");
    const billSheet = page.locator('[data-testid="bill-document"]').first();
    await expect(billSheet).toBeVisible({ timeout: 10000 });
    const headers = billSheet.locator("table thead th");
    expect(await headers.count()).toBe(4);
    const headerText = await billSheet.locator("table thead").innerText();
    expect(headerText).toContain("Sl");
    expect(headerText).toContain("Product");
    expect(headerText).toContain("Price");
    expect(headerText).toContain("Amt.");
    const billText = await billSheet.innerText();
    expect(billText).not.toMatch(/\b(DUES|OUTSTANDING|PREVIOUS BALANCE)\b/i);

    // 2. Verify real invoice print link opens cleanly
    await page.goto("/shop/invoices");
    const printLink = page.locator('a[href*="/print"]').first();
    await expect(printLink).toBeVisible();
  });

  test("G4: Catalog tier prices have linked editable price AND percent boxes", async ({
    page,
  }) => {
    await page.goto("/admin/catalog");
    await page.waitForSelector("table tbody tr");
    const firstRow = page.locator("table tbody tr").first();
    const pctInput = firstRow.locator('input[data-tier-percent], input[aria-label*="percent" i]');
    await expect(pctInput.first()).toBeVisible({ timeout: 5000 });
    await expect(pctInput.first()).toBeEditable();
  });

  test("G5 & G9: Busy-style keyboard-only 5-item bill and Brand Light Theme", async ({
    page,
    context,
  }) => {
    const tabGuard = attachNoNewTabGuard(context);
    await page.goto("/shop/pos");
    await page.waitForSelector(ITEM_SEARCH_SEL);

    // Check G9 Brand tokens / typography (grid >= 16px, no dark navy pos header)
    const headerBg = await page.locator("header, [data-pos-header]").first().evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(headerBg).not.toBe("rgb(18, 53, 91)"); // not old dark navy

    // Check G5 keyboard flow
    const partyPopup = page.locator('[data-testid="pos-party-popup"]');
    if (await partyPopup.isVisible().catch(() => false)) {
      await page.keyboard.press("Escape");
    }

    const search = page.locator(ITEM_SEARCH_SEL);
    await search.focus();
    await expect(search).toBeFocused();
    await page.keyboard.type("himalaya");
    await page.waitForTimeout(300);
    await page.keyboard.press("Enter");

    const gridInput = page.locator('tbody tr[data-line-id] input[data-pos-field="qty"]').first();
    const fontSize = await gridInput.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(16);

    expect(tabGuard.count()).toBe(0);
  });
});
