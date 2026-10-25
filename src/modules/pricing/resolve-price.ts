import {
  BuyerTier,
  ProductPricingFields,
  ResolvePriceOptions,
  ResolvedPriceResult,
  PriceListCode,
  PriceOrderingWarning,
} from "./pricing.types";

export const TIER_RANKS: Record<BuyerTier, number> = {
  [BuyerTier.CUSTOMER]: 1,
  [BuyerTier.RETAILER]: 2,
  [BuyerTier.WHOLESALER]: 3,
};

/**
 * Validate A <= B <= C <= MRP ordering on a product's prices.
 * Returns warnings (does NOT block save/import per spec).
 */
export function validatePriceOrdering(product: ProductPricingFields): PriceOrderingWarning[] {
  const warnings: PriceOrderingWarning[] = [];
  const { mrpPaise, priceAPaise, priceBPaise, priceCPaise } = product;

  if (priceAPaise != null && priceBPaise != null && priceAPaise > priceBPaise) {
    warnings.push({
      code: "A_GT_B",
      message: `Price A (${(priceAPaise / 100).toFixed(2)}) is greater than Price B (${(priceBPaise / 100).toFixed(2)})`,
    });
  }

  if (priceBPaise != null && priceCPaise != null && priceBPaise > priceCPaise) {
    warnings.push({
      code: "B_GT_C",
      message: `Price B (${(priceBPaise / 100).toFixed(2)}) is greater than Price C (${(priceCPaise / 100).toFixed(2)})`,
    });
  }

  if (priceAPaise != null && priceCPaise != null && priceAPaise > priceCPaise) {
    warnings.push({
      code: "A_GT_C",
      message: `Price A (${(priceAPaise / 100).toFixed(2)}) is greater than Price C (${(priceCPaise / 100).toFixed(2)})`,
    });
  }

  if (mrpPaise != null && mrpPaise > 0) {
    if (priceCPaise != null && priceCPaise > mrpPaise) {
      warnings.push({
        code: "C_GT_MRP",
        message: `Price C (${(priceCPaise / 100).toFixed(2)}) exceeds MRP (${(mrpPaise / 100).toFixed(2)})`,
      });
    }
    if (priceBPaise != null && priceBPaise > mrpPaise) {
      warnings.push({
        code: "B_GT_MRP",
        message: `Price B (${(priceBPaise / 100).toFixed(2)}) exceeds MRP (${(mrpPaise / 100).toFixed(2)})`,
      });
    }
    if (priceAPaise != null && priceAPaise > mrpPaise) {
      warnings.push({
        code: "A_GT_MRP",
        message: `Price A (${(priceAPaise / 100).toFixed(2)}) exceeds MRP (${(mrpPaise / 100).toFixed(2)})`,
      });
    }
  }

  return warnings;
}

/**
 * Calculate price in paise from MRP and percentage discount off MRP.
 * Uses standard half-up rounding in paise:
 * e.g., MRP 89 (8900 paise) at 22% off -> round(8900 * (100 - 22) / 100) = 6942 paise (Rs 69.42)
 */
export function calculatePriceFromMrpDiscountPct(mrpPaise: number, discountPct: number): number {
  const factor = (100 - discountPct) / 100;
  return Math.round(mrpPaise * factor);
}

/**
 * Single shared price resolution function used everywhere (billing, van, storefront, orders, POS).
 *
 * Rules:
 * - WHOLESALER -> List A (fallback B -> C -> MRP)
 * - RETAILER   -> List B (fallback C -> MRP)
 * - CUSTOMER / walk-in / anonymous -> List C (fallback MRP)
 * - If buyerApproved is explicitly false (e.g. unapproved storefront user), forces CUSTOMER (List C).
 * - When options.enableQuantityTierPricing is ON and quantitySlabPricePaise is provided,
 *   effective price is the cheaper of the party's list price and the quantity-tier price.
 * - If no price is set on any list or MRP, unitPricePaise = 0 and isUnpriced = true.
 */
