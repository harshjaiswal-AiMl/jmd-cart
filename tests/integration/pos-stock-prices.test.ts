import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resolvePrice } from "@/modules/pricing/resolve-price";
import { dataQualityService } from "@/modules/catalog/data-quality.service";
import { billingService } from "@/modules/billing/billing.service";
import { PaymentMode, UserRole } from "@prisma/client";

describe("Part A Integration Tests: POS Stock, Pricing & Data-Quality", () => {
  const testShortCode1 = "TESTPOS01";
  const testShortCode2 = "TESTPOS02";
  const testShortCodeJunk = "756.0";

  beforeEach(async () => {
    // Clean up test products
    await prisma.stockMovement.deleteMany({
      where: { product: { shortCode: { in: [testShortCode1, testShortCode2, testShortCodeJunk] } } },
    }).catch(() => {});

    await prisma.stockBalance.deleteMany({
      where: { product: { shortCode: { in: [testShortCode1, testShortCode2, testShortCodeJunk] } } },
    });

    await prisma.product.deleteMany({
      where: { shortCode: { in: [testShortCode1, testShortCode2, testShortCodeJunk] } },
    });
  });

  describe("Price Resolution (resolvePrice)", () => {
    it("resolves List C for walk-in / retail buyer", () => {
      const product = {
        id: "prod-1",
        mrpPaise: 10000,
        priceAPaise: 7500,
        priceBPaise: 8000,
        priceCPaise: 8500,
      };

      const res = resolvePrice(product, "CUSTOMER");
      expect(res.isUnpriced).toBe(false);
      expect(res.unitPricePaise).toBe(8500);
      expect(res.listUsed).toBe("C");
    });

    it("resolves Tier A for WHOLESALER buyer", () => {
      const product = {
        id: "prod-1",
        mrpPaise: 10000,
        priceAPaise: 7500,
        priceBPaise: 8000,
        priceCPaise: 8500,
      };

      const res = resolvePrice(product, "WHOLESALER");
      expect(res.isUnpriced).toBe(false);
      expect(res.unitPricePaise).toBe(7500);
      expect(res.listUsed).toBe("A");
    });

    it("flags product with no price as unresolvable and blocks ₹0.00", () => {
      const product = {
        id: "prod-unpriced",
        mrpPaise: null,
        priceAPaise: null,
        priceBPaise: null,
        priceCPaise: null,
      };

      const res = resolvePrice(product, "CUSTOMER");
      expect(res.isUnpriced).toBe(true);
      expect(res.unitPricePaise).toBe(0);
    });
  });

  describe("POS Location Deductions & Stock Rules", () => {
    it("handles loose pieces and carton sales across locations", async () => {
      const godownLoc = await prisma.location.findFirst({
        where: { type: "GODOWN", active: true },
      });
      const shopLoc = await prisma.location.findFirst({
        where: { type: "SHOP", active: true },
      });

      expect(godownLoc).toBeDefined();
      expect(shopLoc).toBeDefined();

      const product = await prisma.product.create({
        data: {
          name: "Test POS Tea 250g",
          shortCode: testShortCode1,
          packSize: 24, // 24 pieces per carton
          packLabel: "24 pcs/Ctn",
          mrpPaise: 12000,
          priceCPaise: 10000,
        },
      });

      // Stock only in Godown (72 pieces = 3 cartons), Shop has 0
      await prisma.stockBalance.create({
        data: {
          productId: product.id,
          locationId: godownLoc!.id,
          qty: 72,
        },
      });

      const shopBalance = await prisma.stockBalance.findUnique({
        where: {
          productId_locationId: {
            productId: product.id,
            locationId: shopLoc!.id,
          },
        },
      });
      const godownBalance = await prisma.stockBalance.findUnique({
        where: {
          productId_locationId: {
            productId: product.id,
            locationId: godownLoc!.id,
          },
        },
      });

      // Verify initial state: shop 0, godown 72 (3 cartons)
      expect(shopBalance?.qty ?? 0).toBe(0);
      expect(godownBalance?.qty).toBe(72);

      // Add loose pieces to shop (5 loose pieces)
      await prisma.stockBalance.upsert({
        where: {
          productId_locationId: {
            productId: product.id,
            locationId: shopLoc!.id,
          },
        },
        create: {
          productId: product.id,
          locationId: shopLoc!.id,
          qty: 5,
        },
        update: {
          qty: 5,
        },
      });

      const updatedShop = await prisma.stockBalance.findUnique({
        where: {
          productId_locationId: {
            productId: product.id,
            locationId: shopLoc!.id,
          },
        },
      });
      expect(updatedShop?.qty).toBe(5);
    });
  });

  describe("Catalog Data-Quality Service", () => {
    it("flags numeric names, pack size outliers, and missing prices", async () => {
      // Create a junk product matching observed corrupted rows
      const junkProduct = await prisma.product.create({
        data: {
          name: "756.0", // Numeric junk name
          shortCode: testShortCodeJunk,
          packSize: 357830, // Outlier packSize > 5000
          packLabel: "357830 pcs/Ctn",
          mrpPaise: null, // Missing price
          priceAPaise: null,
          priceBPaise: null,
          priceCPaise: null,
          active: true,
        },
      });

      const report = await dataQualityService.getReport(UserRole.ADMIN);

      expect(report.totalProducts).toBeGreaterThan(0);
      const flagged = report.items.find((item) => item.id === junkProduct.id);
      expect(flagged).toBeDefined();

      expect(flagged?.issues).toContain("NUMERIC_OR_SHORT_NAME");
      expect(flagged?.issues).toContain("PACK_SIZE_OUTLIER");
      expect(flagged?.issues).toContain("MISSING_PRICE");

      const adminUser = await prisma.user.findFirst();
      if (!adminUser) throw new Error("No user found");

      // Verify bulk deactivation
      const deactivateRes = await dataQualityService.bulkDeactivateProducts(
        UserRole.ADMIN,
        adminUser.id,
        [junkProduct.id],
        "Cleanup junk"
      );

      expect(deactivateRes.deactivatedCount).toBe(1);

      const refreshed = await prisma.product.findUnique({
        where: { id: junkProduct.id },
      });
      expect(refreshed?.active).toBe(false);
    });
  });
});
