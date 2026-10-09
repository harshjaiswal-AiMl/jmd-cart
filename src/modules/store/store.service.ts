import { prisma } from "@/lib/prisma";
import { pricingService } from "@/modules/pricing/pricing.service";
import { PriceSlabRule, BuyerTier } from "@/modules/pricing/pricing.types";

export interface StoreProductItem {
  id: string;
  name: string;
  shortCode: string;
  companyId: string | null;
  companyName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  hsn: string;
  gstRateBp: number;
  mrpPaise: number;
  packSize: number;
  packLabel: string;
  imageUrl: string | null;
  totalAvailableQty: number; // shop + godown available stock
  isAvailable: boolean;
  slabs: Array<{
    minQty: number;
    discountBp: number;
    tier: BuyerTier;
    unitPricePaise: number;
  }>;
}

export interface StoreCatalogueQuery {
  q?: string;
  companyId?: string;
  categoryId?: string;
  inStockOnly?: boolean;
  limit?: number;
  offset?: number;
}

export class StoreService {
  /**
   * Fetch catalogue products with multi-token search, category/brand filters,
   * live stock availability (shop + godown), and dynamic slab price breakdown.
   */
  async getCatalogue(query: StoreCatalogueQuery = {}) {
    const { q, companyId, categoryId, inStockOnly = false, limit = 50, offset = 0 } = query;

    // 1. Build product filters
    const andClauses: any[] = [{ active: true }];

    if (companyId) {
      andClauses.push({ companyId });
    }
    if (categoryId) {
      andClauses.push({ categoryId });
    }

    if (q && q.trim().length > 0) {
      const term = q.trim();
      const tokens = term.split(/\s+/).filter(Boolean);

      const nameTokenClauses = tokens.map((token) => ({
        name: { contains: token, mode: "insensitive" },
      }));

      andClauses.push({
        OR: [
          { shortCode: { contains: term, mode: "insensitive" } },
          { AND: nameTokenClauses },
          { company: { name: { contains: term, mode: "insensitive" } } },
          { category: { name: { contains: term, mode: "insensitive" } } },
        ],
      });
    }

    const where = { AND: andClauses };

    // 2. Fetch products, companies, categories, and all active price slabs in parallel
    const [products, totalCount, allSlabs] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          company: true,
          category: true,
          stockBalances: {
            include: { location: true },
          },
        },
        orderBy: { name: "asc" },
        take: limit,
        skip: offset,
      }),
      prisma.product.count({ where }),
      pricingService.getSlabs(),
    ]);

    // 3. Transform products into storefront view models
    const activeSlabs = allSlabs.filter((s) => s.active);

    const items: StoreProductItem[] = products
      .map((p) => {
        // Calculate total available quantity across Godown and Shop locations
        const totalAvailableQty = p.stockBalances.reduce((sum, sb) => {
          if (sb.location.active && (sb.location.type === "GODOWN" || sb.location.type === "SHOP")) {
            return sum + Math.max(0, sb.qty);
          }
          return sum;
        }, 0);

        // Find applicable slabs for this product (Product, Category, Company, Global)
        const productSlabs = activeSlabs.filter(
          (s) =>
            (s.scope === "PRODUCT" && s.targetId === p.id) ||
            (s.scope === "CATEGORY" && s.targetId === p.categoryId) ||
            (s.scope === "COMPANY" && s.targetId === p.companyId) ||
            s.scope === "GLOBAL"
        );

        // Sort slabs ascending by minQty
        const sortedSlabs = [...productSlabs]
          .sort((a, b) => a.minQty - b.minQty)
          .map((s) => {
            const unitPricePaise = Math.round((p.mrpPaise * (10000 - s.discountBp)) / 10000);
            return {
              minQty: s.minQty,
              discountBp: s.discountBp,
              tier: s.tier,
              unitPricePaise,
            };
          });

        return {
          id: p.id,
          name: p.name,
          shortCode: p.shortCode,
          companyId: p.companyId,
          companyName: p.company?.name ?? null,
          categoryId: p.categoryId,
          categoryName: p.category?.name ?? null,
          hsn: p.hsn,
          gstRateBp: p.gstRateBp,
          mrpPaise: p.mrpPaise,
          packSize: p.packSize,
          packLabel: p.packLabel,
          imageUrl: p.imageUrl,
          totalAvailableQty,
          isAvailable: totalAvailableQty > 0,
          slabs: sortedSlabs,
        };
      })
      .filter((p) => (inStockOnly ? p.isAvailable : true));

    return {
      products: items,
      total: totalCount,
    };
  }

  /**
   * Get single product detail by ID with full slab breakdown, stock availability,
   * carton/loose conversions, and company & category info.
   */
  async getProductDetail(id: string): Promise<StoreProductItem | null> {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        company: true,
        category: true,
        stockBalances: {
          include: { location: true },
        },
      },
    });

    if (!product || !product.active) {
      return null;
    }

    const allSlabs = await pricingService.getSlabs();
    const activeSlabs = allSlabs.filter((s) => s.active);

    const totalAvailableQty = product.stockBalances.reduce((sum, sb) => {
      if (sb.location.active && (sb.location.type === "GODOWN" || sb.location.type === "SHOP")) {
        return sum + Math.max(0, sb.qty);
      }
      return sum;
    }, 0);

    const productSlabs = activeSlabs.filter(
      (s) =>
        (s.scope === "PRODUCT" && s.targetId === product.id) ||
        (s.scope === "CATEGORY" && s.targetId === product.categoryId) ||
        (s.scope === "COMPANY" && s.targetId === product.companyId) ||
        s.scope === "GLOBAL"
    );

    const sortedSlabs = [...productSlabs]
      .sort((a, b) => a.minQty - b.minQty)
      .map((s) => {
        const unitPricePaise = Math.round((product.mrpPaise * (10000 - s.discountBp)) / 10000);
        return {
          minQty: s.minQty,
          discountBp: s.discountBp,
          tier: s.tier,
          unitPricePaise,
        };
      });

    return {
      id: product.id,
      name: product.name,
      shortCode: product.shortCode,
      companyId: product.companyId,
      companyName: product.company?.name ?? null,
      categoryId: product.categoryId,
      categoryName: product.category?.name ?? null,
      hsn: product.hsn,
      gstRateBp: product.gstRateBp,
      mrpPaise: product.mrpPaise,
      packSize: product.packSize,
      packLabel: product.packLabel,
      imageUrl: product.imageUrl,
      totalAvailableQty,
      isAvailable: totalAvailableQty > 0,
      slabs: sortedSlabs,
    };
  }

  /**
   * Get list of active brands and categories for catalogue filtering.
   */
  async getFilterOptions() {
    const [companies, categories] = await Promise.all([
      prisma.company.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.category.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

    return { companies, categories };
  }
}

export const storeService = new StoreService();
