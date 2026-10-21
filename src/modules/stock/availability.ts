import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type StockAvailabilityStatus = "IN_STOCK" | "LOW" | "OUT";

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
