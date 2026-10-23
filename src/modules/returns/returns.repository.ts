import { prisma } from "@/lib/prisma";
import {
  Prisma,
  LocationType,
  MovementType,
  LedgerKind,
  PartyType,
} from "@prisma/client";
import { getNextSequenceNumber } from "@/lib/invoice-number";
import { stockService } from "@/modules/stock/stock.service";
import { auditService } from "@/modules/audit/audit.service";
import { getISTDateString } from "@/lib/date";
import {
  CreateDebitNoteInput,
  DebitNoteWithDetails,
  CompanyReturnReportFilter,
  StockWiseReturnReport,
  StockWiseReturnRow,
} from "./returns.types";

export class ReturnsRepository {
  /**
   * Creates a formal GST Debit Note and atomically executes RETURN_TO_COMPANY stock movements.
   * Debits the supplier ledger and writes an audit log.
   */
  async createDebitNote(
    input: CreateDebitNoteInput,
    actorId: string,
    txClient?: Prisma.TransactionClient
  ): Promise<DebitNoteWithDetails> {
    const execute = async (tx: Prisma.TransactionClient) => {
      // 1. Resolve Location (Central Godown if not specified)
      let locationId = input.locationId;
      if (!locationId) {
        const defaultGodown = await tx.location.findFirst({
          where: { type: LocationType.GODOWN, active: true },
          orderBy: { createdAt: "asc" },
        });
        if (!defaultGodown) {
          throw new Error("No active Central Godown found for company return");
        }
        locationId = defaultGodown.id;
      } else {
        const loc = await tx.location.findUnique({
          where: { id: locationId },
        });
        if (!loc || !loc.active) {
          throw new Error(`Location '${locationId}' is invalid or inactive`);
        }
      }

      // 2. Validate Supplier
      const supplier = await tx.party.findUnique({
        where: { id: input.supplierId },
      });
      if (!supplier || !supplier.active) {
        throw new Error(`Supplier with id '${input.supplierId}' not found or inactive`);
      }

      // 3. Process Items: fetch products, check stock, calculate GST & lines
      let subtotalPaise = 0;
      let taxPaise = 0;
      const itemsCreateData: {
        productId: string;
        qty: number;
        unitPricePaise: number;
        taxablePaise: number;
        gstRateBp: number;
        taxPaise: number;
        totalPaise: number;
        batchNo?: string;
        reason?: string;
      }[] = [];

      for (const item of input.items) {
        const product = await tx.product.findUniqueOrThrow({
          where: { id: item.productId },
        });

        // Stock availability check at location
        const stockBal = await tx.stockBalance.findUnique({
          where: {
            productId_locationId: {
              productId: item.productId,
              locationId,
            },
          },
        });
        const currentQty = stockBal?.qty ?? 0;
        if (currentQty < item.qty) {
          throw new Error(
            `Insufficient stock for '${product.name}' (${product.shortCode}) at location. Available: ${currentQty}, requested return: ${item.qty}`
          );
        }

        // Valuation: baseline unit price defaults to 80% of MRP if unspecified
        const unitPricePaise =
          item.unitPricePaise !== undefined
            ? item.unitPricePaise
            : Math.round((product.mrpPaise ?? product.priceCPaise ?? 0) * 0.8);

        const gstRateBp =
          item.gstRateBp !== undefined ? item.gstRateBp : product.gstRateBp;

        const lineTaxablePaise = item.qty * unitPricePaise;
        const lineTaxPaise = Math.round((lineTaxablePaise * gstRateBp) / 10000);
        const lineTotalPaise = lineTaxablePaise + lineTaxPaise;

        subtotalPaise += lineTaxablePaise;
        taxPaise += lineTaxPaise;

        itemsCreateData.push({
          productId: item.productId,
          qty: item.qty,
          unitPricePaise,
          taxablePaise: lineTaxablePaise,
          gstRateBp,
          taxPaise: lineTaxPaise,
          totalPaise: lineTotalPaise,
          batchNo: item.batchNo,
          reason: item.reason || input.reason,
        });
      }

      const grandTotalUnrounded = subtotalPaise + taxPaise;
      const nearestRupeePaise = Math.round(grandTotalUnrounded / 100) * 100;
      const roundOffPaise = nearestRupeePaise - grandTotalUnrounded;
      const totalPaise = grandTotalUnrounded + roundOffPaise;

      // 4. Generate locked gapless sequence number: DN/26-27/000001
      const { number, fy } = await getNextSequenceNumber(tx, "DN");

      // 5. Create Debit Note record
      const debitNote = await tx.debitNote.create({
        data: {
          number,
          fy,
          supplierId: input.supplierId,
          locationId,
          reason: input.reason,
          subtotalPaise,
          taxPaise,
          roundOffPaise,
          totalPaise,
          notes: input.notes,
          createdBy: actorId,
          items: {
            create: itemsCreateData,
          },
        },
        include: {
          supplier: true,
          location: true,
          creator: true,
          items: {
            include: { product: true },
          },
        },
      });

      // 6. Atomically deduct inventory via RETURN_TO_COMPANY stock movement
      for (const item of input.items) {
        await stockService.postMovement(
          {
            type: MovementType.RETURN_TO_COMPANY,
            fromLocationId: locationId,
            toLocationId: undefined,
            productId: item.productId,
            qty: item.qty,
            referenceId: debitNote.id,
            idempotencyKey: `ret_comp_${debitNote.id}_${item.productId}`,
          },
          tx
        );
      }

      // 7. Debit the supplier account in ledger (reduces payables to supplier)
      await tx.ledgerEntry.create({
        data: {
          partyId: input.supplierId,
          kind: LedgerKind.DEBIT_NOTE,
          debitPaise: totalPaise,
          creditPaise: 0,
          referenceType: "DEBIT_NOTE",
          referenceId: debitNote.id,
        },
      });

      // 8. Record audit log
      await auditService.log({
        actorId,
        action: "DEBIT_NOTE_CREATE",
        entity: "DebitNote",
        entityId: debitNote.id,
        after: {
          number: debitNote.number,
          supplierId: debitNote.supplierId,
          supplierName: supplier.name,
          totalPaise: debitNote.totalPaise,
          itemCount: debitNote.items.length,
          reason: debitNote.reason,
        },
      });

      return debitNote;
    };

    if (txClient) {
      return execute(txClient);
    }

    return prisma.$transaction(execute, {
      maxWait: 5000,
      timeout: 10000,
    });
  }

