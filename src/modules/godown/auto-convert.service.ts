import { Prisma, UserRole, LocationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertPermission, Permission } from "@/modules/auth/permissions";

export interface AutoConvertParams {
  productId: string;
  productName: string;
  shortCode: string;
  packSize: number;
  godownLocationId: string;
  godownBalanceBefore: number;
  requestedLoosePieces: number;
  referenceType: "ORDER" | "VAN_ISSUE" | "SHOP_TRANSFER" | "MANUAL_GODOWN";
  referenceId: string;
  referenceNumber: string;
  actorId?: string | null;
}

export interface CartonConversionEntry {
  id: string;
  createdAt: Date;
  productId: string;
  productName: string;
  shortCode: string;
  packSize: number;
  cartonsOpened: number;
  looseGenerated: number;
  looseUsed: number;
  looseRemaining: number;
  logText: string;
  reason: string;
  referenceType: string;
  referenceId: string;
  referenceNumber: string;
  reversed: boolean;
  reversedAt?: string | null;
  reversedBy?: string | null;
  reversalReason?: string | null;
}

export interface DailyAutoConvertSummary {
  totalCartonsOpenedToday: number;
  totalLooseGeneratedToday: number;
  activeConversionsCount: number;
  entries: CartonConversionEntry[];
}

export class AutoConvertService {
  /**
   * Checks if Godown loose pieces are insufficient for `requestedLoosePieces`.
   * If insufficient and cartons are available in Godown, automatically opens
   * only the required number of cartons (`ceil(deficit / packSize)`),
   * and records an immutable stock/audit log entry:
   * `carton -N, loose +N*packSize`, reason "auto-convert", with order/van/transfer reference.
   */
  async checkAndRecordAutoConvertInTx(
    tx: Prisma.TransactionClient,
    params: AutoConvertParams
  ): Promise<CartonConversionEntry | null> {
    const {
      productId,
      productName,
      shortCode,
      packSize,
      godownLocationId,
      godownBalanceBefore,
      requestedLoosePieces,
      referenceType,
      referenceId,
      referenceNumber,
      actorId,
    } = params;

    if (packSize <= 1 || requestedLoosePieces <= 0) {
      return null;
    }

    const godownLooseBefore = godownBalanceBefore % packSize;

    // If existing loose pieces in Godown already cover the loose request, no carton needs to be opened
    if (godownLooseBefore >= requestedLoosePieces) {
      return null;
    }

    const deficit = requestedLoosePieces - godownLooseBefore;
    const cartonsOpened = Math.ceil(deficit / packSize);
    const looseGenerated = cartonsOpened * packSize;
    const looseRemaining = godownLooseBefore + looseGenerated - requestedLoosePieces;
    const logText = `carton -${cartonsOpened}, loose +${looseGenerated}`;

    const afterPayload = {
      productId,
      productName,
      shortCode,
      packSize,
      godownLocationId,
      godownBalanceBefore,
      godownLooseBefore,
      cartonsOpened,
      looseGenerated,
      looseUsed: requestedLoosePieces,
      looseRemaining,
      logText,
      reason: "auto-convert",
      referenceType,
      referenceId,
      referenceNumber,
      reversed: false,
    };

    const logRecord = await tx.auditLog.create({
      data: {
        actorId: actorId || null,
        action: "CARTON_AUTO_CONVERT",
        entity: "CartonConversion",
        entityId: productId,
        before: {
          cartonsAvailable: Math.floor(godownBalanceBefore / packSize),
          looseAvailable: godownLooseBefore,
        },
        after: afterPayload,
      },
    });

    return {
      id: logRecord.id,
      createdAt: logRecord.createdAt,
      productId,
      productName,
      shortCode,
      packSize,
      cartonsOpened,
      looseGenerated,
      looseUsed: requestedLoosePieces,
      looseRemaining,
      logText,
      reason: "auto-convert",
      referenceType,
      referenceId,
      referenceNumber,
      reversed: false,
    };
  }

