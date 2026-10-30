import { prisma } from "@/lib/prisma";
import { Prisma, UserRole } from "@prisma/client";

export interface UpdateProductInput {
  productId: string;
  name?: string;
  shortCode?: string;
  companyId?: string | null;
  categoryId?: string | null;
  hsn?: string;
  gstRateBp?: number;
  mrpPaise?: number | null;
  priceAPaise?: number | null;
  priceBPaise?: number | null;
  priceCPaise?: number | null;
  packSize?: number;
  packLabel?: string;
  bagSize?: number | null;
  weight?: string | null;
  weightValue?: number | null;
  weightUnit?: string | null;
  reorderLevel?: number;
  imageUrl?: string | null;
  active?: boolean;
  reason?: string;
  confirmPackSizeChange?: boolean;
}

export interface BulkEditProductInput {
  productIds: string[];
  updates: {
    companyId?: string | null;
    categoryId?: string | null;
    hsn?: string;
    gstRateBp?: number;
    weightUnit?: string;
    bagSize?: number | null;
    reorderLevel?: number;
    active?: boolean;
  };
  reason: string;
}

export class ProductEditService {
  /**
   * Updates an individual product with field-level permissions, safety checks, and ProductRevision history.
   */
  async updateProduct(
    role: UserRole,
    input: UpdateProductInput,
    actorId?: string
  ) {
    const product = await prisma.product.findUnique({
      where: { id: input.productId },
      include: {
        stockBalances: true,
      },
    });

    if (!product) throw new Error("Product not found");

    // 1. Permission checks
    const isAdmin = role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;
    const isAccounts = role === UserRole.ACCOUNTS;

    // Price fields restricted to ADMIN & SUPER_ADMIN
    if (
      (input.mrpPaise !== undefined ||
        input.priceAPaise !== undefined ||
        input.priceBPaise !== undefined ||
        input.priceCPaise !== undefined) &&
      !isAdmin
    ) {
      throw new Error("Only Administrators can modify pricing fields (MRP, Prices A/B/C).");
    }

    // Tax fields restricted to ADMIN, SUPER_ADMIN, ACCOUNTS
    if (
      (input.hsn !== undefined || input.gstRateBp !== undefined) &&
      !isAdmin &&
      !isAccounts
    ) {
      throw new Error("Only Admin or Accounts can modify HSN or GST rate.");
    }

    // 2. HSN validation (4, 6 or 8 digits)
    if (input.hsn) {
      const hsnClean = input.hsn.trim();
      if (!/^\d{4}(\d{2}(\d{2})?)?$/.test(hsnClean)) {
        throw new Error("HSN code must be 4, 6, or 8 digits.");
      }
    }

    // 3. Pack size safety guard
    if (input.packSize !== undefined && input.packSize !== product.packSize) {
      const totalStock = product.stockBalances.reduce((sum, b) => sum + b.qty, 0);
      if (totalStock > 0 && !input.confirmPackSizeChange) {
        throw new Error(
          `Pack size change requires confirmation: Product has ${totalStock} pieces in stock. Cartons will recalculate from ${Math.floor(
            totalStock / product.packSize
          )} to ${Math.floor(totalStock / input.packSize)}.`
        );
      }
    }

    // 4. ShortCode uniqueness check
    if (input.shortCode && input.shortCode !== product.shortCode) {
      const existing = await prisma.product.findUnique({
        where: { shortCode: input.shortCode.trim().toUpperCase() },
      });
      if (existing && existing.id !== product.id) {
        throw new Error(`Product with short code '${input.shortCode}' already exists.`);
      }
    }

    // 5. Snapshot before update
    const beforeSnapshot = {
      name: product.name,
      shortCode: product.shortCode,
      companyId: product.companyId,
      categoryId: product.categoryId,
      hsn: product.hsn,
      gstRateBp: product.gstRateBp,
      mrpPaise: product.mrpPaise,
      priceAPaise: product.priceAPaise,
      priceBPaise: product.priceBPaise,
      priceCPaise: product.priceCPaise,
      packSize: product.packSize,
      packLabel: product.packLabel,
      bagSize: product.bagSize,
      weight: product.weight,
      weightValue: product.weightValue,
      weightUnit: product.weightUnit,
      reorderLevel: product.reorderLevel,
      imageUrl: product.imageUrl,
      active: product.active,
    };

    // 6. Execute atomic update and log ProductRevision
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: product.id },
        data: {
          name: input.name !== undefined ? input.name.trim() : product.name,
          shortCode: input.shortCode !== undefined ? input.shortCode.trim().toUpperCase() : product.shortCode,
          companyId: input.companyId !== undefined ? input.companyId : product.companyId,
          categoryId: input.categoryId !== undefined ? input.categoryId : product.categoryId,
          hsn: input.hsn !== undefined ? input.hsn.trim() : product.hsn,
          gstRateBp: input.gstRateBp !== undefined ? input.gstRateBp : product.gstRateBp,
          mrpPaise: input.mrpPaise !== undefined ? input.mrpPaise : product.mrpPaise,
          priceAPaise: input.priceAPaise !== undefined ? input.priceAPaise : product.priceAPaise,
          priceBPaise: input.priceBPaise !== undefined ? input.priceBPaise : product.priceBPaise,
          priceCPaise: input.priceCPaise !== undefined ? input.priceCPaise : product.priceCPaise,
          packSize: input.packSize !== undefined ? input.packSize : product.packSize,
          packLabel: input.packLabel !== undefined ? input.packLabel.trim() : product.packLabel,
          bagSize: input.bagSize !== undefined ? input.bagSize : product.bagSize,
          weight: input.weight !== undefined ? input.weight : product.weight,
          weightValue: input.weightValue !== undefined ? input.weightValue : product.weightValue,
          weightUnit: input.weightUnit !== undefined ? input.weightUnit : product.weightUnit,
          reorderLevel: input.reorderLevel !== undefined ? input.reorderLevel : product.reorderLevel,
          imageUrl: input.imageUrl !== undefined ? input.imageUrl : product.imageUrl,
          active: input.active !== undefined ? input.active : product.active,
        },
      });

      const afterSnapshot = {
        name: updated.name,
        shortCode: updated.shortCode,
        companyId: updated.companyId,
        categoryId: updated.categoryId,
        hsn: updated.hsn,
        gstRateBp: updated.gstRateBp,
        mrpPaise: updated.mrpPaise,
        priceAPaise: updated.priceAPaise,
        priceBPaise: updated.priceBPaise,
        priceCPaise: updated.priceCPaise,
        packSize: updated.packSize,
        packLabel: updated.packLabel,
        bagSize: updated.bagSize,
        weight: updated.weight,
        weightValue: updated.weightValue,
        weightUnit: updated.weightUnit,
        reorderLevel: updated.reorderLevel,
        imageUrl: updated.imageUrl,
        active: updated.active,
      };

      await tx.productRevision.create({
        data: {
          productId: product.id,
          beforeSnapshot,
          afterSnapshot,
          reason: input.reason || "Product details updated",
          editorUserId: actorId || null,
        },
      });

      return updated;
    });
  }

  /**
   * Bulk updates multiple products with before/after state saved in audit log for one-click undo.
   */
  async bulkUpdateProducts(
    role: UserRole,
    input: BulkEditProductInput,
    actorId?: string
  ) {
    if (role !== UserRole.SUPER_ADMIN && role !== UserRole.ADMIN) {
      throw new Error("Only Administrators can perform bulk product edits.");
    }

    const products = await prisma.product.findMany({
      where: { id: { in: input.productIds } },
    });

    return await prisma.$transaction(async (tx) => {
      const snapshots: Record<string, unknown> = {};

      for (const prod of products) {
        snapshots[prod.id] = {
          companyId: prod.companyId,
          categoryId: prod.categoryId,
          hsn: prod.hsn,
          gstRateBp: prod.gstRateBp,
          weightUnit: prod.weightUnit,
          bagSize: prod.bagSize,
          reorderLevel: prod.reorderLevel,
          active: prod.active,
        };

        await tx.product.update({
          where: { id: prod.id },
          data: {
            ...input.updates,
          },
        });

        const beforeSnap = snapshots[prod.id] as Record<string, unknown>;
        const afterSnap = { ...beforeSnap, ...input.updates };

        await tx.productRevision.create({
          data: {
            productId: prod.id,
            beforeSnapshot: JSON.parse(JSON.stringify(beforeSnap)) as Prisma.InputJsonValue,
            afterSnapshot: JSON.parse(JSON.stringify(afterSnap)) as Prisma.InputJsonValue,
            reason: `Bulk Edit: ${input.reason}`,
            editorUserId: actorId || null,
          },
        });
      }

      // Record batch audit for undo
      const batchAudit = await tx.auditLog.create({
        data: {
          actorId: actorId || null,
          action: "PRODUCT_BULK_EDIT",
          entity: "ProductBatch",
          entityId: `batch_${Date.now()}`,
          after: JSON.parse(
            JSON.stringify({
              productIds: input.productIds,
              updates: input.updates,
              reason: input.reason,
              snapshots,
            })
          ) as Prisma.InputJsonValue,
        },
      });

      return {
        count: products.length,
        batchId: batchAudit.id,
      };
    });
  }
}

export const productEditService = new ProductEditService();
