import { z } from "zod";
import { UserRole } from "@prisma/client";

export enum SlabScope {
  PRODUCT = "PRODUCT",
  CATEGORY = "CATEGORY",
  COMPANY = "COMPANY",
  GLOBAL = "GLOBAL",
}

export enum BuyerTier {
  CUSTOMER = "CUSTOMER",
  RETAILER = "RETAILER",
  WHOLESALER = "WHOLESALER",
}

export const priceSlabRuleSchema = z.object({
  id: z.string().min(1),
  scope: z.nativeEnum(SlabScope),
  targetId: z.string().nullable().optional(),
  targetName: z.string().nullable().optional(),
  minQty: z.number().int().min(1, "Minimum quantity must be at least 1 piece"),
  discountBp: z.number().int().min(0).max(10000, "Discount cannot exceed 100% (10000 bp)"),
  tier: z.nativeEnum(BuyerTier),
  active: z.boolean().default(true),
});

export type PriceSlabRule = z.infer<typeof priceSlabRuleSchema>;

export const createPriceSlabInputSchema = z.object({
  scope: z.nativeEnum(SlabScope),
  targetId: z.string().nullable().optional(),
  targetName: z.string().nullable().optional(),
  minQty: z.number().int().min(1, "Minimum quantity must be at least 1"),
  discountBp: z.number().int().min(0).max(10000, "Discount cannot exceed 100%"),
  tier: z.nativeEnum(BuyerTier),
});

export type CreatePriceSlabInput = z.infer<typeof createPriceSlabInputSchema>;

export interface ResolveLinePriceInput {
  productId: string;
  qty: number;
}

export interface ResolvedLinePrice {
  productId: string;
  productName: string;
  shortCode: string;
  companyId: string | null;
  categoryId: string | null;
  mrpPaise: number;
  qty: number;
  gstRateBp: number;
  matchedScope: SlabScope;
  slabDiscountBp: number;
  effectiveDiscountBp: number;
  unitPricePaise: number;
  lineTotalPaise: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  taxPaise: number;
  tier: BuyerTier;
}

export type PriceListCode = "A" | "B" | "C" | "MRP";

export interface ProductPricingFields {
  id?: string;
  mrpPaise: number | null;
  priceAPaise?: number | null;
  priceBPaise?: number | null;
  priceCPaise?: number | null;
}

export interface ResolvePriceOptions {
  /** If true, and quantitySlabPricePaise is provided, takes Math.min(partyListPrice, quantitySlabPrice) */
  enableQuantityTierPricing?: boolean;
  /** Optional quantity slab price in paise */
  quantitySlabPricePaise?: number | null;
  /** Optional quantity slab tier */
  quantitySlabTier?: BuyerTier | null;
  /** Whether the user is an approved buyer (only needed on storefront; staff POS/Van always trust party type) */
  buyerApproved?: boolean;
}

export interface ResolvedPriceResult {
  unitPricePaise: number;
  mrpPaise: number;
  listUsed: PriceListCode;
  effectiveBuyerTier: BuyerTier;
  discountFromMrpPaise: number;
  discountFromMrpBp: number;
}

export interface PriceOrderingWarning {
  code: "A_GT_B" | "B_GT_C" | "C_GT_MRP" | "A_GT_C" | "A_GT_MRP" | "B_GT_MRP";
  message: string;
}

export interface CalculateOrderPriceInput {
  items: Array<{ productId: string; qty: number; unitPriceOverridePaise?: number }>;
  partyId?: string | null;
  buyerType?: BuyerTier | "SUPPLIER" | null;
  buyerApproved?: boolean;
  orderDiscountBp?: number;
  isInterState?: boolean;
  userRole?: UserRole;
}

export interface TaxSummaryRate {
  gstRateBp: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalTaxPaise: number;
}

export interface OrderPriceResult {
  lines: ResolvedLinePrice[];
  buyerTag: BuyerTier;
  subtotalPaise: number;
  lineDiscountPaise: number;
  orderDiscountPaise: number;
  orderDiscountBp: number;
  netSubtotalPaise: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalTaxPaise: number;
  rawTotalPaise: number;
  roundOffPaise: number;
  totalPaise: number;
  taxSummaryByRate: TaxSummaryRate[];
  requiresDiscountApproval: boolean;
  discountApprovalReason?: string;
}

