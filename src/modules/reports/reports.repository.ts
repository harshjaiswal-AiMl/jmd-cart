import { prisma } from "@/lib/prisma";
import {
  InvoiceChannel,
  InvoiceStatus,
  PaymentMode,
  PartyType,
  Prisma,
} from "@prisma/client";
import { getISTDateString } from "@/lib/date";
import {
  StockValuationReport,
  StockValuationItem,
  LowStockReport,
  LowStockItem,
  DailySalesReport,
  DayEndCashReport,
  CashTransactionItem,
  PartyAgeingReport,
  PartyAgeingRow,
  PartyAgeingSummary,
  PartyAgeingFilter,
  Gstr1Report,
  GstB2bInvoiceRow,
  GstB2csSummaryRow,
  GstHsnSummaryRow,
  GstRateBreakdownRow,
  DayBookReport,
  DayBookEntry,
  SalesRegisterReport,
  SalesRegisterRow,
} from "./reports.types";

export class ReportsRepository {
  /**
   * Retrieves stock levels across all locations and computes inventory valuation.
   */
  async getStockValuationReport(): Promise<StockValuationReport> {
    const [locations, products] = await Promise.all([
      prisma.location.findMany({
        where: { active: true },
        select: { id: true, name: true, type: true },
        orderBy: { name: "asc" },
      }),
      prisma.product.findMany({
        where: { active: true },
        include: {
          company: { select: { name: true } },
          category: { select: { name: true } },
          stockBalances: true,
        },
        orderBy: [{ company: { name: "asc" } }, { name: "asc" }],
      }),
    ]);

    let totalUnits = 0;
    let totalCartons = 0;
    let totalValuationPaise = 0;

    const items: StockValuationItem[] = products.map((product) => {
      const locMap: Record<string, number> = {};
      let productQty = 0;

      for (const bal of product.stockBalances) {
        locMap[bal.locationId] = bal.qty;
        productQty += bal.qty;
      }

      const packSize = Math.max(1, product.packSize);
      const cartonCount = Math.floor(productQty / packSize);
      const looseCount = productQty % packSize;

      const effectiveMrp = product.mrpPaise ?? product.priceCPaise ?? 0;
      // Use product mrpPaise as valuation baseline (or estimated cost base)
      const costPaise = Math.round(effectiveMrp * 0.8);
      const lineValuationPaise = productQty * costPaise;

      totalUnits += productQty;
      totalCartons += cartonCount;
      totalValuationPaise += lineValuationPaise;

      return {
        productId: product.id,
        name: product.name,
        shortCode: product.shortCode,
        companyName: product.company?.name || "General",
        categoryName: product.category?.name || "Uncategorized",
        packSize,
        packLabel: product.packLabel,
        locations: locMap,
        totalQty: productQty,
        cartonCount,
        looseCount,
        mrpPaise: effectiveMrp,
        costPaise,
        valuationPaise: lineValuationPaise,
      };
    });

    return {
      totalProducts: products.length,
      totalUnits,
      totalCartons,
      totalValuationPaise,
      locationsList: locations.map((l) => ({ id: l.id, name: l.name })),
      items,
    };
  }

  /**
   * Retrieves products running low on inventory compared to their reorder levels.
   */
  async getLowStockReport(customThreshold?: number): Promise<LowStockReport> {
    const products = await prisma.product.findMany({
      where: { active: true },
      include: {
        company: { select: { name: true } },
        category: { select: { name: true } },
        stockBalances: true,
      },
      orderBy: { name: "asc" },
    });

    const lowStockItems: LowStockItem[] = [];
    let totalDeficitUnits = 0;

    for (const product of products) {
      const locMap: Record<string, number> = {};
      let totalStock = 0;

      for (const bal of product.stockBalances) {
        locMap[bal.locationId] = bal.qty;
        totalStock += bal.qty;
      }

      const effectiveThreshold =
        customThreshold ?? (product.reorderLevel > 0 ? product.reorderLevel : 10);

      if (totalStock <= effectiveThreshold) {
        const deficit = Math.max(0, effectiveThreshold - totalStock);
        totalDeficitUnits += deficit;

        lowStockItems.push({
          productId: product.id,
          name: product.name,
          shortCode: product.shortCode,
          companyName: product.company?.name || "General",
          categoryName: product.category?.name || "Uncategorized",
          currentStock: totalStock,
          reorderLevel: effectiveThreshold,
          deficit,
          locations: locMap,
        });
      }
    }

    // Sort by largest deficit first
    lowStockItems.sort((a, b) => b.deficit - a.deficit);

    return {
      totalLowStockCount: lowStockItems.length,
      totalDeficitUnits,
      items: lowStockItems,
    };
  }

