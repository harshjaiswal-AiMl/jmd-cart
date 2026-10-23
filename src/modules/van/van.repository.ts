import { prisma } from "@/lib/prisma";
import { Prisma, Location, LocationType, MovementType, Product, User, VanDayStatus } from "@prisma/client";
import { stockService } from "@/modules/stock/stock.service";
import { autoConvertService } from "@/modules/godown/auto-convert.service";
import { getNextSequenceNumber } from "@/lib/invoice-number";
import {
  CreateVanIssueSheetInput,
  VanDayWithDetails,
  VanStockSummary,
  VanStockItem,
  ReconcileVanDayInput,
  VanReconciliationReport,
  VanReconciliationLine,
  VanReconciliationFinancials,
  ConfirmCashHandoverInput,
  CashHandoverWithDetails,
} from "./van.types";

export class CentralGodownNotFoundError extends Error {
  constructor() {
    super("Active Central Godown location not found");
    this.name = "CentralGodownNotFoundError";
  }
}

export class VanNotFoundError extends Error {
  constructor(id: string) {
    super(`Van location '${id}' not found or is not of type VAN`);
    this.name = "VanNotFoundError";
  }
}

export class SalespersonNotAssignedError extends Error {
  constructor(vanName: string) {
    super(`No active salesperson is assigned to '${vanName}'`);
    this.name = "SalespersonNotAssignedError";
  }
}

export class VanAlreadyActiveError extends Error {
  constructor(vanName: string, issueSheetNo: string) {
    super(`Van '${vanName}' already has an active issue sheet (${issueSheetNo}) for today`);
    this.name = "VanAlreadyActiveError";
  }
}

export class VanRepository {
  async listVanLocations(): Promise<(Location & { assignedUser: User | null })[]> {
    return prisma.location.findMany({
      where: {
        type: LocationType.VAN,
        active: true,
      },
      include: {
        assignedUser: true,
      },
      orderBy: { name: "asc" },
    });
  }

  async getVanLocationById(id: string): Promise<(Location & { assignedUser: User | null }) | null> {
    return prisma.location.findFirst({
      where: {
        id,
        type: LocationType.VAN,
      },
      include: {
        assignedUser: true,
      },
    });
  }

  async getCentralGodown(): Promise<Location | null> {
    return prisma.location.findFirst({
      where: {
        type: LocationType.GODOWN,
        active: true,
      },
    });
  }

  async getVanDayById(id: string): Promise<VanDayWithDetails | null> {
    return prisma.vanDay.findUnique({
      where: { id },
      include: {
        vanLocation: true,
        salesperson: true,
        lines: {
          include: {
            product: true,
          },
          orderBy: { product: { name: "asc" } },
        },
      },
    });
  }

