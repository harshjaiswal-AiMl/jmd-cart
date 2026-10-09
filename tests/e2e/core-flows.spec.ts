import { test, expect } from "@playwright/test";

test.describe("IDMS Phase 1 E2E Core Flows", () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies before each test to ensure a clean session state
    await page.context().clearCookies();
  });

  test("1. System Health & Public Landing Page", async ({ page }) => {
    // Check health endpoint
    const healthRes = await page.goto("/api/health");
    expect(healthRes?.status()).toBe(200);
    const healthJson = await healthRes?.json();
    expect(healthJson.status).toBe("ok");
    expect(healthJson.database).toBe("connected");

    // Check Landing Page
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("IDMS - Saharsa");
    await expect(page.getByRole("link", { name: "Staff Login" })).toBeVisible();
  });

  test("2. Super Admin Login & Dashboard Navigation", async ({ page }) => {
    await page.goto("/login");

    await page.fill('input[name="phone"]', "9876543210");
    await page.fill('input[name="password"]', "admin123");
    await page.click('button[type="submit"]');

    // Should redirect to /admin dashboard
    await page.waitForURL("**/admin", { timeout: 20000 });
    await expect(page.locator("h1")).toContainText("Administrator Dashboard");

    // Verify key module links exist on dashboard
    await expect(page.getByRole("link", { name: /Catalog Master/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Reports & Analytics/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Shop POS Register/i })).toBeVisible();
  });

  test("3. RBAC Route Guards (Godown user blocked from Admin settings)", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.fill('input[name="phone"]', "9876543211"); // Godown user
    await page.fill('input[name="password"]', "godown123");
    await page.click('button[type="submit"]');

    await page.waitForURL("**/godown", { timeout: 20000 });
    await expect(page.locator("h1")).toContainText("Godown & Inventory Operations");

    // Godown user attempts to access Super Admin settings
    const forbiddenRes = await page.goto("/admin/settings");
    expect(forbiddenRes?.status()).toBe(403);
  });

  test("4. Catalog Bulk Import Flow", async ({ page }) => {
    // Login as Admin
    await page.goto("/login");
    await page.fill('input[name="phone"]', "9876543210");
    await page.fill('input[name="password"]', "admin123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/admin", { timeout: 20000 });

    // Navigate to Catalog Import
    await page.goto("/admin/catalog/import");
    await expect(page.locator("text=Upload Product Master CSV")).toBeVisible();

    // Click "Paste CSV Text" tab
    await page.click('button:has-text("Paste CSV Text")');

    // Paste sample CSV content
    const timestamp = Date.now().toString().slice(-6);
    const testCode = `E2E_${timestamp}`;
    const testCsv = `shortCode,name,company,category,hsn,gstRate,mrp,packSize,packLabel
${testCode},E2E Mustard Oil ${timestamp},Saloni,Oils,15149120,5,180.00,12,Carton of 12`;

    await page.fill('textarea[name="rawText"]', testCsv);
    await page.click('button:has-text("Import Products")');

    // Wait for success confirmation
    await expect(page.locator("text=Import Summary")).toBeVisible({ timeout: 20000 });
    await expect(page.locator("text=100% Success")).toBeVisible();

    // Verify product is listed in Catalog with direct search query
    await page.goto(`/admin/catalog?q=${testCode}`);
    await expect(page.locator(`text=${testCode}`)).toBeVisible();
  });

  test("5. Multi-Location Stock Overview & Movement History", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="phone"]', "9876543210");
    await page.fill('input[name="password"]', "admin123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/admin", { timeout: 20000 });

    await page.goto("/godown/stock");
    await expect(page.locator("h1")).toContainText("Inventory by Location");

    // Check table headers
    await expect(page.locator("th:has-text('Product / Short Code')")).toBeVisible();
    await expect(page.locator("th:has-text('Total Stock')")).toBeVisible();
    await expect(page.locator("th:has-text('Location Breakdown')")).toBeVisible();
  });

  test("6. Shop POS Register & Interface Elements", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="phone"]', "9876543210");
    await page.fill('input[name="password"]', "admin123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/admin", { timeout: 20000 });

    await page.goto("/shop/pos");
    await expect(page.locator("h1")).toContainText("Shop POS Counter");

    // Search input
    const searchInput = page.locator('input[placeholder*="Search products by name"]');
    await expect(searchInput).toBeVisible();

    // Verify empty cart state
    await expect(page.locator("text=No items on current bill")).toBeVisible();

    // Check if an in-stock product exists to add to cart
    const inStockCard = page.locator('button:has-text("in stock"):not([disabled])').first();
    const count = await inStockCard.count();
    if (count > 0) {
      await inStockCard.click();
      await expect(page.locator("text=Total Payable")).toBeVisible();
      await expect(page.locator('button:has-text("Pay & Finalize")')).toBeVisible();
    }
  });

  test("7. Sales Invoices Register & Print Viewer", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="phone"]', "9876543210");
    await page.fill('input[name="password"]', "admin123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/admin", { timeout: 20000 });

    await page.goto("/shop/invoices");
    await expect(page.locator("h1")).toContainText("Sales Invoices");

    // Click on the first invoice link if any exists in table
    const firstInvoiceLink = page.locator('table tbody tr td a[href^="/shop/invoices/"]').first();
    const count = await firstInvoiceLink.count();

    if (count > 0) {
      const invoiceUrl = await firstInvoiceLink.getAttribute("href");
      if (invoiceUrl) {
        await page.goto(invoiceUrl);
        await expect(page.locator("h1")).toContainText("INV/");
        await expect(page.getByRole("link", { name: /Print A4 Invoice/i })).toBeVisible();
        await expect(page.getByRole("link", { name: /Print 80mm Thermal/i })).toBeVisible();

        // Check thermal print route
        await page.goto(`${invoiceUrl}/print?format=thermal`);
        await expect(page.locator("text=NET TOTAL:")).toBeVisible();
        await expect(page.locator("text=Thank you! Visit Again")).toBeVisible();

        // Check A4 print route
        await page.goto(`${invoiceUrl}/print?format=a4`);
        await expect(page.locator("text=Tax Invoice (Under Section 31 of CGST Act)")).toBeVisible();
        await expect(page.locator("text=GST Tax Computation Summary")).toBeVisible();
      }
    }
  });

  test("8. Basic Reports & Analytics Module", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="phone"]', "9876543210");
    await page.fill('input[name="password"]', "admin123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/admin", { timeout: 20000 });

    await page.goto("/admin/reports");
    await expect(page.locator("h1")).toContainText("Business Reports & Analytics");

    // Verify all 4 report tabs can be opened
    await page.click('button:has-text("Daily Sales Summary")');
    await expect(page.locator("text=Finalized Invoices")).toBeVisible();

    await page.click('button:has-text("Day-End Cash Register")');
    await expect(page.locator("text=Total System Recorded Cash")).toBeVisible();
    await expect(page.locator("text=Physical Cash Denomination Counter")).toBeVisible();

    await page.click('button:has-text("Stock Inventory & Valuation")');
    await expect(page.locator("text=Total Stock Valuation")).toBeVisible();

    await page.click('button:has-text("Low Stock Alerts")');
    await expect(page.locator("text=Products at or below reorder level")).toBeVisible();
  });

  test("9. Salesperson Login, Auto-Routing to /van PWA Shell & Static Assets", async ({ page, request }) => {
    // 1. Verify PWA manifest and service worker routes are served cleanly
    const manifestRes = await request.get("/manifest.webmanifest");
    expect(manifestRes.status()).toBe(200);
    const manifestJson = await manifestRes.json();
    expect(manifestJson.name).toContain("Van Sales");
    expect(manifestJson.start_url).toBe("/van");

    const swRes = await request.get("/sw.js");
    expect(swRes.status()).toBe(200);

    // 2. Salesperson Login
    await page.goto("/login");
    await page.fill('input[name="phone"]', "9876543213");
    await page.fill('input[name="password"]', "van123");
    await page.click('button[type="submit"]');

    // 3. Verify automatic redirection to /van
    await page.waitForURL("**/van", { timeout: 20000 });
    await expect(page.locator("text=JMD CART").first()).toBeVisible();
    await expect(page.locator("text=VAN PWA").first()).toBeVisible();
    await expect(page.locator("text=Van Stock").first()).toBeVisible();

    // 4. Verify PWA mobile bottom navigation bar
    await page.setViewportSize({ width: 390, height: 844 });
    const bottomNav = page.locator("nav.fixed.bottom-0");
    await expect(bottomNav).toBeVisible();
    await expect(bottomNav.getByText("New Bill")).toBeVisible();
    await expect(bottomNav.getByText("Day End")).toBeVisible();
    await expect(bottomNav.getByText("Invoices")).toBeVisible();

    // 5. Verify Salesperson is blocked from admin routes (403 Forbidden)
    const adminResponse = await page.goto("/admin");
    expect(adminResponse?.status()).toBe(403);
  });
});

