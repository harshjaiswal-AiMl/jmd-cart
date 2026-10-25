import { z } from "zod";
import { VanDay, VanDayLine, Location, Product, User, VanDayStatus, CashHandover } from "@prisma/client";

export const vanIssueItemSchema = z
  .object({
    productId: z.string().min(1, "Product ID is required"),
    cartons: z.number().int().min(0).optional().default(0),
    pieces: z.number().int().min(0).optional().default(0),
  })
  .refine((data) => (data.cartons ?? 0) > 0 || (data.pieces ?? 0) > 0, {
    message: "At least 1 carton or piece must be specified per product",
  });

export type VanIssueItemInput = z.input<typeof vanIssueItemSchema>;

export const createVanIssueSheetSchema = z.object({
  vanLocationId: z.string().min(1, "Van location ID is required"),
  salespersonId: z.string().optional(),
  notes: z.string().max(500).optional(),
  items: z.array(vanIssueItemSchema).min(1, "At least one product line is required"),
});

export type CreateVanIssueSheetInput = z.input<typeof createVanIssueSheetSchema>;

export interface VanDayLineWithProduct extends VanDayLine {
  product: Product;
}

export interface VanDayWithDetails extends VanDay {
  vanLocation: Location;
  salesperson: User;
  lines: VanDayLineWithProduct[];
}

export interface VanStockItem {
  product: Product;
  qty: number;
  cartons: number;
  loosePieces: number;
  valuationPaise: number;
}

export interface VanStockSummary {
  vanLocation: Location;
  salesperson: User | null;
  activeVanDay: VanDayWithDetails | null;
  inventory: VanStockItem[];
  totalPieces: number;
  totalValuationPaise: number;
}

export const vanReconcileItemSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  cartons: z.number().int().min(0).default(0),
  pieces: z.number().int().min(0).default(0),
});

export const reconcileVanDaySchema = z.object({
  vanDayId: z.string().min(1, "Van Day ID is required"),
  notes: z.string().max(500).optional(),
  items: z.array(vanReconcileItemSchema),
});

export type ReconcileVanDayInput = z.infer<typeof reconcileVanDaySchema>;

export interface VanReconciliationLine {
  productId: string;
  productName: string;
  shortCode: string;
  packSize: number;
  mrpPaise: number;
  issuedQty: number; // in pieces
  soldQty: number; // in pieces
  expectedQty: number; // in pieces: issued - sold
  returnedQty: number; // in pieces: physical count
  shortageQty: number; // Math.max(0, expected - returned)
  excessQty: number; // Math.max(0, returned - expected)
  shortageValuationPaise: number; // shortageQty * mrpPaise
  excessValuationPaise: number; // excessQty * mrpPaise
  netDiscrepancyPaise: number; // excess - shortage
}

export interface VanReconciliationFinancials {
  totalIssuedValuationPaise: number;
  totalSoldValuationPaise: number;
  totalExpectedValuationPaise: number;
  totalReturnedValuationPaise: number;
  totalShortageValuationPaise: number;
  totalExcessValuationPaise: number;
  // Cash / Route Collections Breakdown
  invoiceCount: number;
  invoiceTotalPaise: number;
  invoiceCashPaise: number;
  invoiceUpiPaise: number;
  invoiceCreditPaise: number;
  routeCollectionCount: number;
  routeCollectionCashPaise: number;
  routeCollectionUpiPaise: number;
  totalCashInHandPaise: number; // invoiceCashPaise + routeCollectionCashPaise
  totalUpiReceivedPaise: number; // invoiceUpiPaise + routeCollectionUpiPaise
}

export interface VanReconciliationReport {
  vanDay: VanDayWithDetails;
  lines: VanReconciliationLine[];
  financials: VanReconciliationFinancials;
  isReconciled: boolean;
}

export const confirmCashHandoverSchema = z.object({
  vanDayId: z.string().min(1, "Van day ID is required"),
  receivedCashPaise: z.number().int().min(0, "Received cash cannot be negative"),
  notes: z.string().max(500).optional(),
});

export type ConfirmCashHandoverInput = z.infer<typeof confirmCashHandoverSchema>;

export interface CashHandoverWithDetails extends CashHandover {
  vanDay: VanDayWithDetails;
  salesperson: User;
  receivedBy: User;
}
