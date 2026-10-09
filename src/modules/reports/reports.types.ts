import { InvoiceChannel, PaymentMode } from "@prisma/client";

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
