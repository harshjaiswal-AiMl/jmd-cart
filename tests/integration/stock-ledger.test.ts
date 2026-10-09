import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { stockService } from "@/modules/stock/stock.service";
import { InsufficientStockError, InvalidMovementError } from "@/modules/stock/stock.types";
import { verifyStockLedgerConsistency } from "@/modules/stock/stock.consistency";

describe("Stock Ledger Service: Integration Tests", () => {
  let godownId: string;
  let shopId: string;
  let vanId: string;
  let productId: string;
  const packSize = 24;

  beforeAll(async () => {
    // Create locations
    const godown = await prisma.location.create({
      data: { name: "Main Godown", type: "GODOWN" },
    });
    godownId = godown.id;

    const shop = await prisma.location.create({
      data: { name: "Main Shop", type: "SHOP" },
    });
    shopId = shop.id;

    const van = await prisma.location.create({
      data: { name: "Van 1", type: "VAN" },
    });
    vanId = van.id;

    // Create product
    const product = await prisma.product.create({
      data: {
        name: "MDH Deggi Mirch 100g",
        shortCode: `TEST-MDH-${Date.now()}`,
        hsn: "09042010",
        gstRateBp: 500,
        mrpPaise: 9500,
        packSize,
        packLabel: "Carton",
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("processes PURCHASE_RECEIPT into Godown", async () => {
    const res = await stockService.postMovement({
      type: "PURCHASE_RECEIPT",
      productId,
      toLocationId: godownId,
      qty: 240, // 10 cartons
      idempotencyKey: `receipt-${Date.now()}`,
      reason: "Initial GRN from MDH",
    });

    expect(res.qty).toBe(240);
    const balance = await stockService.getBalance(productId, godownId);
    expect(balance).toBe(240);
  });

  it("processes TRANSFER from Godown to Shop", async () => {
    await stockService.postMovement({
      type: "TRANSFER",
      productId,
      fromLocationId: godownId,
      toLocationId: shopId,
      qty: 48,
      idempotencyKey: `transfer-${Date.now()}`,
      reason: "Replenish shop stock",
    });

    const godownBal = await stockService.getBalance(productId, godownId);
    const shopBal = await stockService.getBalance(productId, shopId);
    expect(godownBal).toBe(192); // 240 - 48
    expect(shopBal).toBe(48);
  });

  it("processes CARTON_BREAK moving cartons x packSize from Godown to Shop", async () => {
    const cartonsToBreak = 2;
    const pieces = cartonsToBreak * packSize; // 48 pieces

    await stockService.postMovement({
      type: "CARTON_BREAK",
      productId,
      fromLocationId: godownId,
      toLocationId: shopId,
      qty: pieces,
      meta: { cartons: cartonsToBreak, packSize },
      idempotencyKey: `carton-break-${Date.now()}`,
      reason: "Break 2 cartons for retail loose sale",
    });

    const godownBal = await stockService.getBalance(productId, godownId);
    const shopBal = await stockService.getBalance(productId, shopId);
    expect(godownBal).toBe(144); // 192 - 48
    expect(shopBal).toBe(96); // 48 + 48
  });

  it("processes VAN_ISSUE and VAN_RETURN", async () => {
    // Issue 20 pieces to van
    await stockService.postMovement({
      type: "VAN_ISSUE",
      productId,
      fromLocationId: godownId,
      toLocationId: vanId,
      qty: 20,
      idempotencyKey: `van-issue-${Date.now()}`,
    });

    expect(await stockService.getBalance(productId, godownId)).toBe(124);
    expect(await stockService.getBalance(productId, vanId)).toBe(20);

    // Return 5 unsold pieces from van back to godown
    await stockService.postMovement({
      type: "VAN_RETURN",
      productId,
      fromLocationId: vanId,
      toLocationId: godownId,
      qty: 5,
      idempotencyKey: `van-return-${Date.now()}`,
    });

    expect(await stockService.getBalance(productId, godownId)).toBe(129);
    expect(await stockService.getBalance(productId, vanId)).toBe(15);
  });

  it("processes SALE and SALE_CANCEL", async () => {
    // Sale of 10 pieces from shop
    await stockService.postMovement({
      type: "SALE",
      productId,
      fromLocationId: shopId,
      qty: 10,
      idempotencyKey: `sale-${Date.now()}`,
      referenceType: "INVOICE",
      referenceId: "INV/26-27/000001",
    });

    expect(await stockService.getBalance(productId, shopId)).toBe(86); // 96 - 10

    // Cancellation: return 10 pieces back to shop
    await stockService.postMovement({
      type: "SALE_CANCEL",
      productId,
      toLocationId: shopId,
      qty: 10,
      idempotencyKey: `sale-cancel-${Date.now()}`,
      referenceType: "CREDIT_NOTE",
      referenceId: "CN/26-27/000001",
    });

    expect(await stockService.getBalance(productId, shopId)).toBe(96);
  });

  it("processes DAMAGE, RETURN_TO_COMPANY and ADJUSTMENT", async () => {
    // Damage of 2 pieces at shop
    await stockService.postMovement({
      type: "DAMAGE",
      productId,
      fromLocationId: shopId,
      qty: 2,
      idempotencyKey: `damage-${Date.now()}`,
      reason: "Water damage",
    });
    expect(await stockService.getBalance(productId, shopId)).toBe(94);

    // Return 4 pieces to company from godown
    await stockService.postMovement({
      type: "RETURN_TO_COMPANY",
      productId,
      fromLocationId: godownId,
      qty: 4,
      idempotencyKey: `ret-comp-${Date.now()}`,
      reason: "Factory recall",
    });
    expect(await stockService.getBalance(productId, godownId)).toBe(125);

    // Downward adjustment of 1 piece at shop
    await stockService.postMovement({
      type: "ADJUSTMENT",
      productId,
      fromLocationId: shopId,
      qty: 1,
      idempotencyKey: `adj-down-${Date.now()}`,
      reason: "Audit correction - shortage",
    });
    expect(await stockService.getBalance(productId, shopId)).toBe(93);

    // Upward adjustment of 3 pieces at godown
    await stockService.postMovement({
      type: "ADJUSTMENT",
      productId,
      toLocationId: godownId,
      qty: 3,
      idempotencyKey: `adj-up-${Date.now()}`,
      reason: "Audit correction - excess",
    });
    expect(await stockService.getBalance(productId, godownId)).toBe(128);
  });

  it("rejects movements causing negative stock with InsufficientStockError and leaves balance unchanged", async () => {
    const shopBalBefore = await stockService.getBalance(productId, shopId); // 93
    const excessQty = shopBalBefore + 50; // 143

    await expect(
      stockService.postMovement({
        type: "SALE",
        productId,
        fromLocationId: shopId,
        qty: excessQty,
        idempotencyKey: `excess-sale-${Date.now()}`,
      })
    ).rejects.toThrow(InsufficientStockError);

    // Balance must be unchanged
    const shopBalAfter = await stockService.getBalance(productId, shopId);
    expect(shopBalAfter).toBe(shopBalBefore);
  });

  it("rejects invalid movement inputs (non-positive qty, float, same locations)", async () => {
    await expect(
      stockService.postMovement({
        type: "SALE",
        productId,
        fromLocationId: shopId,
        qty: 0,
        idempotencyKey: `zero-qty-${Date.now()}`,
      })
    ).rejects.toThrow(InvalidMovementError);

    await expect(
      stockService.postMovement({
        type: "SALE",
        productId,
        fromLocationId: shopId,
        qty: 1.5,
        idempotencyKey: `float-qty-${Date.now()}`,
      })
    ).rejects.toThrow(InvalidMovementError);

    await expect(
      stockService.postMovement({
        type: "TRANSFER",
        productId,
        fromLocationId: shopId,
        toLocationId: shopId,
        qty: 5,
        idempotencyKey: `same-loc-${Date.now()}`,
      })
    ).rejects.toThrow(InvalidMovementError);
  });

  it("handles idempotent replays safely without double posting balance changes", async () => {
    const key = `replay-test-key-${Date.now()}`;
    const initialShopBal = await stockService.getBalance(productId, shopId);

    // First post
    const firstRes = await stockService.postMovement({
      type: "SALE",
      productId,
      fromLocationId: shopId,
      qty: 3,
      idempotencyKey: key,
    });
    expect(firstRes.isReplay).toBeFalsy();
    expect(await stockService.getBalance(productId, shopId)).toBe(initialShopBal - 3);

    // Replay with exact same idempotency key
    const replayRes = await stockService.postMovement({
      type: "SALE",
      productId,
      fromLocationId: shopId,
      qty: 3,
      idempotencyKey: key,
    });
    expect(replayRes.isReplay).toBe(true);
    expect(replayRes.id).toBe(firstRes.id);

    // Crucial: balance must NOT be deducted again
    expect(await stockService.getBalance(productId, shopId)).toBe(initialShopBal - 3);
  });

  it("passes nightly consistency check: balance == sum(inflows) - sum(outflows)", async () => {
    const audit = await verifyStockLedgerConsistency(productId);
    expect(audit.isConsistent).toBe(true);
    expect(audit.discrepancies).toHaveLength(0);
  });
});