  async getActiveVanDayForVan(vanLocationId: string): Promise<VanDayWithDetails | null> {
    return prisma.vanDay.findFirst({
      where: {
        vanLocationId,
        status: VanDayStatus.OPEN,
      },
      include: {
        vanLocation: true,
        salesperson: true,
        lines: {
          include: {
            product: true,
          },
          orderBy: { product: { name: "asc" } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getActiveVanDayForSalesperson(salespersonId: string): Promise<VanDayWithDetails | null> {
    return prisma.vanDay.findFirst({
      where: {
        salespersonId,
        status: VanDayStatus.OPEN,
      },
      include: {
        vanLocation: true,
        salesperson: true,
        lines: {
          include: {
            product: true,
          },
          orderBy: { product: { name: "asc" } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async listVanDays(filters?: {
    vanLocationId?: string;
    salespersonId?: string;
    status?: VanDayStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ vanDays: VanDayWithDetails[]; total: number }> {
    const where: Prisma.VanDayWhereInput = {};

    if (filters?.vanLocationId) where.vanLocationId = filters.vanLocationId;
    if (filters?.salespersonId) where.salespersonId = filters.salespersonId;
    if (filters?.status) where.status = filters.status;

    const [vanDays, total] = await Promise.all([
      prisma.vanDay.findMany({
        where,
        include: {
          vanLocation: true,
          salesperson: true,
          lines: {
            include: {
              product: true,
            },
            orderBy: { product: { name: "asc" } },
          },
        },
        orderBy: { createdAt: "desc" },
        take: filters?.limit ?? 50,
        skip: filters?.offset ?? 0,
      }),
      prisma.vanDay.count({ where }),
    ]);

    return { vanDays, total };
  }

  async createVanIssueSheet(
    actorId: string,
    input: CreateVanIssueSheetInput,
    txClient?: Prisma.TransactionClient
  ): Promise<VanDayWithDetails> {
    const execute = async (tx: Prisma.TransactionClient) => {
      // 1. Fetch Van Location
      const van = await tx.location.findFirst({
        where: { id: input.vanLocationId, type: LocationType.VAN, active: true },
        include: { assignedUser: true },
      });

      if (!van) {
        throw new VanNotFoundError(input.vanLocationId);
      }

      let salesperson = van.assignedUser;
      if (input.salespersonId) {
        const customUser = await tx.user.findUnique({
          where: { id: input.salespersonId },
        });
        if (customUser) {
          salesperson = customUser;
          if (van.assignedUserId !== customUser.id) {
            await tx.location.update({
              where: { id: van.id },
              data: { assignedUserId: customUser.id },
            });
          }
        }
      }

      if (!salesperson) {
        throw new SalespersonNotAssignedError(van.name);
      }

      // 2. Check if Van already has an OPEN van day
      const existingOpen = await tx.vanDay.findFirst({
        where: { vanLocationId: van.id, status: VanDayStatus.OPEN },
      });

      if (existingOpen) {
        throw new VanAlreadyActiveError(van.name, existingOpen.issueSheetNo);
      }

      // 3. Fetch Central Godown (oldest active godown = primary)
      const godown = await tx.location.findFirst({
        where: { type: LocationType.GODOWN, active: true },
        orderBy: { createdAt: "asc" },
      });

      if (!godown) {
        throw new CentralGodownNotFoundError();
      }

      // 4. Fetch Products to calculate total pieces and validate
      const productIds = input.items.map((i) => i.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, active: true },
      });

      const productMap = new Map<string, Product>();
      products.forEach((p) => productMap.set(p.id, p));

      // 5. Generate gapless Sequence for Van Issue Sheet (e.g. VIS/26-27/000001)
      const now = new Date();
      const seq = await getNextSequenceNumber(tx, "VIS", now);
      const issueSheetNo = seq.number;

      // 6. Create VanDay record
      const vanDay = await tx.vanDay.create({
        data: {
          vanLocationId: van.id,
          salespersonId: salesperson.id,
          date: now,
          status: VanDayStatus.OPEN,
          issueSheetNo,
          notes: input.notes?.trim() || null,
          issuedBy: actorId,
        },
      });

      // 7. For each item, create VanDayLine and post TRANSFER stock movement from Godown to Van
      for (const item of input.items) {
        const product = productMap.get(item.productId);
        if (!product) {
          throw new Error(`Product '${item.productId}' not found or inactive`);
        }

        const totalPieces = (item.cartons ?? 0) * product.packSize + (item.pieces ?? 0);
        if (totalPieces <= 0) continue;

        // Check if loose pieces are needed and trigger auto carton -> loose conversion in Godown if required
        const requestedLoose = (item.pieces ?? 0) > 0 ? (item.pieces ?? 0) : totalPieces % product.packSize;
        if (requestedLoose > 0 && product.packSize > 1) {
          const godownBal = await tx.stockBalance.findUnique({
            where: {
              productId_locationId: {
                productId: product.id,
                locationId: godown.id,
              },
            },
          });
          const godownQtyBefore = godownBal?.qty ?? 0;
          if (godownQtyBefore >= totalPieces) {
            await autoConvertService.checkAndRecordAutoConvertInTx(tx, {
              productId: product.id,
              productName: product.name,
              shortCode: product.shortCode,
              packSize: product.packSize,
              godownLocationId: godown.id,
              godownBalanceBefore: godownQtyBefore,
              requestedLoosePieces: requestedLoose,
              referenceType: "VAN_ISSUE",
              referenceId: vanDay.id,
              referenceNumber: issueSheetNo,
              actorId,
            });
          }
        }

        // Create line
        await tx.vanDayLine.create({
          data: {
            vanDayId: vanDay.id,
            productId: product.id,
            issuedQty: totalPieces,
            soldQty: 0,
            returnedQty: 0,
            shortageQty: 0,
            excessQty: 0,
          },
        });

        // Post TRANSFER movement in stock ledger
        const idempotencyKey = `VAN_ISSUE_${vanDay.id}_${product.id}`;
        await stockService.postMovement(
          {
            type: MovementType.TRANSFER,
            productId: product.id,
            fromLocationId: godown.id,
            toLocationId: van.id,
            qty: totalPieces,
            referenceType: "VAN_ISSUE",
            referenceId: vanDay.id,
            reason: `Morning Van Load: ${issueSheetNo} to ${van.name}`,
            idempotencyKey,
            actorId,
          },
          tx
        );
      }

      // 8. Return complete record
      const result = await tx.vanDay.findUniqueOrThrow({
        where: { id: vanDay.id },
        include: {
          vanLocation: true,
          salesperson: true,
          lines: {
            include: {
              product: true,
            },
            orderBy: { product: { name: "asc" } },
          },
        },
      });

      return result;
    };

    if (txClient) {
      return execute(txClient);
    }
    return prisma.$transaction(execute);
  }

  async getVanStockSummary(vanLocationId: string): Promise<VanStockSummary> {
    const van = await this.getVanLocationById(vanLocationId);
    if (!van) {
      throw new VanNotFoundError(vanLocationId);
    }

    const activeVanDay = await this.getActiveVanDayForVan(vanLocationId);

    // Fetch live stock balances in this van
    const balances = await prisma.stockBalance.findMany({
      where: {
        locationId: vanLocationId,
        qty: { gt: 0 },
      },
      include: {
        product: true,
      },
      orderBy: { product: { name: "asc" } },
    });

    let totalPieces = 0;
    let totalValuationPaise = 0;

    const inventory: VanStockItem[] = balances.map((b) => {
      const cartons = Math.floor(b.qty / b.product.packSize);
      const loosePieces = b.qty % b.product.packSize;
      const effectiveMrp = b.product.mrpPaise ?? b.product.priceCPaise ?? 0;
      const valuationPaise = b.qty * effectiveMrp;

      totalPieces += b.qty;
      totalValuationPaise += valuationPaise;

      return {
        product: { ...b.product, mrpPaise: effectiveMrp },
        qty: b.qty,
        cartons,
        loosePieces,
        valuationPaise,
      };
    });

    return {
      vanLocation: van,
      salesperson: van.assignedUser,
      activeVanDay,
      inventory,
      totalPieces,
      totalValuationPaise,
    };
  }

  async getVanReconciliationData(
    vanDayId: string,
    currentCounts?: Map<string, number>,
    txClient?: Prisma.TransactionClient
  ): Promise<VanReconciliationReport> {
    const client = txClient ?? prisma;

    const vanDay = await client.vanDay.findUnique({
      where: { id: vanDayId },
      include: {
        vanLocation: true,
        salesperson: true,
        lines: {
          include: {
            product: true,
          },
          orderBy: { product: { name: "asc" } },
        },
      },
    });

    if (!vanDay) {
      throw new Error(`Van day '${vanDayId}' not found`);
    }

    // Determine time window for invoices and collections on this van day
    const timeWindow: Prisma.DateTimeFilter =
      vanDay.status === VanDayStatus.OPEN
        ? { gte: vanDay.createdAt }
        : { gte: vanDay.createdAt, lte: vanDay.updatedAt };

    // Fetch finalized invoices on this van
    const invoices = await client.invoice.findMany({
      where: {
        channel: "VAN",
        locationId: vanDay.vanLocationId,
        status: "FINAL",
        createdAt: timeWindow,
      },
      include: {
        items: true,
        payments: true,
      },
    });

    // Map product sales
    const soldMap = new Map<string, number>();
    let invoiceTotalPaise = 0;
    let invoiceCashPaise = 0;
    let invoiceUpiPaise = 0;
    let invoicePaidTotalPaise = 0;

    for (const inv of invoices) {
      invoiceTotalPaise += inv.totalPaise;
      for (const item of inv.items) {
        soldMap.set(item.productId, (soldMap.get(item.productId) ?? 0) + item.qty);
      }
      for (const p of inv.payments) {
        if (p.mode === "CASH") invoiceCashPaise += p.amountPaise;
        else if (p.mode === "UPI") invoiceUpiPaise += p.amountPaise;
        invoicePaidTotalPaise += p.amountPaise;
      }
    }
    const invoiceCreditPaise = Math.max(0, invoiceTotalPaise - invoicePaidTotalPaise);

    // Fetch on-route payments/collections
    const routePayments = await client.payment.findMany({
      where: {
        vanLocationId: vanDay.vanLocationId,
        receiptNo: { not: null },
        createdAt: timeWindow,
      },
    });

    let routeCollectionCashPaise = 0;
    let routeCollectionUpiPaise = 0;
    for (const rp of routePayments) {
      if (rp.mode === "CASH") routeCollectionCashPaise += rp.amountPaise;
      else if (rp.mode === "UPI") routeCollectionUpiPaise += rp.amountPaise;
    }

    const totalCashInHandPaise = invoiceCashPaise + routeCollectionCashPaise;
    const totalUpiReceivedPaise = invoiceUpiPaise + routeCollectionUpiPaise;

    // Build reconciliation lines
    const lineProductIds = new Set(vanDay.lines.map((l) => l.productId));
    const extraProductIds = Array.from(soldMap.keys()).filter((pid) => !lineProductIds.has(pid));

    let extraProducts: Product[] = [];
    if (extraProductIds.length > 0) {
      extraProducts = await client.product.findMany({
        where: { id: { in: extraProductIds } },
      });
    }
    const extraProductMap = new Map(extraProducts.map((p) => [p.id, p]));

    const lines: VanReconciliationLine[] = [];
    let totalIssuedValuationPaise = 0;
    let totalSoldValuationPaise = 0;
    let totalExpectedValuationPaise = 0;
    let totalReturnedValuationPaise = 0;
    let totalShortageValuationPaise = 0;
    let totalExcessValuationPaise = 0;

    // Process issued lines
    for (const line of vanDay.lines) {
      const soldQty = soldMap.get(line.productId) ?? line.soldQty ?? 0;
      const expectedQty = Math.max(0, line.issuedQty - soldQty);

      let returnedQty = line.returnedQty ?? 0;
      if (vanDay.status === VanDayStatus.OPEN) {
        if (currentCounts?.has(line.productId)) {
          returnedQty = currentCounts.get(line.productId)!;
        } else {
          returnedQty = expectedQty;
        }
      }

      const shortageQty = Math.max(0, expectedQty - returnedQty);
      const excessQty = Math.max(0, returnedQty - expectedQty);

      const lineMrp = line.product.mrpPaise ?? line.product.priceCPaise ?? 0;
      const shortageValuationPaise = shortageQty * lineMrp;
      const excessValuationPaise = excessQty * lineMrp;
      const netDiscrepancyPaise = excessValuationPaise - shortageValuationPaise;

      totalIssuedValuationPaise += line.issuedQty * lineMrp;
      totalSoldValuationPaise += soldQty * lineMrp;
      totalExpectedValuationPaise += expectedQty * lineMrp;
      totalReturnedValuationPaise += returnedQty * lineMrp;
      totalShortageValuationPaise += shortageValuationPaise;
      totalExcessValuationPaise += excessValuationPaise;

      lines.push({
        productId: line.productId,
        productName: line.product.name,
        shortCode: line.product.shortCode,
        packSize: line.product.packSize,
        mrpPaise: lineMrp,
        issuedQty: line.issuedQty,
        soldQty,
        expectedQty,
        returnedQty,
        shortageQty,
        excessQty,
        shortageValuationPaise,
        excessValuationPaise,
        netDiscrepancyPaise,
      });
    }

    // Process any unissued sold products
    for (const extraId of extraProductIds) {
      const product = extraProductMap.get(extraId);
      if (!product) continue;
      const soldQty = soldMap.get(extraId) ?? 0;
      const expectedQty = 0;
      const returnedQty = currentCounts?.get(extraId) ?? 0;
      const shortageQty = 0;
      const excessQty = returnedQty;
      const extraMrp = product.mrpPaise ?? product.priceCPaise ?? 0;
      const excessValuationPaise = excessQty * extraMrp;

      totalSoldValuationPaise += soldQty * extraMrp;
      totalReturnedValuationPaise += returnedQty * extraMrp;
      totalExcessValuationPaise += excessValuationPaise;

      lines.push({
        productId: product.id,
        productName: product.name,
        shortCode: product.shortCode,
        packSize: product.packSize,
        mrpPaise: extraMrp,
        issuedQty: 0,
        soldQty,
        expectedQty: 0,
        returnedQty,
        shortageQty: 0,
        excessQty,
        shortageValuationPaise: 0,
        excessValuationPaise,
        netDiscrepancyPaise: excessValuationPaise,
      });
    }

    const financials: VanReconciliationFinancials = {
      totalIssuedValuationPaise,
      totalSoldValuationPaise,
      totalExpectedValuationPaise,
      totalReturnedValuationPaise,
      totalShortageValuationPaise,
      totalExcessValuationPaise,
      invoiceCount: invoices.length,
      invoiceTotalPaise,
      invoiceCashPaise,
      invoiceUpiPaise,
      invoiceCreditPaise,
      routeCollectionCount: routePayments.length,
      routeCollectionCashPaise,
      routeCollectionUpiPaise,
      totalCashInHandPaise,
      totalUpiReceivedPaise,
    };

    return {
      vanDay,
      lines,
      financials,
      isReconciled: vanDay.status !== VanDayStatus.OPEN,
    };
  }

  async reconcileVanDay(
    actorId: string,
    input: ReconcileVanDayInput,
    txClient?: Prisma.TransactionClient
  ): Promise<VanReconciliationReport> {
    const execute = async (tx: Prisma.TransactionClient) => {
      // 1. Fetch van day
      const vanDay = await tx.vanDay.findUnique({
        where: { id: input.vanDayId },
        include: {
          vanLocation: true,
          salesperson: true,
          lines: {
            include: { product: true },
          },
        },
      });

      if (!vanDay) {
        throw new Error(`Van day '${input.vanDayId}' not found`);
      }

      if (vanDay.status !== VanDayStatus.OPEN) {
        throw new Error(
          `Van day '${vanDay.issueSheetNo}' is already ${vanDay.status} and cannot be re-reconciled`
        );
      }

      // 2. Fetch Central Godown
      const godown = await tx.location.findFirst({
        where: { type: LocationType.GODOWN, active: true },
        orderBy: { createdAt: "asc" },
      });

      if (!godown) {
        throw new CentralGodownNotFoundError();
      }

      // 3. Map user entered returned quantities: (cartons * packSize) + pieces
      const productMap = new Map<string, Product>();
      vanDay.lines.forEach((l) => productMap.set(l.productId, l.product));

      const missingProductIds = input.items
        .map((i) => i.productId)
        .filter((pid) => !productMap.has(pid));
      if (missingProductIds.length > 0) {
        const extraProducts = await tx.product.findMany({
          where: { id: { in: missingProductIds } },
        });
        extraProducts.forEach((p) => productMap.set(p.id, p));
      }

      const returnedCountMap = new Map<string, number>();
      for (const item of input.items) {
        const product = productMap.get(item.productId);
        if (!product) {
          throw new Error(`Product '${item.productId}' not found`);
        }
        const totalPieces = (item.cartons ?? 0) * product.packSize + (item.pieces ?? 0);
        returnedCountMap.set(item.productId, totalPieces);
      }

      // 4. Compute sold quantities from finalized invoices
      const invoices = await tx.invoice.findMany({
        where: {
          channel: "VAN",
          locationId: vanDay.vanLocationId,
          status: "FINAL",
          createdAt: { gte: vanDay.createdAt },
        },
        include: {
          items: true,
        },
      });

      const soldMap = new Map<string, number>();
      for (const inv of invoices) {
        for (const it of inv.items) {
          soldMap.set(it.productId, (soldMap.get(it.productId) ?? 0) + it.qty);
        }
      }

      // 5. For each line, update line status and post stock movements
      for (const line of vanDay.lines) {
        const soldQty = soldMap.get(line.productId) ?? 0;
        const expectedQty = Math.max(0, line.issuedQty - soldQty);
        const returnedQty = returnedCountMap.get(line.productId) ?? 0;
        const shortageQty = Math.max(0, expectedQty - returnedQty);
        const excessQty = Math.max(0, returnedQty - expectedQty);

        // Update line
        await tx.vanDayLine.update({
          where: { id: line.id },
          data: {
            soldQty,
            returnedQty,
            shortageQty,
            excessQty,
          },
        });

        // Stock Ledger Movements:
        // A) If excess stock is physically returned, adjust van stock up first
        if (excessQty > 0) {
          await stockService.postMovement(
            {
              type: MovementType.ADJUSTMENT,
              productId: line.productId,
              toLocationId: vanDay.vanLocationId,
              qty: excessQty,
              referenceType: "VAN_RECONCILE",
              referenceId: vanDay.id,
              reason: `Evening excess adjustment: ${vanDay.issueSheetNo}`,
              idempotencyKey: `VAN_REC_EXCESS_${vanDay.id}_${line.productId}`,
              actorId,
            },
            tx
          );
        }

        // B) Transfer physical returned goods from Van back to Godown via VAN_RETURN
        if (returnedQty > 0) {
          await stockService.postMovement(
            {
              type: MovementType.VAN_RETURN,
              productId: line.productId,
              fromLocationId: vanDay.vanLocationId,
              toLocationId: godown.id,
              qty: returnedQty,
              referenceType: "VAN_RECONCILE",
              referenceId: vanDay.id,
              reason: `Evening van return: ${vanDay.issueSheetNo}`,
              idempotencyKey: `VAN_REC_RETURN_${vanDay.id}_${line.productId}`,
              actorId,
            },
            tx
          );
        }

        // C) If shortage, adjust van stock down so van location does not retain phantom balance
        if (shortageQty > 0) {
          await stockService.postMovement(
            {
              type: MovementType.ADJUSTMENT,
              productId: line.productId,
              fromLocationId: vanDay.vanLocationId,
              qty: shortageQty,
              referenceType: "VAN_RECONCILE",
              referenceId: vanDay.id,
              reason: `Evening van shortage: ${vanDay.issueSheetNo}`,
              idempotencyKey: `VAN_REC_SHORTAGE_${vanDay.id}_${line.productId}`,
              actorId,
            },
            tx
          );
        }
      }

      // Also handle any extra products returned that were not originally issued
      for (const [prodId, returnedQty] of returnedCountMap.entries()) {
        if (!vanDay.lines.some((l) => l.productId === prodId) && returnedQty > 0) {
          const soldQty = soldMap.get(prodId) ?? 0;
          const excessQty = returnedQty;

          await tx.vanDayLine.create({
            data: {
              vanDayId: vanDay.id,
              productId: prodId,
              issuedQty: 0,
              soldQty,
              returnedQty,
              shortageQty: 0,
              excessQty,
            },
          });

          await stockService.postMovement(
            {
              type: MovementType.ADJUSTMENT,
              productId: prodId,
              toLocationId: vanDay.vanLocationId,
              qty: excessQty,
              referenceType: "VAN_RECONCILE",
              referenceId: vanDay.id,
              reason: `Evening unissued excess adjustment: ${vanDay.issueSheetNo}`,
              idempotencyKey: `VAN_REC_EXCESS_${vanDay.id}_${prodId}`,
              actorId,
            },
            tx
          );

          await stockService.postMovement(
            {
              type: MovementType.VAN_RETURN,
              productId: prodId,
              fromLocationId: vanDay.vanLocationId,
              toLocationId: godown.id,
              qty: returnedQty,
              referenceType: "VAN_RECONCILE",
              referenceId: vanDay.id,
              reason: `Evening unissued return: ${vanDay.issueSheetNo}`,
              idempotencyKey: `VAN_REC_RETURN_${vanDay.id}_${prodId}`,
              actorId,
            },
            tx
          );
        }
      }

      // 6. Update VanDay status to RECONCILED
      const now = new Date();
      await tx.vanDay.update({
        where: { id: vanDay.id },
        data: {
          status: VanDayStatus.RECONCILED,
          reconciledBy: actorId,
          notes: input.notes?.trim() || vanDay.notes,
          updatedAt: now,
        },
      });

      return this.getVanReconciliationData(vanDay.id, returnedCountMap, tx);
    };

    if (txClient) {
      return execute(txClient);
    }
    return prisma.$transaction(execute, {
      maxWait: 5000,
      timeout: 15000,
    });
  }

  async getCashHandoverByVanDay(
    vanDayId: string,
    txClient?: Prisma.TransactionClient
  ): Promise<CashHandoverWithDetails | null> {
    const client = txClient ?? prisma;
    return client.cashHandover.findUnique({
      where: { vanDayId },
      include: {
        vanDay: {
          include: {
            vanLocation: true,
            salesperson: true,
            lines: {
              include: { product: true },
              orderBy: { product: { name: "asc" } },
            },
          },
        },
        salesperson: true,
        receivedBy: true,
      },
    });
  }

  async confirmCashHandover(
    receiverId: string,
    input: ConfirmCashHandoverInput,
    txClient?: Prisma.TransactionClient
  ): Promise<CashHandoverWithDetails> {
    const execute = async (tx: Prisma.TransactionClient) => {
      // 1. Fetch van day
      const vanDay = await tx.vanDay.findUnique({
        where: { id: input.vanDayId },
        include: {
          vanLocation: true,
          salesperson: true,
          cashHandover: true,
        },
      });

      if (!vanDay) {
        throw new Error(`Van day '${input.vanDayId}' not found`);
      }

      if (vanDay.status === VanDayStatus.OPEN) {
        throw new Error(
          `Van day '${vanDay.issueSheetNo}' must be reconciled before confirming cash handover`
        );
      }

      if (vanDay.status === VanDayStatus.CLOSED || vanDay.cashHandover) {
        throw new Error(
          `Cash handover for van day '${vanDay.issueSheetNo}' has already been confirmed and closed`
        );
      }

      // 2. Fetch expected cash in hand from reconciliation report
      const reconciliationReport = await this.getVanReconciliationData(vanDay.id, undefined, tx);
      const expectedCashPaise = reconciliationReport.financials.totalCashInHandPaise;

      // 3. Calculate shortage or excess
      const shortagePaise = Math.max(0, expectedCashPaise - input.receivedCashPaise);
      const excessPaise = Math.max(0, input.receivedCashPaise - expectedCashPaise);

      // 4. Create CashHandover record
      const handover = await tx.cashHandover.create({
        data: {
          vanDayId: vanDay.id,
          salespersonId: vanDay.salespersonId,
          receivedById: receiverId,
          expectedCashPaise,
          receivedCashPaise: input.receivedCashPaise,
          shortagePaise,
          excessPaise,
          notes: input.notes?.trim() || null,
          confirmedAt: new Date(),
        },
        include: {
          vanDay: {
            include: {
              vanLocation: true,
              salesperson: true,
              lines: {
                include: { product: true },
                orderBy: { product: { name: "asc" } },
              },
            },
          },
          salesperson: true,
          receivedBy: true,
        },
      });

      // 5. Update VanDay to CLOSED
      await tx.vanDay.update({
        where: { id: vanDay.id },
        data: {
          status: VanDayStatus.CLOSED,
          closedBy: receiverId,
          updatedAt: new Date(),
        },
      });

      return handover;
    };

    if (txClient) {
      return execute(txClient);
    }
    return prisma.$transaction(execute, {
      maxWait: 5000,
      timeout: 10000,
    });
  }
}

export const vanRepository = new VanRepository();
