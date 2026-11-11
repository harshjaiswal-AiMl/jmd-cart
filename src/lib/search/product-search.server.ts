import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { searchItems, SearchableProduct } from "./smart-search";

export interface ServerProductSearchOptions {
  q?: string | null;
  limit?: number;
  offset?: number;
  activeOnly?: boolean;
  companyId?: string | null;
  categoryId?: string | null;
  storefrontOnly?: boolean;
  requireInStock?: boolean;
  productIds?: string[];
  locationScope?: "ADMIN" | "SHOP" | "GODOWN" | "STOREFRONT";
}

export interface StorefrontPublicProduct {
  id: string;
  name: string;
  shortCode: string;
  weight: string | null;
  imageUrl: string | null;
  companyName: string | null;
  categoryName: string | null;
  mrpPaise: number | null;
  priceAPaise: number | null;
  priceBPaise: number | null;
  priceCPaise: number | null;
  packSize: number;
  packLabel: string;
  inStock: boolean;
  availableStock: number;
}

export type ServerProductRow = Prisma.ProductGetPayload<{
  include: {
    company: true;
    category: true;
    stockBalances: {
      include: {
        location: true;
      };
    };
  };
}>;

export interface ServerProductSearchResult<T = ServerProductRow> {
  items: T[];
  total: number;
  matchedIds: string[];
}

/**
 * Single shared server-side product search engine powered by Shop POS's
 * tokenizing, weight conversion, MRP matching, typo tolerance, and Devanagari/Hinglish normalization.
 */
export async function searchProducts(
  options: ServerProductSearchOptions & { storefrontOnly: true }
): Promise<ServerProductSearchResult<StorefrontPublicProduct>>;
export async function searchProducts(
  options: ServerProductSearchOptions
): Promise<ServerProductSearchResult<ServerProductRow>>;
export async function searchProducts(
  options: ServerProductSearchOptions
): Promise<ServerProductSearchResult<ServerProductRow | StorefrontPublicProduct>> {
  const {
    q,
    limit = 50,
    offset = 0,
    activeOnly = true,
    companyId,
    categoryId,
    storefrontOnly = false,
    requireInStock = false,
    productIds,
  } = options;

  const where: Prisma.ProductWhereInput = {};
  if (storefrontOnly || activeOnly !== false) {
    where.active = true;
  }
  if (companyId) {
    where.companyId = companyId;
  }
  if (categoryId) {
    where.categoryId = categoryId;
  }
  if (productIds && productIds.length > 0) {
    where.id = { in: productIds };
  }
  if (storefrontOnly) {
    where.OR = [{ mrpPaise: { gt: 0 } }, { priceCPaise: { gt: 0 } }];
  }

  const rawProducts = await prisma.product.findMany({
    where,
    include: {
      company: true,
      category: true,
      stockBalances: {
        include: {
          location: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const searchableList: Array<SearchableProduct & { _raw: ServerProductRow; _storeStock: number }> =
    rawProducts.map((p) => {
      const shopQty = p.stockBalances.reduce(
        (sum, sb) => (sb.location?.active && sb.location.type === "SHOP" ? sum + sb.qty : sum),
        0
      );
      const godownQty = p.stockBalances.reduce(
        (sum, sb) => (sb.location?.active && sb.location.type === "GODOWN" ? sum + sb.qty : sum),
        0
      );
      const anyActiveQty = p.stockBalances.reduce(
        (sum, sb) => (sb.location?.active ? sum + sb.qty : sum),
        0
      );
      const effectiveShop = storefrontOnly ? shopQty : shopQty;
      const effectiveGodown = storefrontOnly ? godownQty : Math.max(godownQty, anyActiveQty - shopQty);

      return {
        id: p.id,
        name: p.name,
        nameHi: (p as { nameHi?: string | null }).nameHi ?? null,
        shortCode: p.shortCode,
        companyName: p.company?.name ?? null,
        categoryName: p.category?.name ?? null,
        weight: p.weight,
        weightValue: p.weightValue,
        weightUnit: p.weightUnit,
        weightBase: p.weightBase,
        packSize: p.packSize,
        packLabel: p.packLabel,
        shopStockQty: effectiveShop,
        godownStockQty: effectiveGodown,
        mrpPaise: p.mrpPaise,
        priceAPaise: p.priceAPaise,
        priceBPaise: p.priceBPaise,
        priceCPaise: p.priceCPaise,
        bagSize: p.bagSize,
        imageUrl: p.imageUrl,
        active: p.active,
        _raw: p,
        _storeStock: shopQty + godownQty,
      };
    });

  let ordered: typeof searchableList;
  const trimmedQ = q?.trim() || "";
  if (trimmedQ) {
    const matched = searchItems(trimmedQ, searchableList, {
      limit: searchableList.length + 10,
      requireInStock,
    }) as typeof searchableList;
    ordered = matched;
  } else {
    ordered = [...searchableList].filter((item) => {
      if (!requireInStock) return true;
      return (item.shopStockQty ?? 0) + (item.godownStockQty ?? 0) > 0;
    });
    ordered.sort((a, b) => {
      const aStock = (a.shopStockQty ?? 0) + (a.godownStockQty ?? 0) > 0 ? 1 : 0;
      const bStock = (b.shopStockQty ?? 0) + (b.godownStockQty ?? 0) > 0 ? 1 : 0;
      if (bStock !== aStock) return bStock - aStock;
      return a.name.localeCompare(b.name);
    });
  }

  const total = ordered.length;
  const paged = ordered.slice(offset, offset + limit);
  const matchedIds = paged.map((x) => x.id);

  if (storefrontOnly) {
    const publicItems: StorefrontPublicProduct[] = paged.map((item) => ({
      id: item._raw.id,
      name: item._raw.name,
      shortCode: item._raw.shortCode,
      weight: item._raw.weight,
      imageUrl: item._raw.imageUrl,
      companyName: item._raw.company?.name ?? null,
      categoryName: item._raw.category?.name ?? null,
      mrpPaise: item._raw.mrpPaise,
      priceAPaise: item._raw.priceAPaise,
      priceBPaise: item._raw.priceBPaise,
      priceCPaise: item._raw.priceCPaise,
      packSize: item._raw.packSize,
      packLabel: item._raw.packLabel,
      inStock: item._storeStock > 0,
      availableStock: item._storeStock,
    }));
    return { items: publicItems, total, matchedIds };
  }

  return {
    items: paged.map((x) => x._raw),
    total,
    matchedIds,
  };
}
