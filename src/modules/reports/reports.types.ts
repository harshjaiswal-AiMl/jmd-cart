import { InvoiceChannel, PaymentMode, PartyType } from "@prisma/client";

export interface StockValuationItem {
  productId: string;
  name: string;
  shortCode: string;
  companyName: string;
  categoryName: string;
  packSize: number;
  packLabel: string;
  locations: Record<string, number>;
  totalQty: number;
  cartonCount: number;
  looseCount: number;
  mrpPaise: number;
  costPaise: number;
  valuationPaise: number;
}

export interface StockValuationReport {
  totalProducts: number;
  totalUnits: number;
  totalCartons: number;
  totalValuationPaise: number;
  locationsList: { id: string; name: string }[];
  items: StockValuationItem[];
}

export interface LowStockItem {
  productId: string;
  name: string;
  shortCode: string;
  companyName: string;
  categoryName: string;
  currentStock: number;
  reorderLevel: number;
  deficit: number;
  locations: Record<string, number>;
}

export interface LowStockReport {
  totalLowStockCount: number;
  totalDeficitUnits: number;
  items: LowStockItem[];
}

export interface DailySalesReportFilter {
  date?: string; // YYYY-MM-DD in IST
  channel?: InvoiceChannel;
  locationId?: string;
}

export interface DailySalesReport {
  date: string;
  invoiceCount: number;
  cancelledCount: number;
  totalUnitsSold: number;
  grossSubtotalPaise: number;
  totalDiscountPaise: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  roundOffPaise: number;
  netSalesPaise: number;
  paymentsByMode: {
    mode: PaymentMode;
    amountPaise: number;
    count: number;
  }[];
  taxSummary: {
    gstRateBp: number;
    taxablePaise: number;
    taxPaise: number;
  }[];
  topProducts: {
    productId: string;
    name: string;
    shortCode: string;
    qty: number;
    totalPaise: number;
  }[];
  invoices: {
    id: string;
    number: string;
    createdAt: Date;
    customerName: string;
    channel: string;
    totalPaise: number;
    paymentStatus: string;
    status: string;
  }[];
}

export interface CashTransactionItem {
  id: string;
  invoiceNumber: string;
  channel: string;
  cashierName: string;
  createdAt: Date;
  amountPaise: number;
}

export interface DayEndCashReport {
  date: string;
  locationId?: string;
  locationName?: string;
  totalCashPaise: number;
  transactionsCount: number;
  transactions: CashTransactionItem[];
}

export interface PartyAgeingRow {
  partyId: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  type: PartyType;
  creditEnabled: boolean;
  creditLimitPaise: number;
  creditDays: number;
  totalOutstandingPaise: number;
  advancePaise: number;
  bucket0_15Paise: number;
  bucket16_30Paise: number;
  bucket31_60Paise: number;
  bucket60PlusPaise: number;
  oldestEntryDate?: Date | null;
  maxAgeDays: number;
  isOverdue: boolean;
  overdueDays: number;
  isOverLimit: boolean;
  limitExceededByPaise: number;
}

export interface PartyAgeingSummary {
  totalParties: number;
  partiesWithOutstanding: number;
  totalReceivablesPaise: number;
  totalAdvancePaise: number;
  totalBucket0_15Paise: number;
  totalBucket16_30Paise: number;
  totalBucket31_60Paise: number;
  totalBucket60PlusPaise: number;
  overLimitCount: number;
  overLimitTotalPaise: number;
  overdueCount: number;
  overdueTotalPaise: number;
}

export interface PartyAgeingFilter {
  type?: PartyType;
  overdueOnly?: boolean;
  overLimitOnly?: boolean;
  search?: string;
  minOutstandingPaise?: number;
}

export interface PartyAgeingReport {
  summary: PartyAgeingSummary;
  rows: PartyAgeingRow[];
  asOfDate: string;
}