  /**
   * Generates daily sales report for a specified period and optional filters.
   */
  async getDailySalesReport(
    startUtc: Date,
    endUtc: Date,
    dateStr: string,
    channel?: InvoiceChannel,
    locationId?: string
  ): Promise<DailySalesReport> {
    const where: Prisma.InvoiceWhereInput = {
      OR: [
        { finalizedAt: { gte: startUtc, lte: endUtc } },
        { finalizedAt: null, createdAt: { gte: startUtc, lte: endUtc } },
      ],
    };

    if (channel) where.channel = channel;
    if (locationId) where.locationId = locationId;

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        party: { select: { name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, shortCode: true } },
          },
        },
        payments: true,
      },
      orderBy: { createdAt: "desc" },
    });

    let invoiceCount = 0;
    let cancelledCount = 0;
    let totalUnitsSold = 0;
    let grossSubtotalPaise = 0;
    let totalDiscountPaise = 0;
    let taxablePaise = 0;
    let cgstPaise = 0;
    let sgstPaise = 0;
    let igstPaise = 0;
    let roundOffPaise = 0;
    let netSalesPaise = 0;

    const paymentMap = new Map<
      PaymentMode,
      { amountPaise: number; count: number }
    >();
    const taxMap = new Map<number, { taxablePaise: number; taxPaise: number }>();
    const productSalesMap = new Map<
      string,
      { name: string; shortCode: string; qty: number; totalPaise: number }
    >();

    for (const inv of invoices) {
      if (inv.status === InvoiceStatus.CANCELLED) {
        cancelledCount++;
        continue;
      }

      invoiceCount++;
      grossSubtotalPaise += inv.subtotalPaise;
      totalDiscountPaise += inv.discountPaise;
      taxablePaise += inv.taxablePaise;
      cgstPaise += inv.cgstPaise;
      sgstPaise += inv.sgstPaise;
      igstPaise += inv.igstPaise;
      roundOffPaise += inv.roundOffPaise;
      netSalesPaise += inv.totalPaise;

      // Aggregate payments
      for (const p of inv.payments) {
        const cur = paymentMap.get(p.mode) || { amountPaise: 0, count: 0 };
        cur.amountPaise += p.amountPaise;
        cur.count++;
        paymentMap.set(p.mode, cur);
      }

      // Aggregate items and taxes
      for (const it of inv.items) {
        totalUnitsSold += it.qty;

        // Taxes
        const curTax = taxMap.get(it.gstRateBp) || {
          taxablePaise: 0,
          taxPaise: 0,
        };
        curTax.taxablePaise += it.taxablePaise;
        curTax.taxPaise += it.taxPaise;
        taxMap.set(it.gstRateBp, curTax);

        // Product ranking
        const curProd = productSalesMap.get(it.productId) || {
          name: it.product.name,
          shortCode: it.product.shortCode,
          qty: 0,
          totalPaise: 0,
        };
        curProd.qty += it.qty;
        curProd.totalPaise += it.taxablePaise + it.taxPaise;
        productSalesMap.set(it.productId, curProd);
      }
    }

    const paymentsByMode = Array.from(paymentMap.entries()).map(
      ([mode, val]) => ({
        mode,
        amountPaise: val.amountPaise,
        count: val.count,
      })
    );

    const taxSummary = Array.from(taxMap.entries())
      .map(([gstRateBp, val]) => ({
        gstRateBp,
        taxablePaise: val.taxablePaise,
        taxPaise: val.taxPaise,
      }))
      .sort((a, b) => a.gstRateBp - b.gstRateBp);

    const topProducts = Array.from(productSalesMap.entries())
      .map(([productId, val]) => ({
        productId,
        ...val,
      }))
      .sort((a, b) => b.totalPaise - a.totalPaise)
      .slice(0, 10);

    const invoiceSummaries = invoices.map((inv) => ({
      id: inv.id,
      number: inv.number,
      createdAt: inv.createdAt,
      customerName: inv.party?.name || "Walk-in Retail Customer",
      channel: inv.channel,
      totalPaise: inv.totalPaise,
      paymentStatus: inv.paymentStatus,
      status: inv.status,
    }));

    return {
      date: dateStr,
      invoiceCount,
      cancelledCount,
      totalUnitsSold,
      grossSubtotalPaise,
      totalDiscountPaise,
      taxablePaise,
      cgstPaise,
      sgstPaise,
      igstPaise,
      roundOffPaise,
      netSalesPaise,
      paymentsByMode,
      taxSummary,
      topProducts,
      invoices: invoiceSummaries,
    };
  }

  /**
   * Generates Day-End Cash Register report.
   */
  async getDayEndCashReport(
    startUtc: Date,
    endUtc: Date,
    dateStr: string,
    locationId?: string
  ): Promise<DayEndCashReport> {
    const where: Prisma.PaymentWhereInput = {
      mode: PaymentMode.CASH,
      createdAt: {
        gte: startUtc,
        lte: endUtc,
      },
    };

    if (locationId) {
      where.invoice = {
        locationId,
      };
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        invoice: {
          select: {
            id: true,
            number: true,
            channel: true,
            location: { select: { id: true, name: true } },
            creator: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    let totalCashPaise = 0;
    const transactions: CashTransactionItem[] = [];

    for (const p of payments) {
      totalCashPaise += p.amountPaise;
      transactions.push({
        id: p.id,
        invoiceNumber: p.invoice?.number || "Direct Payment",
        channel: p.invoice?.channel || "SHOP",
        cashierName: p.invoice?.creator?.name || "Counter Cashier",
        createdAt: p.createdAt,
        amountPaise: p.amountPaise,
      });
    }

    let locationName: string | undefined;
    if (locationId) {
      const loc = await prisma.location.findUnique({
        where: { id: locationId },
        select: { name: true },
      });
      locationName = loc?.name;
    }

    return {
      date: dateStr,
      locationId,
      locationName,
      totalCashPaise,
      transactionsCount: transactions.length,
      transactions,
    };
  }

  /**
   * Generates accounts receivables ageing report with 0-15, 16-30, 31-60, 60+ days bucketed outstanding.
   * Uses FIFO debit-to-credit matching across chronological party ledger entries.
   */
  async getPartyAgeingReport(
    filters: PartyAgeingFilter = {}
  ): Promise<PartyAgeingReport> {
    const whereClause: Prisma.PartyWhereInput = {
      active: true,
    };

    if (filters.type) {
      whereClause.type = filters.type;
    }

    if (filters.search?.trim()) {
      const q = filters.search.trim();
      whereClause.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { tallyRef: { contains: q, mode: "insensitive" } },
      ];
    }

    const parties = await prisma.party.findMany({
      where: whereClause,
      include: {
        ledgerEntries: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    const now = new Date();
    const asOfDate = getISTDateString();

    const rows: PartyAgeingRow[] = [];

    let totalParties = parties.length;
    let partiesWithOutstanding = 0;
    let totalReceivablesPaise = 0;
    let totalAdvancePaise = 0;
    let totalBucket0_15Paise = 0;
    let totalBucket16_30Paise = 0;
    let totalBucket31_60Paise = 0;
    let totalBucket60PlusPaise = 0;
    let overLimitCount = 0;
    let overLimitTotalPaise = 0;
    let overdueCount = 0;
    let overdueTotalPaise = 0;

    for (const party of parties) {
      let totalDebitPaise = 0;
      let totalCreditPaise = 0;

      for (const entry of party.ledgerEntries) {
        totalDebitPaise += entry.debitPaise;
        totalCreditPaise += entry.creditPaise;
      }

      const totalOutstandingPaise = totalDebitPaise - totalCreditPaise;

      let advancePaise = 0;
      let bucket0_15Paise = 0;
      let bucket16_30Paise = 0;
      let bucket31_60Paise = 0;
      let bucket60PlusPaise = 0;
      let oldestEntryDate: Date | null = null;
      let maxAgeDays = 0;

      if (totalOutstandingPaise < 0) {
        advancePaise = Math.abs(totalOutstandingPaise);
        totalAdvancePaise += advancePaise;
      } else if (totalOutstandingPaise > 0) {
        partiesWithOutstanding++;
        totalReceivablesPaise += totalOutstandingPaise;

        // FIFO allocation of credits against debit entries
        let remainingCredit = totalCreditPaise;

        for (const entry of party.ledgerEntries) {
          if (entry.debitPaise <= 0) continue;

          let unpaidDebit = 0;
          if (remainingCredit >= entry.debitPaise) {
            remainingCredit -= entry.debitPaise;
            continue; // fully paid by earlier or later credits
          } else if (remainingCredit > 0) {
            unpaidDebit = entry.debitPaise - remainingCredit;
            remainingCredit = 0;
          } else {
            unpaidDebit = entry.debitPaise;
          }

          if (unpaidDebit > 0) {
            const ageDays = Math.max(
              0,
              Math.floor((now.getTime() - entry.createdAt.getTime()) / (1000 * 60 * 60 * 24))
            );

            if (!oldestEntryDate) {
              oldestEntryDate = entry.createdAt;
            }
            if (ageDays > maxAgeDays) {
              maxAgeDays = ageDays;
            }

            if (ageDays <= 15) {
              bucket0_15Paise += unpaidDebit;
            } else if (ageDays <= 30) {
              bucket16_30Paise += unpaidDebit;
            } else if (ageDays <= 60) {
              bucket31_60Paise += unpaidDebit;
            } else {
              bucket60PlusPaise += unpaidDebit;
            }
          }
        }

        totalBucket0_15Paise += bucket0_15Paise;
        totalBucket16_30Paise += bucket16_30Paise;
        totalBucket31_60Paise += bucket31_60Paise;
        totalBucket60PlusPaise += bucket60PlusPaise;
      }

      // Overdue check
      let isOverdue = false;
      let overdueDays = 0;
      if (totalOutstandingPaise > 0) {
        if (party.creditDays > 0) {
          if (maxAgeDays > party.creditDays) {
            isOverdue = true;
            overdueDays = maxAgeDays - party.creditDays;
          }
        } else if (maxAgeDays > 0) {
          isOverdue = true;
          overdueDays = maxAgeDays;
        }

        if (isOverdue) {
          overdueCount++;
          overdueTotalPaise += totalOutstandingPaise;
        }
      }

      // Over-limit check
      const isOverLimit =
        party.creditEnabled &&
        party.creditLimitPaise > 0 &&
        totalOutstandingPaise > party.creditLimitPaise;
      const limitExceededByPaise = isOverLimit
        ? totalOutstandingPaise - party.creditLimitPaise
        : 0;

      if (isOverLimit) {
        overLimitCount++;
        overLimitTotalPaise += limitExceededByPaise;
      }

      // Apply filter flags
      if (filters.overdueOnly && !isOverdue) continue;
      if (filters.overLimitOnly && !isOverLimit) continue;
      if (filters.minOutstandingPaise && totalOutstandingPaise < filters.minOutstandingPaise) continue;

      rows.push({
        partyId: party.id,
        name: party.name,
        phone: party.phone,
        address: party.address,
        type: party.type,
        creditEnabled: party.creditEnabled,
        creditLimitPaise: party.creditLimitPaise,
        creditDays: party.creditDays,
        totalOutstandingPaise,
        advancePaise,
        bucket0_15Paise,
        bucket16_30Paise,
        bucket31_60Paise,
        bucket60PlusPaise,
        oldestEntryDate,
        maxAgeDays,
        isOverdue,
        overdueDays,
        isOverLimit,
        limitExceededByPaise,
      });
    }

    // Sort: highest total outstanding first, then oldest age
    rows.sort((a, b) => {
      if (b.totalOutstandingPaise !== a.totalOutstandingPaise) {
        return b.totalOutstandingPaise - a.totalOutstandingPaise;
      }
      return b.maxAgeDays - a.maxAgeDays;
    });

    const summary: PartyAgeingSummary = {
      totalParties,
      partiesWithOutstanding,
      totalReceivablesPaise,
      totalAdvancePaise,
      totalBucket0_15Paise,
      totalBucket16_30Paise,
      totalBucket31_60Paise,
      totalBucket60PlusPaise,
      overLimitCount,
      overLimitTotalPaise,
      overdueCount,
      overdueTotalPaise,
    };

    return {
      summary,
      rows,
      asOfDate,
    };
  }

  /**
   * Generates comprehensive GSTR-1 outward supplies report:
   * - Table 4A: B2B Invoices (registered buyers with GSTIN)
   * - Table 7: B2C Small Invoices (unregistered consumer/retail walk-ins grouped by rate)
   * - Table 12: HSN-wise summary of outward supplies
   * - Rate-wise GST breakdown
   */
  async getGstr1Report(startDateUtc: Date, endDateUtc: Date, periodMonth: string): Promise<Gstr1Report> {
    const invoices = await prisma.invoice.findMany({
      where: {
        status: InvoiceStatus.FINAL,
        createdAt: { gte: startDateUtc, lte: endDateUtc },
      },
      include: {
        party: { select: { id: true, name: true, gstin: true, address: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, hsn: true, gstRateBp: true, packLabel: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const b2bInvoices: GstB2bInvoiceRow[] = [];
    const b2csMap: Record<string, { rateBp: number; taxablePaise: number; cgstPaise: number; sgstPaise: number; totalTaxPaise: number }> = {};
    const hsnMap: Record<string, GstHsnSummaryRow> = {};
    const rateMap: Record<number, GstRateBreakdownRow> = {};

    let totalTaxablePaise = 0;
    let totalCgstPaise = 0;
    let totalSgstPaise = 0;
    let totalIgstPaise = 0;
    let totalTaxPaise = 0;
    let totalInvoiceValuePaise = 0;

    for (const inv of invoices) {
      totalTaxablePaise += inv.taxablePaise;
      totalCgstPaise += inv.cgstPaise;
      totalSgstPaise += inv.sgstPaise;
      totalIgstPaise += inv.igstPaise;
      totalTaxPaise += inv.cgstPaise + inv.sgstPaise + inv.igstPaise;
      totalInvoiceValuePaise += inv.totalPaise;

      const isB2B = Boolean(inv.party?.gstin && inv.party.gstin.trim().length >= 15);
      const placeOfSupply = inv.party?.gstin?.slice(0, 2) ? `${inv.party.gstin.slice(0, 2)}-${inv.party.address || "Bihar"}` : "10-Bihar";

      if (isB2B) {
        b2bInvoices.push({
          invoiceNumber: inv.number,
          invoiceDate: inv.createdAt.toISOString().slice(0, 10),
          partyName: inv.party?.name || "Registered Buyer",
          partyGstin: inv.party?.gstin || "",
          placeOfSupply,
          invoiceType: "REGULAR",
          invoiceValuePaise: inv.totalPaise,
          taxablePaise: inv.taxablePaise,
          cgstPaise: inv.cgstPaise,
          sgstPaise: inv.sgstPaise,
          igstPaise: inv.igstPaise,
          reverseCharge: false,
        });
      }

      for (const item of inv.items) {
        const rateBp = item.gstRateBp;
        const itemTaxable = item.taxablePaise;
        const itemTax = item.taxPaise;
        const itemCgst = Math.floor(itemTax / 2);
        const itemSgst = itemTax - itemCgst;

        // B2CS summary aggregation (if not B2B)
        if (!isB2B) {
          const b2csKey = `${placeOfSupply}_${rateBp}`;
          if (!b2csMap[b2csKey]) {
            b2csMap[b2csKey] = {
              rateBp,
              taxablePaise: 0,
              cgstPaise: 0,
              sgstPaise: 0,
              totalTaxPaise: 0,
            };
          }
          b2csMap[b2csKey].taxablePaise += itemTaxable;
          b2csMap[b2csKey].cgstPaise += itemCgst;
          b2csMap[b2csKey].sgstPaise += itemSgst;
          b2csMap[b2csKey].totalTaxPaise += itemTax;
        }

        // HSN Summary aggregation
        const hsnCode = item.hsn || item.product.hsn || "21069099";
        const hsnKey = `${hsnCode}_${rateBp}`;
        if (!hsnMap[hsnKey]) {
          hsnMap[hsnKey] = {
            hsn: hsnCode,
            description: item.product.name,
            uqc: item.product.packLabel || "PCS",
            totalQty: 0,
            totalTaxablePaise: 0,
            gstRateBp: rateBp,
            cgstPaise: 0,
            sgstPaise: 0,
            igstPaise: 0,
            totalTaxPaise: 0,
          };
        }
        hsnMap[hsnKey].totalQty += item.qty;
        hsnMap[hsnKey].totalTaxablePaise += itemTaxable;
        hsnMap[hsnKey].cgstPaise += itemCgst;
        hsnMap[hsnKey].sgstPaise += itemSgst;
        hsnMap[hsnKey].totalTaxPaise += itemTax;

        // Rate-wise summary
        if (!rateMap[rateBp]) {
          rateMap[rateBp] = {
            gstRateBp: rateBp,
            taxablePaise: 0,
            cgstPaise: 0,
            sgstPaise: 0,
            igstPaise: 0,
            totalTaxPaise: 0,
            invoiceCount: 0,
          };
        }
        rateMap[rateBp].taxablePaise += itemTaxable;
        rateMap[rateBp].cgstPaise += itemCgst;
        rateMap[rateBp].sgstPaise += itemSgst;
        rateMap[rateBp].totalTaxPaise += itemTax;
        rateMap[rateBp].invoiceCount += 1;
      }
    }

    const b2csSummary: GstB2csSummaryRow[] = Object.entries(b2csMap).map(([key, val]) => ({
      placeOfSupply: key.split("_")[0],
      rateBp: val.rateBp,
      taxablePaise: val.taxablePaise,
      cgstPaise: val.cgstPaise,
      sgstPaise: val.sgstPaise,
      totalTaxPaise: val.totalTaxPaise,
    }));

    return {
      periodMonth,
      startDate: startDateUtc.toISOString().slice(0, 10),
      endDate: endDateUtc.toISOString().slice(0, 10),
      b2bInvoices,
      b2csSummary,
      hsnSummary: Object.values(hsnMap).sort((a, b) => b.totalTaxablePaise - a.totalTaxablePaise),
      rateBreakdown: Object.values(rateMap).sort((a, b) => a.gstRateBp - b.gstRateBp),
      totalInvoicesCount: invoices.length,
      totalTaxablePaise,
      totalCgstPaise,
      totalSgstPaise,
      totalIgstPaise,
      totalTaxPaise,
      totalInvoiceValuePaise,
    };
  }

  /**
   * Generates chronological Day Book combining all financial vouchers:
   * Sales Invoices, Supplier Purchases, Customer Receipts, and Debit Notes.
   */
  async getDayBookReport(startUtc: Date, endUtc: Date, dateStr: string): Promise<DayBookReport> {
    const [invoices, purchases, payments, debitNotes] = await Promise.all([
      // Sales Invoices
      prisma.invoice.findMany({
        where: {
          status: InvoiceStatus.FINAL,
          OR: [
            { finalizedAt: { gte: startUtc, lte: endUtc } },
            { finalizedAt: null, createdAt: { gte: startUtc, lte: endUtc } },
          ],
        },
        include: { party: { select: { name: true } } },
      }),

      // Purchases
      prisma.purchase.findMany({
        where: {
          createdAt: { gte: startUtc, lte: endUtc },
        },
        include: { supplier: { select: { name: true } } },
      }),

      // Customer Receipts / Payments
      prisma.payment.findMany({
        where: {
          createdAt: { gte: startUtc, lte: endUtc },
        },
        include: {
          party: { select: { name: true } },
          invoice: { select: { number: true, channel: true } },
        },
      }),

      // Debit Notes (Returns to company)
      prisma.debitNote.findMany({
        where: {
          createdAt: { gte: startUtc, lte: endUtc },
        },
        include: { supplier: { select: { name: true } } },
      }),
    ]);

    const entries: DayBookEntry[] = [];
    let totalDebitPaise = 0;
    let totalCreditPaise = 0;

    for (const inv of invoices) {
      entries.push({
        id: `inv-${inv.id}`,
        voucherNo: inv.number,
        voucherType: "SALES",
        date: inv.createdAt,
        partyName: inv.party?.name || "Cash Customer",
        particulars: `Sales (${inv.channel} channel)`,
        debitPaise: inv.totalPaise,
        creditPaise: 0,
        channel: inv.channel,
      });
      totalDebitPaise += inv.totalPaise;
    }

    for (const pur of purchases) {
      entries.push({
        id: `pur-${pur.id}`,
        voucherNo: pur.billNo,
        voucherType: "PURCHASE",
        date: pur.createdAt,
        partyName: pur.supplier?.name || "Supplier",
        particulars: "Goods Purchase (Inward)",
        debitPaise: 0,
        creditPaise: pur.totalPaise,
      });
      totalCreditPaise += pur.totalPaise;
    }

    for (const pay of payments) {
      entries.push({
        id: `pay-${pay.id}`,
        voucherNo: pay.receiptNo || `PAY-${pay.id.slice(-6)}`,
        voucherType: "RECEIPT",
        date: pay.createdAt,
        partyName: pay.party?.name || "Customer",
        particulars: `Collection received via ${pay.mode}${pay.invoice?.number ? ` against ${pay.invoice.number}` : ""}`,
        debitPaise: pay.amountPaise,
        creditPaise: 0,
        paymentMode: pay.mode,
      });
      totalDebitPaise += pay.amountPaise;
    }

    for (const dn of debitNotes) {
      entries.push({
        id: `dn-${dn.id}`,
        voucherNo: dn.number,
        voucherType: "DEBIT_NOTE",
        date: dn.createdAt,
        partyName: dn.supplier?.name || "Supplier",
        particulars: `Goods Return (${dn.reason || "Supplier Return"})`,
        debitPaise: dn.totalPaise,
        creditPaise: 0,
      });
      totalDebitPaise += dn.totalPaise;
    }

    entries.sort((a, b) => a.date.getTime() - b.date.getTime());

    return {
      date: dateStr,
      totalDebitPaise,
      totalCreditPaise,
      entriesCount: entries.length,
      entries,
    };
  }

  /**
   * Generates formal Sales Register across date range.
   */
  async getSalesRegisterReport(
    startUtc: Date,
    endUtc: Date,
    startDateStr?: string,
    endDateStr?: string
  ): Promise<SalesRegisterReport> {
    const invoices = await prisma.invoice.findMany({
      where: {
        status: InvoiceStatus.FINAL,
        OR: [
          { finalizedAt: { gte: startUtc, lte: endUtc } },
          { finalizedAt: null, createdAt: { gte: startUtc, lte: endUtc } },
        ],
      },
      include: {
        party: { select: { name: true, gstin: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    let totalTaxablePaise = 0;
    let totalCgstPaise = 0;
    let totalSgstPaise = 0;
    let totalIgstPaise = 0;
    let totalTaxPaise = 0;
    let totalNetSalesPaise = 0;

    const rows: SalesRegisterRow[] = invoices.map((inv) => {
      if (inv.status === InvoiceStatus.FINAL) {
        totalTaxablePaise += inv.taxablePaise;
        totalCgstPaise += inv.cgstPaise;
        totalSgstPaise += inv.sgstPaise;
        totalIgstPaise += inv.igstPaise;
        totalTaxPaise += inv.cgstPaise + inv.sgstPaise + inv.igstPaise;
        totalNetSalesPaise += inv.totalPaise;
      }

      return {
        id: inv.id,
        invoiceNumber: inv.number,
        date: inv.createdAt,
        customerName: inv.party?.name || "Cash Customer",
        customerGstin: inv.party?.gstin,
        channel: inv.channel,
        grossAmountPaise: inv.subtotalPaise,
        discountPaise: inv.discountPaise,
        taxablePaise: inv.taxablePaise,
        cgstPaise: inv.cgstPaise,
        sgstPaise: inv.sgstPaise,
        igstPaise: inv.igstPaise,
        roundOffPaise: inv.roundOffPaise,
        netInvoicePaise: inv.totalPaise,
        paymentStatus: inv.paymentStatus,
        status: inv.status,
      };
    });

    return {
      startDate: startDateStr || startUtc.toISOString().slice(0, 10),
      endDate: endDateStr || endUtc.toISOString().slice(0, 10),
      totalInvoices: invoices.length,
      totalTaxablePaise,
      totalCgstPaise,
      totalSgstPaise,
      totalIgstPaise,
      totalTaxPaise,
      totalNetSalesPaise,
      rows,
    };
  }
}

export const reportsRepository = new ReportsRepository();
