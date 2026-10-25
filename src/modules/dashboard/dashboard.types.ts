import { InvoiceChannel, OrderStatus } from "@prisma/client";

export interface DashboardMetricSummary {
  // Sales & Revenue Metrics (Integer Paise)
  todaySalesPaise: number;
  todaySalesCount: number;
  todayCashCollectedPaise: number;
  todayUpiCollectedPaise: number;
  todayCreditGivenPaise: number;
  salesGrowthPercent?: number; // vs yesterday

  // Inventory & Stock
  totalStockValuationPaise: number;
  totalStockUnits: number;
  totalLowStockCount: number;

  // Receivables & Credit
  totalReceivablesPaise: number;
  overdueReceivablesPaise: number;
  overduePartiesCount: number;

  // Van Distribution
  activeVansCount: number;
  closedVansCount: number;
  pendingVanReconciliationCount: number;
  pendingCashHandoverCount: number;

  // Online Store Orders
  pendingOrdersCount: number;
  confirmedOrdersCount: number;
  outForDeliveryOrdersCount: number;
  deliveredOrdersCount: number;
}

export interface ChannelSalesBreakdown {
  channel: InvoiceChannel;
  salesPaise: number;
  invoicesCount: number;
  percent: number;
}

export interface RecentActivityItem {
  id: string;
  type: "INVOICE" | "PAYMENT" | "VAN_DAY" | "ORDER" | "STOCK_AUDIT";
  title: string;
  description: string;
  timestamp: Date;
  badgeText: string;
  badgeColor: string; // Tailwind color class
  amountPaise?: number;
}

export interface GettingStartedStep {
  id: string;
  title: string;
  description: string;
  done: boolean;
  actionLabel: string;
  actionHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

export interface OwnerDashboardData {
  asOfDate: string; // IST YYYY-MM-DD
  metrics: DashboardMetricSummary;
  gettingStartedSteps: GettingStartedStep[];
  channelBreakdown: ChannelSalesBreakdown[];
  topSellingProducts: {
    productId: string;
    name: string;
    shortCode: string;
    qtySold: number;
    salesPaise: number;
  }[];
  criticalAlerts: {
    id: string;
    severity: "CRITICAL" | "WARNING" | "INFO";
    message: string;
    actionLabel: string;
    actionHref: string;
  }[];
  recentActivities: RecentActivityItem[];
}
