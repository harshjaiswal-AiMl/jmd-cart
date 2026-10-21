import { UserRole, MovementType, AuditStatus, LocationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  transferStockSchema,
  cartonBreakSchema,
  recordDamageSchema,
  stockAdjustmentSchema,
  createAuditSchema,
  openingStockSchema,
  stockCountSetSchema,
} from "./godown.types";
import { assertPermission, Permission } from "@/modules/auth/permissions";
import { stockService } from "@/modules/stock/stock.service";
import { auditService } from "@/modules/audit/audit.service";
import { autoConvertService } from "./auto-convert.service";

export class GodownService {
  /**
   * Transfer stock pieces between locations (e.g. Godown -> Shop, Shop -> Van).
   * If transferring loose pieces from Godown and Godown loose stock is insufficient,
   * automatically converts the required cartons into loose pieces.
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

    // Check if source location is a GODOWN and if loose pieces require auto-converting a carton
    const [fromLoc, product, fromBal] = await Promise.all([
      prisma.location.findUnique({ where: { id: parsed.fromLocationId } }),
      prisma.product.findUnique({ where: { id: parsed.productId } }),
      prisma.stockBalance.findUnique({
        where: {
          productId_locationId: {
            productId: parsed.productId,
            locationId: parsed.fromLocationId,
          },
        },
      }),
    ]);

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

    if (
      fromLoc?.type === LocationType.GODOWN &&
      product &&
      product.packSize > 1 &&
      (fromBal?.qty ?? 0) >= parsed.qty
    ) {
      const looseNeeded = parsed.qty % product.packSize;
      if (looseNeeded > 0) {
        await prisma.$transaction(async (tx) => {
          await autoConvertService.checkAndRecordAutoConvertInTx(tx, {
            productId: product.id,
            productName: product.name,
            shortCode: product.shortCode,
            packSize: product.packSize,
            godownLocationId: fromLoc.id,
            godownBalanceBefore: fromBal?.qty ?? 0,
            requestedLoosePieces: looseNeeded,
            referenceType: "SHOP_TRANSFER",
            referenceId: movement.id,
            referenceNumber: `XFER-${movement.id.slice(-6).toUpperCase()}`,
            actorId,
          });
        });
      }
    }

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

  /**
   * Enter Opening Stock without GRN (`OPENING_STOCK` movement via `stockService.postMovement`).
   */
  async enterOpeningStock(
    actorRole: UserRole,
    actorId: string,
    data: unknown,
    ip?: string
  ) {
    assertPermission(actorRole, Permission.STOCK_ADJUST);
    const parsed = openingStockSchema.parse(data);

    const idempotencyKey =
      parsed.idempotencyKey || `open_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const movement = await stockService.postMovement({
      type: MovementType.ADJUSTMENT,
      productId: parsed.productId,
      toLocationId: parsed.locationId,
      qty: parsed.qty,
      referenceType: "OPENING_STOCK",
      reason: parsed.reason,
      idempotencyKey,
      actorId,
    });

    const resultingBalance = await stockService.getBalance(parsed.productId, parsed.locationId);

    await auditService.log({
      actorId,
      action: "STOCK_OPENING_ENTERED",
      entity: "StockMovement",
      entityId: movement.id,
      after: {
        productId: parsed.productId,
        locationId: parsed.locationId,
        qty: parsed.qty,
        resultingBalance,
        reason: parsed.reason,
      },
      ip,
    });

    return { movement, resultingBalance };
  }

  /**
   * Set Stock Count (computes delta `countedQty - systemQty` and posts `ADJUSTMENT` via `stockService.postMovement`).
   */
  async setStockCount(
    actorRole: UserRole,
    actorId: string,
    data: unknown,
    ip?: string
  ) {
    assertPermission(actorRole, Permission.STOCK_ADJUST);
    const parsed = stockCountSetSchema.parse(data);

    const systemQty = await stockService.getBalance(parsed.productId, parsed.locationId);
    const delta = parsed.countedQty - systemQty;

    if (delta === 0) {
      return {
        movement: null,
        systemQty,
        countedQty: parsed.countedQty,
        delta: 0,
        resultingBalance: systemQty,
      };
    }

    const idempotencyKey =
      parsed.idempotencyKey || `cnt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const movement = await stockService.postMovement({
      type: MovementType.ADJUSTMENT,
      productId: parsed.productId,
      toLocationId: delta > 0 ? parsed.locationId : null,
      fromLocationId: delta < 0 ? parsed.locationId : null,
      qty: Math.abs(delta),
      referenceType: "STOCK_COUNT",
      reason: parsed.reason,
      idempotencyKey,
      actorId,
    });

    const resultingBalance = await stockService.getBalance(parsed.productId, parsed.locationId);

    await auditService.log({
      actorId,
      action: "STOCK_COUNT_SET",
      entity: "StockMovement",
      entityId: movement.id,
      before: { systemQty },
      after: {
        productId: parsed.productId,
        locationId: parsed.locationId,
        systemQty,
        countedQty: parsed.countedQty,
        delta,
        resultingBalance,
        reason: parsed.reason,
      },
      ip,
    });

    return {
      movement,
      systemQty,
      countedQty: parsed.countedQty,
      delta,
      resultingBalance,
    };
  }

