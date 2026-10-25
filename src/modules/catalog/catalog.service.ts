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

  async bulkCreateProducts(
    actorRole: UserRole,
    actorId: string,
    items: Array<any>,
    ip?: string
  ): Promise<{ createdCount: number; errors: Array<{ index: number; name: string; error: string }> }> {
    assertPermission(actorRole, Permission.MANAGE_PRODUCTS);
    let createdCount = 0;
    const errors: Array<{ index: number; name: string; error: string }> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        const parsed = createProductSchema.parse(item);
        const existing = await catalogRepository.findProductByShortCode(parsed.shortCode);
        if (existing) {
          throw new DuplicateShortCodeError(parsed.shortCode);
        }
        const created = await catalogRepository.createProduct(parsed);
        createdCount++;
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
      } catch (err: any) {
        errors.push({
          index: i,
          name: item?.name || `Row ${i + 1}`,
          error: err?.message || "Failed to create",
        });
      }
    }

    return { createdCount, errors };
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
    const { ensureSupplierParty } = await import("@/modules/party/party.service");
    await ensureSupplierParty(created);

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

  /**
   * Delete a single product. If it has transactions/movements, soft-deletes (active = false)
   * to preserve ledger integrity. If no transactions exist, performs clean hard-delete.
   */
  async deleteProduct(
    actorRole: UserRole,
    actorId: string,
    id: string,
    ip?: string
  ): Promise<{ success: boolean; mode: "DELETED" | "DEACTIVATED"; message: string }> {
    assertPermission(actorRole, Permission.MANAGE_PRODUCTS);
    const product = await catalogRepository.findProductById(id);
    if (!product) {
      throw new ProductNotFoundError(id);
    }

    const { prisma } = await import("@/lib/prisma");

    const [movementsCount, invoiceItemsCount, purchaseItemsCount, debitNoteItemsCount, orderItemsCount] =
      await Promise.all([
        prisma.stockMovement.count({ where: { productId: id } }),
        prisma.invoiceItem.count({ where: { productId: id } }),
        prisma.purchaseItem.count({ where: { productId: id } }),
        prisma.debitNoteItem.count({ where: { productId: id } }),
        prisma.orderItem.count({ where: { productId: id } }),
      ]);

    const hasTransactions =
      movementsCount > 0 ||
      invoiceItemsCount > 0 ||
      purchaseItemsCount > 0 ||
      debitNoteItemsCount > 0 ||
      orderItemsCount > 0;

    if (hasTransactions) {
      await prisma.product.update({
        where: { id },
        data: { active: false },
      });

      await auditService.log({
        actorId,
        action: "PRODUCT_DEACTIVATED",
        entity: "Product",
        entityId: id,
        before: { active: true },
        after: { active: false, reason: "Deactivated because transaction history exists" },
        ip,
      });

      return {
        success: true,
        mode: "DEACTIVATED",
        message: `${product.name} has sales/stock history, so it was archived (set inactive).`,
      };
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.cartItem.deleteMany({ where: { productId: id } });
        await tx.wishlistItem.deleteMany({ where: { productId: id } });
        await tx.stockReservation.deleteMany({ where: { productId: id } });
        await tx.supplierItemAlias.deleteMany({ where: { productId: id } });
        await tx.billScanLine.deleteMany({ where: { productId: id } });
        await tx.stockBalance.deleteMany({ where: { productId: id } });
        await tx.product.delete({ where: { id } });
      });

      await auditService.log({
        actorId,
        action: "PRODUCT_DELETED",
        entity: "Product",
        entityId: id,
        before: { name: product.name, shortCode: product.shortCode },
        ip,
      });

      return {
        success: true,
        mode: "DELETED",
        message: `${product.name} was permanently deleted.`,
      };
    }
  }

  /**
   * Bulk delete products.
   */
  async bulkDeleteProducts(
    actorRole: UserRole,
    actorId: string,
    productIds: string[],
    ip?: string
  ): Promise<{ deletedCount: number; deactivatedCount: number; message: string }> {
    assertPermission(actorRole, Permission.MANAGE_PRODUCTS);
    if (!productIds || productIds.length === 0) {
      return { deletedCount: 0, deactivatedCount: 0, message: "No products selected" };
    }

    let deletedCount = 0;
    let deactivatedCount = 0;

    for (const id of productIds) {
      try {
        const res = await this.deleteProduct(actorRole, actorId, id, ip);
        if (res.mode === "DELETED") deletedCount++;
        else deactivatedCount++;
      } catch (e) {
        // Continue with next
      }
    }

    return {
      deletedCount,
      deactivatedCount,
      message: `Processed ${deletedCount + deactivatedCount} product(s): ${deletedCount} deleted, ${deactivatedCount} archived.`,
    };
  }

  /**
   * Bulk update common fields across selected products.
   */
  async bulkUpdateProducts(
    actorRole: UserRole,
    actorId: string,
    input: {
      productIds: string[];
      companyId?: string | null;
      categoryId?: string | null;
      packSize?: number;
      packLabel?: string;
      gstRateBp?: number;
      active?: boolean;
      mrpPaise?: number | null;
      priceAPaise?: number | null;
      priceBPaise?: number | null;
      priceCPaise?: number | null;
    },
    ip?: string
  ): Promise<{ updatedCount: number }> {
    assertPermission(actorRole, Permission.MANAGE_PRODUCTS);
    const { productIds, ...updates } = input;
    if (!productIds || productIds.length === 0) {
      return { updatedCount: 0 };
    }

    const { prisma } = await import("@/lib/prisma");

    const dataToUpdate: Record<string, any> = {};
    if (updates.companyId !== undefined) dataToUpdate.companyId = updates.companyId;
    if (updates.categoryId !== undefined) dataToUpdate.categoryId = updates.categoryId;
    if (updates.packSize !== undefined && updates.packSize > 0) dataToUpdate.packSize = updates.packSize;
    if (updates.packLabel !== undefined && updates.packLabel.trim()) dataToUpdate.packLabel = updates.packLabel.trim();
    if (updates.gstRateBp !== undefined) dataToUpdate.gstRateBp = updates.gstRateBp;
    if (updates.active !== undefined) dataToUpdate.active = updates.active;
    if (updates.mrpPaise !== undefined) dataToUpdate.mrpPaise = updates.mrpPaise;
    if (updates.priceAPaise !== undefined) dataToUpdate.priceAPaise = updates.priceAPaise;
    if (updates.priceBPaise !== undefined) dataToUpdate.priceBPaise = updates.priceBPaise;
    if (updates.priceCPaise !== undefined) dataToUpdate.priceCPaise = updates.priceCPaise;

    if (Object.keys(dataToUpdate).length === 0) {
      return { updatedCount: 0 };
    }

    const res = await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: dataToUpdate,
    });

    await auditService.log({
      actorId,
      action: "PRODUCT_BULK_UPDATED",
      entity: "Product",
      entityId: "bulk",
      after: {
        productIds,
        dataToUpdate,
        updatedCount: res.count,
      },
      ip,
    });

    return { updatedCount: res.count };
  }
}

export const catalogService = new CatalogService();