  async getDebitNoteById(id: string): Promise<DebitNoteWithDetails | null> {
    return prisma.debitNote.findUnique({
      where: { id },
      include: {
        supplier: true,
        location: true,
        creator: true,
        items: {
          include: { product: true },
        },
      },
    });
  }

  async listDebitNotes(options?: {
    supplierId?: string;
    locationId?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: DebitNoteWithDetails[]; totalCount: number }> {
    const where: Prisma.DebitNoteWhereInput = {};

    if (options?.supplierId) {
      where.supplierId = options.supplierId;
    }

    if (options?.locationId) {
      where.locationId = options.locationId;
    }

    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options.startDate) {
        where.createdAt.gte = options.startDate;
      }
      if (options.endDate) {
        where.createdAt.lte = options.endDate;
      }
    }

    if (options?.search?.trim()) {
      const q = options.search.trim();
      where.OR = [
        { number: { contains: q, mode: "insensitive" } },
        { supplier: { name: { contains: q, mode: "insensitive" } } },
        { reason: { contains: q, mode: "insensitive" } },
      ];
    }

    const [items, totalCount] = await Promise.all([
      prisma.debitNote.findMany({
        where,
        include: {
          supplier: true,
          location: true,
          creator: true,
          items: {
            include: { product: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: options?.limit ?? 50,
        skip: options?.offset ?? 0,
      }),
      prisma.debitNote.count({ where }),
    ]);

    return { items, totalCount };
  }

  /**
   * Generates product-level return summary across company returns and debit notes.
   */
  async getStockWiseReturnReport(
    filter: CompanyReturnReportFilter = {}
  ): Promise<StockWiseReturnReport> {
    const whereItem: Prisma.DebitNoteItemWhereInput = {};

    if (filter.productId) {
      whereItem.productId = filter.productId;
    }

    if (filter.supplierId || filter.startDate || filter.endDate || filter.reason) {
      whereItem.debitNote = {};
      if (filter.supplierId) {
        whereItem.debitNote.supplierId = filter.supplierId;
      }
      if (filter.reason) {
        whereItem.debitNote.reason = filter.reason;
      }
      if (filter.startDate || filter.endDate) {
        whereItem.debitNote.createdAt = {};
        if (filter.startDate) {
          whereItem.debitNote.createdAt.gte = new Date(filter.startDate);
        }
        if (filter.endDate) {
          whereItem.debitNote.createdAt.lte = new Date(filter.endDate);
        }
      }
    }

    const items = await prisma.debitNoteItem.findMany({
      where: whereItem,
      include: {
        product: {
          include: { company: true },
        },
        debitNote: true,
      },
      orderBy: {
        debitNote: { createdAt: "desc" },
      },
    });

    // Group by product
    const productMap = new Map<string, StockWiseReturnRow>();
    let totalItemsReturned = 0;
    let totalValuationPaise = 0;
    const debitNoteIds = new Set<string>();

    for (const item of items) {
      totalItemsReturned += item.qty;
      totalValuationPaise += item.totalPaise;
      debitNoteIds.add(item.debitNoteId);

      const existing = productMap.get(item.productId);
      const reasonKey = item.reason || item.debitNote.reason || "OTHER";

      if (existing) {
        existing.totalQtyReturned += item.qty;
        existing.totalTaxablePaise += item.taxablePaise;
        existing.totalTaxPaise += item.taxPaise;
        existing.totalValuationPaise += item.totalPaise;
        existing.returnsCount += 1;
        existing.reasonsBreakdown[reasonKey] =
          (existing.reasonsBreakdown[reasonKey] || 0) + item.qty;
      } else {
        productMap.set(item.productId, {
          productId: item.productId,
          productName: item.product?.name || "Product",
          shortCode: item.product?.shortCode || "N/A",
          companyName: item.product?.company?.name || "General",
          hsn: item.product?.hsn || "0000",
          totalQtyReturned: item.qty,
          totalTaxablePaise: item.taxablePaise,
          totalTaxPaise: item.taxPaise,
          totalValuationPaise: item.totalPaise,
          returnsCount: 1,
          reasonsBreakdown: {
            [reasonKey]: item.qty,
          },
        });
      }
    }

    const rows = Array.from(productMap.values()).sort(
      (a, b) => b.totalValuationPaise - a.totalValuationPaise
    );

    return {
      totalItemsReturned,
      totalValuationPaise,
      totalDebitNotesCount: debitNoteIds.size,
      rows,
      asOfDate: getISTDateString(),
    };
  }
}

export const returnsRepository = new ReturnsRepository();
