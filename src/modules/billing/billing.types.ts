import { z } from "zod";
import {
  InvoiceChannel,
  InvoiceStatus,
  PaymentMode,
  PaymentStatus,
  Invoice,
  InvoiceItem,
  Payment,
  CreditNote,
  Location,
  Party,
  User,
} from "@prisma/client";

export const invoiceItemInputSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  qty: z.number().int().min(1, "Quantity must be at least 1 piece"),
});

export type InvoiceItemInput = z.infer<typeof invoiceItemInputSchema>;

export const paymentInputSchema = z.object({
  mode: z.nativeEnum(PaymentMode),
  amountPaise: z.number().int().min(1, "Payment amount must be greater than zero"),
});

export type PaymentInput = z.infer<typeof paymentInputSchema>;

export const creditOverrideInputSchema = z.object({
  approvedByUserId: z.string().min(1, "Approver user ID is required"),
  reason: z.string().min(3, "Override reason must be at least 3 characters"),
});

export type CreditOverrideInput = z.infer<typeof creditOverrideInputSchema>;

export const finalizeInvoiceInputSchema = z.object({
  channel: z.nativeEnum(InvoiceChannel).default(InvoiceChannel.SHOP),
  locationId: z.string().min(1, "Location ID is required"),
  partyId: z.string().nullable().optional(),
  buyerType: z.string().optional(),
  orderDiscountBp: z.number().int().min(0).max(10000).default(0),
  isInterState: z.boolean().default(false),
  items: z.array(invoiceItemInputSchema).min(1, "At least one item is required"),
  payments: z.array(paymentInputSchema).default([]),
  idempotencyKey: z.string().min(1, "Idempotency key is required"),
  notes: z.string().optional(),
  creditOverride: creditOverrideInputSchema.optional(),
});

export type FinalizeInvoiceInput = z.input<typeof finalizeInvoiceInputSchema>;
export type FinalizeInvoiceOutput = z.output<typeof finalizeInvoiceInputSchema>;

export const cancelInvoiceInputSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required"),
  reason: z.string().min(3, "Cancellation reason must be at least 3 characters"),
});

export type CancelInvoiceInput = z.infer<typeof cancelInvoiceInputSchema>;

export interface InvoiceWithDetails extends Invoice {
  location: Location;
  party: Party | null;
  creator: Pick<User, "id" | "name" | "role"> | null;
  creditOverrideUser: Pick<User, "id" | "name" | "role"> | null;
  items: (InvoiceItem & {
    product: {
      id: string;
      name: string;
      shortCode: string;
      packSize: number;
      packLabel: string;
    };
  })[];
  payments: Payment[];
  creditNotes: CreditNote[];
}

export interface InvoiceListFilters {
  status?: InvoiceStatus;
  locationId?: string;
  partyId?: string;
  channel?: InvoiceChannel;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  limit?: number;
  offset?: number;
}
