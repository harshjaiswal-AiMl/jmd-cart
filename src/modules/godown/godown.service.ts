import { UserRole, MovementType, AuditStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  transferStockSchema,
  cartonBreakSchema,
  recordDamageSchema,
  stockAdjustmentSchema,
  createAuditSchema,
} from "./godown.types";
import { assertPermission, Permission } from "@/modules/auth/permissions";
import { stockService } from "@/modules/stock/stock.service";
import { auditService } from "@/modules/audit/audit.service";

export class GodownService {
  /**
   * Transfer stock pieces between locations (e.g. Godown -> Shop, Shop -> Van).
   */
  async transferStock(
    actorRole: UserRole,
    actorId: string,
    data: unknown,
    ip?: string
  ) {
    assertPermission(actorRole, Permission.STOCK_TRANSFER);
    const parsed = transferStockSchema.parse(data);

    const idempotencyKey =
      parsed.idempotencyKey || `xfer_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const movement = await stockService.postMovement({
      type: MovementType.TRANSFER,
      productId: parsed.productId,
      fromLocationId: parsed.fromLocationId,
      toLocationId: parsed.toLocationId,
      qty: parsed.qty,
      referenceType: "TRANSFER",
      reason: parsed.reason || "Inter-location stock transfer",
      idempotencyKey,
      actorId,
    });

    await auditService.log({
      actorId,
      action: "STOCK_TRANSFER",
      entity: "StockMovement",
      entityId: movement.id,
      after: {
        productId: parsed.productId,
        fromLocationId: parsed.fromLocationId,
        toLocationId: parsed.toLocationId,
        qty: parsed.qty,
      },
      ip,
    });

    return movement;
  }

  /**
   * Carton Break: converts specified number of cartons into loose pieces at destination (Shop).
   * Total pieces = cartons * product.packSize.
   */
  async cartonBreak(
    actorRole: UserRole,
    actorId: string,
    data: unknown,
    ip?: string
  ) {
    assertPermission(actorRole, Permission.STOCK_CARTON_BREAK);
    const parsed = cartonBreakSchema.parse(data);

    const product = await prisma.product.findUniqueOrThrow({
      where: { id: parsed.productId },
      select: { id: true, name: true, packSize: true, packLabel: true },
    });

    const totalPieces = parsed.cartons * product.packSize;
    const idempotencyKey =
      parsed.idempotencyKey || `cbreak_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const movement = await stockService.postMovement({
      type: MovementType.CARTON_BREAK,
      productId: parsed.productId,
      fromLocationId: parsed.fromLocationId,
      toLocationId: parsed.toLocationId,
      qty: totalPieces,
      referenceType: "CARTON_BREAK",
      reason:
        parsed.reason ||
        `Carton Break: ${parsed.cartons} ${product.packLabel}(s) (${totalPieces} pieces)`,
      idempotencyKey,
      actorId,
    });

    await auditService.log({
      actorId,
      action: "STOCK_CARTON_BREAK",
      entity: "StockMovement",
      entityId: movement.id,
      after: {
        productId: parsed.productId,
        fromLocationId: parsed.fromLocationId,
        toLocationId: parsed.toLocationId,
        cartons: parsed.cartons,
        packSize: product.packSize,
        totalPieces,
      },
      ip,
    });

    return { movement, totalPieces, cartons: parsed.cartons, packSize: product.packSize };
  }

  /**
   * Record Stock Damage or Spoilage.
   */
  async recordDamage(
    actorRole: UserRole,
    actorId: string,
    data: unknown,
    ip?: string
  ) {
    assertPermission(actorRole, Permission.STOCK_ADJUST);
    const parsed = recordDamageSchema.parse(data);

    const idempotencyKey =
      parsed.idempotencyKey || `dmg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const movement = await stockService.postMovement({
      type: MovementType.DAMAGE,
      productId: parsed.productId,
      fromLocationId: parsed.locationId,
      qty: parsed.qty,
      referenceType: "DAMAGE",
      reason: parsed.reason,
      idempotencyKey,
      actorId,
    });

    await auditService.log({
      actorId,
      action: "STOCK_DAMAGE_RECORDED",
      entity: "StockMovement",
      entityId: movement.id,
      after: {
        productId: parsed.productId,
        locationId: parsed.locationId,
        qty: parsed.qty,
        reason: parsed.reason,
      },
      ip,
    });

    return movement;
  }

  /**
   * Manual Stock Adjustment (positive adds stock, negative removes stock).
   */
  async adjustStock(
    actorRole: UserRole,
    actorId: string,
    data: unknown,
    ip?: string
  ) {
    assertPermission(actorRole, Permission.STOCK_ADJUST);
    const parsed = stockAdjustmentSchema.parse(data);

    const idempotencyKey =
      parsed.idempotencyKey || `adj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const movement = await stockService.postMovement({
      type: MovementType.ADJUSTMENT,
      productId: parsed.productId,
      toLocationId: parsed.adjustmentQty > 0 ? parsed.locationId : null,
      fromLocationId: parsed.adjustmentQty < 0 ? parsed.locationId : null,
      qty: Math.abs(parsed.adjustmentQty),
      referenceType: "ADJUSTMENT",
      reason: parsed.reason,
      idempotencyKey,
      actorId,
    });

    await auditService.log({
      actorId,
      action: "STOCK_ADJUSTMENT",
      entity: "StockMovement",
      entityId: movement.id,
      after: {
        productId: parsed.productId,
        locationId: parsed.locationId,
        adjustmentQty: parsed.adjustmentQty,
        reason: parsed.reason,
      },
      ip,
    });

    return movement;
  }

