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
}

export const catalogService = new CatalogService();
