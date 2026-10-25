import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { catalogService, DuplicateShortCodeError, ProductNotFoundError } from "@/modules/catalog/catalog.service";
import { UserRole } from "@prisma/client";
import { ForbiddenError } from "@/modules/auth/permissions";
import { prisma } from "@/lib/prisma";
import { ZodError } from "zod";

describe("Task 1.4: Catalog Master CRUD & Search", () => {
  let adminUser: { id: string; role: UserRole };
  const createdProductIds: string[] = [];
  const createdCompanyIds: string[] = [];
  const createdCategoryIds: string[] = [];

  beforeEach(async () => {
    adminUser = await prisma.user.findUniqueOrThrow({
      where: { phone: "9876543210" },
      select: { id: true, role: true },
    });
  });

  afterEach(async () => {
    if (createdProductIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { entityId: { in: createdProductIds } } });
      await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
      createdProductIds.length = 0;
    }
    if (createdCompanyIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { entityId: { in: createdCompanyIds } } });
      await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
      createdCompanyIds.length = 0;
    }
    if (createdCategoryIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { entityId: { in: createdCategoryIds } } });
      await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
      createdCategoryIds.length = 0;
    }
  });

  describe("Companies & Categories Management", () => {
    it("should allow Super Admin to create companies and categories", async () => {
      const company = await catalogService.createCompany(
        adminUser.role,
        adminUser.id,
        { name: "Test FMCG Brand Ltd" }
      );
      createdCompanyIds.push(company.id);
      expect(company.name).toBe("Test FMCG Brand Ltd");

      const category = await catalogService.createCategory(
        adminUser.role,
        adminUser.id,
        { name: "Test Confectionery" }
      );
      createdCategoryIds.push(category.id);
      expect(category.name).toBe("Test Confectionery");

      // Verify audit logs
      const compAudit = await prisma.auditLog.findFirst({
        where: { action: "COMPANY_CREATED", entityId: company.id },
      });
      expect(compAudit).not.toBeNull();
    });
  });

  describe("Product Master CRUD", () => {
    it("should create a valid product, enforce uppercase shortCode, and log audit event", async () => {
      const product = await catalogService.createProduct(
        adminUser.role,
        adminUser.id,
        {
          name: "Bikaji Rasgulla 1kg Tin",
          shortCode: "bik-ras-1kg",
          hsn: "21069099",
          gstRateBp: 1200,
          mrpPaise: 24000, // Rs 240.00
          packSize: 12,
          packLabel: "Carton",
          reorderLevel: 24,
        }
      );
      createdProductIds.push(product.id);

      expect(product.id).toBeDefined();
      expect(product.shortCode).toBe("BIK-RAS-1KG"); // converted to uppercase
      expect(product.mrpPaise).toBe(24000);
      expect(product.packSize).toBe(12);

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: { action: "PRODUCT_CREATED", entityId: product.id },
      });
      expect(audit).not.toBeNull();
      expect((audit?.after as any).shortCode).toBe("BIK-RAS-1KG");
    });

    it("should reject duplicate short code with DuplicateShortCodeError", async () => {
      const product = await catalogService.createProduct(
        adminUser.role,
        adminUser.id,
        {
          name: "Original Product",
          shortCode: "DUP-CODE-01",
          hsn: "21069099",
          gstRateBp: 1200,
          mrpPaise: 10000,
          packSize: 10,
        }
      );
      createdProductIds.push(product.id);

      await expect(
        catalogService.createProduct(
          adminUser.role,
          adminUser.id,
          {
            name: "Duplicate Attempt",
            shortCode: "dup-code-01", // case-insensitive duplicate
            hsn: "21069099",
            gstRateBp: 1200,
            mrpPaise: 15000,
            packSize: 5,
          }
        )
      ).rejects.toThrow(DuplicateShortCodeError);
    });

    it("should reject invalid HSN codes and invalid GST rates", async () => {
      // Invalid HSN (too short)
      await expect(
        catalogService.createProduct(
          adminUser.role,
          adminUser.id,
          {
            name: "Bad HSN Product",
            shortCode: "BAD-HSN-01",
            hsn: "12", // invalid: min 4 digits
            gstRateBp: 1200,
            mrpPaise: 10000,
            packSize: 1,
          }
        )
      ).rejects.toThrow(ZodError);

      // Invalid GST rate (non-standard 15%)
      await expect(
        catalogService.createProduct(
          adminUser.role,
          adminUser.id,
          {
            name: "Bad GST Product",
            shortCode: "BAD-GST-01",
            hsn: "21069099",
            gstRateBp: 1500, // not in allowed GST slabs
            mrpPaise: 10000,
            packSize: 1,
          }
        )
      ).rejects.toThrow(ZodError);
    });

    it("should update product details and log before/after diff", async () => {
      const product = await catalogService.createProduct(
        adminUser.role,
        adminUser.id,
        {
          name: "Editable Biscuit 100g",
          shortCode: "EDIT-BIS-100",
          hsn: "19053100",
          gstRateBp: 1800,
          mrpPaise: 2000,
          packSize: 48,
        }
      );
      createdProductIds.push(product.id);

      const updated = await catalogService.updateProduct(
        adminUser.role,
        adminUser.id,
        product.id,
        {
          mrpPaise: 2500, // price changed to Rs 25.00
          reorderLevel: 96,
        }
      );

      expect(updated.mrpPaise).toBe(2500);
      expect(updated.reorderLevel).toBe(96);

      const audit = await prisma.auditLog.findFirst({
        where: { action: "PRODUCT_UPDATED", entityId: product.id },
        orderBy: { createdAt: "desc" },
      });
      expect(audit).not.toBeNull();
      expect((audit?.before as any).mrpPaise).toBe(2000);
      expect((audit?.after as any).mrpPaise).toBe(2500);
    });
  });

  describe("Product Search & Role Permissions", () => {
    it("should perform multi-token search matching name and shortCode", async () => {
      // Seeded product: "Bikaji Bhujia 1kg" with shortCode "BKJ-BHU-1K"
      const res = await catalogService.searchProducts(UserRole.SHOP, {
        q: "bhujia 1kg",
      });

      expect(res.products.length).toBeGreaterThanOrEqual(1);
      const match = res.products.find((p) => p.shortCode === "BKJ-BHU-1K");
      expect(match).toBeDefined();
      expect(match?.name).toBe("Bikaji Bhujia 1kg");
    });

    it("should search products by exact shortCode query", async () => {
      const res = await catalogService.searchProducts(UserRole.GODOWN, {
        q: "ENG-OIL-1L",
      });

      expect(res.products.length).toBe(1);
      expect(res.products[0].shortCode).toBe("ENG-OIL-1L");
    });

    it("should allow Shop role to view products but reject product creation", async () => {
      // Shop role can search/view
      const res = await catalogService.searchProducts(UserRole.SHOP, { limit: 5 });
      expect(res.products).toBeDefined();

      // Shop role cannot create product
      await expect(
        catalogService.createProduct(
          UserRole.SHOP,
          "shop-user-id",
          {
            name: "Unauthorized Product",
            shortCode: "UNAUTH-01",
            hsn: "21069099",
            gstRateBp: 1200,
            mrpPaise: 10000,
            packSize: 1,
          }
        )
      ).rejects.toThrow(ForbiddenError);
    });
  });
});
