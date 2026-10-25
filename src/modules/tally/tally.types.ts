export type TallyExportFormat = "XML" | "CSV";

export type TallyVoucherType = "SALES" | "RECEIPT" | "PURCHASE" | "PAYMENT" | "CREDIT_NOTE" | "DEBIT_NOTE";

export interface TallyExportFilter {
  format?: TallyExportFormat;
  voucherTypes?: TallyVoucherType[];
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
}

export interface TallySalesVoucherItem {
  productName: string;
  qty: number;
  ratePaise: number;
  mrpPaise: number;
  unit: string;
  amountPaise: number;
  discountBp: number;
  gstRateBp: number;
}

export interface TallySalesVoucher {
  voucherNumber: string;
  date: string; // YYYY-MM-DD
  partyName: string;
  partyGstin?: string | null;
  placeOfSupply: string;
  narration: string;
  subtotalPaise: number;
  discountPaise: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  roundOffPaise: number;
  totalPaise: number;
  items: TallySalesVoucherItem[];
}

export interface TallyReceiptVoucher {
  voucherNumber: string;
  date: string; // YYYY-MM-DD
  partyName: string;
  amountPaise: number;
  mode: string;
  narration: string;
}

export interface TallyMasterLedger {
  name: string;
  parent: "Sundry Debtors" | "Sundry Creditors" | "Sales Accounts" | "Purchase Accounts" | "Direct Incomes";
  gstin?: string | null;
  phone?: string | null;
  address?: string | null;
  openingBalancePaise: number;
  creditLimitPaise: number;
}

export interface TallyExportResult {
  filename: string;
  mimeType: string;
  content: string;
  summary: {
    startDate: string;
    endDate: string;
    salesCount: number;
    receiptsCount: number;
    totalSalesPaise: number;
    totalReceiptsPaise: number;
  };
}
