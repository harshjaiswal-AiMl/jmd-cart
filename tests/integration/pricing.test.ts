import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { pricingService } from "@/modules/pricing/pricing.service";
import {
  SlabScope,
  BuyerTier,
} from "@/modules/pricing/pricing.types";
import { UserRole } from "@prisma/client";
import { ForbiddenError } from "@/modules/auth/permissions";

describe("Task 1.10: Pricing Engine Integration Tests", () => {
  const runId = Date.now().toString().slice(-6);
  let testCompanyId: string;
  let testProduct1Id: string;
  let testProduct2Id: string;

  beforeAll(async () => {
    // 1. Create test company
    const comp = await prisma.company.create({
      data: {
        name: `Pricing Test Company ${runId}`,
      },
    });
    testCompanyId = comp.id;

    // 2. Create test products
    const p1 = await prisma.product.create({
      data: {
        name: `Pricing Item One ${runId}`,
        shortCode: `PRC1_${runId}`,
        companyId: testCompanyId,
        hsn: "21069099",
        gstRateBp: 1200, // 12% GST
        mrpPaise: 10000, // ₹100.00
        packSize: 10,
        reorderLevel: 20,
      },
    });
    testProduct1Id = p1.id;

    const p2 = await prisma.product.create({
      data: {
        name: `Pricing Item Two ${runId}`,
        shortCode: `PRC2_${runId}`,
        companyId: testCompanyId,
        hsn: "09042010",
        gstRateBp: 500, // 5% GST
        mrpPaise: 5000, // ₹50.00
        packSize: 24,
        reorderLevel: 10,
      },
    });
    testProduct2Id = p2.id;
  });

  afterAll(async () => {
    // Cleanup products and company
    await prisma.product.updateMany({
      where: { id: { in: [testProduct1Id, testProduct2Id] } },
      data: { active: false },
    });
    await prisma.company.deleteMany({
      where: { id: testCompanyId },
    });
  });

  it("should create and persist a new price slab in settings with Super Admin role", async () => {
    const newSlab = await pricingService.createSlab(UserRole.SUPER_ADMIN, {
      scope: SlabScope.COMPANY,
      targetId: testCompanyId,
      targetName: `Pricing Test Company ${runId}`,
      minQty: 10,
      discountBp: 1000, // 10%
      tier: BuyerTier.RETAILER,
    });

    expect(newSlab.id).toBeDefined();
    expect(newSlab.discountBp).toBe(1000);

    const slabs = await pricingService.getSlabs();
    const found = slabs.find((s) => s.id === newSlab.id);
    expect(found).toBeDefined();
    expect(found?.targetId).toBe(testCompanyId);
  });

  it("should reject slab creation for non-admin roles", async () => {
    await expect(
      pricingService.createSlab(UserRole.SHOP, {
        scope: SlabScope.GLOBAL,
        targetId: null,
        minQty: 10,
        discountBp: 500,
        tier: BuyerTier.RETAILER,
      })
    ).rejects.toThrow(ForbiddenError);

    await expect(
      pricingService.createSlab(UserRole.GODOWN, {
        scope: SlabScope.GLOBAL,
        targetId: null,
        minQty: 10,
        discountBp: 500,
        tier: BuyerTier.RETAILER,
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("should calculate end-to-end order pricing with dynamic slabs, taxes, and buyer tagging", async () => {
    // Product 1: 15 pieces (satisfies Company slab minQty 10 -> 10% discount)
    // MRP ₹100.00 x 15 = ₹1,500.00 subtotal.
    // 10% slab discount -> unit price ₹90.00 (9000 paise). Line total = ₹1,350.00 (135000 paise).
    // Product 2: 2 pieces (below any slab -> 0% discount, ₹50.00 x 2 = ₹100.00)
    const result = await pricingService.calculateOrderPricing({
      items: [
        { productId: testProduct1Id, qty: 15 },
        { productId: testProduct2Id, qty: 2 },
      ],
      orderDiscountBp: 0,
      userRole: UserRole.SHOP,
    });

    expect(result.lines.length).toBe(2);

    const line1 = result.lines.find((l) => l.productId === testProduct1Id);
    expect(line1).toBeDefined();
    expect(line1!.slabDiscountBp).toBe(1000); // 10%
    expect(line1!.unitPricePaise).toBe(9000); // ₹90.00
    expect(line1!.lineTotalPaise).toBe(135000); // ₹1,350.00
    expect(line1!.tier).toBe(BuyerTier.RETAILER);

    const line2 = result.lines.find((l) => l.productId === testProduct2Id);
    expect(line2).toBeDefined();
    expect(line2!.slabDiscountBp).toBe(0);
    expect(line2!.unitPricePaise).toBe(5000);
    expect(line2!.lineTotalPaise).toBe(10000);
    expect(line2!.tier).toBe(BuyerTier.CUSTOMER);

    // Auto Buyer Tag = Highest among lines -> RETAILER
    expect(result.buyerTag).toBe(BuyerTier.RETAILER);

    // Subtotal = (100 * 15) + (50 * 2) = 160000 paise (₹1,600.00)
    expect(result.subtotalPaise).toBe(160000);
    // Line discount = 15000 paise (₹150.00)
    expect(result.lineDiscountPaise).toBe(15000);

    // Grand total = 135000 + 10000 = 145000 paise (₹1,450.00)
    expect(result.totalPaise).toBe(145000);
    expect(result.requiresDiscountApproval).toBe(false);
  });

  it("should enforce role discount limit and flag approval requirement when exceeded", async () => {
    // In seed data: SHOP role limit is 500 bp (5%)
    // Cashier enters 800 bp (8%) order discount
    const resultOverLimit = await pricingService.calculateOrderPricing({
      items: [{ productId: testProduct1Id, qty: 1 }],
      orderDiscountBp: 800, // 8% > 5% limit
      userRole: UserRole.SHOP,
    });

    expect(resultOverLimit.requiresDiscountApproval).toBe(true);
    expect(resultOverLimit.discountApprovalReason).toContain("exceeds role limit");

    // Cashier enters 400 bp (4%) order discount -> within 5% limit
    const resultWithinLimit = await pricingService.calculateOrderPricing({
      items: [{ productId: testProduct1Id, qty: 1 }],
      orderDiscountBp: 400, // 4% <= 5% limit
      userRole: UserRole.SHOP,
    });

    expect(resultWithinLimit.requiresDiscountApproval).toBe(false);

    // Super Admin enters 1500 bp (15%) -> never requires approval
    const resultAdmin = await pricingService.calculateOrderPricing({
      items: [{ productId: testProduct1Id, qty: 1 }],
      orderDiscountBp: 1500,
      userRole: UserRole.SUPER_ADMIN,
    });

    expect(resultAdmin.requiresDiscountApproval).toBe(false);
  });
});
