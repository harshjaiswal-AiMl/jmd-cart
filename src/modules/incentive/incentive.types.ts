import { z } from "zod";
import {
  IncentiveRuleScope,
  IncentiveEntryType,
  IncentiveEntryStatus,
  IncentivePayoutStatus,
  UserRole,
} from "@prisma/client";

export {
  IncentiveRuleScope,
  IncentiveEntryType,
  IncentiveEntryStatus,
  IncentivePayoutStatus,
};

export const incentiveSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  defaultPercentBp: z.number().int().min(0).max(10000).default(100), // 100 bp = 1%
  base: z.enum(["PAYABLE", "TAXABLE"]).default("PAYABLE"),
  creditTrigger: z.enum(["HANDOVER", "DELIVERED"]).default("HANDOVER"),
  creditSales: z.enum(["ON_SALE", "ON_COLLECTION"]).default("ON_SALE"),
  eligibleRoles: z
    .array(z.nativeEnum(UserRole))
    .default([
      UserRole.SHOP,
      UserRole.SALESPERSON,
      UserRole.DELIVERY,
      UserRole.WAREHOUSE_MANAGER,
    ]),
  rounding: z.enum(["HALF_UP"]).default("HALF_UP"),
});

export type IncentiveSettings = z.infer<typeof incentiveSettingsSchema>;

export const DEFAULT_INCENTIVE_SETTINGS: IncentiveSettings = {
  enabled: true,
  defaultPercentBp: 100, // 1%
  base: "PAYABLE",
  creditTrigger: "HANDOVER",
  creditSales: "ON_SALE",
  eligibleRoles: [
    UserRole.SHOP,
    UserRole.SALESPERSON,
    UserRole.DELIVERY,
    UserRole.WAREHOUSE_MANAGER,
  ],
  rounding: "HALF_UP",
};

export const createIncentiveRuleSchema = z.object({
  scope: z.nativeEnum(IncentiveRuleScope),
  agentUserId: z.string().nullable().optional(),
  companyId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  productId: z.string().nullable().optional(),
  percentBp: z.number().int().min(0).max(10000),
  validFrom: z.coerce.date().default(() => new Date()),
  validTo: z.coerce.date().nullable().optional(),
  active: z.boolean().default(true),
  note: z.string().nullable().optional(),
});

export type CreateIncentiveRuleInput = z.infer<typeof createIncentiveRuleSchema>;

export interface IncentiveCalculationResult {
  ruleId: string | null;
  ruleScope: string;
  percentBp: number;
  baseAmountPaise: number;
  amountPaise: number;
  explanation: string;
}

export interface IncentiveLedgerFilter {
  period?: string; // "YYYY-MM"
  agentUserId?: string;
  status?: IncentiveEntryStatus;
  type?: IncentiveEntryType;
  channel?: string;
  invoiceId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface MonthlyStatementSummary {
  period: string;
  agentUserId: string;
  agentName: string;
  agentCode: string;
  totalPendingPaise: number;
  totalCreditedPaise: number;
  totalReversedPaise: number;
  totalAdjustmentsPaise: number;
  netPayablePaise: number;
  status: IncentivePayoutStatus;
  isLocked: boolean;
  payoutId?: string | null;
  paidAt?: Date | null;
  paidMethod?: string | null;
  paidReference?: string | null;
}
