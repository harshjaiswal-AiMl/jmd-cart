import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { cartService } from "@/modules/cart/cart.service";
import { pricingService } from "@/modules/pricing/pricing.service";
import { SlabScope, BuyerTier } from "@/modules/pricing/pricing.types";
import { UserRole } from "@prisma/client";

describe("Task 3.3 Integration Tests: Store Cart with Dynamic Slab Pricing & Buyer Tagging", () => {
  let testUserId: string;
  let product1Id: string;
  let product2Id: string;

  beforeAll(async () => {
    // 1. Find or create a test buyer user
    let user = await prisma.user.findFirst({
      where: { role: UserRole.CUSTOMER },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: "Test Cart Buyer",
          phone: "9900012345",
          passwordHash: "hash123",
          role: UserRole.CUSTOMER,
        },
      });
    }
    testUserId = user.id;

    // 2. Create products for cart test
    const p1 = await prisma.product.create({
      data: {
        name: `Cart Biscuit Product ${Date.now()}`,
        shortCode: `CART-B-${Date.now()}`,
        hsn: "19053100",
        gstRateBp: 1800, // 18% GST
        mrpPaise: 2000, // ₹20.00
        packSize: 50,
        packLabel: "Carton",
        active: true,
      },
    });
    product1Id = p1.id;

    const p2 = await prisma.product.create({
      data: {
        name: `Cart Oil Product ${Date.now()}`,
        shortCode: `CART-O-${Date.now()}`,
        hsn: "15141900",
        gstRateBp: 500, // 5% GST
        mrpPaise: 15000, // ₹150.00
        packSize: 12,
        packLabel: "Carton",
        active: true,
      },
    });
    product2Id = p2.id;

    // 3. Create price slabs for product 1
    const admin = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.SUPER_ADMIN },
    });

    // 10+ pcs -> 10% discount (RETAILER tier)
    await pricingService.createSlab(
      UserRole.SUPER_ADMIN,
      {
        scope: SlabScope.PRODUCT,
        targetId: product1Id,
        minQty: 10,
        discountBp: 1000,
        tier: BuyerTier.RETAILER,
      },
      admin.id
    );

    // 50+ pcs (1 carton) -> 20% discount (WHOLESALER tier)
    await pricingService.createSlab(
      UserRole.SUPER_ADMIN,
      {
        scope: SlabScope.PRODUCT,
        targetId: product1Id,
        minQty: 50,
        discountBp: 2000,
        tier: BuyerTier.WHOLESALER,
      },
      admin.id
    );
  });

  it("adds items to cart and starts at CUSTOMER buyer tier when below minQty", async () => {
    // Clear any existing cart items
    await cartService.clearCart(testUserId);

    // Add 2 pieces of product 1
    await cartService.addToCart(testUserId, product1Id, 2);

    const summary = await cartService.getCartSummary(testUserId);
    expect(summary.itemsCount).toBe(1);
    expect(summary.totalPieces).toBe(2);
    expect(summary.buyerTag).toBe(BuyerTier.CUSTOMER);

    // Rate: Full MRP ₹20.00 * 2 = ₹40.00 (4000 paise)
    expect(summary.subtotalPaise).toBe(4000);
    expect(summary.lineDiscountPaise).toBe(0);
    expect(summary.totalPaise).toBe(4000);
  });

  it("updates quantity to 10 pcs and automatically upgrades order buyerTag to RETAILER with slab discount", async () => {
    // Update quantity to 10
    await cartService.updateQuantity(testUserId, product1Id, 10);

    const summary = await cartService.getCartSummary(testUserId);
    expect(summary.totalPieces).toBe(10);
    expect(summary.buyerTag).toBe(BuyerTier.RETAILER);

    // MRP: 10 * ₹20.00 = ₹200.00 (20000 paise)
    expect(summary.subtotalPaise).toBe(20000);

    // Slab rate: 10% off -> ₹18.00 per unit (1800 paise)
    // Line total: 10 * 1800 = 18000 paise (₹180.00)
    // Line discount: 2000 paise (₹20.00)
    expect(summary.lineDiscountPaise).toBe(2000);
    expect(summary.totalPaise).toBe(18000);
  });

  it("updates quantity to 50 pcs (1 carton) and automatically upgrades order buyerTag to WHOLESALER", async () => {
    // Update quantity to 50 pcs
    await cartService.updateQuantity(testUserId, product1Id, 50);

    const summary = await cartService.getCartSummary(testUserId);
    expect(summary.totalPieces).toBe(50);
    expect(summary.buyerTag).toBe(BuyerTier.WHOLESALER);

    // MRP: 50 * ₹20.00 = ₹1000.00 (100000 paise)
    expect(summary.subtotalPaise).toBe(100000);

    // Slab rate: 20% off -> ₹16.00 per unit (1600 paise)
    // Line total: 50 * 1600 = 80000 paise (₹800.00)
    // Line discount: 20000 paise (₹200.00)
    expect(summary.lineDiscountPaise).toBe(20000);
    expect(summary.totalPaise).toBe(80000);

    // Verify carton conversion in line
    const line = summary.lines[0];
    expect(line.cartonsCount).toBe(1);
    expect(line.looseCount).toBe(0);
  });

  it("supports multiple items, computes overall order highest buyer tier, and computes combined GST", async () => {
    // Add 2 bottles of oil (product 2) @ ₹150.00 each
    await cartService.addToCart(testUserId, product2Id, 2);

    const summary = await cartService.getCartSummary(testUserId);
    expect(summary.itemsCount).toBe(2);
    expect(summary.totalPieces).toBe(52); // 50 biscuits + 2 oil

    // Order tag is still WHOLESALER because product 1 is at WHOLESALER tier
    expect(summary.buyerTag).toBe(BuyerTier.WHOLESALER);

    // Product 1: ₹800.00 (80000 paise)
    // Product 2: 2 * ₹150.00 = ₹300.00 (30000 paise)
    // Grand Total: ₹1100.00 (110000 paise)
    expect(summary.totalPaise).toBe(110000);
    expect(summary.totalTaxPaise).toBeGreaterThan(0);
    expect(summary.taxablePaise + summary.totalTaxPaise + summary.roundOffPaise).toBe(summary.totalPaise);
  });

  it("removes items and clears cart correctly", async () => {
    await cartService.removeFromCart(testUserId, product2Id);

    let summary = await cartService.getCartSummary(testUserId);
    expect(summary.itemsCount).toBe(1);

    await cartService.clearCart(testUserId);
    summary = await cartService.getCartSummary(testUserId);
    expect(summary.itemsCount).toBe(0);
    expect(summary.totalPieces).toBe(0);
    expect(summary.totalPaise).toBe(0);
  });
});