  /**
   * Bulk CSV/Excel Stock Update with Preview and Row-Level Error Reporting.
   * Format: `shortCode,cartons,loosePieces,reason`
   * Mode: `"OPENING_STOCK" | "STOCK_COUNT" | "ADJUSTMENT"`
   */
  async previewOrApplyBulkStockCsv(
    actorRole: UserRole,
    actorId: string,
    params: {
      locationId: string;
      mode: "OPENING_STOCK" | "STOCK_COUNT" | "ADJUSTMENT";
      rawCsv: string;
      previewOnly: boolean;
    }
  ) {
    assertPermission(actorRole, Permission.STOCK_ADJUST);

    const lines = params.rawCsv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      throw new Error("CSV content is empty");
    }

    const location = await prisma.location.findUnique({
      where: { id: params.locationId },
    });
    if (!location) {
      throw new Error("Selected location not found");
    }

    const products = await prisma.product.findMany({
      where: { active: true },
      include: {
        stockBalances: {
          where: { locationId: params.locationId },
        },
      },
    });
    const prodByCode = new Map(products.map((p) => [p.shortCode.toUpperCase(), p]));

    // Skip header row if first column is "shortCode"
    const startIdx = lines[0].toLowerCase().startsWith("shortcode") ? 1 : 0;

    const previewRows: Array<{
      rowNumber: number;
      shortCode: string;
      productId?: string;
      productName?: string;
      packSize?: number;
      cartons: number;
      loosePieces: number;
      inputPieces: number;
      currentBalance: number;
      deltaPieces: number;
      resultingBalance: number;
      reason: string;
      error?: string;
    }> = [];

    for (let i = startIdx; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim());
      const rowNumber = i + 1;
      const shortCode = (cols[0] || "").toUpperCase();
      const cartons = parseInt(cols[1] || "0", 10);
      const loosePieces = parseInt(cols[2] || "0", 10);
      const reason = cols.slice(3).join(",").trim() || `${params.mode} bulk upload`;

      if (!shortCode) {
        previewRows.push({
          rowNumber,
          shortCode: "",
          cartons: 0,
          loosePieces: 0,
          inputPieces: 0,
          currentBalance: 0,
          deltaPieces: 0,
          resultingBalance: 0,
          reason,
          error: "Missing product shortCode",
        });
        continue;
      }

      const product = prodByCode.get(shortCode);
      if (!product) {
        previewRows.push({
          rowNumber,
          shortCode,
          cartons: 0,
          loosePieces: 0,
          inputPieces: 0,
          currentBalance: 0,
          deltaPieces: 0,
          resultingBalance: 0,
          reason,
          error: `Product with shortCode "${shortCode}" not found`,
        });
        continue;
      }

      if (Number.isNaN(cartons) || Number.isNaN(loosePieces)) {
        previewRows.push({
          rowNumber,
          shortCode,
          productId: product.id,
          productName: product.name,
          packSize: product.packSize,
          cartons: 0,
          loosePieces: 0,
          inputPieces: 0,
          currentBalance: product.stockBalances[0]?.qty ?? 0,
          deltaPieces: 0,
          resultingBalance: product.stockBalances[0]?.qty ?? 0,
          reason,
          error: "Invalid cartons or loosePieces integer",
        });
        continue;
      }

      const currentBalance = product.stockBalances[0]?.qty ?? 0;
      const inputPieces = cartons * product.packSize + loosePieces;
      let deltaPieces = 0;
      let resultingBalance = currentBalance;
      let error: string | undefined;

      if (params.mode === "OPENING_STOCK") {
        if (inputPieces <= 0) {
          error = "Opening stock quantity must be greater than 0 pieces";
        }
        deltaPieces = inputPieces;
        resultingBalance = currentBalance + inputPieces;
      } else if (params.mode === "STOCK_COUNT") {
        if (inputPieces < 0) {
          error = "Counted stock cannot be negative";
        }
        deltaPieces = inputPieces - currentBalance;
        resultingBalance = inputPieces;
      } else {
        // ADJUSTMENT (+/-)
        if (inputPieces === 0) {
          error = "Adjustment quantity cannot be 0";
        }
        deltaPieces = inputPieces;
        resultingBalance = currentBalance + deltaPieces;
        if (resultingBalance < 0) {
          error = `Resulting balance (${resultingBalance}) cannot be negative`;
        }
      }

      if (reason.length < 3) {
        error = "Reason must be at least 3 characters";
      }

      previewRows.push({
        rowNumber,
        shortCode,
        productId: product.id,
        productName: product.name,
        packSize: product.packSize,
        cartons,
        loosePieces,
        inputPieces,
        currentBalance,
        deltaPieces,
        resultingBalance,
        reason,
        error,
      });
    }

    const errorCount = previewRows.filter((r) => Boolean(r.error)).length;

    if (params.previewOnly || errorCount > 0) {
      return {
        applied: false,
        errorCount,
        rows: previewRows,
      };
    }

    for (const row of previewRows) {
      if (!row.productId) continue;
      if (params.mode === "OPENING_STOCK") {
        await this.enterOpeningStock(actorRole, actorId, {
          productId: row.productId,
          locationId: params.locationId,
          qty: row.inputPieces,
          reason: row.reason,
        });
      } else if (params.mode === "STOCK_COUNT") {
        await this.setStockCount(actorRole, actorId, {
          productId: row.productId,
          locationId: params.locationId,
          countedQty: row.inputPieces,
          reason: row.reason,
        });
      } else {
        await this.adjustStock(actorRole, actorId, {
          productId: row.productId,
          locationId: params.locationId,
          adjustmentQty: row.deltaPieces,
          reason: row.reason,
        });
      }
    }

    return {
      applied: true,
      errorCount: 0,
      rows: previewRows,
    };
  }
}

export const godownService = new GodownService();

