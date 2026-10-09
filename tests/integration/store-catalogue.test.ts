import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { storeService } from "@/modules/store/store.service";
import { pricingService } from "@/modules/pricing/pricing.service";
import { SlabScope, BuyerTier } from "@/modules/pricing/pricing.types";
import { UserRole } from "@prisma/client";

describe("Task 3.2 Integration Tests: Storefront Catalogue, Search & Dynamic Slab Product Page", () => {
  let testCompanyId: string;
  let testCategoryId: string;
  let testProduct1Id: string;
  let testProduct2Id: string;

  beforeAll(async () => {
    // 1. Create test Brand / Company
    const company = await prisma.company.create({
      data: {
        name: `Test Brand Storefront ${Date.now()}`,
        active: true,
      },
    });
    testCompanyId = company.id;

    // 2. Create test Category
    const category = await prisma.category.create({
      data: {
        name: `Test Biscuits Category ${Date.now()}`,
        active: true,
      },
    });
    testCategoryId = category.id;

    // 3. Create test Godown location for stock balances
    const godown = await prisma.location.findFirstOrThrow({
      where: { type: "GODOWN", active: true },
    });

    // 4. Create test products
    const product1 = await prisma.product.create({
      data: {
        name: "Parle Glucose Gold Biscuit 200g",
        shortCode: `PGLD-${Date.now()}`,
        companyId: testCompanyId,
        categoryId: testCategoryId,
        hsn: "19053100",
        gstRateBp: 1800,
        mrpPaise: 2500, // ₹25.00
        packSize: 48,
        packLabel: "Carton",
        active: true,
      },
    });
    testProduct1Id = product1.id;

    const product2 = await prisma.product.create({
      data: {
        name: "Tiger Krunch Choco Cookie 150g",
        shortCode: `TKRN-${Date.now()}`,
        companyId: testCompanyId,
        categoryId: testCategoryId,
        hsn: "19053100",
        gstRateBp: 1800,
        mrpPaise: 4000, // ₹40.00
        packSize: 30,
        packLabel: "Carton",
        active: true,
      },
    });
    testProduct2Id = product2.id;

    // 5. Add stock balance for product 1 (in-stock) and leave product 2 out of stock
    await prisma.stockBalance.upsert({
      where: {
        productId_locationId: { productId: testProduct1Id, locationId: godown.id },
      },
      create: {
        productId: testProduct1Id,
        locationId: godown.id,
        qty: 120, // 120 pcs available
      },
      update: {
        qty: 120,
      },
    });

    // 6. Setup dynamic price slabs for product 1
    const admin = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.SUPER_ADMIN },
    });

    await pricingService.createSlab(
      UserRole.SUPER_ADMIN,
      {
        scope: SlabScope.PRODUCT,
        targetId: testProduct1Id,
        minQty: 10,
        discountBp: 800, // 8% discount for 10+ pcs
        tier: BuyerTier.RETAILER,
      },
      admin.id
    );

    await pricingService.createSlab(
      UserRole.SUPER_ADMIN,
      {
        scope: SlabScope.PRODUCT,
        targetId: testProduct1Id,
        minQty: 48,
        discountBp: 1500, // 15% discount for 1 full carton (48+ pcs)
        tier: BuyerTier.WHOLESALER,
      },
      admin.id
    );
  });

  it("lists active products in catalogue with stock availability and brand tags", async () => {
    const { products, total } = await storeService.getCatalogue({
      companyId: testCompanyId,
    });

    expect(total).toBeGreaterThanOrEqual(2);
    expect(products.length).toBeGreaterThanOrEqual(2);

    const p1 = products.find((p) => p.id === testProduct1Id);
    expect(p1).toBeDefined();
    expect(p1?.name).toBe("Parle Glucose Gold Biscuit 200g");
    expect(p1?.totalAvailableQty).toBe(120);
    expect(p1?.isAvailable).toBe(true);

    const p2 = products.find((p) => p.id === testProduct2Id);
    expect(p2).toBeDefined();
    expect(p2?.isAvailable).toBe(false);
  });

  it("filters products by multi-token search across product name and code", async () => {
    const { products } = await storeService.getCatalogue({
      q: "Glucose Gold",
    });

    expect(products.length).toBeGreaterThanOrEqual(1);
    expect(products.some((p) => p.id === testProduct1Id)).toBe(true);
    expect(products.some((p) => p.id === testProduct2Id)).toBe(false);
  });

  it("filters products by inStockOnly flag", async () => {
    const { products } = await storeService.getCatalogue({
      companyId: testCompanyId,
      inStockOnly: true,
    });

    expect(products.some((p) => p.id === testProduct1Id)).toBe(true);
    expect(products.some((p) => p.id === testProduct2Id)).toBe(false);
  });

  it("retrieves product detail with sorted quantity price slabs and rates", async () => {
    const product = await storeService.getProductDetail(testProduct1Id);

    expect(product).not.toBeNull();
    expect(product?.name).toBe("Parle Glucose Gold Biscuit 200g");
    expect(product?.mrpPaise).toBe(2500);
    expect(product?.packSize).toBe(48);

    // Verify slabs
    expect(product?.slabs.length).toBeGreaterThanOrEqual(2);
    const slab10 = product?.slabs.find((s) => s.minQty === 10);
    expect(slab10).toBeDefined();
    expect(slab10?.discountBp).toBe(800);
    expect(slab10?.tier).toBe(BuyerTier.RETAILER);
    // Rate: ₹25.00 * (1 - 0.08) = ₹23.00 (2300 paise)
    expect(slab10?.unitPricePaise).toBe(2300);

    const slab48 = product?.slabs.find((s) => s.minQty === 48);
    expect(slab48).toBeDefined();
    expect(slab48?.discountBp).toBe(1500);
    expect(slab48?.tier).toBe(BuyerTier.WHOLESALER);
    // Rate: ₹25.00 * (1 - 0.15) = ₹21.25 (2125 paise)
    expect(slab48?.unitPricePaise).toBe(2125);
  });

  it("returns null for non-existent product detail", async () => {
    const result = await storeService.getProductDetail("non-existent-product-id");
    expect(result).toBeNull();
  });
});
