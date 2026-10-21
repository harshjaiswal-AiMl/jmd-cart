import { PartyType, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertPermission, Permission } from "@/modules/auth/permissions";
import { calculateLineGst, calculateInvoiceTotals } from "@/lib/gst";
import { settingsService } from "@/modules/settings/settings.service";
import { auditService } from "@/modules/audit/audit.service";
import {
  pricingRepository,
  PricingRepository,
} from "./pricing.repository";
import {
  PriceSlabRule,
  SlabScope,
  BuyerTier,
  CreatePriceSlabInput,
  createPriceSlabInputSchema,
  CalculateOrderPriceInput,
  ResolvedLinePrice,
  OrderPriceResult,
  ProductPricingFields,
  ResolvePriceOptions,
  ResolvedPriceResult,
  PriceListCode,
  PriceOrderingWarning,
} from "./pricing.types";

const TIER_RANKS: Record<BuyerTier, number> = {
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
 * Single shared price resolution function used everywhere (billing, van, storefront, orders).
 *
 * Rules:
 * - WHOLESALER -> List A (fallback B -> C -> MRP)
 * - RETAILER   -> List B (fallback C -> MRP)
 * - CUSTOMER / walk-in / anonymous -> List C (fallback MRP)
 * - If buyerApproved is explicitly false (e.g. unapproved storefront user), forces CUSTOMER (List C).
 * - When options.enableQuantityTierPricing is ON and quantitySlabPricePaise is provided,
 *   effective price is the cheaper of the party's list price and the quantity-tier price.
 */
export function resolvePrice(
  product: ProductPricingFields,
  buyerType?: PartyType | BuyerTier | string | null,
  options?: ResolvePriceOptions
): ResolvedPriceResult {
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

  if (normalizedBuyer === "WHOLESALER" || normalizedBuyer === BuyerTier.WHOLESALER) {
    effectiveBuyerTier = BuyerTier.WHOLESALER;
    if (product.priceAPaise != null && product.priceAPaise > 0) {
      listPricePaise = product.priceAPaise;
      listUsed = "A";
    } else if (product.priceBPaise != null && product.priceBPaise > 0) {
      listPricePaise = product.priceBPaise;
      listUsed = "B";
    } else if (product.priceCPaise != null && product.priceCPaise > 0) {
      listPricePaise = product.priceCPaise;
      listUsed = "C";
    }
  } else if (normalizedBuyer === "RETAILER" || normalizedBuyer === BuyerTier.RETAILER) {
    effectiveBuyerTier = BuyerTier.RETAILER;
    if (product.priceBPaise != null && product.priceBPaise > 0) {
      listPricePaise = product.priceBPaise;
      listUsed = "B";
    } else if (product.priceCPaise != null && product.priceCPaise > 0) {
      listPricePaise = product.priceCPaise;
      listUsed = "C";
    }
  } else {
    effectiveBuyerTier = BuyerTier.CUSTOMER;
    if (product.priceCPaise != null && product.priceCPaise > 0) {
      listPricePaise = product.priceCPaise;
      listUsed = "C";
    }
  }

  let unitPricePaise = listPricePaise;

  // Quantity-tier override when enabled and cheaper
  if (
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
  };
}

export class PricingService {
  constructor(private readonly repo: PricingRepository = pricingRepository) {}

  /**
   * Expose shared resolvePrice on service instance as well.
   */
  resolvePrice(
    product: ProductPricingFields,
    buyerType?: PartyType | BuyerTier | string | null,
    options?: ResolvePriceOptions
  ): ResolvedPriceResult {
    return resolvePrice(product, buyerType, options);
  }

  /**
   * Get all active and inactive price slabs.
   */
  async getSlabs(): Promise<PriceSlabRule[]> {
    return this.repo.getSlabs();
  }

  /**
   * Save full list of price slabs. Guarded by MANAGE_SETTINGS.
   */
  async saveSlabs(role: UserRole, slabs: PriceSlabRule[], actorId?: string): Promise<void> {
    assertPermission(role, Permission.MANAGE_SETTINGS);
    const before = await this.repo.getSlabs();
    await this.repo.saveSlabs(slabs);

    await auditService.log({
      actorId: actorId ?? null,
      action: "UPDATE_PRICE_SLABS",
      entity: "Setting",
      entityId: "price_slabs",
      before: { slabs: before },
      after: { slabs },
    });
  }

  /**
   * Add a new price slab. Guarded by MANAGE_SETTINGS.
   */
  async createSlab(
    role: UserRole,
    input: CreatePriceSlabInput,
    actorId?: string
  ): Promise<PriceSlabRule> {
    assertPermission(role, Permission.MANAGE_SETTINGS);
    const validated = createPriceSlabInputSchema.parse(input);

    const slabs = await this.repo.getSlabs();
    const newSlab: PriceSlabRule = {
      id: `slab-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      scope: validated.scope,
      targetId: validated.targetId ?? null,
      targetName: validated.targetName ?? null,
      minQty: validated.minQty,
      discountBp: validated.discountBp,
      tier: validated.tier,
      active: true,
    };

    const updated = [...slabs, newSlab];
    await this.saveSlabs(role, updated, actorId);
    return newSlab;
  }

  /**
   * Delete a price slab by ID. Guarded by MANAGE_SETTINGS.
   */
  async deleteSlab(role: UserRole, slabId: string, actorId?: string): Promise<void> {
    assertPermission(role, Permission.MANAGE_SETTINGS);
    const slabs = await this.repo.getSlabs();
    const updated = slabs.filter((s) => s.id !== slabId);
    await this.saveSlabs(role, updated, actorId);
  }

  /**
   * Resolve slab discount and buyer tier for a single item according to the hierarchy:
   * 1. PRODUCT > 2. CATEGORY > 3. COMPANY > 4. GLOBAL.
   */
  resolveItemSlab(
    product: { id: string; categoryId: string | null; companyId: string | null },
    qty: number,
    slabs: PriceSlabRule[]
  ): { winningSlab: PriceSlabRule | null; matchedScope: SlabScope; slabDiscountBp: number; tier: BuyerTier } {
    const activeSlabs = slabs.filter((s) => s.active && qty >= s.minQty);

    // 1. PRODUCT scope
    const productSlabs = activeSlabs.filter(
      (s) => s.scope === SlabScope.PRODUCT && s.targetId === product.id
    );
    if (productSlabs.length > 0) {
      const winner = productSlabs.reduce((max, s) => (s.minQty > max.minQty ? s : max));
      return {
        winningSlab: winner,
        matchedScope: SlabScope.PRODUCT,
        slabDiscountBp: winner.discountBp,
        tier: winner.tier,
      };
    }

    // 2. CATEGORY scope
    if (product.categoryId) {
      const categorySlabs = activeSlabs.filter(
        (s) => s.scope === SlabScope.CATEGORY && s.targetId === product.categoryId
      );
      if (categorySlabs.length > 0) {
        const winner = categorySlabs.reduce((max, s) => (s.minQty > max.minQty ? s : max));
        return {
          winningSlab: winner,
          matchedScope: SlabScope.CATEGORY,
          slabDiscountBp: winner.discountBp,
          tier: winner.tier,
        };
      }
    }

    // 3. COMPANY scope
    if (product.companyId) {
      const companySlabs = activeSlabs.filter(
        (s) => s.scope === SlabScope.COMPANY && s.targetId === product.companyId
      );
      if (companySlabs.length > 0) {
        const winner = companySlabs.reduce((max, s) => (s.minQty > max.minQty ? s : max));
        return {
          winningSlab: winner,
          matchedScope: SlabScope.COMPANY,
          slabDiscountBp: winner.discountBp,
          tier: winner.tier,
        };
      }
    }

    // 4. GLOBAL scope
    const globalSlabs = activeSlabs.filter((s) => s.scope === SlabScope.GLOBAL);
    if (globalSlabs.length > 0) {
      const winner = globalSlabs.reduce((max, s) => (s.minQty > max.minQty ? s : max));
      return {
        winningSlab: winner,
        matchedScope: SlabScope.GLOBAL,
        slabDiscountBp: winner.discountBp,
        tier: winner.tier,
      };
    }

    // Fallback: 0 discount, retail walk-in customer
    return {
      winningSlab: null,
      matchedScope: SlabScope.GLOBAL,
      slabDiscountBp: 0,
      tier: BuyerTier.CUSTOMER,
    };
  }

  /**
   * Determine overall order buyer tag based on highest tier among all lines.
   */
  resolveOrderBuyerTag(lines: { tier: BuyerTier }[]): BuyerTier {
    if (lines.length === 0) return BuyerTier.CUSTOMER;

    let highestTier = BuyerTier.CUSTOMER;
    let highestRank = TIER_RANKS[BuyerTier.CUSTOMER];

    for (const line of lines) {
      const rank = TIER_RANKS[line.tier] ?? 1;
      if (rank > highestRank) {
        highestRank = rank;
        highestTier = line.tier;
      }
    }

    return highestTier;
  }

  /**
   * Calculate complete order pricing with A/B/C price lists, optional quantity-slab resolution,
   * order discount, role discount limit approval check, and GST calculations.
   */
  async calculateOrderPricing(
    input: CalculateOrderPriceInput
  ): Promise<OrderPriceResult> {
    const {
      items,
      partyId,
      buyerType: explicitBuyerType,
      buyerApproved = true,
      orderDiscountBp = 0,
      isInterState = false,
      userRole,
    } = input;

    if (items.length === 0) {
      return {
        lines: [],
        buyerTag: BuyerTier.CUSTOMER,
        subtotalPaise: 0,
        lineDiscountPaise: 0,
        orderDiscountPaise: 0,
        orderDiscountBp: 0,
        netSubtotalPaise: 0,
        taxablePaise: 0,
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: 0,
        totalTaxPaise: 0,
        rawTotalPaise: 0,
        roundOffPaise: 0,
        totalPaise: 0,
        taxSummaryByRate: [],
        requiresDiscountApproval: false,
      };
    }

    // 1. Fetch products, active price slabs, role limits, pricing settings, and party if provided
    const productIds = items.map((i) => i.productId);
    const [products, slabs, roleLimits, pricingSettings, party] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          shortCode: true,
          companyId: true,
          categoryId: true,
          mrpPaise: true,
          priceAPaise: true,
          priceBPaise: true,
          priceCPaise: true,
          gstRateBp: true,
        },
      }),
      this.getSlabs(),
      settingsService.getRoleDiscountLimits(),
      settingsService.getPricingSettings(),
      partyId
        ? prisma.party.findUnique({
            where: { id: partyId },
            select: { id: true, type: true },
          })
        : Promise.resolve(null),
    ]);

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Determine effective buyerType from explicit input or party record
    const partyBuyerType = explicitBuyerType ?? party?.type ?? BuyerTier.CUSTOMER;
    // Note: if slabs exist in the DB (e.g. legacy tests or explicit admin slabs), and no A/B/C prices are set on the product,
    // or if enableQuantityTierPricing is ON, we also evaluate quantity slabs.
    const enableQuantitySlabs = pricingSettings.enableQuantityTierPricing;

    // 2. Validate role discount limit
    let requiresDiscountApproval = false;
    let discountApprovalReason: string | undefined = undefined;

    if (
      userRole &&
      userRole !== UserRole.SUPER_ADMIN &&
      userRole !== UserRole.ADMIN &&
      orderDiscountBp > 0
    ) {
      const maxAllowedBp = roleLimits[userRole] ?? 0;
      if (orderDiscountBp > maxAllowedBp) {
        requiresDiscountApproval = true;
        discountApprovalReason = `Order discount of ${(orderDiscountBp / 100).toFixed(
          2
        )}% exceeds role limit of ${(maxAllowedBp / 100).toFixed(2)}% for ${userRole}`;
      }
    }

    // 3. Resolve each line item
    const resolvedLines: ResolvedLinePrice[] = [];
    const gstInputLines: Array<{
      mrpPaise: number;
      qty: number;
      discountBp: number;
      gstRateBp: number;
      isInterState: boolean;
    }> = [];

    let totalSubtotalPaise = 0;
    let totalLineDiscountPaise = 0;

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new Error(`Product not found with ID ${item.productId}`);
      }

      const effectiveMrp =
        product.mrpPaise ??
        product.priceCPaise ??
        product.priceBPaise ??
        product.priceAPaise ??
        0;

      const hasAbcPrices =
        product.priceAPaise != null ||
        product.priceBPaise != null ||
        product.priceCPaise != null;

      const { matchedScope, slabDiscountBp: rawSlabDiscountBp, tier: slabTier } =
        this.resolveItemSlab(product, item.qty, slabs);

      const quantitySlabPricePaise =
        rawSlabDiscountBp > 0
          ? Math.round((effectiveMrp * (10000 - rawSlabDiscountBp)) / 10000)
          : null;

      // Resolve price via shared A/B/C resolver
      // If product has no A/B/C prices configured yet, allow slab discounts if any slabs are configured
      const resolvedAbc = resolvePrice(product, partyBuyerType, {
        buyerApproved,
        enableQuantityTierPricing: enableQuantitySlabs || !hasAbcPrices,
        quantitySlabPricePaise,
        quantitySlabTier: slabTier,
      });

      const baseUnitPricePaise =
        item.unitPriceOverridePaise != null
          ? item.unitPriceOverridePaise
          : resolvedAbc.unitPricePaise;

      // Convert resolved unit price into equivalent discountBp off effectiveMrp for GST engine compatibility
      const slabDiscountBp =
        effectiveMrp > 0
          ? Math.max(0, Math.round(((effectiveMrp - baseUnitPricePaise) * 10000) / effectiveMrp))
          : 0;

      const tier = resolvedAbc.effectiveBuyerTier;

      // Effective discount combines list/slab discount and order discount
      const effectiveDiscountBp =
        orderDiscountBp > 0
          ? Math.min(
              10000,
              slabDiscountBp +
                Math.round(((10000 - slabDiscountBp) * orderDiscountBp) / 10000)
            )
          : slabDiscountBp;

      const lineGst = calculateLineGst({
        mrpPaise: effectiveMrp,
        qty: item.qty,
        discountBp: effectiveDiscountBp,
        gstRateBp: product.gstRateBp,
        isInterState,
      });

      const lineUndiscounted = effectiveMrp * item.qty;
      const lineAfterList = baseUnitPricePaise * item.qty;
      totalSubtotalPaise += lineUndiscounted;
      totalLineDiscountPaise += Math.max(0, lineUndiscounted - lineAfterList);

      resolvedLines.push({
        productId: product.id,
        productName: product.name,
        shortCode: product.shortCode,
        companyId: product.companyId,
        categoryId: product.categoryId,
        mrpPaise: effectiveMrp,
        qty: item.qty,
        gstRateBp: product.gstRateBp,
        matchedScope,
        slabDiscountBp,
        effectiveDiscountBp,
        unitPricePaise: lineGst.unitPricePaise,
        lineTotalPaise: lineGst.lineTotalPaise,
        taxablePaise: lineGst.taxablePaise,
        cgstPaise: lineGst.cgstPaise,
        sgstPaise: lineGst.sgstPaise,
        igstPaise: lineGst.igstPaise,
        taxPaise: lineGst.taxPaise,
        tier,
      });

      gstInputLines.push({
        mrpPaise: effectiveMrp,
        qty: item.qty,
        discountBp: slabDiscountBp,
        gstRateBp: product.gstRateBp,
        isInterState,
      });
    }

    // 4. Calculate invoice totals using core GST engine
    const invoiceTotals = calculateInvoiceTotals(gstInputLines, orderDiscountBp);
    const buyerTag = this.resolveOrderBuyerTag(resolvedLines);

    return {
      lines: resolvedLines,
      buyerTag,
      subtotalPaise: totalSubtotalPaise,
      lineDiscountPaise: totalLineDiscountPaise,
      orderDiscountPaise: invoiceTotals.orderDiscountPaise,
      orderDiscountBp,
      netSubtotalPaise: invoiceTotals.netSubtotalPaise,
      taxablePaise: invoiceTotals.taxablePaise,
      cgstPaise: invoiceTotals.cgstPaise,
      sgstPaise: invoiceTotals.sgstPaise,
      igstPaise: invoiceTotals.igstPaise,
      totalTaxPaise: invoiceTotals.totalTaxPaise,
      rawTotalPaise: invoiceTotals.rawTotalPaise,
      roundOffPaise: invoiceTotals.roundOffPaise,
      totalPaise: invoiceTotals.totalPaise,
      taxSummaryByRate: invoiceTotals.taxSummaryByRate,
      requiresDiscountApproval,
      discountApprovalReason,
    };
  }
}

export const pricingService = new PricingService();
