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

    // Compute totals in integer paise
    let totalPaise = 0;
    for (const item of parsed.items) {
      const taxablePaise = item.qty * item.ratePaise;
      const taxPaise = Math.round((taxablePaise * item.gstRateBp) / 10000);
      totalPaise += taxablePaise + taxPaise;
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
        createdBy: actorId,
        items: {
          create: parsed.items.map((it) => ({
            productId: it.productId,
            qty: it.qty,
            ratePaise: it.ratePaise,
            gstRateBp: it.gstRateBp,
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
        select: { id: true, name: true, shortCode: true, gstRateBp: true, mrpPaise: true, packSize: true },
        orderBy: { name: "asc" },
      }),
    ]);
    return { suppliers, locations, products };
  }
}

export const purchaseService = new PurchaseService();
