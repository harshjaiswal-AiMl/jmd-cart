import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";

describe("Database Triggers and Constraints: Core Stock Ledger", () => {
  let locationId: string;
  let productId: string;

  beforeAll(async () => {
    // Create test location and product
    const location = await prisma.location.create({
      data: {
        name: "Test Godown",
        type: "GODOWN",
      },
    });
    locationId = location.id;

    const product = await prisma.product.create({
      data: {
        name: "Bikaji Bhujia 1kg",
        shortCode: `TEST-BKJ-${Date.now()}`,
        hsn: "21069099",
        gstRateBp: 1200,
        mrpPaise: 25000,
        packSize: 20,
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    // Cleanup will respect foreign keys
    await prisma.$disconnect();
  });

  it("enforces non-negative stock_balances via CHECK constraint", async () => {
    // Valid balance: 10
    await prisma.stockBalance.upsert({
      where: {
        productId_locationId: { productId, locationId },
      },
      create: { productId, locationId, qty: 10 },
      update: { qty: 10 },
    });

    // Attempt negative balance: should throw DB error
    await expect(
      prisma.$executeRaw`
        INSERT INTO "stock_balances" ("product_id", "location_id", "qty", "updated_at")
        VALUES (${productId}, ${locationId}, -5, NOW())
        ON CONFLICT ("product_id", "location_id")
        DO UPDATE SET "qty" = -5;
      `
    ).rejects.toThrow();
  });

  it("blocks UPDATE on stock_movements via PostgreSQL trigger", async () => {
    const movement = await prisma.stockMovement.create({
      data: {
        type: "PURCHASE_RECEIPT",
        productId,
        toLocationId: locationId,
        qty: 50,
        idempotencyKey: `test-idem-${Date.now()}-1`,
        reason: "Initial test receipt",
      },
    });

    // Attempt direct UPDATE on stock_movements
    await expect(
      prisma.$executeRaw`
        UPDATE "stock_movements"
        SET "qty" = 999
        WHERE "id" = ${movement.id};
      `
    ).rejects.toThrow(/Stock movements are immutable/);
  });

  it("blocks DELETE on stock_movements via PostgreSQL trigger", async () => {
    const movement = await prisma.stockMovement.create({
      data: {
        type: "PURCHASE_RECEIPT",
        productId,
        toLocationId: locationId,
        qty: 25,
        idempotencyKey: `test-idem-${Date.now()}-2`,
        reason: "Second test receipt",
      },
    });

    // Attempt direct DELETE on stock_movements
    await expect(
      prisma.$executeRaw`
        DELETE FROM "stock_movements"
        WHERE "id" = ${movement.id};
      `
    ).rejects.toThrow(/Stock movements are immutable/);
  });
});
