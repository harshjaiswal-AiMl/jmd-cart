import { UserRole } from "@prisma/client";
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
} from "./pricing.types";

const TIER_RANKS: Record<BuyerTier, number> = {
  [BuyerTier.CUSTOMER]: 1,
  [BuyerTier.RETAILER]: 2,
  [BuyerTier.WHOLESALER]: 3,
};

export class PricingService {
  constructor(private readonly repo: PricingRepository = pricingRepository) {}

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
   * Calculate complete order pricing with dynamic slab resolution, order discount,
   * role discount limit approval check, and GST calculations.
   */
  async calculateOrderPricing(
    input: CalculateOrderPriceInput
  ): Promise<OrderPriceResult> {
    const { items, orderDiscountBp = 0, isInterState = false, userRole } = input;

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

    // 1. Fetch products & active price slabs
    const productIds = items.map((i) => i.productId);
    const [products, slabs, roleLimits] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          shortCode: true,
          companyId: true,
          categoryId: true,
          mrpPaise: true,
          gstRateBp: true,
        },
      }),
      this.getSlabs(),
      settingsService.getRoleDiscountLimits(),
    ]);

    const productMap = new Map(products.map((p) => [p.id, p]));

    // 2. Validate role discount limit
    let requiresDiscountApproval = false;
    let discountApprovalReason: string | undefined = undefined;

    if (userRole && userRole !== UserRole.SUPER_ADMIN && orderDiscountBp > 0) {
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

      const { matchedScope, slabDiscountBp, tier } = this.resolveItemSlab(
        product,
        item.qty,
        slabs
      );

      // Effective discount combines slab discount and order discount
      const effectiveDiscountBp =
        orderDiscountBp > 0
          ? Math.min(
              10000,
              slabDiscountBp +
                Math.round(((10000 - slabDiscountBp) * orderDiscountBp) / 10000)
            )
          : slabDiscountBp;

      const lineGst = calculateLineGst({
        mrpPaise: product.mrpPaise,
        qty: item.qty,
        discountBp: effectiveDiscountBp,
        gstRateBp: product.gstRateBp,
        isInterState,
      });

      const lineUndiscounted = product.mrpPaise * item.qty;
      const lineSlabDiscount = Math.round((product.mrpPaise * (10000 - slabDiscountBp)) / 10000) * item.qty;
      totalSubtotalPaise += lineUndiscounted;
      totalLineDiscountPaise += (lineUndiscounted - lineSlabDiscount);

      resolvedLines.push({
        productId: product.id,
        productName: product.name,
        shortCode: product.shortCode,
        companyId: product.companyId,
        categoryId: product.categoryId,
        mrpPaise: product.mrpPaise,
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
        mrpPaise: product.mrpPaise,
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