export function resolvePrice(
  product: ProductPricingFields,
  buyerType?: string | null,
  options?: ResolvePriceOptions
): ResolvedPriceResult & { isUnpriced: boolean } {
  const effectiveMrp =
    product.mrpPaise ??
    product.priceCPaise ??
    product.priceBPaise ??
    product.priceAPaise ??
    0;

  // If buyerApproved is explicitly false, force CUSTOMER (List C)
  const isApproved = options?.buyerApproved !== false;
  const normalizedBuyer = isApproved ? (buyerType ?? "CUSTOMER") : "CUSTOMER";

  let listPricePaise = effectiveMrp;
  let listUsed: PriceListCode = "MRP";
  let effectiveBuyerTier: BuyerTier = BuyerTier.CUSTOMER;
  let hasPriceSet = false;

  if (normalizedBuyer === "WHOLESALER" || normalizedBuyer === BuyerTier.WHOLESALER) {
    effectiveBuyerTier = BuyerTier.WHOLESALER;
    if (product.priceAPaise != null && product.priceAPaise > 0) {
      listPricePaise = product.priceAPaise;
      listUsed = "A";
      hasPriceSet = true;
    } else if (product.priceBPaise != null && product.priceBPaise > 0) {
      listPricePaise = product.priceBPaise;
      listUsed = "B";
      hasPriceSet = true;
    } else if (product.priceCPaise != null && product.priceCPaise > 0) {
      listPricePaise = product.priceCPaise;
      listUsed = "C";
      hasPriceSet = true;
    } else if (effectiveMrp > 0) {
      listPricePaise = effectiveMrp;
      listUsed = "MRP";
      hasPriceSet = true;
    }
  } else if (normalizedBuyer === "RETAILER" || normalizedBuyer === BuyerTier.RETAILER) {
    effectiveBuyerTier = BuyerTier.RETAILER;
    if (product.priceBPaise != null && product.priceBPaise > 0) {
      listPricePaise = product.priceBPaise;
      listUsed = "B";
      hasPriceSet = true;
    } else if (product.priceCPaise != null && product.priceCPaise > 0) {
      listPricePaise = product.priceCPaise;
      listUsed = "C";
      hasPriceSet = true;
    } else if (effectiveMrp > 0) {
      listPricePaise = effectiveMrp;
      listUsed = "MRP";
      hasPriceSet = true;
    }
  } else {
    effectiveBuyerTier = BuyerTier.CUSTOMER;
    if (product.priceCPaise != null && product.priceCPaise > 0) {
      listPricePaise = product.priceCPaise;
      listUsed = "C";
      hasPriceSet = true;
    } else if (effectiveMrp > 0) {
      listPricePaise = effectiveMrp;
      listUsed = "MRP";
      hasPriceSet = true;
    }
  }

  let unitPricePaise = hasPriceSet ? listPricePaise : 0;

  // Quantity-tier override when enabled and cheaper
  if (
    hasPriceSet &&
    options?.enableQuantityTierPricing &&
    options.quantitySlabPricePaise != null &&
    options.quantitySlabPricePaise > 0 &&
    options.quantitySlabPricePaise < unitPricePaise
  ) {
    unitPricePaise = options.quantitySlabPricePaise;
    if (
      options.quantitySlabTier &&
      TIER_RANKS[options.quantitySlabTier] > TIER_RANKS[effectiveBuyerTier]
    ) {
      effectiveBuyerTier = options.quantitySlabTier;
    }
  }

  const discountFromMrpPaise = Math.max(0, effectiveMrp - unitPricePaise);
  const discountFromMrpBp =
    effectiveMrp > 0 ? Math.round((discountFromMrpPaise * 10000) / effectiveMrp) : 0;

  return {
    unitPricePaise,
    mrpPaise: effectiveMrp,
    listUsed,
    effectiveBuyerTier,
    discountFromMrpPaise,
    discountFromMrpBp,
    isUnpriced: !hasPriceSet || unitPricePaise <= 0,
  };
}
