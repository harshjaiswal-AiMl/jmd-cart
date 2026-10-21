import { prisma } from "@/lib/prisma";
import { pricingService, resolvePrice } from "@/modules/pricing/pricing.service";
import { BuyerTier, PriceListCode } from "@/modules/pricing/pricing.types";
import { PartyType } from "@prisma/client";

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
        // Online orders fulfil strictly from Godown:
        // Available stock = Godown loose + (openable cartons * packSize) = total Godown pieces
        const totalAvailableQty = p.stockBalances.reduce((sum, sb) => {
          if (sb.location.active && sb.location.type === "GODOWN") {
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
      })
      .filter((p) => (inStockOnly ? p.isAvailable : true))
      .sort((a, b) => {
        if (a.isAvailable !== b.isAvailable) {
          return a.isAvailable ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
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

    const totalAvailableQty = product.stockBalances.reduce((sum, sb) => {
      if (sb.location.active && sb.location.type === "GODOWN") {
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
    const products = await prisma.product.findMany({
      where: {
        active: true,
        id: { not: productId },
        ...(categoryId ? { categoryId } : {}),
      },
      include: {
        company: true,
        category: true,
        stockBalances: {
          include: { location: true },
        },
      },
      take: limit,
      orderBy: { updatedAt: "desc" },
    });

    return products.map((p) => {
      const totalAvailableQty = p.stockBalances.reduce((sum, sb) => {
        if (sb.location.active && sb.location.type === "GODOWN") {
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