  /**
   * Manual Godown "Carton Kholo -> Loose me Convert Karo" action for Godown Keeper.
   * Opens N cartons in Godown into N * packSize loose pieces and logs the conversion.
   */
  async manualConvertInGodown(
    actorRole: UserRole,
    actorId: string,
    input: { productId: string; cartons: number; reason?: string }
  ): Promise<CartonConversionEntry> {
    assertPermission(actorRole, Permission.STOCK_CARTON_BREAK);

    if (!Number.isInteger(input.cartons) || input.cartons <= 0) {
      throw new Error("Cartons to open must be a positive integer");
    }

    const product = await prisma.product.findUniqueOrThrow({
      where: { id: input.productId },
    });

    if (product.packSize <= 1) {
      throw new Error(
        `Product "${product.name}" has packSize = 1 (already loose pieces)`
      );
    }

    const godown = await prisma.location.findFirst({
      where: { type: LocationType.GODOWN, active: true },
      orderBy: { createdAt: "asc" },
    });

    if (!godown) {
      throw new Error("Active Godown location not found");
    }

    const balance = await prisma.stockBalance.findUnique({
      where: {
        productId_locationId: {
          productId: product.id,
          locationId: godown.id,
        },
      },
    });

    const currentQty = balance?.qty ?? 0;
    const availableCartons = Math.floor(currentQty / product.packSize);

    if (availableCartons < input.cartons) {
      throw new Error(
        `Insufficient whole cartons in Godown for "${product.name}". Available cartons: ${availableCartons}, Requested to open: ${input.cartons}`
      );
    }

    const looseGenerated = input.cartons * product.packSize;
    const godownLooseBefore = currentQty % product.packSize;
    const looseRemaining = godownLooseBefore + looseGenerated;
    const logText = `carton -${input.cartons}, loose +${looseGenerated}`;
    const refNo = `GCV/${new Date().toISOString().slice(0, 10).replace(/-/g, "")}/${Math.floor(
      1000 + Math.random() * 9000
    )}`;

    const afterPayload = {
      productId: product.id,
      productName: product.name,
      shortCode: product.shortCode,
      packSize: product.packSize,
      godownLocationId: godown.id,
      godownBalanceBefore: currentQty,
      godownLooseBefore,
      cartonsOpened: input.cartons,
      looseGenerated,
      looseUsed: 0,
      looseRemaining,
      logText,
      reason: input.reason?.trim() || "manual-godown-convert",
      referenceType: "MANUAL_GODOWN",
      referenceId: godown.id,
      referenceNumber: refNo,
      reversed: false,
    };

    const logRecord = await prisma.auditLog.create({
      data: {
        actorId,
        action: "CARTON_AUTO_CONVERT",
        entity: "CartonConversion",
        entityId: product.id,
        before: {
          cartonsAvailable: availableCartons,
          looseAvailable: godownLooseBefore,
        },
        after: afterPayload,
      },
    });

    return {
      id: logRecord.id,
      createdAt: logRecord.createdAt,
      productId: product.id,
      productName: product.name,
      shortCode: product.shortCode,
      packSize: product.packSize,
      cartonsOpened: input.cartons,
      looseGenerated,
      looseUsed: 0,
      looseRemaining,
      logText,
      reason: afterPayload.reason,
      referenceType: "MANUAL_GODOWN",
      referenceId: godown.id,
      referenceNumber: refNo,
      reversed: false,
    };
  }

  /**
   * Safeguard #3: Admin / Godown Keeper can reverse an auto-converted carton entry
   * if physical verification shows the carton was not opened or needs correction.
   */
  async reverseConversion(
    actorRole: UserRole,
    actorId: string,
    conversionId: string,
    reversalReason?: string
  ): Promise<CartonConversionEntry> {
    assertPermission(actorRole, Permission.STOCK_CARTON_BREAK);

    const existing = await prisma.auditLog.findUnique({
      where: { id: conversionId },
    });

    if (!existing || existing.action !== "CARTON_AUTO_CONVERT") {
      throw new Error("Carton conversion record not found");
    }

    const data = (existing.after as Record<string, any>) || {};
    if (data.reversed) {
      throw new Error("This carton conversion has already been reversed");
    }

    const updatedAfter = {
      ...data,
      reversed: true,
      reversedAt: new Date().toISOString(),
      reversedBy: actorId,
      reversalReason: reversalReason?.trim() || "Reversed by Admin/Godown",
    };

    const updated = await prisma.auditLog.update({
      where: { id: conversionId },
      data: {
        after: updatedAfter,
      },
    });

    // Also log the reversal event
    await prisma.auditLog.create({
      data: {
        actorId,
        action: "CARTON_CONVERT_REVERSED",
        entity: "CartonConversion",
        entityId: existing.entityId,
        before: data,
        after: {
          originalConversionId: conversionId,
          logText: `carton +${data.cartonsOpened || 0}, loose -${data.looseGenerated || 0}`,
          reason: updatedAfter.reversalReason,
        },
      },
    });

    return this.mapAuditToEntry(updated);
  }

  /**
   * Safeguard #1 & #2: Get Daily "Auto-Converted Cartons" Report and notification summary.
   */
  async getDailyAutoConvertSummary(limit: number = 50): Promise<DailyAutoConvertSummary> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const logs = await prisma.auditLog.findMany({
      where: {
        action: "CARTON_AUTO_CONVERT",
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const entries = logs.map((l) => this.mapAuditToEntry(l));

    const todayActive = entries.filter(
      (e) => e.createdAt >= startOfToday && !e.reversed
    );

    const totalCartonsOpenedToday = todayActive.reduce(
      (sum, e) => sum + e.cartonsOpened,
      0
    );
    const totalLooseGeneratedToday = todayActive.reduce(
      (sum, e) => sum + e.looseGenerated,
      0
    );

    return {
      totalCartonsOpenedToday,
      totalLooseGeneratedToday,
      activeConversionsCount: todayActive.length,
      entries,
    };
  }

  private mapAuditToEntry(log: {
    id: string;
    createdAt: Date;
    entityId: string | null;
    after: any;
  }): CartonConversionEntry {
    const d = (log.after as Record<string, any>) || {};
    const cartonsOpened = Number(d.cartonsOpened || 0);
    const packSize = Number(d.packSize || 1);
    const looseGenerated = Number(d.looseGenerated || cartonsOpened * packSize);

    return {
      id: log.id,
      createdAt: log.createdAt,
      productId: d.productId || log.entityId || "",
      productName: d.productName || "Product",
      shortCode: d.shortCode || "",
      packSize,
      cartonsOpened,
      looseGenerated,
      looseUsed: Number(d.looseUsed || 0),
      looseRemaining: Number(d.looseRemaining || 0),
      logText: d.logText || `carton -${cartonsOpened}, loose +${looseGenerated}`,
      reason: d.reason || "auto-convert",
      referenceType: d.referenceType || "ORDER",
      referenceId: d.referenceId || "",
      referenceNumber: d.referenceNumber || "",
      reversed: Boolean(d.reversed),
      reversedAt: d.reversedAt || null,
      reversedBy: d.reversedBy || null,
      reversalReason: d.reversalReason || null,
    };
  }
}

export const autoConvertService = new AutoConvertService();
