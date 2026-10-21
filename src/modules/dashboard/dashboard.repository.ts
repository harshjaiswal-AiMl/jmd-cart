import { prisma } from "@/lib/prisma";
import { getISTDateString, getISTDayRange } from "@/lib/date";
import {
  InvoiceChannel,
  InvoiceStatus,
  OrderStatus,
  PaymentMode,
  PaymentStatus,
  VanDayStatus,
} from "@prisma/client";
import { OwnerDashboardData } from "./dashboard.types";

export class DashboardRepository {
  /**
   * Aggregates real-time KPIs, sales by channel, stock valuation, credit ageing,
   * van distribution, and alerts for the Owner Dashboard.
   */
  async getOwnerDashboardData(dateStr?: string): Promise<OwnerDashboardData> {
    const todayStr = dateStr || getISTDateString();
    const { startUtc, endUtc } = getISTDayRange(todayStr);

    // Run parallel queries across all operational subsystems
    const [
      todayInvoices,
      stockBalances,
      lowStockProducts,
      openVanDays,
      todayPayments,
      allOrders,
      debtorLedger,
      recentInvoices,
      recentPayments,
    ] = await Promise.all([
      // 1. Today's finalized sales invoices
      prisma.invoice.findMany({
        where: {
          status: InvoiceStatus.FINAL,
          createdAt: { gte: startUtc, lte: endUtc },
        },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, shortCode: true },
              },
            },
          },
          payments: true,
        },
      }),

      // 2. All active stock balances with product MRP
      prisma.stockBalance.findMany({
        include: {
          product: {
            select: { id: true, mrpPaise: true, reorderLevel: true },
          },
        },
      }),

      // 3. Products with stock below reorder level
      prisma.product.findMany({
        where: {
          active: true,
          reorderLevel: { gt: 0 },
        },
        include: {
          stockBalances: true,
        },
      }),

      // 4. Van Days opened today or currently active
      prisma.vanDay.findMany({
        where: {
          OR: [
            { status: VanDayStatus.OPEN },
            { status: VanDayStatus.RECONCILED },
            { date: { gte: startUtc, lte: endUtc } },
          ],
        },
      }),

      // 5. Today's recorded payments & collections
      prisma.payment.findMany({
        where: {
          createdAt: { gte: startUtc, lte: endUtc },
        },
      }),

      // 6. Online store orders
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      }),

      // 7. Debtor accounts ledger entries
      prisma.ledgerEntry.findMany({
        include: {
          party: {
            select: { id: true, name: true, creditLimitPaise: true, creditDays: true },
          },
        },
      }),

      // 8. Recent 5 invoices for live activity stream
      prisma.invoice.findMany({
        where: { status: InvoiceStatus.FINAL },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          party: { select: { name: true } },
        },
      }),

      // 9. Recent 5 payments for live activity stream
      prisma.payment.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    // 1. Calculate Today's Sales & Tender Splits
    let todaySalesPaise = 0;
    let todayCashCollectedPaise = 0;
    let todayUpiCollectedPaise = 0;
    let todayCreditGivenPaise = 0;
    const channelSales: Record<InvoiceChannel, { paise: number; count: number }> = {
      SHOP: { paise: 0, count: 0 },
      VAN: { paise: 0, count: 0 },
      ONLINE: { paise: 0, count: 0 },
    };

    const productSalesMap: Record<string, { name: string; shortCode: string; qty: number; paise: number }> = {};

    for (const inv of todayInvoices) {
      todaySalesPaise += inv.totalPaise;
      channelSales[inv.channel].paise += inv.totalPaise;
      channelSales[inv.channel].count += 1;

      // Tender breakdown
      for (const p of inv.payments) {
        if (p.mode === PaymentMode.CASH) todayCashCollectedPaise += p.amountPaise;
        else if (p.mode === PaymentMode.UPI) todayUpiCollectedPaise += p.amountPaise;
        else if (p.mode === PaymentMode.CREDIT) todayCreditGivenPaise += p.amountPaise;
      }

      // Top products map
      for (const item of inv.items) {
        const lineTotalPaise = item.taxablePaise + item.taxPaise;
        if (!productSalesMap[item.productId]) {
          productSalesMap[item.productId] = {
            name: item.product.name,
            shortCode: item.product.shortCode,
            qty: 0,
            paise: 0,
          };
        }
        productSalesMap[item.productId].qty += item.qty;
        productSalesMap[item.productId].paise += lineTotalPaise;
      }
    }

    // Top selling products sorted by quantity
    const topSellingProducts = Object.entries(productSalesMap)
      .map(([productId, data]) => ({
        productId,
        name: data.name,
        shortCode: data.shortCode,
        qtySold: data.qty,
        salesPaise: data.paise,
      }))
      .sort((a, b) => b.qtySold - a.qtySold)
      .slice(0, 5);

    // Channel breakdown percentages
    const channelBreakdown = (Object.keys(channelSales) as InvoiceChannel[]).map((ch) => ({
      channel: ch,
      salesPaise: channelSales[ch].paise,
      invoicesCount: channelSales[ch].count,
      percent: todaySalesPaise > 0 ? Math.round((channelSales[ch].paise / todaySalesPaise) * 100) : 0,
    }));

    // 2. Inventory Valuation & Low Stock
    let totalStockUnits = 0;
    let totalStockValuationPaise = 0;
    for (const bal of stockBalances) {
      totalStockUnits += bal.qty;
      totalStockValuationPaise += bal.qty * (bal.product.mrpPaise ?? 0);
    }

    let totalLowStockCount = 0;
    for (const p of lowStockProducts) {
      const current = p.stockBalances.reduce((acc, b) => acc + b.qty, 0);
      if (current <= p.reorderLevel) {
        totalLowStockCount += 1;
      }
    }

    // 3. Receivables & Overdue Ageing
    const partyLedgerMap: Record<string, { name: string; netPaise: number; limitPaise: number; creditDays: number; oldestDebitDate?: Date }> = {};
    for (const entry of debtorLedger) {
      const pid = entry.partyId;
      if (!partyLedgerMap[pid]) {
        partyLedgerMap[pid] = {
          name: entry.party.name,
          netPaise: 0,
          limitPaise: entry.party.creditLimitPaise,
          creditDays: entry.party.creditDays,
        };
      }
      partyLedgerMap[pid].netPaise += entry.debitPaise - entry.creditPaise;
      if (entry.debitPaise > 0 && !partyLedgerMap[pid].oldestDebitDate) {
        partyLedgerMap[pid].oldestDebitDate = entry.createdAt;
      }
    }

    let totalReceivablesPaise = 0;
    let overdueReceivablesPaise = 0;
    let overduePartiesCount = 0;
    const now = new Date();

    for (const p of Object.values(partyLedgerMap)) {
      if (p.netPaise > 0) {
        totalReceivablesPaise += p.netPaise;

        if (p.oldestDebitDate && p.creditDays > 0) {
          const ageDays = Math.floor((now.getTime() - p.oldestDebitDate.getTime()) / (1000 * 60 * 60 * 24));
          if (ageDays > p.creditDays) {
            overdueReceivablesPaise += p.netPaise;
            overduePartiesCount += 1;
          }
        }
      }
    }

    // 4. Van Distribution Status
    const activeVansCount = openVanDays.filter((v) => v.status === VanDayStatus.OPEN).length;
    const closedVansCount = openVanDays.filter((v) => v.status === VanDayStatus.CLOSED).length;
    const pendingVanReconciliationCount = openVanDays.filter((v) => v.status === VanDayStatus.OPEN).length;
    const pendingCashHandoverCount = openVanDays.filter((v) => v.status === VanDayStatus.RECONCILED).length;

    // 5. Online Store Orders Breakdown
    const pendingOrdersCount = allOrders.filter((o) => o.status === OrderStatus.PENDING).length;
    const confirmedOrdersCount = allOrders.filter((o) => o.status === OrderStatus.CONFIRMED || o.status === OrderStatus.PROCESSING).length;
    const outForDeliveryOrdersCount = allOrders.filter((o) => o.status === OrderStatus.DISPATCHED).length;
    const deliveredOrdersCount = allOrders.filter((o) => o.status === OrderStatus.DELIVERED).length;

    // 6. Critical Actionable Alerts
    const criticalAlerts: OwnerDashboardData["criticalAlerts"] = [];

    if (pendingCashHandoverCount > 0) {
      criticalAlerts.push({
        id: "alert-van-handover",
        severity: "CRITICAL",
        message: `${pendingCashHandoverCount} Van route(s) reconciled and awaiting owner physical cash verification!`,
        actionLabel: "Verify Handover",
        actionHref: "/van/reconciliation",
      });
    }

    if (pendingOrdersCount > 0) {
      criticalAlerts.push({
        id: "alert-pending-orders",
        severity: "WARNING",
        message: `${pendingOrdersCount} new online customer order(s) pending warehouse confirmation & pick list generation.`,
        actionLabel: "View Orders",
        actionHref: "/admin/orders",
      });
    }

    if (totalLowStockCount > 0) {
      criticalAlerts.push({
        id: "alert-low-stock",
        severity: "WARNING",
        message: `${totalLowStockCount} critical inventory product(s) have fallen below their reorder threshold.`,
        actionLabel: "Stock Alerts",
        actionHref: "/admin/reports?tab=lowstock",
      });
    }

    if (overduePartiesCount > 0) {
      criticalAlerts.push({
        id: "alert-overdue-credit",
        severity: "INFO",
        message: `${overduePartiesCount} debtor account(s) have overdue credit beyond agreed terms (Total ₹${(overdueReceivablesPaise / 100).toFixed(0)}).`,
        actionLabel: "Ageing Report",
        actionHref: "/admin/reports?tab=ageing",
      });
    }

    // 7. Recent Activities Stream
    const recentActivities: OwnerDashboardData["recentActivities"] = [];

    for (const inv of recentInvoices) {
      recentActivities.push({
        id: `act-inv-${inv.id}`,
        type: "INVOICE",
        title: `Sales Invoice ${inv.number}`,
        description: `Billed to ${inv.party?.name || "Cash Customer"} (${inv.channel} channel)`,
        timestamp: inv.createdAt,
        badgeText: `₹${(inv.totalPaise / 100).toFixed(0)}`,
        badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
        amountPaise: inv.totalPaise,
      });
    }

    for (const p of recentPayments) {
      recentActivities.push({
        id: `act-pay-${p.id}`,
        type: "PAYMENT",
        title: `Payment Received (${p.mode})`,
        description: p.notes || `Settlement recorded for invoice`,
        timestamp: p.createdAt,
        badgeText: `+₹${(p.amountPaise / 100).toFixed(0)}`,
        badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
        amountPaise: p.amountPaise,
      });
    }

    recentActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // 8. Getting Started Checklist (driven by real DB data per design.md section 10 & architecture.md section 15)
    const [
      businessDetailsSetting,
      companyCount,
      categoryCount,
      productCount,
      partyCount,
      staffCount,
      priceSlabsSetting,
    ] = await Promise.all([
      prisma.setting.findUnique({ where: { key: "business_details" } }),
      prisma.company.count(),
      prisma.category.count(),
      prisma.product.count({ where: { active: true } }),
      prisma.party.count(),
      prisma.user.count({
        where: {
          active: true,
          role: {
            notIn: ["SUPER_ADMIN", "CUSTOMER"],
          },
        },
      }),
      prisma.setting.findUnique({ where: { key: "price_slabs" } }),
    ]);

    const priceSlabCount = Array.isArray(priceSlabsSetting?.value)
      ? (priceSlabsSetting.value as Array<{ active?: boolean }>).filter(
          (s) => s.active !== false
        ).length
      : 0;

    const bizVal = (businessDetailsSetting?.value as Record<string, string> | null) || {};
    const hasBusinessDetails = Boolean(
      bizVal.legalName && bizVal.legalName.trim().length > 0 && bizVal.address && bizVal.address.trim().length > 0
    );

    const gettingStartedSteps: OwnerDashboardData["gettingStartedSteps"] = [
      {
        id: "business-details",
        title: "1. Business details",
        description: hasBusinessDetails
          ? `${bizVal.tradeName || bizVal.legalName} (${bizVal.address})`
          : "Configure legal name, trade name (JMD Cart), GSTIN, FSSAI, and address.",
        done: hasBusinessDetails,
        actionLabel: hasBusinessDetails ? "Edit details" : "Set business details",
        actionHref: "/admin/settings",
      },
      {
        id: "companies-categories",
        title: "2. Companies and categories",
        description: `${companyCount} companies, ${categoryCount} categories configured.`,
        done: companyCount > 0 && categoryCount > 0,
        actionLabel: "Manage brands & categories",
        actionHref: "/admin/catalog",
      },
      {
        id: "products",
        title: "3. Add product / Import products",
        description: `${productCount} active product(s) in catalogue.`,
        done: productCount > 0,
        actionLabel: "+ Add product",
        actionHref: "/admin/catalog",
        secondaryLabel: "Import products",
        secondaryHref: "/admin/catalog/import",
      },
      {
        id: "opening-stock",
        title: "4. Opening stock / Update stock",
        description: `${totalStockUnits.toLocaleString("en-IN")} piece(s) across locations.`,
        done: totalStockUnits > 0,
        actionLabel: "Update stock",
        actionHref: "/godown/stock/update",
        secondaryLabel: "+ GRN",
        secondaryHref: "/godown/purchases/new",
      },
      {
        id: "parties",
        title: "5. Parties",
        description: `${partyCount} customer/retailer/supplier party record(s).`,
        done: partyCount > 0,
        actionLabel: "+ Add party",
        actionHref: "/admin/parties",
        secondaryLabel: "Import Tally CSV",
        secondaryHref: "/admin/parties/import",
      },
      {
        id: "staff-accounts",
        title: "6. Staff accounts",
        description: `${staffCount} staff account(s) (Godown, Shop POS, Van Sales, Delivery, Accounts).`,
        done: staffCount > 0,
        actionLabel: "Manage staff",
        actionHref: "/admin/users",
      },
      {
        id: "settings-slabs",
        title: "7. Settings (slabs, delivery, discount limits)",
        description: `${priceSlabCount} active quantity price slab(s) configured.`,
        done: priceSlabCount > 0,
        actionLabel: "Configure slabs",
        actionHref: "/admin/slabs",
        secondaryLabel: "Settings",
        secondaryHref: "/admin/settings",
      },
    ];

    return {
      asOfDate: todayStr,
      metrics: {
        todaySalesPaise,
        todaySalesCount: todayInvoices.length,
        todayCashCollectedPaise,
        todayUpiCollectedPaise,
        todayCreditGivenPaise,
        totalStockValuationPaise,
        totalStockUnits,
        totalLowStockCount,
        totalReceivablesPaise,
        overdueReceivablesPaise,
        overduePartiesCount,
        activeVansCount,
        closedVansCount,
        pendingVanReconciliationCount,
        pendingCashHandoverCount,
        pendingOrdersCount,
        confirmedOrdersCount,
        outForDeliveryOrdersCount,
        deliveredOrdersCount,
      },
      gettingStartedSteps,
      channelBreakdown,
      topSellingProducts,
      criticalAlerts,
      recentActivities: recentActivities.slice(0, 10),
    };
  }
}

export const dashboardRepository = new DashboardRepository();
