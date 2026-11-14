import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { stockLedgerService } from "@/modules/stock/stock-ledger.service";
import { UserRole, LocationType, MovementType } from "@prisma/client";

describe("R2: Product-wise Movement Ledger in Godown Manager App", () => {
  it("computes accurate running balance, in/out totals, and matches current stock check", async () => {
    // 1. Get or create a test product
    const company = await prisma.company.findFirst() || await prisma.company.create({
      data: { name: "Test FMCG Co" },
    });
    const product = await prisma.product.create({
      data: {
        name: `Ledger Test Biscuit ${Date.now()}`,
        shortCode: `LTB-${Date.now().toString().slice(-4)}`,
        companyId: company.id,
        mrpPaise: 5000,
        priceAPaise: 4500,
        packSize: 20,
        packLabel: "Carton",
        active: true,
      },
    });

    const godown = await prisma.location.findFirst({
      where: { type: LocationType.GODOWN, active: true },
    });
    const shop = await prisma.location.findFirst({
      where: { type: LocationType.SHOP, active: true },
    });
    expect(godown).toBeDefined();
    expect(shop).toBeDefined();

    // 2. Insert mock movements across different types
    // Movement 1: Purchase receipt of 100 pcs (5 cartons) to Godown
    await prisma.stockMovement.create({
      data: {
        type: MovementType.PURCHASE_RECEIPT,
        productId: product.id,
        toLocationId: godown!.id,
        qty: 100,
        referenceType: "GRN",
        referenceId: "GRN-001",
        reason: "Initial supplier receipt",
        idempotencyKey: `test_r2_mov1_${Date.now()}`,
        createdAt: new Date("2026-11-01T08:00:00Z"),
      },
    });

    // Movement 2: Transfer 40 pcs (2 cartons) from Godown to Shop
    await prisma.stockMovement.create({
      data: {
        type: MovementType.TRANSFER,
        productId: product.id,
        fromLocationId: godown!.id,
        toLocationId: shop!.id,
        qty: 40,
        referenceType: "TRANSFER",
        referenceId: "TR-001",
        reason: "Replenish retail counter",
        idempotencyKey: `test_r2_mov2_${Date.now()}`,
        createdAt: new Date("2026-11-02T10:00:00Z"),
      },
    });

    // Movement 3: Damage of 2 pcs in Godown
    await prisma.stockMovement.create({
      data: {
        type: MovementType.DAMAGE,
        productId: product.id,
        fromLocationId: godown!.id,
        qty: 2,
        referenceType: "DAMAGE",
        referenceId: "DMG-001",
        reason: "Rats damaged packaging",
        idempotencyKey: `test_r2_mov3_${Date.now()}`,
        createdAt: new Date("2026-11-03T12:00:00Z"),
      },
    });

    // Set Godown stock balance to 58 (100 - 40 - 2)
    await prisma.stockBalance.upsert({
      where: {
        productId_locationId: { productId: product.id, locationId: godown!.id },
      },
      create: {
        productId: product.id,
        locationId: godown!.id,
        qty: 58,
      },
      update: {
        qty: 58,
      },
    });

    // 3. Query ledger for Godown
    const report = await stockLedgerService.getProductLedgerReport(UserRole.GODOWN, {
      productId: product.id,
      locationId: godown!.id,
    });

    expect(report.product.id).toBe(product.id);
    expect(report.summary.totalIn).toBe(100);
    expect(report.summary.totalOut).toBe(42);
    expect(report.summary.closingBalance).toBe(58);
    expect(report.summary.currentStock).toBe(58);
    expect(report.summary.matchesCurrentStock).toBe(true);
    expect(report.summary.difference).toBe(0);

    // Verify rows and running balance
    expect(report.rows.length).toBe(3);
    // Row 1 (oldest to newest): Purchase Receipt +100 -> Running Bal 100
    expect(report.rows[0].inQty).toBe(100);
    expect(report.rows[0].outQty).toBe(0);
    expect(report.rows[0].runningBalance).toBe(100);
    expect(report.rows[0].balanceCartons).toBe(5);
    expect(report.rows[0].balanceLoose).toBe(0);

    // Row 2: Transfer Out 40 -> Running Bal 60
    expect(report.rows[1].inQty).toBe(0);
    expect(report.rows[1].outQty).toBe(40);
    expect(report.rows[1].runningBalance).toBe(60);
    expect(report.rows[1].balanceCartons).toBe(3);
    expect(report.rows[1].balanceLoose).toBe(0);

    // Row 3: Damage Out 2 -> Running Bal 58
    expect(report.rows[2].inQty).toBe(0);
    expect(report.rows[2].outQty).toBe(2);
    expect(report.rows[2].runningBalance).toBe(58);
    expect(report.rows[2].balanceCartons).toBe(2);
    expect(report.rows[2].balanceLoose).toBe(18);
  });

  it("detects and flags stock balance mismatch in red when physical count deviates", async () => {
    const company = await prisma.company.findFirst() || await prisma.company.create({
      data: { name: "Test FMCG Co" },
    });
    const product = await prisma.product.create({
      data: {
        name: `Mismatch Test Product ${Date.now()}`,
        shortCode: `MTP-${Date.now().toString().slice(-4)}`,
        companyId: company.id,
        mrpPaise: 1000,
        packSize: 10,
        active: true,
      },
    });

    const godown = await prisma.location.findFirst({
      where: { type: LocationType.GODOWN, active: true },
    });

    // Purchase 50 pcs
    await prisma.stockMovement.create({
      data: {
        type: MovementType.PURCHASE_RECEIPT,
        productId: product.id,
        toLocationId: godown!.id,
        qty: 50,
        referenceType: "GRN",
        idempotencyKey: `test_r2_mismatch_${Date.now()}`,
      },
    });

    // Deliberately set stock balance to 45 (e.g. unrecorded shrinkage of 5 pcs)
    await prisma.stockBalance.upsert({
      where: {
        productId_locationId: { productId: product.id, locationId: godown!.id },
      },
      create: {
        productId: product.id,
        locationId: godown!.id,
        qty: 45,
      },
      update: {
        qty: 45,
      },
    });

    const report = await stockLedgerService.getProductLedgerReport(UserRole.GODOWN, {
      productId: product.id,
      locationId: godown!.id,
    });

    expect(report.summary.closingBalance).toBe(50);
    expect(report.summary.currentStock).toBe(45);
    expect(report.summary.matchesCurrentStock).toBe(false);
    expect(report.summary.difference).toBe(5); // 50 calculated vs 45 actual
  });

  it("supports date range filtering with opening and closing balances", async () => {
    const company = await prisma.company.findFirst() || await prisma.company.create({
      data: { name: "Test FMCG Co" },
    });
    const product = await prisma.product.create({
      data: {
        name: `Date Filter Product ${Date.now()}`,
        shortCode: `DFP-${Date.now().toString().slice(-4)}`,
        companyId: company.id,
        mrpPaise: 1000,
        packSize: 10,
        active: true,
      },
    });

    const godown = await prisma.location.findFirst({
      where: { type: LocationType.GODOWN, active: true },
    });

    // Movement on Nov 1: +50
    await prisma.stockMovement.create({
      data: {
        type: MovementType.PURCHASE_RECEIPT,
        productId: product.id,
        toLocationId: godown!.id,
        qty: 50,
        idempotencyKey: `test_r2_d1_${Date.now()}`,
        createdAt: new Date("2026-11-01T09:00:00Z"),
      },
    });

    // Movement on Nov 10: +30
    await prisma.stockMovement.create({
      data: {
        type: MovementType.PURCHASE_RECEIPT,
        productId: product.id,
        toLocationId: godown!.id,
        qty: 30,
        idempotencyKey: `test_r2_d2_${Date.now()}`,
        createdAt: new Date("2026-11-10T09:00:00Z"),
      },
    });

    // Movement on Nov 12: -15
    await prisma.stockMovement.create({
      data: {
        type: MovementType.TRANSFER,
        productId: product.id,
        fromLocationId: godown!.id,
        qty: 15,
        idempotencyKey: `test_r2_d3_${Date.now()}`,
        createdAt: new Date("2026-11-12T09:00:00Z"),
      },
    });

    // Query for range Nov 05 to Nov 15:
    // Opening balance before Nov 05 should be 50!
    // In: 30, Out: 15. Closing: 50 + 30 - 15 = 65.
    const report = await stockLedgerService.getProductLedgerReport(UserRole.GODOWN, {
      productId: product.id,
      locationId: godown!.id,
      startDate: new Date("2026-11-05T00:00:00Z"),
      endDate: new Date("2026-11-15T23:59:59Z"),
    });

    expect(report.summary.openingBalance).toBe(50);
    expect(report.summary.totalIn).toBe(30);
    expect(report.summary.totalOut).toBe(15);
    expect(report.summary.closingBalance).toBe(65);
    expect(report.rows.length).toBe(2);
  });

  it("enforces VIEW_STOCK permission", async () => {
    // DELIVERY role does not have VIEW_STOCK
    await expect(
      stockLedgerService.getProductLedgerReport(UserRole.DELIVERY, {
        productId: "any-prod",
      })
    ).rejects.toThrow(/permission|forbidden/i);
  });
});
