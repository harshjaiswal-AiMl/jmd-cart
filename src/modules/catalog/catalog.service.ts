import { UserRole } from "@prisma/client";
import { catalogRepository } from "./catalog.repository";
import {
  createProductSchema,
  CreateProductInput,
  updateProductSchema,
  createCompanySchema,
  createCategorySchema,
  productSearchQuerySchema,
  ProductSearchQuery,
  ProductSearchQueryInput,
  ProductWithDetails,
} from "./catalog.types";
import { assertPermission, Permission } from "@/modules/auth/permissions";
import { auditService } from "@/modules/audit/audit.service";

export class DuplicateShortCodeError extends Error {
  constructor(shortCode: string) {
    super(`Product short code '${shortCode}' already exists`);
    this.name = "DuplicateShortCodeError";
  }
}

export class ProductNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Product '${identifier}' not found`);
    this.name = "ProductNotFoundError";
  }
}

export class CatalogService {
  async searchProducts(role: UserRole, query: ProductSearchQueryInput): Promise<{ products: ProductWithDetails[]; total: number }> {
    assertPermission(role, Permission.VIEW_PRODUCTS);
    const parsedQuery = productSearchQuerySchema.parse(query);

    const [products, total] = await Promise.all([
      catalogRepository.searchProducts(parsedQuery),
      catalogRepository.countProducts(parsedQuery),
    ]);

    return { products, total };
  }

  async getProductById(role: UserRole, id: string): Promise<ProductWithDetails> {
    assertPermission(role, Permission.VIEW_PRODUCTS);
    const product = await catalogRepository.findProductById(id);
    if (!product) {
      throw new ProductNotFoundError(id);
    }
    return product;
  }

  async getProductByShortCode(role: UserRole, shortCode: string): Promise<ProductWithDetails> {
    assertPermission(role, Permission.VIEW_PRODUCTS);
    const product = await catalogRepository.findProductByShortCode(shortCode.toUpperCase());
    if (!product) {
      throw new ProductNotFoundError(shortCode);
    }
    return product;
  }

  async createProduct(
    actorRole: UserRole,
    actorId: string,
    data: unknown,
    ip?: string
  ): Promise<ProductWithDetails> {
    assertPermission(actorRole, Permission.MANAGE_PRODUCTS);
    const parsed = createProductSchema.parse(data);

    // Verify uniqueness of shortCode
    const existing = await catalogRepository.findProductByShortCode(parsed.shortCode);
    if (existing) {
      throw new DuplicateShortCodeError(parsed.shortCode);
    }

    const created = await catalogRepository.createProduct(parsed);

    await auditService.log({
      actorId,
      action: "PRODUCT_CREATED",
      entity: "Product",
      entityId: created.id,
      after: {
        name: created.name,
        shortCode: created.shortCode,
        mrpPaise: created.mrpPaise,
        gstRateBp: created.gstRateBp,
        packSize: created.packSize,
      },
      ip,
    });

    return created;
  }

  async updateProduct(
    actorRole: UserRole,
    actorId: string,
    id: string,
    data: unknown,
    ip?: string
  ): Promise<ProductWithDetails> {
    assertPermission(actorRole, Permission.MANAGE_PRODUCTS);
    const before = await catalogRepository.findProductById(id);
    if (!before) {
      throw new ProductNotFoundError(id);
    }

    const rawObject = typeof data === "object" && data !== null ? data : {};
    const parsed = updateProductSchema.parse({ ...rawObject, id });

    if (parsed.shortCode && parsed.shortCode !== before.shortCode) {
      const conflict = await catalogRepository.findProductByShortCode(parsed.shortCode);
      if (conflict && conflict.id !== id) {
        throw new DuplicateShortCodeError(parsed.shortCode);
      }
    }

    const updated = await catalogRepository.updateProduct(id, parsed);

    await auditService.log({
      actorId,
      action: "PRODUCT_UPDATED",
      entity: "Product",
      entityId: id,
      before: {
        name: before.name,
        shortCode: before.shortCode,
        mrpPaise: before.mrpPaise,
        gstRateBp: before.gstRateBp,
        packSize: before.packSize,
        active: before.active,
      },
      after: {
        name: updated.name,
        shortCode: updated.shortCode,
        mrpPaise: updated.mrpPaise,
        gstRateBp: updated.gstRateBp,
        packSize: updated.packSize,
        active: updated.active,
      },
      ip,
    });

    return updated;
  }

  async setProductActive(
    actorRole: UserRole,
    actorId: string,
    id: string,
    active: boolean,
    ip?: string
  ): Promise<ProductWithDetails> {
    return this.updateProduct(actorRole, actorId, id, { active }, ip);
  }

  // Companies
  async listCompanies(role: UserRole, activeOnly = true) {
    assertPermission(role, Permission.VIEW_PRODUCTS);
    return catalogRepository.listCompanies(activeOnly);
  }

  async createCompany(
    actorRole: UserRole,
    actorId: string,
    data: unknown,
    ip?: string
  ) {
    assertPermission(actorRole, Permission.MANAGE_PRODUCTS);
    const parsed = createCompanySchema.parse(data);

    const created = await catalogRepository.createCompany(parsed);

    await auditService.log({
      actorId,
      action: "COMPANY_CREATED",
      entity: "Company",
      entityId: created.id,
      after: { name: created.name },
      ip,
    });

    return created;
  }

  // Categories
  async listCategories(role: UserRole, activeOnly = true) {
    assertPermission(role, Permission.VIEW_PRODUCTS);
    return catalogRepository.listCategories(activeOnly);
  }

  async createCategory(
    actorRole: UserRole,
    actorId: string,
    data: unknown,
    ip?: string
  ) {
    assertPermission(actorRole, Permission.MANAGE_PRODUCTS);
    const parsed = createCategorySchema.parse(data);

    const created = await catalogRepository.createCategory(parsed);

    await auditService.log({
      actorId,
      action: "CATEGORY_CREATED",
      entity: "Category",
      entityId: created.id,
      after: { name: created.name },
      ip,
    });

    return created;
  }

  /**
   * Inline update of MRP / Price A / Price B / Price C / Pack Size for a single product.
   */
  async updateProductPrices(
    actorRole: UserRole,
    actorId: string,
    id: string,
    prices: {
      mrpPaise?: number | null;
      priceAPaise?: number | null;
      priceBPaise?: number | null;
      priceCPaise?: number | null;
      packSize?: number;
    },
    ip?: string
  ): Promise<ProductWithDetails> {
    assertPermission(actorRole, Permission.MANAGE_PRODUCTS);
    const before = await catalogRepository.findProductById(id);
    if (!before) {
      throw new ProductNotFoundError(id);
    }

    const updated = await catalogRepository.updateProduct(id, prices);

    await auditService.log({
      actorId,
      action: "PRODUCT_PRICES_UPDATED",
      entity: "Product",
      entityId: id,
      before: {
        mrpPaise: before.mrpPaise,
        priceAPaise: before.priceAPaise,
        priceBPaise: before.priceBPaise,
        priceCPaise: before.priceCPaise,
        packSize: before.packSize,
      },
      after: {
        mrpPaise: updated.mrpPaise,
        priceAPaise: updated.priceAPaise,
        priceBPaise: updated.priceBPaise,
        priceCPaise: updated.priceCPaise,
        packSize: updated.packSize,
      },
      ip,
    });

    return updated;
  }

  /**
   * Bulk set Price A, B, and C as % off MRP for selected product IDs.
   */
  async bulkSetPricesPercentOffMrp(
    actorRole: UserRole,
    actorId: string,
    input: {
      productIds: string[];
      pctA: number;
      pctB: number;
      pctC: number;
    },
    ip?: string
  ): Promise<{ updatedCount: number; skippedMissingMrp: number }> {
    assertPermission(actorRole, Permission.MANAGE_PRODUCTS);
    const { productIds, pctA, pctB, pctC } = input;
    if (!productIds || productIds.length === 0) {
      return { updatedCount: 0, skippedMissingMrp: 0 };
    }

    let updatedCount = 0;
    let skippedMissingMrp = 0;

    for (const id of productIds) {
      const product = await catalogRepository.findProductById(id);
      if (!product) continue;
      if (product.mrpPaise == null || product.mrpPaise <= 0) {
        skippedMissingMrp++;
        continue;
      }

      const mrp = product.mrpPaise;
      const priceAPaise = Math.round((mrp * (100 - pctA)) / 100);
      const priceBPaise = Math.round((mrp * (100 - pctB)) / 100);
      const priceCPaise = Math.round((mrp * (100 - pctC)) / 100);

      await catalogRepository.updateProduct(id, {
        priceAPaise,
        priceBPaise,
        priceCPaise,
      });
      updatedCount++;
    }

    await auditService.log({
      actorId,
      action: "PRODUCT_BULK_PERCENT_OFF_MRP",
      entity: "Product",
      entityId: "bulk",
      after: {
        productIds,
        pctA,
        pctB,
        pctC,
        updatedCount,
        skippedMissingMrp,
      },
      ip,
    });

    return { updatedCount, skippedMissingMrp };
  }
}

export const catalogService = new CatalogService();
