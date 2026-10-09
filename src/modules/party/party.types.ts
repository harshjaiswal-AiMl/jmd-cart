import { z } from "zod";
import { PartyType, Party, LedgerEntry } from "@prisma/client";

export const partyTypeSchema = z.nativeEnum(PartyType);

export const createPartySchema = z.object({
  name: z.string().min(2, "Party name must be at least 2 characters").max(150),
  type: partyTypeSchema.default(PartyType.CUSTOMER),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Invalid 10-digit Indian phone number")
    .optional()
    .or(z.literal("")),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  gstin: z
    .string()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Invalid 15-character GSTIN format")
    .optional()
    .or(z.literal("")),
  address: z.string().max(300).optional().or(z.literal("")),
  creditEnabled: z.boolean().default(false),
  creditLimitPaise: z.number().int().min(0, "Credit limit cannot be negative").default(0),
  creditDays: z.number().int().min(0).max(365, "Credit days cannot exceed 365").default(0),
  openingOutstandingPaise: z.number().int().default(0), // Positive: Customer owes distributor; Negative: Advance / Distributor owes
  tallyRef: z.string().max(100).optional().or(z.literal("")),
  active: z.boolean().default(true),
});

export type CreatePartyInput = z.input<typeof createPartySchema>;
export type CreatePartyOutput = z.output<typeof createPartySchema>;

export const updatePartySchema = createPartySchema.partial().extend({
  id: z.string().cuid(),
});

export type UpdatePartyInput = z.input<typeof updatePartySchema>;
export type UpdatePartyOutput = z.output<typeof updatePartySchema>;

export const partySearchQuerySchema = z.object({
  q: z.string().optional(),
  type: partyTypeSchema.optional(),
  creditOnly: z.boolean().optional(),
  activeOnly: z.boolean().optional().default(true),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export type PartySearchQuery = z.infer<typeof partySearchQuerySchema>;
export type PartySearchQueryInput = z.input<typeof partySearchQuerySchema>;

export interface PartyWithOutstanding extends Party {
  outstandingPaise: number;
}

export interface TallyPartyRowError {
  row: number;
  column?: string;
  value?: string;
  message: string;
}

export interface TallyPartyImportResult {
  total: number;
  created: number;
  updated: number;
  failed: number;
  errors: TallyPartyRowError[];
}

export const recordCollectionInputSchema = z.object({
  partyId: z.string().min(1, "Party is required"),
  amountPaise: z.number().int().positive("Amount must be greater than zero"),
  mode: z.enum(["CASH", "UPI", "CARD"]),
  vanLocationId: z.string().nullable().optional(),
  notes: z.string().max(255).optional(),
});

export type RecordCollectionInput = z.infer<typeof recordCollectionInputSchema>;

export interface CollectionReceipt {
  id: string;
  receiptNo: string;
  partyId: string;
  partyName: string;
  partyPhone: string | null;
  amountPaise: number;
  mode: "CASH" | "UPI" | "CARD";
  vanLocationId: string | null;
  vanName: string | null;
  notes: string | null;
  collectedById: string | null;
  collectedByName: string | null;
  previousOutstandingPaise: number;
  currentOutstandingPaise: number;
  createdAt: Date;
}

export const partyLedgerFilterSchema = z.object({
  partyId: z.string().min(1, "Party ID is required"),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});

export type PartyLedgerFilter = z.infer<typeof partyLedgerFilterSchema>;
export type PartyLedgerFilterInput = z.input<typeof partyLedgerFilterSchema>;

export interface PartyLedgerRow {
  id: string;
  createdAt: Date;
  kind: "INVOICE" | "RECEIPT" | "CREDIT_NOTE" | "DEBIT_NOTE" | "OPENING" | "ADJUSTMENT";
  referenceType: string | null;
  referenceId: string | null;
  debitPaise: number;
  creditPaise: number;
  runningBalancePaise: number;
}

export interface PartyLedgerStatement {
  party: PartyWithOutstanding;
  openingBalancePaise: number;
  entries: PartyLedgerRow[];
  totalDebitPaise: number;
  totalCreditPaise: number;
  closingBalancePaise: number;
}
