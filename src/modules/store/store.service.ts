import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { pricingService, resolvePrice } from "@/modules/pricing/pricing.service";
import { BuyerTier, PriceListCode } from "@/modules/pricing/pricing.types";
import { PartyType } from "@prisma/client";
import { queryRankedProductIds, stockRankSql } from "@/modules/stock/availability";

export interface StoreProductItem {
  id: string;
  name: string;
  shortCode: string;
  weight?: string | null;
  companyId: string | null;
  companyName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  hsn: string;
  gstRateBp: number;
  mrpPaise: number;
  unitPricePaise?: number;
  priceListUsed?: PriceListCode;
  packSize: number;
  packLabel: string;
  imageUrl: string | null;
  totalAvailableQty: number; // godownLoose + (openableCartons * packSize)
  godownCartonsCount?: number;
  godownLooseQty?: number;
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
  buyerType?: PartyType | BuyerTier | string | null;
  buyerApproved?: boolean;
}

export class StoreService {
  /**
   * Fetch catalogue products with multi-token search, category/brand filters,
   * live Godown stock availability (loose + openable cartons * packSize), and dynamic A/B/C + slab price breakdown.
   *
   * Security invariant: Anonymous or unapproved visitors NEVER receive Price A or Price B in the response.
   */
  async getCatalogue(query: StoreCatalogueQuery = {}) {
    const {
      q,
      companyId,
      categoryId,
      inStockOnly = false,
      limit = 50,
      offset = 0,
      buyerType = "CUSTOMER",
      buyerApproved = false,
    } = query;

    // 1. Build product SQL filters (excluding unpriced items from public storefront)
    const whereParts: Prisma.Sql[] = [
      Prisma.sql`p.active = true`,
      Prisma.sql`(COALESCE(p.mrp_paise, 0) > 0 OR COALESCE(p.price_c_paise, 0) > 0)`,
    ];

    if (companyId) {
      whereParts.push(Prisma.sql`p.company_id = ${companyId}`);
    }
    if (categoryId) {
      whereParts.push(Prisma.sql`p.category_id = ${categoryId}`);
    }
    if (inStockOnly) {
      whereParts.push(Prisma.sql`(${stockRankSql("STOREFRONT")}) = 1`);
    }

    if (q && q.trim().length > 0) {
      const term = q.trim();
      const pattern = `%${term}%`;
      whereParts.push(Prisma.sql`(
        p.short_code ILIKE ${pattern}
        OR p.name ILIKE ${pattern}
        OR EXISTS (
          SELECT 1 FROM companies c WHERE c.id = p.company_id AND c.name ILIKE ${pattern}
        )
        OR EXISTS (
          SELECT 1 FROM categories cat WHERE cat.id = p.category_id AND cat.name ILIKE ${pattern}
        )
      )`);
    }

    const whereSql = Prisma.join(whereParts, " AND ");

    // 2. Fetch product IDs ordered by in_stock_rank DESC, name ASC BEFORE pagination in database
    const [{ productIds, totalCount }, allSlabs] = await Promise.all([
      queryRankedProductIds("STOREFRONT", {
        whereSql,
        limit,
        offset,
      }),
      pricingService.getSlabs(),
    ]);

    if (productIds.length === 0) {
      return { products: [], total: totalCount };
    }

    // 3. Fetch product details and maintain exact database ranking
    const productsRaw = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        company: true,
        category: true,
        stockBalances: {
          include: { location: true },
        },
      },
    });

    const productMap = new Map<string, any>(productsRaw.map((p: any) => [p.id, p]));
    const products = productIds
      .map((id) => productMap.get(id))
      .filter((p: any): p is NonNullable<any> => Boolean(p));


    // 3. Transform products into storefront view models
    const activeSlabs = allSlabs.filter((s) => s.active);

    const items: StoreProductItem[] = products
      .map((p: any) => {
        // Shared sellable pool (Godown + Shop) per Section 5a:
        const totalAvailableQty = p.stockBalances.reduce((sum: number, sb: any) => {
          if (sb.location.active && (sb.location.type === "GODOWN" || sb.location.type === "SHOP")) {
            return sum + Math.max(0, sb.qty);
          }
          return sum;
        }, 0);

        const packSize = Math.max(1, p.packSize);
        const godownCartonsCount = Math.floor(totalAvailableQty / packSize);
        const godownLooseQty = totalAvailableQty % packSize;

        // Resolve visitor's effective price via shared A/B/C resolver
        // Anonymous / unapproved visitors strictly resolve to CUSTOMER (List C)
        const resolved = resolvePrice(p, buyerType, {
          buyerApproved,
        });
        const effectiveMrp = resolved.mrpPaise;

        // Find applicable slabs for this product (Product, Category, Company, Global)
        const productSlabs = activeSlabs.filter(
          (s) =>
            (s.scope === "PRODUCT" && s.targetId === p.id) ||
            (s.scope === "CATEGORY" && s.targetId === p.categoryId) ||
            (s.scope === "COMPANY" && s.targetId === p.companyId) ||
            s.scope === "GLOBAL"
        );

        // Sort slabs ascending by minQty
        let sortedSlabs = [...productSlabs]
          .sort((a, b) => a.minQty - b.minQty)
          .map((s) => {
            const unitPricePaise = Math.round((effectiveMrp * (10000 - s.discountBp)) / 10000);
            return {
              minQty: s.minQty,
              discountBp: s.discountBp,
              tier: s.tier,
              unitPricePaise,
            };
          });

        // If no slabs configured, synthesize a 1-qty slab from the resolved A/B/C price so UI cards display resolved price cleanly
        if (sortedSlabs.length === 0) {
          sortedSlabs = [
            {
              minQty: 1,
              discountBp: resolved.discountFromMrpBp,
              tier: resolved.effectiveBuyerTier,
              unitPricePaise: resolved.unitPricePaise,
            },
          ];
        }

        // Notice: priceAPaise and priceBPaise are NEVER included in the returned object
        return {
          id: p.id,
          name: p.name,
          shortCode: p.shortCode,
          weight: p.weight,
          companyId: p.companyId,
          companyName: p.company?.name ?? null,
          categoryId: p.categoryId,
          categoryName: p.category?.name ?? null,
          hsn: p.hsn,
          gstRateBp: p.gstRateBp,
          mrpPaise: effectiveMrp,
          unitPricePaise: resolved.unitPricePaise,
          priceListUsed: resolved.listUsed,
          packSize: p.packSize,
          packLabel: p.packLabel,
          imageUrl: p.imageUrl,
          totalAvailableQty,
          godownCartonsCount,
          godownLooseQty,
          isAvailable: totalAvailableQty > 0,
          slabs: sortedSlabs,
        };
      });

    return {
      products: items,

      total: totalCount,
    };
  }

  /**
   * Get single product detail by ID with full slab breakdown, Godown stock availability,
   * carton/loose conversions, and company & category info.
   */
  async getProductDetail(
    id: string,
    options?: { buyerType?: PartyType | BuyerTier | string | null; buyerApproved?: boolean }
  ): Promise<StoreProductItem | null> {
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

    const totalAvailableQty = (product.stockBalances as any[]).reduce((sum: number, sb: any) => {
      if (sb.location.active && (sb.location.type === "GODOWN" || sb.location.type === "SHOP")) {
        return sum + Math.max(0, sb.qty);
      }
      return sum;
    }, 0);

    const packSize = Math.max(1, product.packSize);
    const godownCartonsCount = Math.floor(totalAvailableQty / packSize);
    const godownLooseQty = totalAvailableQty % packSize;

    const resolved = resolvePrice(product, options?.buyerType ?? "CUSTOMER", {
      buyerApproved: options?.buyerApproved ?? false,
    });
    const effectiveMrp = resolved.mrpPaise;

    const productSlabs = activeSlabs.filter(
      (s) =>
        (s.scope === "PRODUCT" && s.targetId === product.id) ||
        (s.scope === "CATEGORY" && s.targetId === product.categoryId) ||
        (s.scope === "COMPANY" && s.targetId === product.companyId) ||
        s.scope === "GLOBAL"
    );

    let sortedSlabs = [...productSlabs]
      .sort((a, b) => a.minQty - b.minQty)
      .map((s) => {
        const unitPricePaise = Math.round((effectiveMrp * (10000 - s.discountBp)) / 10000);
        return {
          minQty: s.minQty,
          discountBp: s.discountBp,
          tier: s.tier,
          unitPricePaise,
        };
      });

    if (sortedSlabs.length === 0) {
      sortedSlabs = [
        {
          minQty: 1,
          discountBp: resolved.discountFromMrpBp,
          tier: resolved.effectiveBuyerTier,
          unitPricePaise: resolved.unitPricePaise,
        },
      ];
    }

    return {
      id: product.id,
      name: product.name,
      shortCode: product.shortCode,
      weight: product.weight,
      companyId: product.companyId,
      companyName: product.company?.name ?? null,
      categoryId: product.categoryId,
      categoryName: product.category?.name ?? null,
      hsn: product.hsn,
      gstRateBp: product.gstRateBp,
      mrpPaise: effectiveMrp,
      unitPricePaise: resolved.unitPricePaise,
      priceListUsed: resolved.listUsed,
      packSize: product.packSize,
      packLabel: product.packLabel,
      imageUrl: product.imageUrl,
      totalAvailableQty,
      godownCartonsCount,
      godownLooseQty,
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
        where: {
          active: true,
          products: {
            some: {
              active: true,
            },
          },
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.category.findMany({
        where: {
          active: true,
          products: {
            some: {
              active: true,
            },
          },
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

    return {
      companies,
      categories,
    };
  }

  /**
   * Get related products for a product (frequently bought together / cross-sells)
   */
  async getRelatedProducts(productId: string, categoryId?: string | null, limit = 4): Promise<StoreProductItem[]> {
    const whereParts: Prisma.Sql[] = [
      Prisma.sql`p.active = true`,
      Prisma.sql`p.id != ${productId}`,
    ];
    if (categoryId) {
      whereParts.push(Prisma.sql`p.category_id = ${categoryId}`);
    }
    const whereSql = Prisma.join(whereParts, " AND ");

    const { productIds } = await queryRankedProductIds("STOREFRONT", {
      whereSql,
      orderBySql: Prisma.sql`p.updated_at DESC`,
      limit,
      offset: 0,
    });

    if (productIds.length === 0) {
      return [];
    }

    const productsRaw = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        company: true,
        category: true,
        stockBalances: {
          include: { location: true },
        },
      },
    });

    const productMap = new Map<string, any>(productsRaw.map((p: any) => [p.id, p]));
    const products = productIds
      .map((id) => productMap.get(id))
      .filter((p: any): p is NonNullable<any> => Boolean(p));


    return products.map((p: any) => {
      const totalAvailableQty = p.stockBalances.reduce((sum: number, sb: any) => {
        if (sb.location.active && (sb.location.type === "GODOWN" || sb.location.type === "SHOP")) {
          return sum + Math.max(0, sb.qty);
        }
        return sum;
      }, 0);

      const resolved = resolvePrice(p, "CUSTOMER", { buyerApproved: false });

      return {
        id: p.id,
        name: p.name,
        shortCode: p.shortCode,
        weight: p.weight,
        companyId: p.companyId,
        companyName: p.company?.name ?? null,
        categoryId: p.categoryId,
        categoryName: p.category?.name ?? null,
        hsn: p.hsn,
        gstRateBp: p.gstRateBp,
        mrpPaise: resolved.mrpPaise,
        unitPricePaise: resolved.unitPricePaise,
        priceListUsed: resolved.listUsed,
        packSize: p.packSize,
        packLabel: p.packLabel,
        imageUrl: p.imageUrl,
        totalAvailableQty,
        godownCartonsCount: Math.floor(totalAvailableQty / Math.max(1, p.packSize)),
        godownLooseQty: totalAvailableQty % Math.max(1, p.packSize),
        isAvailable: totalAvailableQty > 0,
        slabs: [],
      };
    });
  }
}

export const storeService = new StoreService();