  /**
   * Create a physical stock audit record.
   */
  async createStockAudit(
    actorRole: UserRole,
    actorId: string,
    data: unknown,
    ip?: string
  ) {
    assertPermission(actorRole, Permission.STOCK_AUDIT);
    const parsed = createAuditSchema.parse(data);

    // Retrieve current system balances for every counted product
    const linesWithBalances = await Promise.all(
      parsed.lines.map(async (l) => {
        const systemQty = await stockService.getBalance(l.productId, parsed.locationId);
        return {
          productId: l.productId,
          systemQty,
          countedQty: l.countedQty,
        };
      })
    );

    const audit = await prisma.stockAudit.create({
      data: {
        locationId: parsed.locationId,
        status: AuditStatus.PENDING,
        createdBy: actorId,
        lines: {
          create: linesWithBalances,
        },
      },
      include: {
        lines: {
          include: { product: true },
        },
        location: true,
      },
    });

    await auditService.log({
      actorId,
      action: "STOCK_AUDIT_CREATED",
      entity: "StockAudit",
      entityId: audit.id,
      after: {
        locationId: audit.locationId,
        lineCount: audit.lines.length,
      },
      ip,
    });

    return audit;
  }

  /**
   * Approve a physical stock audit. Posts adjustments to align ledger with counted quantities.
   */
  async approveStockAudit(
    actorRole: UserRole,
    actorId: string,
    auditId: string,
    ip?: string
  ) {
    assertPermission(actorRole, Permission.STOCK_AUDIT);

    const audit = await prisma.stockAudit.findUniqueOrThrow({
      where: { id: auditId },
      include: { lines: true, location: true },
    });

    if (audit.status !== AuditStatus.PENDING) {
      throw new Error(`Audit '${auditId}' is already ${audit.status}`);
    }

    // Apply adjustments for variance lines
    for (const line of audit.lines) {
      const currentQty = await stockService.getBalance(line.productId, audit.locationId);
      const diff = line.countedQty - currentQty;

      if (diff !== 0) {
        await stockService.postMovement({
          type: MovementType.ADJUSTMENT,
          productId: line.productId,
          toLocationId: diff > 0 ? audit.locationId : null,
          fromLocationId: diff < 0 ? audit.locationId : null,
          qty: Math.abs(diff),
          referenceType: "STOCK_AUDIT",
          referenceId: audit.id,
          reason: `Stock Audit #${audit.id} approved adjustment (variance ${diff})`,
          idempotencyKey: `audit_${audit.id}_item_${line.id}`,
          actorId,
        });
      }
    }

    const updated = await prisma.stockAudit.update({
      where: { id: auditId },
      data: { status: AuditStatus.APPROVED },
      include: { lines: { include: { product: true } } },
    });

    await auditService.log({
      actorId,
      action: "STOCK_AUDIT_APPROVED",
      entity: "StockAudit",
      entityId: audit.id,
      after: { status: AuditStatus.APPROVED },
      ip,
    });

    return updated;
  }

  /**
   * Reject a physical stock audit.
   */
  async rejectStockAudit(
    actorRole: UserRole,
    actorId: string,
    auditId: string,
    ip?: string
  ) {
    assertPermission(actorRole, Permission.STOCK_AUDIT);

    const updated = await prisma.stockAudit.update({
      where: { id: auditId },
      data: { status: AuditStatus.REJECTED },
    });

    await auditService.log({
      actorId,
      action: "STOCK_AUDIT_REJECTED",
      entity: "StockAudit",
      entityId: auditId,
      after: { status: AuditStatus.REJECTED },
      ip,
    });

    return updated;
  }
}

export const godownService = new GodownService();
