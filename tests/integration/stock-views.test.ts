import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { stockService } from "@/modules/stock/stock.service";
import { UserRole } from "@prisma/client";
import { ForbiddenError } from "@/modules/auth/permissions";

describe("Task 1.9: Stock Views by Location & Product Movement History", () => {
  const runId = Date.now().toString().slice(-6);
  const p1ShortCode = `VB_${runId}`;
  const p2ShortCode = `VR_${runId}`;
  const p1Name = `Bikaji Views Bhujia ${runId}`;
  const p2Name = `Bikaji Views Rasgulla ${runId}`;

  let godownLocId: string;
  let shopLocId: string;
  let vanLocId: string;
  let testCompanyId: string;
  let product1Id: string;
  let product2Id: string;

  beforeAll(async () => {
    // 1. Get or create test locations
    const godown = await prisma.location.upsert({
      where: { id: "test-view-loc-godown" },
      update: {},
      create: {
        id: "test-view-loc-godown",
        name: "Test Views Godown",
        type: "GODOWN",
      },
    });
    godownLocId = godown.id;

    const shop = await prisma.location.upsert({
      where: { id: "test-view-loc-shop" },
      update: {},
      create: {
        id: "test-view-loc-shop",
        name: "Test Views Shop",
        type: "SHOP",
      },
    });
    shopLocId = shop.id;

    const van = await prisma.location.upsert({
      where: { id: "test-view-loc-van" },
      update: {},
      create: {
        id: "test-view-loc-van",
        name: "Test Views Van",
        type: "VAN",
      },
    });
    vanLocId = van.id;

    // 2. Create test company
    const comp = await prisma.company.upsert({
      where: { name: `Bikaji Views Test ${runId}` },
      update: {},
      create: {
        name: `Bikaji Views Test ${runId}`,
      },
    });
    testCompanyId = comp.id;

    // 3. Create two test products
    const p1 = await prisma.product.create({
      data: {
        name: p1Name,
        shortCode: p1ShortCode,
        companyId: testCompanyId,
        hsn: "21069099",
        gstRateBp: 1200,
        mrpPaise: 5000, // ₹50.00
        packSize: 20,
        packLabel: "Carton",
        reorderLevel: 50,
      },
    });
    product1Id = p1.id;

    const p2 = await prisma.product.create({
      data: {
        name: p2Name,
        shortCode: p2ShortCode,
        companyId: testCompanyId,
        hsn: "21069099",
        gstRateBp: 500,
        mrpPaise: 22000, // ₹220.00
        packSize: 10,
        packLabel: "Box",
        reorderLevel: 25,
      },
    });
    product2Id = p2.id;
  });

  afterAll(async () => {
    // Note: stock_movements are strictly immutable by DB trigger and cannot be deleted.
    // Deactivate test products instead to keep test suites clean.
    await prisma.product.updateMany({
      where: { id: { in: [product1Id, product2Id] } },
      data: { active: false },
    });
  });

  it("should show products with 0 stock as low stock when below reorderLevel", async () => {
    const { items } = await stockService.listStockBalances(UserRole.GODOWN, {
      companyId: testCompanyId,
    });

    const item1 = items.find((i) => i.productId === product1Id);
    expect(item1).toBeDefined();
    expect(item1!.totalQty).toBe(0);
    expect(item1!.reorderLevel).toBe(50);
    expect(item1!.isLowStock).toBe(true);
    expect(item1!.packsCount).toBe(0);
    expect(item1!.looseCount).toBe(0);
  });

  it("should accurately reflect multi-location stock movements and calculate pack breakdown", async () => {
    // Post initial receipt of 100 units to Godown
    await stockService.postMovement({
      type: "PURCHASE_RECEIPT",
      productId: product1Id,
      toLocationId: godownLocId,
      qty: 100,
      idempotencyKey: `view-test-grn-${Date.now()}`,
      referenceType: "PURCHASE",
      referenceId: "GRN-VIEW-01",
      reason: "Initial test goods receipt",
    });

    // Transfer 30 units from Godown to Shop
    await stockService.postMovement({
      type: "TRANSFER",
      productId: product1Id,
      fromLocationId: godownLocId,
      toLocationId: shopLocId,
      qty: 30,
      idempotencyKey: `view-test-xfer-${Date.now()}`,
      referenceType: "TRANSFER",
      referenceId: "TR-VIEW-01",
      reason: "Inter-location shelf replenishment",
    });

    // Carton break 20 units (1 full carton) from Godown to Shop
    await stockService.postMovement({
      type: "CARTON_BREAK",
      productId: product1Id,
      fromLocationId: godownLocId,
      toLocationId: shopLocId,
      qty: 20,
      idempotencyKey: `view-test-break-${Date.now()}`,
      referenceType: "CARTON_BREAK",
      referenceId: "CB-VIEW-01",
      reason: "Carton broken for loose retail counter sales",
    });

    // Verify stock balances view
    const { items } = await stockService.listStockBalances(UserRole.SUPER_ADMIN, {
      companyId: testCompanyId,
    });

    const item1 = items.find((i) => i.productId === product1Id);
    expect(item1).toBeDefined();
    expect(item1!.totalQty).toBe(100); // 100 total
    expect(item1!.isLowStock).toBe(false); // 100 > reorderLevel (50)

    // Check balances array breakdown
    const godownBal = item1!.balances.find((b) => b.locationId === godownLocId);
    const shopBal = item1!.balances.find((b) => b.locationId === shopLocId);

    expect(godownBal?.qty).toBe(50); // 100 - 30 - 20 = 50
    expect(godownBal?.packsCount).toBe(2); // 50 / 20 = 2 cartons
    expect(godownBal?.looseCount).toBe(10); // 50 % 20 = 10 loose pieces

    expect(shopBal?.qty).toBe(50); // 30 + 20 = 50
    expect(shopBal?.packsCount).toBe(2);
    expect(shopBal?.looseCount).toBe(10);
  });

  it("should filter correctly by location, search term, and low stock toggle", async () => {
    // 1. Filter by locationId = shopLocId
    const shopResult = await stockService.listStockBalances(UserRole.SHOP, {
      companyId: testCompanyId,
      locationId: shopLocId,
    });
    const item1Shop = shopResult.items.find((i) => i.productId === product1Id);
    expect(item1Shop?.locationQty).toBe(50);

    // 2. Search by shortCode
    const searchResult = await stockService.listStockBalances(UserRole.GODOWN, {
      search: p1ShortCode,
    });
    expect(searchResult.items.length).toBe(1);
    expect(searchResult.items[0].shortCode).toBe(p1ShortCode);

    // 3. Search by partial product name
    const searchNameResult = await stockService.listStockBalances(UserRole.GODOWN, {
      search: p2Name,
    });
    expect(searchNameResult.items.length).toBe(1);
    expect(searchNameResult.items[0].shortCode).toBe(p2ShortCode);

    // 4. Filter by lowStockOnly = true
    const lowStockResult = await stockService.listStockBalances(UserRole.GODOWN, {
      companyId: testCompanyId,
      lowStockOnly: true,
    });
    // Product 1 has 100 units > reorderLevel (50) -> excluded
    // Product 2 has 0 units <= reorderLevel (25) -> included
    const hasP1 = lowStockResult.items.some((i) => i.productId === product1Id);
    const hasP2 = lowStockResult.items.some((i) => i.productId === product2Id);
    expect(hasP1).toBe(false);
    expect(hasP2).toBe(true);
  });

  it("should return detailed product stock information with full location grid", async () => {
    const details = await stockService.getProductStockDetails(UserRole.ACCOUNTS, product1Id);

    expect(details).not.toBeNull();
    expect(details!.product.shortCode).toBe(p1ShortCode);
    expect(details!.product.mrpPaise).toBe(5000);
    expect(details!.totalQty).toBe(100);
    expect(details!.isLowStock).toBe(false);
    expect(details!.packsCount).toBe(5); // 100 / 20 = 5 full cartons
    expect(details!.looseCount).toBe(0);

    const godownEntry = details!.balances.find((b) => b.locationId === godownLocId);
    expect(godownEntry?.qty).toBe(50);
  });

  it("should return chronological movement ledger in reverse order with complete metadata", async () => {
    const movements = await stockService.getProductMovements(UserRole.GODOWN, product1Id);

    expect(movements.length).toBeGreaterThanOrEqual(3);
    // Chronological order: newest movement first
    expect(movements[0].type).toBe("CARTON_BREAK");
    expect(movements[0].qty).toBe(20);
    expect(movements[0].fromLocationId).toBe(godownLocId);
    expect(movements[0].toLocationId).toBe(shopLocId);
    expect(movements[0].referenceType).toBe("CARTON_BREAK");
    expect(movements[0].referenceId).toBe("CB-VIEW-01");

    expect(movements[1].type).toBe("TRANSFER");
    expect(movements[1].qty).toBe(30);

    expect(movements[2].type).toBe("PURCHASE_RECEIPT");
    expect(movements[2].qty).toBe(100);
    expect(movements[2].fromLocationId).toBeNull();
    expect(movements[2].toLocationId).toBe(godownLocId);
  });

  it("should return high-level stock KPIs", async () => {
    const kpis = await stockService.getStockKPIs(UserRole.SUPER_ADMIN);

    expect(kpis.totalProducts).toBeGreaterThanOrEqual(2);
    expect(kpis.totalQty).toBeGreaterThanOrEqual(100);
    expect(kpis.godownQty).toBeGreaterThanOrEqual(50);
    expect(kpis.shopQty).toBeGreaterThanOrEqual(50);
  });

  it("should enforce RBAC: allow STOCK_VIEW roles and deny unauthorized roles", async () => {
    // Allowed roles
    await expect(
      stockService.listStockBalances(UserRole.SUPER_ADMIN, {})
    ).resolves.toBeDefined();
    await expect(
      stockService.listStockBalances(UserRole.GODOWN, {})
    ).resolves.toBeDefined();
    await expect(
      stockService.listStockBalances(UserRole.SHOP, {})
    ).resolves.toBeDefined();
    await expect(
      stockService.listStockBalances(UserRole.SALESPERSON, {})
    ).resolves.toBeDefined();
    await expect(
      stockService.listStockBalances(UserRole.ACCOUNTS, {})
    ).resolves.toBeDefined();

    // Denied roles
    await expect(
      stockService.listStockBalances(UserRole.DELIVERY, {})
    ).rejects.toThrow(ForbiddenError);

    await expect(
      stockService.listStockBalances(UserRole.CUSTOMER, {})
    ).rejects.toThrow(ForbiddenError);

    await expect(
      stockService.getProductStockDetails(UserRole.DELIVERY, product1Id)
    ).rejects.toThrow(ForbiddenError);

    await expect(
      stockService.getProductMovements(UserRole.DELIVERY, product1Id)
    ).rejects.toThrow(ForbiddenError);

    await expect(
      stockService.getStockKPIs(UserRole.DELIVERY)
    ).rejects.toThrow(ForbiddenError);
  });

  it("supports pagination with limit and offset across products", async () => {
    const page1 = await stockService.listStockBalances(UserRole.GODOWN, {
      limit: 1,
      offset: 0,
    });
    expect(page1.items.length).toBeLessThanOrEqual(1);
    expect(page1.total).toBeGreaterThanOrEqual(2);

    const page2 = await stockService.listStockBalances(UserRole.GODOWN, {
      limit: 1,
      offset: 1,
    });
    expect(page2.items.length).toBeLessThanOrEqual(1);
    expect(page2.total).toBe(page1.total);

    if (page1.items.length > 0 && page2.items.length > 0) {
      expect(page1.items[0].productId).not.toBe(page2.items[0].productId);
    }
  });
});
