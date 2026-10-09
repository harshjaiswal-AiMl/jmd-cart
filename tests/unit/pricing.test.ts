import { describe, it, expect } from "vitest";
import { PricingService } from "@/modules/pricing/pricing.service";
import {
  SlabScope,
  BuyerTier,
  PriceSlabRule,
} from "@/modules/pricing/pricing.types";
import { UserRole } from "@prisma/client";

describe("Task 1.10: Pricing Engine Unit Tests", () => {
  const service = new PricingService();

  const mockSlabs: PriceSlabRule[] = [
    // Global slabs
    {
      id: "global-10",
      scope: SlabScope.GLOBAL,
      targetId: null,
      minQty: 10,
      discountBp: 500, // 5%
      tier: BuyerTier.RETAILER,
      active: true,
    },
    {
      id: "global-50",
      scope: SlabScope.GLOBAL,
      targetId: null,
      minQty: 50,
      discountBp: 1000, // 10%
      tier: BuyerTier.WHOLESALER,
      active: true,
    },
    // Company slab for "comp-bikaji"
    {
      id: "company-bikaji-10",
      scope: SlabScope.COMPANY,
      targetId: "comp-bikaji",
      minQty: 10,
      discountBp: 700, // 7%
      tier: BuyerTier.RETAILER,
      active: true,
    },
    // Category slab for "cat-snacks"
    {
      id: "cat-snacks-10",
      scope: SlabScope.CATEGORY,
      targetId: "cat-snacks",
      minQty: 10,
      discountBp: 800, // 8%
      tier: BuyerTier.RETAILER,
      active: true,
    },
    // Product slab for "prod-bhujia-special"
    {
      id: "prod-special-10",
      scope: SlabScope.PRODUCT,
      targetId: "prod-bhujia-special",
      minQty: 10,
      discountBp: 1200, // 12%
      tier: BuyerTier.RETAILER,
      active: true,
    },
  ];

  describe("Slab Resolution Hierarchy (Product > Category > Company > Global)", () => {
    it("should resolve Product-specific slab over Category, Company, and Global", () => {
      const product = {
        id: "prod-bhujia-special",
        categoryId: "cat-snacks",
        companyId: "comp-bikaji",
      };

      const result = service.resolveItemSlab(product, 15, mockSlabs);
      expect(result.matchedScope).toBe(SlabScope.PRODUCT);
      expect(result.slabDiscountBp).toBe(1200); // 12%
      expect(result.tier).toBe(BuyerTier.RETAILER);
    });

    it("should resolve Category-specific slab over Company and Global when no Product slab exists", () => {
      const product = {
        id: "prod-other-snack",
        categoryId: "cat-snacks",
        companyId: "comp-bikaji",
      };

      const result = service.resolveItemSlab(product, 15, mockSlabs);
      expect(result.matchedScope).toBe(SlabScope.CATEGORY);
      expect(result.slabDiscountBp).toBe(800); // 8%
      expect(result.tier).toBe(BuyerTier.RETAILER);
    });

    it("should resolve Company-specific slab over Global when no Category or Product slab exists", () => {
      const product = {
        id: "prod-bikaji-sweets",
        categoryId: "cat-sweets",
        companyId: "comp-bikaji",
      };

      const result = service.resolveItemSlab(product, 15, mockSlabs);
      expect(result.matchedScope).toBe(SlabScope.COMPANY);
      expect(result.slabDiscountBp).toBe(700); // 7%
      expect(result.tier).toBe(BuyerTier.RETAILER);
    });

    it("should resolve Global slab when no Product, Category, or Company slabs exist", () => {
      const product = {
        id: "prod-mdh-masala",
        categoryId: "cat-spices",
        companyId: "comp-mdh",
      };

      const result = service.resolveItemSlab(product, 15, mockSlabs);
      expect(result.matchedScope).toBe(SlabScope.GLOBAL);
      expect(result.slabDiscountBp).toBe(500); // 5%
      expect(result.tier).toBe(BuyerTier.RETAILER);
    });

    it("should return 0 discount and CUSTOMER tier if qty is below lowest minQty", () => {
      const product = {
        id: "prod-bhujia-special",
        categoryId: "cat-snacks",
        companyId: "comp-bikaji",
      };

      const result = service.resolveItemSlab(product, 5, mockSlabs);
      expect(result.matchedScope).toBe(SlabScope.GLOBAL);
      expect(result.slabDiscountBp).toBe(0);
      expect(result.tier).toBe(BuyerTier.CUSTOMER);
    });
  });

  describe("Quantity Boundaries and Highest Matching Slab", () => {
    it("should pick highest minQty satisfied within the same scope", () => {
      const product = {
        id: "prod-generic",
        categoryId: null,
        companyId: null,
      };

      // Qty 9 -> below 10 -> 0%
      const r9 = service.resolveItemSlab(product, 9, mockSlabs);
      expect(r9.slabDiscountBp).toBe(0);
      expect(r9.tier).toBe(BuyerTier.CUSTOMER);

      // Qty 10 -> exact boundary for 10 -> 5% Retailer
      const r10 = service.resolveItemSlab(product, 10, mockSlabs);
      expect(r10.slabDiscountBp).toBe(500);
      expect(r10.tier).toBe(BuyerTier.RETAILER);

      // Qty 49 -> still 5% Retailer
      const r49 = service.resolveItemSlab(product, 49, mockSlabs);
      expect(r49.slabDiscountBp).toBe(500);
      expect(r49.tier).toBe(BuyerTier.RETAILER);

      // Qty 50 -> exact boundary for 50 -> 10% Wholesaler
      const r50 = service.resolveItemSlab(product, 50, mockSlabs);
      expect(r50.slabDiscountBp).toBe(1000);
      expect(r50.tier).toBe(BuyerTier.WHOLESALER);

      // Qty 200 -> still 10% Wholesaler
      const r200 = service.resolveItemSlab(product, 200, mockSlabs);
      expect(r200.slabDiscountBp).toBe(1000);
      expect(r200.tier).toBe(BuyerTier.WHOLESALER);
    });
  });

  describe("Buyer Tag Resolution (Highest Tier Among Lines)", () => {
    it("should tag as CUSTOMER when all lines are retail/customer", () => {
      const lines = [
        { tier: BuyerTier.CUSTOMER },
        { tier: BuyerTier.CUSTOMER },
      ];
      expect(service.resolveOrderBuyerTag(lines)).toBe(BuyerTier.CUSTOMER);
    });

    it("should tag as RETAILER when at least one line is Retailer and none is Wholesaler", () => {
      const lines = [
        { tier: BuyerTier.CUSTOMER },
        { tier: BuyerTier.RETAILER },
        { tier: BuyerTier.CUSTOMER },
      ];
      expect(service.resolveOrderBuyerTag(lines)).toBe(BuyerTier.RETAILER);
    });

    it("should tag as WHOLESALER when any line qualifies for Wholesaler", () => {
      const lines = [
        { tier: BuyerTier.CUSTOMER },
        { tier: BuyerTier.RETAILER },
        { tier: BuyerTier.WHOLESALER },
      ];
      expect(service.resolveOrderBuyerTag(lines)).toBe(BuyerTier.WHOLESALER);
    });

    it("should return CUSTOMER for empty order lines", () => {
      expect(service.resolveOrderBuyerTag([])).toBe(BuyerTier.CUSTOMER);
    });
  });
});
