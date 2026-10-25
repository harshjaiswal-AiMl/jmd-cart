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

export function getCategoryFallbackPhoto(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("atta") || n.includes("rice") || n.includes("wheat") || n.includes("flour")) {
    return "/media/products/e74f0026865ae77f/original.png";
  }
  if (n.includes("oil") || n.includes("ghee") || n.includes("mustard") || n.includes("refined")) {
    return "/media/products/58dc49501050f36a/original.png";
  }
  if (n.includes("tea") || n.includes("beverage") || n.includes("coffee") || n.includes("sugar")) {
    return "/media/products/5280b3616ee09cd5/original.png";
  }
  if (n.includes("cereal") || n.includes("food") || n.includes("daliya") || n.includes("sattu")) {
    return "/media/products/230691785f964164/original.png";
  }
  if (n.includes("daily") || n.includes("essential") || n.includes("paste")) {
    return "/media/products/76cee8f7ee660d4b/original.png";
  }
  if (n.includes("disposable") || n.includes("plate") || n.includes("cup") || n.includes("container")) {
    return "/media/products/e64d9dc70c0c7a58/original.png";
  }
  if (n.includes("personal") || n.includes("health") || n.includes("chyawanprash")) {
    return "/media/products/b8b1b7faaae2883f/original.png";
  }
  if (n.includes("clean") || n.includes("floor") || n.includes("detergent") || n.includes("wash")) {
    return "/media/products/aae5994d38fcac16/original.png";
  }
  if (n.includes("biscuit") || n.includes("snack") || n.includes("namkeen") || n.includes("cookie") || n.includes("papad")) {
    return "/media/products/5a5e3933958103a7/original.png";
  }
  if (n.includes("spice") || n.includes("masala")) {
    return "/brand/mdh-logo.png";
  }
  if (n.includes("pulse") || n.includes("dal")) {
    return "/brand/dawat.svg";
  }
  if (n.includes("dry fruit") || n.includes("kaju") || n.includes("badam") || n.includes("nut")) {
    return "/brand/regency.svg";
  }
  if (n.includes("sauce") || n.includes("ketchup") || n.includes("pickle") || n.includes("jam")) {
    return "/brand/nilons.svg";
  }
  if (n.includes("sweet") || n.includes("mithai")) {
    return "/brand/bikaji.svg";
  }
  if (n.includes("baby")) {
    return "/brand/himalaya.svg";
  }
  if (n.includes("beauty") || n.includes("grooming") || n.includes("skin")) {
    return "/brand/himalaya.svg";
  }
  if (n.includes("gift") || n.includes("hamper")) {
    return "/brand/banner-snacks.jpg";
  }
  if (n.includes("electronic") || n.includes("battery") || n.includes("appliance")) {
    return "/brand/eveready.svg";
  }
  return "/brand/jmd-cart-logo.png";
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
      const tokens = q.trim().split(/\s+/).filter(Boolean);
      if (tokens.length > 0) {
        const tokenConditions = tokens.map((token) => {
          const pattern = `%${token}%`;
          return Prisma.sql`(
            p.short_code ILIKE ${pattern}
            OR p.name ILIKE ${pattern}
            OR COALESCE(p.weight, '') ILIKE ${pattern}
            OR EXISTS (
              SELECT 1 FROM companies c WHERE c.id = p.company_id AND c.name ILIKE ${pattern}
            )
            OR EXISTS (
              SELECT 1 FROM categories cat WHERE cat.id = p.category_id AND cat.name ILIKE ${pattern}
            )
          )`;
        });
        whereParts.push(Prisma.sql`(${Prisma.join(tokenConditions, " AND ")})`);
      }
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

        // If no custom slabs configured, synthesize natural volume slabs from A/B/C pricing:
        if (sortedSlabs.length === 0) {
          const autoSlabs: Array<{
            minQty: number;
            discountBp: number;
            tier: BuyerTier;
            unitPricePaise: number;
          }> = [
            {
              minQty: 1,
              discountBp: resolved.discountFromMrpBp,
              tier: resolved.effectiveBuyerTier,
              unitPricePaise: resolved.unitPricePaise,
            },
          ];

          // 2nd tier: Kirana Retailer (List B) for 4+ units
          if (p.priceBPaise && p.priceBPaise > 0 && p.priceBPaise < resolved.unitPricePaise) {
            autoSlabs.push({
              minQty: 4,
              discountBp: effectiveMrp > 0 ? Math.round(((effectiveMrp - p.priceBPaise) * 10000) / effectiveMrp) : 0,
              tier: BuyerTier.RETAILER,
              unitPricePaise: p.priceBPaise,
            });
          }

          // 3rd tier: Wholesaler Mandi Carton (List A) for full carton / packSize units
          const bulkThreshold = Math.max(10, p.packSize || 20);
          const cheapestB = p.priceBPaise && p.priceBPaise > 0 ? p.priceBPaise : resolved.unitPricePaise;
          if (p.priceAPaise && p.priceAPaise > 0 && p.priceAPaise < cheapestB) {
            autoSlabs.push({
              minQty: bulkThreshold,
              discountBp: effectiveMrp > 0 ? Math.round(((effectiveMrp - p.priceAPaise) * 10000) / effectiveMrp) : 0,
              tier: BuyerTier.WHOLESALER,
              unitPricePaise: p.priceAPaise,
            });
          }

          sortedSlabs = autoSlabs.sort((a, b) => a.minQty - b.minQty);
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
      const autoSlabs: Array<{
        minQty: number;
        discountBp: number;
        tier: BuyerTier;
        unitPricePaise: number;
      }> = [
        {
          minQty: 1,
          discountBp: resolved.discountFromMrpBp,
          tier: resolved.effectiveBuyerTier,
          unitPricePaise: resolved.unitPricePaise,
        },
      ];

      // 2nd tier: Kirana Retailer (List B) for 4+ units
      if (product.priceBPaise && product.priceBPaise > 0 && product.priceBPaise < resolved.unitPricePaise) {
        autoSlabs.push({
          minQty: 4,
          discountBp: effectiveMrp > 0 ? Math.round(((effectiveMrp - product.priceBPaise) * 10000) / effectiveMrp) : 0,
          tier: BuyerTier.RETAILER,
          unitPricePaise: product.priceBPaise,
        });
      }

      // 3rd tier: Wholesaler Mandi Carton (List A) for full carton / packSize units
      const bulkThreshold = Math.max(10, product.packSize || 20);
      const cheapestB = product.priceBPaise && product.priceBPaise > 0 ? product.priceBPaise : resolved.unitPricePaise;
      if (product.priceAPaise && product.priceAPaise > 0 && product.priceAPaise < cheapestB) {
        autoSlabs.push({
          minQty: bulkThreshold,
          discountBp: effectiveMrp > 0 ? Math.round(((effectiveMrp - product.priceAPaise) * 10000) / effectiveMrp) : 0,
          tier: BuyerTier.WHOLESALER,
          unitPricePaise: product.priceAPaise,
        });
      }

      sortedSlabs = autoSlabs.sort((a, b) => a.minQty - b.minQty);
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
        },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          _count: {
            select: { products: { where: { active: true } } },
          },
          products: {
            where: { active: true, imageUrl: { not: null } },
            select: { imageUrl: true },
            take: 1,
          },
        },
      }),
    ]);

    const formattedCategories = categories
      .map((cat) => {
        const dbImage = cat.products[0]?.imageUrl || null;
        return {
          id: cat.id,
          name: cat.name,
          productCount: cat._count.products,
          imageUrl: dbImage || getCategoryFallbackPhoto(cat.name),
        };
      })
      .sort((a, b) => {
        // Stocked categories with products first, then alphabetical
        if ((b.productCount > 0) !== (a.productCount > 0)) {
          return b.productCount > 0 ? 1 : -1;
        }
        return a.name.localeCompare(b.name);
      });

    return {
      companies,
      categories: formattedCategories,
    };
  }

  /**
   * Get related products for a product (frequently bought together / cross-sells)
   */
  async getRelatedProducts(
    productId: string,
    categoryId?: string | null,
    limit = 4,
    options?: { buyerType?: PartyType | BuyerTier | string | null; buyerApproved?: boolean }
  ): Promise<StoreProductItem[]> {
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

      const resolved = resolvePrice(p, options?.buyerType ?? "CUSTOMER", {
        buyerApproved: options?.buyerApproved ?? false,
      });

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
