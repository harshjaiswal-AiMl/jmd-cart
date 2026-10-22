import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  resolvePrice,
  validatePriceOrdering,
  calculatePriceFromMrpDiscountPct,
  pricingService,
} from "@/modules/pricing/pricing.service";
import { BuyerTier } from "@/modules/pricing/pricing.types";
import { storeService } from "@/modules/store/store.service";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { settingsService } from "@/modules/settings/settings.service";

describe("Part 1 — A / B / C Price Lists & Resolution Engine", () => {
  const sampleProduct = {
    id: "prod-saloni-1l",
    mrpPaise: 22500, // ₹225.00
    priceAPaise: 17625, // ₹176.25 (Wholesaler)
    priceBPaise: 17725, // ₹177.25 (Retailer)
    priceCPaise: 17800, // ₹178.00 (Customer)
  };

  it("1. resolvePrice maps WHOLESALER -> A, RETAILER -> B, CUSTOMER/walk-in/anonymous -> C", () => {
    const resA = resolvePrice(sampleProduct, "WHOLESALER");
    expect(resA.unitPricePaise).toBe(17625);
    expect(resA.listUsed).toBe("A");
    expect(resA.effectiveBuyerTier).toBe(BuyerTier.WHOLESALER);

    const resB = resolvePrice(sampleProduct, "RETAILER");
    expect(resB.unitPricePaise).toBe(17725);
    expect(resB.listUsed).toBe("B");
    expect(resB.effectiveBuyerTier).toBe(BuyerTier.RETAILER);

    const resC = resolvePrice(sampleProduct, "CUSTOMER");
    expect(resC.unitPricePaise).toBe(17800);
    expect(resC.listUsed).toBe("C");
    expect(resC.effectiveBuyerTier).toBe(BuyerTier.CUSTOMER);

    const resAnon = resolvePrice(sampleProduct, null);
    expect(resAnon.unitPricePaise).toBe(17800);
    expect(resAnon.listUsed).toBe("C");
  });

  it("2. unapproved buyer on storefront strictly receives List C even if buyerType is WHOLESALER or RETAILER", () => {
    const unapprovedWholesaler = resolvePrice(sampleProduct, "WHOLESALER", {
      buyerApproved: false,
    });
    expect(unapprovedWholesaler.unitPricePaise).toBe(17800);
    expect(unapprovedWholesaler.listUsed).toBe("C");
    expect(unapprovedWholesaler.effectiveBuyerTier).toBe(BuyerTier.CUSTOMER);

    const unapprovedRetailer = resolvePrice(sampleProduct, "RETAILER", {
      buyerApproved: false,
    });
    expect(unapprovedRetailer.unitPricePaise).toBe(17800);
    expect(unapprovedRetailer.listUsed).toBe("C");
  });

  it("3. quantity-tier toggle OFF vs ON chooses Math.min(partyListPrice, quantitySlabPrice) when ON", () => {
    // Retailer has List B = 17725. Suppose quantity slab offers 17500 (WHOLESALER tier).
    const whenOff = resolvePrice(sampleProduct, "RETAILER", {
      enableQuantityTierPricing: false,
      quantitySlabPricePaise: 17500,
      quantitySlabTier: BuyerTier.WHOLESALER,
    });
    expect(whenOff.unitPricePaise).toBe(17725);
    expect(whenOff.effectiveBuyerTier).toBe(BuyerTier.RETAILER);

    const whenOnCheaperSlab = resolvePrice(sampleProduct, "RETAILER", {
      enableQuantityTierPricing: true,
      quantitySlabPricePaise: 17500,
      quantitySlabTier: BuyerTier.WHOLESALER,
    });
    expect(whenOnCheaperSlab.unitPricePaise).toBe(17500);
    expect(whenOnCheaperSlab.effectiveBuyerTier).toBe(BuyerTier.WHOLESALER);

    // If party is WHOLESALER (17625) and quantity slab is 17700, party keeps 17625
    const whenOnPartyCheaper = resolvePrice(sampleProduct, "WHOLESALER", {
      enableQuantityTierPricing: true,
      quantitySlabPricePaise: 17700,
      quantitySlabTier: BuyerTier.RETAILER,
    });
    expect(whenOnPartyCheaper.unitPricePaise).toBe(17625);
    expect(whenOnPartyCheaper.effectiveBuyerTier).toBe(BuyerTier.WHOLESALER);
  });

  it("4. calculatePriceFromMrpDiscountPct computes exact half-up paise for MDH 22% / 21% / 20% off MRP 89", () => {
    const mrp89 = 8900; // ₹89.00
    expect(calculatePriceFromMrpDiscountPct(mrp89, 22)).toBe(6942); // ₹69.42
    expect(calculatePriceFromMrpDiscountPct(mrp89, 21)).toBe(7031); // ₹70.31
    expect(calculatePriceFromMrpDiscountPct(mrp89, 20)).toBe(7120); // ₹71.20
  });

  it("5. validatePriceOrdering warns when A <= B <= C <= MRP is violated without throwing", () => {
    const validWarnings = validatePriceOrdering(sampleProduct);
    expect(validWarnings).toHaveLength(0);

    // Dawat Devaaya 1kg: MRP=10000, A=8000, B=8100, C=8000 (B > C)
    const dawatWarnings = validatePriceOrdering({
      mrpPaise: 10000,
      priceAPaise: 8000,
      priceBPaise: 8100,
      priceCPaise: 8000,
    });
    expect(dawatWarnings.some((w) => w.code === "B_GT_C")).toBe(true);

    // C > MRP warning
    const exceedMrpWarnings = validatePriceOrdering({
      mrpPaise: 10000,
      priceAPaise: 8000,
      priceBPaise: 9000,
      priceCPaise: 10500,
    });
    expect(exceedMrpWarnings.some((w) => w.code === "C_GT_MRP")).toBe(true);
  });

  const isDbAvailable = process.env.TEST_DB_AVAILABLE === "1";
  describe.skipIf(!isDbAvailable)("Database & Storefront Privacy Integration", () => {
    const testSku = "TEST_ABC_PRIVACY_SKU";

    beforeEach(async () => {
      await prisma.product.deleteMany({ where: { shortCode: testSku } });
      await prisma.product.create({
        data: {
          name: "ABC Privacy Test Mustard Oil",
          shortCode: testSku,
          weight: "1Ltr",
          hsn: "15149020",
          gstRateBp: 500,
          mrpPaise: 22500,
          priceAPaise: 17625,
          priceBPaise: 17725,
          priceCPaise: 17800,
          packSize: 12,
          packLabel: "Carton",
          active: true,
        },
      });
    });

    afterEach(async () => {
      await prisma.product.deleteMany({ where: { shortCode: testSku } });
    });

    it("6. anonymous storefront catalogue response never exposes priceAPaise or priceBPaise", async () => {
      const catalogue = await storeService.getCatalogue({
        q: testSku,
      });

      expect(catalogue.products.length).toBe(1);
      const item = catalogue.products[0];
      expect(item.mrpPaise).toBe(22500);
      expect(item.unitPricePaise).toBe(17800); // Price C
      expect(item.priceListUsed).toBe("C");

      const serialized = JSON.stringify(catalogue);
      expect(serialized).not.toContain("17625");
      expect(serialized).not.toContain("17725");
      expect(serialized).not.toContain("priceAPaise");
      expect(serialized).not.toContain("priceBPaise");
    });

    it("7. calculateOrderPricing stacks admin orderDiscountBp on top of resolved A/B/C price", async () => {
      const prod = await prisma.product.findUniqueOrThrow({
        where: { shortCode: testSku },
      });

      await settingsService.updatePricingSettings(UserRole.SUPER_ADMIN, null, {
        enableQuantityTierPricing: false,
      });

      const orderRes = await pricingService.calculateOrderPricing({
        items: [{ productId: prod.id, qty: 10 }],
        buyerType: BuyerTier.WHOLESALER,
        buyerApproved: true,
        orderDiscountBp: 500, // 5% order discount on top of List A (176.25)
        userRole: UserRole.SUPER_ADMIN,
      });

      expect(orderRes.buyerTag).toBe(BuyerTier.WHOLESALER);
      expect(orderRes.lines[0].tier).toBe(BuyerTier.WHOLESALER);
      // Without 5% order discount, 10 units at 17625 = 176250. With 5% extra discount, net is ~167438
      expect(orderRes.netSubtotalPaise).toBeLessThan(176250);
    });
  });
});
