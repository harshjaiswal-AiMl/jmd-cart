import { prisma } from "@/lib/prisma";
import {
  InvoiceChannel,
  InvoiceStatus,
  PaymentMode,
  Prisma,
} from "@prisma/client";
import {
  StockValuationReport,
  StockValuationItem,
  LowStockReport,
  LowStockItem,
  DailySalesReport,
  DayEndCashReport,
  CashTransactionItem,
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

      // Use product mrpPaise as valuation baseline (or estimated cost base)
      const costPaise = Math.round(product.mrpPaise * 0.8);
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
        mrpPaise: product.mrpPaise,
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
      createdAt: {
        gte: startUtc,
        lte: endUtc,
      },
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
}

export const reportsRepository = new ReportsRepository();
