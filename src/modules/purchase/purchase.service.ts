import { UserRole, MovementType, LedgerKind, PurchaseStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { purchaseRepository } from "./purchase.repository";
import {
  createPurchaseSchema,
  CreatePurchaseInput,
  PurchaseListFilter,
  PurchaseWithDetails,
} from "./purchase.types";
import { assertPermission, Permission } from "@/modules/auth/permissions";
import { stockService } from "@/modules/stock/stock.service";
import { auditService } from "@/modules/audit/audit.service";

export class PurchaseNotFoundError extends Error {
  constructor(id: string) {
    super(`Purchase order '${id}' not found`);
    this.name = "PurchaseNotFoundError";
  }
}

export class PurchaseService {
  /**
   * Record a received supplier purchase (GRN).
   * Atomically posts stock to the designated location ledger, updates supplier ledger, and records audit.
   */
  async recordPurchaseReceive(
    actorRole: UserRole,
    actorId: string,
    data: unknown,
    ip?: string
  ): Promise<PurchaseWithDetails> {
    assertPermission(actorRole, Permission.STOCK_RECEIVE);
    const parsed = createPurchaseSchema.parse(data);

    // Compute totals in integer paise, safely clamped within PostgreSQL INT4 bounds
    const MAX_INT4 = 2147483647;
    let totalPaise = 0;
    for (const item of parsed.items) {
      const safeRate = Math.min(MAX_INT4, Math.max(0, item.ratePaise));
      const taxablePaise = Math.min(MAX_INT4, item.qty * safeRate);
      const taxPaise = Math.round((taxablePaise * (item.gstRateBp || 0)) / 10000);
      totalPaise = Math.min(MAX_INT4, totalPaise + taxablePaise + taxPaise);
    }

    const baseKey = parsed.idempotencyKey || `pur_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // 1. Create Purchase & items in database
    const purchase = await prisma.purchase.create({
      data: {
        supplierId: parsed.supplierId ?? null,
        billNo: parsed.billNo,
        billDate: parsed.billDate,
        locationId: parsed.locationId,
        totalPaise,
        status: PurchaseStatus.RECEIVED,
        billScanId: parsed.billScanId ?? null,
        billTotalPaise: parsed.billTotalPaise != null ? Math.min(MAX_INT4, Math.max(0, parsed.billTotalPaise)) : null,
        createdBy: actorId,
        items: {
          create: parsed.items.map((it) => ({
            productId: it.productId,
            qty: it.qty,
            billedQty: it.billedQty != null ? Math.min(MAX_INT4, it.billedQty) : null,
            acceptedQty: it.acceptedQty != null ? Math.min(MAX_INT4, it.acceptedQty) : it.qty,
            varianceReason: it.varianceReason ?? null,
            ratePaise: Math.min(MAX_INT4, Math.max(0, it.ratePaise)),
            gstRateBp: Math.min(MAX_INT4, Math.max(0, it.gstRateBp || 0)),
          })),
        },
      },
      include: {
        items: true,
      },
    });

    // 2. Post stock ledger movements for every received item
    for (const item of purchase.items) {
      await stockService.postMovement({
        type: MovementType.PURCHASE_RECEIPT,
        productId: item.productId,
        toLocationId: parsed.locationId,
        qty: item.qty,
        referenceType: "PURCHASE",
        referenceId: purchase.id,
        reason: `Purchase Bill #${parsed.billNo}`,
        idempotencyKey: `${baseKey}_item_${item.id}`,
        actorId,
      });
    }

    // 3. Update Supplier Account Ledger if supplier was linked
    if (parsed.supplierId) {
      await prisma.ledgerEntry.create({
        data: {
          partyId: parsed.supplierId,
          kind: LedgerKind.INVOICE,
          creditPaise: totalPaise,
          referenceType: "PURCHASE",
          referenceId: purchase.id,
        },
      });
    }

    // 4. Log immutable audit entry
    await auditService.log({
      actorId,
      action: "PURCHASE_RECEIVED",
      entity: "Purchase",
      entityId: purchase.id,
      after: {
        billNo: purchase.billNo,
        totalPaise: purchase.totalPaise,
        supplierId: purchase.supplierId,
        locationId: purchase.locationId,
        itemCount: purchase.items.length,
      },
      ip,
    });

    const fullPurchase = await purchaseRepository.getPurchaseById(purchase.id);
    if (!fullPurchase) {
      throw new PurchaseNotFoundError(purchase.id);
    }
    return fullPurchase;
  }

  async getPurchaseById(role: UserRole, id: string): Promise<PurchaseWithDetails> {
    assertPermission(role, Permission.STOCK_VIEW);
    const purchase = await purchaseRepository.getPurchaseById(id);
    if (!purchase) {
      throw new PurchaseNotFoundError(id);
    }
    return purchase;
  }

  async listPurchases(
    role: UserRole,
    filter: PurchaseListFilter = {}
  ): Promise<{ purchases: PurchaseWithDetails[]; total: number }> {
    assertPermission(role, Permission.STOCK_VIEW);
    const [purchases, total] = await Promise.all([
      purchaseRepository.listPurchases(filter),
      purchaseRepository.countPurchases(filter),
    ]);
    return { purchases, total };
  }

  async getFormData(role: UserRole) {
    assertPermission(role, Permission.STOCK_RECEIVE);
    const [suppliers, locations, products] = await Promise.all([
      purchaseRepository.listSuppliers(),
      purchaseRepository.listLocations(),
      prisma.product.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
          shortCode: true,
          companyId: true,
          company: { select: { id: true, name: true } },
          gstRateBp: true,
          mrpPaise: true,
          packSize: true,
        },
        orderBy: { name: "asc" },
      }),
    ]);
    return { suppliers, locations, products };
  }

  /**
   * Cancel / Void a purchase GRN.
   * Reverses stock movements via compensating ADJUSTMENT movements,
   * creates supplier ledger reversal if applicable, and sets status to CANCELLED.
   */
  async cancelPurchase(
    actorRole: UserRole,
    actorId: string,
    purchaseId: string,
    reason: string,
    ip?: string
  ): Promise<PurchaseWithDetails> {
    assertPermission(actorRole, Permission.STOCK_RECEIVE);
    const purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: { items: true, location: true },
    });

    if (!purchase) {
      throw new PurchaseNotFoundError(purchaseId);
    }

    if (purchase.status === PurchaseStatus.CANCELLED) {
      throw new Error("This purchase receipt is already cancelled");
    }

    const cancelKey = `pur_void_${Date.now()}_${purchase.id}`;

    await prisma.$transaction(async (tx) => {
      // 1. Post compensating movements to reverse stock
      for (const item of purchase.items) {
        if (item.qty > 0) {
          await stockService.postMovement(
            {
              type: MovementType.ADJUSTMENT,
              productId: item.productId,
              fromLocationId: purchase.locationId,
              toLocationId: null,
              qty: item.qty,
              referenceType: "PURCHASE_VOID",
              referenceId: purchase.id,
              reason: `Voided GRN #${purchase.billNo}: ${reason || "Cancelled"}`,
              idempotencyKey: `${cancelKey}_item_${item.id}`,
              actorId,
            },
            tx
          );
        }
      }

      // 2. Reverse supplier ledger entry if supplier and amount exist
      if (purchase.supplierId && purchase.totalPaise > 0) {
        await tx.ledgerEntry.create({
          data: {
            partyId: purchase.supplierId,
            kind: LedgerKind.DEBIT_NOTE,
            debitPaise: purchase.totalPaise,
            referenceType: "PURCHASE_VOID",
            referenceId: purchase.id,
          },
        });
      }

      // 3. Mark purchase as CANCELLED
      await tx.purchase.update({
        where: { id: purchaseId },
        data: {
          status: PurchaseStatus.CANCELLED,
        },
      });
    });

    // 4. Log immutable audit entry
    await auditService.log({
      actorId,
      action: "PURCHASE_CANCELLED",
      entity: "Purchase",
      entityId: purchase.id,
      before: { status: purchase.status },
      after: {
        status: PurchaseStatus.CANCELLED,
        reason,
        reversedItemsCount: purchase.items.length,
      },
      ip,
    });

    const updated = await purchaseRepository.getPurchaseById(purchaseId);
    if (!updated) {
      throw new PurchaseNotFoundError(purchaseId);
    }
    return updated;
  }

  /**
   * Update metadata of an existing purchase receipt (Bill #, Bill Date, Supplier).
   */
  async updatePurchase(
    actorRole: UserRole,
    actorId: string,
    purchaseId: string,
    data: {
      billNo?: string;
      billDate?: Date;
      supplierId?: string | null;
    },
    ip?: string
  ): Promise<PurchaseWithDetails> {
    assertPermission(actorRole, Permission.STOCK_RECEIVE);
    const purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
    });

    if (!purchase) {
      throw new PurchaseNotFoundError(purchaseId);
    }

    if (purchase.status === PurchaseStatus.CANCELLED) {
      throw new Error("Cannot edit a cancelled purchase receipt");
    }

    const updated = await prisma.purchase.update({
      where: { id: purchaseId },
      data: {
        billNo: data.billNo?.trim() || purchase.billNo,
        billDate: data.billDate || purchase.billDate,
        supplierId: data.supplierId !== undefined ? data.supplierId : purchase.supplierId,
      },
    });

    await auditService.log({
      actorId,
      action: "PURCHASE_UPDATED",
      entity: "Purchase",
      entityId: purchase.id,
      before: {
        billNo: purchase.billNo,
        billDate: purchase.billDate,
        supplierId: purchase.supplierId,
      },
      after: {
        billNo: updated.billNo,
        billDate: updated.billDate,
        supplierId: updated.supplierId,
      },
      ip,
    });

    const fullPurchase = await purchaseRepository.getPurchaseById(purchaseId);
    if (!fullPurchase) {
      throw new PurchaseNotFoundError(purchaseId);
    }
    return fullPurchase;
  }
}

export const purchaseService = new PurchaseService();
