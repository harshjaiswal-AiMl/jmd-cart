import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { stockService } from "@/modules/stock/stock.service";
import { InsufficientStockError } from "@/modules/stock/stock.types";

describe("Stock Ledger: Concurrency & Race Condition Tests", () => {
  let shopId: string;
  let godownId: string;

  beforeAll(async () => {
    const shop = await prisma.location.create({
      data: { name: "Concurrency Shop", type: "SHOP" },
    });
    shopId = shop.id;

    const godown = await prisma.location.create({
      data: { name: "Concurrency Godown", type: "GODOWN" },
    });
    godownId = godown.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("handles 2 parallel sales competing for the last 1 piece: exactly one succeeds, balance is 0 and never -1", async () => {
    // 1. Create a product with exactly 1 unit of initial stock
    const product = await prisma.product.create({
      data: {
        name: "Sole Unit Product",
        shortCode: `TEST-SOLE-${Date.now()}`,
        hsn: "21069099",
        gstRateBp: 1200,
        mrpPaise: 10000,
        packSize: 1,
      },
    });

    // Seed exactly 1 piece
    await stockService.postMovement({
      type: "PURCHASE_RECEIPT",
      productId: product.id,
      toLocationId: shopId,
      qty: 1,
      idempotencyKey: `sole-init-${Date.now()}`,
    });

    const initialBal = await stockService.getBalance(product.id, shopId);
    expect(initialBal).toBe(1);

    // 2. Launch two concurrent parallel sales requests for 1 piece each
    const req1 = stockService.postMovement({
      type: "SALE",
      productId: product.id,
      fromLocationId: shopId,
      qty: 1,
      idempotencyKey: `race-1-${Date.now()}`,
      referenceId: "BILL-A",
    });

    const req2 = stockService.postMovement({
      type: "SALE",
      productId: product.id,
      fromLocationId: shopId,
      qty: 1,
      idempotencyKey: `race-2-${Date.now()}`,
      referenceId: "BILL-B",
    });

    const results = await Promise.allSettled([req1, req2]);

    // 3. Verify exactly one succeeded and exactly one failed
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    // 4. Verify the rejected error is InsufficientStockError
    const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
    expect(rejectionReason).toBeInstanceOf(InsufficientStockError);

    // 5. Verify the balance is strictly 0 and never negative
    const finalBalance = await stockService.getBalance(product.id, shopId);
    expect(finalBalance).toBe(0);

    // 6. Verify total movements recorded for this product: exactly 1 PURCHASE_RECEIPT + 1 SALE
    const movements = await stockService.getMovements(product.id);
    expect(movements).toHaveLength(2);
    expect(movements[0].type).toBe("SALE");
    expect(movements[1].type).toBe("PURCHASE_RECEIPT");
  });

  it("handles 5 concurrent transfers from Godown with limited stock (stock = 10, each demands 5)", async () => {
    // 10 units available. Each transfer requests 5 units.
    // Exactly 2 must succeed (consuming 10 units), and 3 must fail.
    const product = await prisma.product.create({
      data: {
        name: "Concurrent Batch Product",
        shortCode: `TEST-BATCH-${Date.now()}`,
        hsn: "21069099",
        gstRateBp: 1200,
        mrpPaise: 5000,
        packSize: 1,
      },
    });

    await stockService.postMovement({
      type: "PURCHASE_RECEIPT",
      productId: product.id,
      toLocationId: godownId,
      qty: 10,
      idempotencyKey: `batch-init-${Date.now()}`,
    });

    expect(await stockService.getBalance(product.id, godownId)).toBe(10);
    expect(await stockService.getBalance(product.id, shopId)).toBe(0);

    // Launch 5 parallel transfers of 5 units each
    const transferRequests = Array.from({ length: 5 }, (_, i) =>
      stockService.postMovement({
        type: "TRANSFER",
        productId: product.id,
        fromLocationId: godownId,
        toLocationId: shopId,
        qty: 5,
        idempotencyKey: `transfer-batch-${Date.now()}-${i}`,
      })
    );

    const batchResults = await Promise.allSettled(transferRequests);

    const successful = batchResults.filter((r) => r.status === "fulfilled");
    const failed = batchResults.filter((r) => r.status === "rejected");

    // Exactly 2 can succeed (2 * 5 = 10)
    expect(successful.length).toBe(2);
    // 3 must fail
    expect(failed.length).toBe(3);

    // Godown balance must be exactly 0, Shop balance must be exactly 10
    expect(await stockService.getBalance(product.id, godownId)).toBe(0);
    expect(await stockService.getBalance(product.id, shopId)).toBe(10);
  });
});
