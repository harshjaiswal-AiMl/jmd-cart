import { z } from "zod";
import {
  DebitNote,
  DebitNoteItem,
  Party,
  Location,
  User,
  Product,
} from "@prisma/client";

export const ReturnReasonEnum = z.enum([
  "DAMAGE",
  "EXPIRY",
  "SLOW_MOVING",
  "RATE_DIFFERENCE",
  "RECALL",
  "QUALITY_REJECTION",
  "OTHER",
]);

export type ReturnReason = z.infer<typeof ReturnReasonEnum>;

export const createDebitNoteItemSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  qty: z.number().int().positive("Quantity must be greater than 0"),
  unitPricePaise: z.number().int().nonnegative("Unit price must be non-negative").optional(),
  gstRateBp: z.number().int().nonnegative().optional(),
  batchNo: z.string().optional(),
  reason: z.string().optional(),
});

export const createDebitNoteSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  locationId: z.string().optional(),
  reason: ReturnReasonEnum,
  notes: z.string().optional(),
  items: z.array(createDebitNoteItemSchema).min(1, "At least one product item is required"),
});

export type CreateDebitNoteInput = z.infer<typeof createDebitNoteSchema>;
export type CreateDebitNoteItemInput = z.infer<typeof createDebitNoteItemSchema>;

export type DebitNoteWithDetails = DebitNote & {
  supplier: Party;
  location: Location;
  creator: User | null;
  items: (DebitNoteItem & {
    product: Product;
  })[];
};

export interface CompanyReturnReportFilter {
  supplierId?: string;
  productId?: string;
  startDate?: string;
  endDate?: string;
  reason?: string;
}

export interface StockWiseReturnRow {
  productId: string;
  productName: string;
  shortCode: string;
  companyName: string;
  hsn: string;
  totalQtyReturned: number;
  totalTaxablePaise: number;
  totalTaxPaise: number;
  totalValuationPaise: number;
  returnsCount: number;
  reasonsBreakdown: Record<string, number>;
}

export interface StockWiseReturnReport {
  totalItemsReturned: number;
  totalValuationPaise: number;
  totalDebitNotesCount: number;
  rows: StockWiseReturnRow[];
  asOfDate: string;
}
