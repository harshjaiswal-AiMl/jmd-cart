import { Prisma, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type StockAvailabilityStatus = "IN_STOCK" | "LOW" | "OUT";

export type StockRankContext = "STOREFRONT" | "POS" | "VAN" | "ADMIN";

export interface StockRankOptions {
  buffer?: number;
  vanLocationId?: string;
  tableAlias?: string; // default "p"
}

/**
 * Pure helper to compute stockRank in memory (used in unit & property tests).
 * Returns 1 for IN_STOCK, 0 for OUT_OF_STOCK.
 */
export function stockRank(
  product: { id: string; packSize?: number },
  context: StockRankContext,
  data: {
    godownQty?: number;
    shopQty?: number;
    reservedQty?: number;
    vanQty?: number;
    totalActiveQty?: number;
    buffer?: number;
  }
): number {
  const buffer = data.buffer ?? 0;
  if (context === "STOREFRONT") {
    const godown = data.godownQty ?? 0;
    const reserved = data.reservedQty ?? 0;
    return godown - reserved - buffer > 0 ? 1 : 0;
  }
  if (context === "POS") {
    const shop = data.shopQty ?? 0;
    const godown = data.godownQty ?? 0;
    const packSize = Math.max(1, product.packSize ?? 1);
    return shop > 0 || godown >= packSize ? 1 : 0;
  }
  if (context === "VAN") {
    return (data.vanQty ?? 0) > 0 ? 1 : 0;
  }
  if (context === "ADMIN") {
    return (data.totalActiveQty ?? 0) > 0 ? 1 : 0;
  }
  return 0;
}

/**
 * Single shared stockRank SQL expression used by every list and picker.
 * Evaluates to 1 for in-stock, 0 for out-of-stock in the database BEFORE pagination.
 *
 * Invariants:
 * - STOREFRONT: godown - reserved - buffer > 0 (identical to getAvailability)
 * - POS: shop pieces > 0 or godown >= one carton
 * - VAN: van stock > 0
 * - ADMIN: total across active locations > 0
 */
export function stockRankSql(
  context: StockRankContext,
  options?: StockRankOptions
): Prisma.Sql {
  const alias = options?.tableAlias || "p";
  const buffer = options?.buffer ?? 0;
  const pId = Prisma.raw(`${alias}.id`);
  const packSize = Prisma.raw(`${alias}.pack_size`);

  if (context === "STOREFRONT") {
    return Prisma.sql`(
      CASE WHEN (
        COALESCE((
          SELECT SUM(sb.qty)
          FROM stock_balances sb
          JOIN locations l ON sb.location_id = l.id
          WHERE sb.product_id = ${pId}
            AND l.type = 'GODOWN'
            AND l.active = true
        ), 0)
        -
        COALESCE((
          SELECT SUM(oi.qty)
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          WHERE oi.product_id = ${pId}
            AND o.status IN ('PENDING', 'CONFIRMED', 'PROCESSING')
            AND o.invoice_id IS NULL
        ), 0)
        - ${buffer}
      ) > 0 THEN 1 ELSE 0 END
    )`;
  }

  if (context === "POS") {
    return Prisma.sql`(
      CASE WHEN (
        COALESCE((
          SELECT SUM(sb.qty)
          FROM stock_balances sb
          JOIN locations l ON sb.location_id = l.id
          WHERE sb.product_id = ${pId}
            AND l.type = 'SHOP'
            AND l.active = true
        ), 0) > 0
        OR
        COALESCE((
          SELECT SUM(sb.qty)
          FROM stock_balances sb
          JOIN locations l ON sb.location_id = l.id
          WHERE sb.product_id = ${pId}
            AND l.type = 'GODOWN'
            AND l.active = true
        ), 0) >= GREATEST(COALESCE(${packSize}, 1), 1)
      ) THEN 1 ELSE 0 END
    )`;
  }

  if (context === "VAN") {
    const vanLocId = options?.vanLocationId || "";
    return Prisma.sql`(
      CASE WHEN (
        COALESCE((
          SELECT SUM(sb.qty)
          FROM stock_balances sb
          WHERE sb.product_id = ${pId}
            AND sb.location_id = ${vanLocId}
        ), 0) > 0
      ) THEN 1 ELSE 0 END
    )`;
  }

  // ADMIN (Admin catalog & admin order creation: total active stock > 0)
  return Prisma.sql`(
    CASE WHEN (
      COALESCE((
        SELECT SUM(sb.qty)
        FROM stock_balances sb
        JOIN locations l ON sb.location_id = l.id
        WHERE sb.product_id = ${pId}
          AND l.active = true
      ), 0) > 0
    ) THEN 1 ELSE 0 END
  )`;
}

export interface ProductRankedQueryOptions {
  whereSql?: Prisma.Sql;
  orderBySql?: Prisma.Sql;
  limit?: number;
  offset?: number;
  stockRankOptions?: StockRankOptions;
}

/**
 * Execute product query with stockRank ordering in PostgreSQL before pagination.
 */
export async function queryRankedProductIds(
  context: StockRankContext,
  options: ProductRankedQueryOptions = {}
): Promise<{ productIds: string[]; totalCount: number }> {
  const rankExpr = stockRankSql(context, options.stockRankOptions);
  const whereClause = options.whereSql
    ? Prisma.sql`WHERE ${options.whereSql}`
    : Prisma.empty;
  const orderClause = options.orderBySql || Prisma.sql`p.name ASC`;
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  const [idRows, countRows] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>`
      SELECT p.id
      FROM products p
      ${whereClause}
      ORDER BY ${rankExpr} DESC, ${orderClause}
      LIMIT ${limit} OFFSET ${offset}
    `,
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM products p
      ${whereClause}
    `,
  ]);

  return {
    productIds: idRows.map((r) => r.id),
    totalCount: Number(countRows[0]?.count ?? 0),
  };
}

export interface ProductAvailability {
  productId: string;
  godown: number;
  shop: number;
  reserved: number;
  buffer: number;
  availablePieces: number;
  status: StockAvailabilityStatus;
}

export interface FeasibilityLineInput {
  productId: string;
  qty: number;
}

export interface FeasibilityAdjustment {
  productId: string;
  productName?: string;
  requestedQty: number;
  availablePieces: number;
  message: string;
}

export interface FeasibilityResult {
  ok: boolean;
  adjustments: FeasibilityAdjustment[];
}

const DEFAULT_LOW_THRESHOLD = 10;

/**
 * Single source of truth for online availability (`modules/stock/availability.ts` per `docs/storefront.md` section 4).
 * - Online-sellable locations: `GODOWN` only. Shop and Van stock are excluded.
 * - `reserved(product)`: pieces held by open online orders (`PENDING`, `CONFIRMED`, `PACKING` without finalized invoice).
 * - `available_pieces(product) = Math.max(0, godown - reserved - buffer)`.
 */
export async function getAvailability(
  productIds: string[],
  options?: { buffer?: number; lowThreshold?: number }
): Promise<Record<string, ProductAvailability>> {
  const buffer = options?.buffer ?? 0;
  const lowThreshold = options?.lowThreshold ?? DEFAULT_LOW_THRESHOLD;

  if (productIds.length === 0) {
    return {};
  }

  const [balances, openOrderLines] = await Promise.all([
    prisma.stockBalance.findMany({
      where: {
        productId: { in: productIds },
        location: { active: true },
      },
      include: {
        location: {
          select: { type: true, active: true },
        },
      },
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        productId: { in: productIds },
        order: {
          status: {
            in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING],
          },
          invoiceId: null,
        },
      },
      _sum: {
        qty: true,
      },
    }),
  ]);

  const reservedByProduct = new Map<string, number>();
  for (const row of openOrderLines) {
    reservedByProduct.set(row.productId, row._sum.qty ?? 0);
  }

  const godownByProduct = new Map<string, number>();
  const shopByProduct = new Map<string, number>();

  for (const sb of balances) {
    if (!sb.location.active) continue;
    if (sb.location.type === "GODOWN") {
      godownByProduct.set(
        sb.productId,
        (godownByProduct.get(sb.productId) ?? 0) + Math.max(0, sb.qty)
      );
    } else if (sb.location.type === "SHOP") {
      shopByProduct.set(
        sb.productId,
        (shopByProduct.get(sb.productId) ?? 0) + Math.max(0, sb.qty)
      );
    }
  }

  const result: Record<string, ProductAvailability> = {};

  for (const pid of productIds) {
    const godown = godownByProduct.get(pid) ?? 0;
    const shop = shopByProduct.get(pid) ?? 0;
    const reserved = reservedByProduct.get(pid) ?? 0;
    const availablePieces = Math.max(0, godown - reserved - buffer);

    let status: StockAvailabilityStatus = "IN_STOCK";
    if (availablePieces === 0) {
      status = "OUT";
    } else if (availablePieces <= lowThreshold) {
      status = "LOW";
    }

    result[pid] = {
      productId: pid,
      godown,
      shop,
      reserved,
      buffer,
      availablePieces,
      status,
    };
  }

  return result;
}

/**
 * Checks whether every requested line can be fulfilled from Godown available stock.
 * Returns exact adjustments ("Only N left of X") when any line exceeds availability.
 */
export async function checkFeasible(
  lines: FeasibilityLineInput[]
): Promise<FeasibilityResult> {
  if (lines.length === 0) {
    return { ok: true, adjustments: [] };
  }

  const productIds = Array.from(new Set(lines.map((l) => l.productId)));
  const [availabilityMap, products] = await Promise.all([
    getAvailability(productIds),
    prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    }),
  ]);

  const nameMap = new Map(products.map((p) => [p.id, p.name]));
  const adjustments: FeasibilityAdjustment[] = [];

  for (const line of lines) {
    const avail = availabilityMap[line.productId];
    const availablePieces = avail?.availablePieces ?? 0;
    const productName = nameMap.get(line.productId) ?? "Product";

    if (line.qty > availablePieces) {
      const message =
        availablePieces === 0
          ? `${productName} is currently out of stock`
          : `Only ${availablePieces} left of ${productName}`;
      adjustments.push({
        productId: line.productId,
        productName,
        requestedQty: line.qty,
        availablePieces,
        message,
      });
    }
  }

  return {
    ok: adjustments.length === 0,
    adjustments,
  };
}
