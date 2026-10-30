import { prisma } from "@/lib/prisma";
import { MovementType, InvoiceChannel } from "@prisma/client";
import { startOfIstDay, endOfIstDay } from "@/lib/datetime";

export interface ItemStockStatementFilters {
  startDate?: string | Date; // YYYY-MM-DD or Date
  endDate?: string | Date;
  locationId?: string;
  companyId?: string;
  categoryId?: string;
  search?: string;
  onlyWithMovement?: boolean;
}

export interface ItemStockStatementRow {
  productId: string;
  productName: string;
  shortCode: string;
  companyName: string;
  categoryName: string;
  weightDisplay: string;
  packSize: number;
  packLabel: string;
  mrpPaise: number;
  // Quantities
  openingQty: number;
  purchasedQty: number;
  purchasedValuePaise: number;
  soldShopQty: number;
  soldVanQty: number;
  soldOnlineQty: number;
  totalSoldQty: number;
  soldValuePaise: number;
  transfersInQty: number;
  transfersOutQty: number;
  adjustmentsQty: number;
  vanReturnsQty: number;
  closingQty: number;
  // Carton conversion for closing
  closingCartons: number;
  closingLoose: number;
  // Location balances
  godownStockQty: number;
  shopStockQty: number;
  vanStockQty: number;
  // Financials
  avgSaleRatePaise: number;
}

export interface ItemStockStatementReport {
  rows: ItemStockStatementRow[];
  summary: {
    totalItems: number;
    totalOpeningQty: number;
    totalPurchasedQty: number;
    totalPurchasedValuePaise: number;
    totalSoldQty: number;
    totalSoldValuePaise: number;
    totalClosingQty: number;
    totalStockValueMrpPaise: number;
  };
}

export class ItemStockStatementService {
  async getStatement(
    filters: ItemStockStatementFilters
  ): Promise<ItemStockStatementReport> {
    const start = filters.startDate
      ? startOfIstDay(filters.startDate)
      : startOfIstDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const end = filters.endDate ? endOfIstDay(filters.endDate) : endOfIstDay(new Date());

    // 1. Fetch matching products
    const productWhere: Record<string, unknown> = { active: true };
    if (filters.companyId) productWhere.companyId = filters.companyId;
    if (filters.categoryId) productWhere.categoryId = filters.categoryId;
    if (filters.search) {
      const q = filters.search.trim().toLowerCase();
      productWhere.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { shortCode: { contains: q, mode: "insensitive" } },
      ];
    }

    const products = await prisma.product.findMany({
      where: productWhere,
      include: {
        company: true,
        category: true,
        stockBalances: { include: { location: true } },
      },
      orderBy: { name: "asc" },
    });

    const productIds = products.map((p) => p.id);
    if (productIds.length === 0) {
      return {
        rows: [],
        summary: {
          totalItems: 0,
          totalOpeningQty: 0,
          totalPurchasedQty: 0,
          totalPurchasedValuePaise: 0,
          totalSoldQty: 0,
          totalSoldValuePaise: 0,
          totalClosingQty: 0,
          totalStockValueMrpPaise: 0,
        },
      };
    }

    // 2. Fetch movements in date range
    const movementWhere: Record<string, unknown> = {
      productId: { in: productIds },
      createdAt: { gte: start, lte: end },
    };
    if (filters.locationId) {
      movementWhere.OR = [
        { fromLocationId: filters.locationId },
        { toLocationId: filters.locationId },
      ];
    }

    const movements = await prisma.stockMovement.findMany({
      where: movementWhere,
    });

    // 3. Fetch opening movements (prior to start)
    const priorMovements = await prisma.stockMovement.findMany({
      where: {
        productId: { in: productIds },
        createdAt: { lt: start },
        ...(filters.locationId
          ? {
              OR: [
                { fromLocationId: filters.locationId },
                { toLocationId: filters.locationId },
              ],
            }
          : {}),
      },
    });

    // Compute opening balance per product
    const openingMap = new Map<string, number>();
    for (const m of priorMovements) {
      const pid = m.productId;
      const current = openingMap.get(pid) || 0;
      if (filters.locationId) {
        if (m.toLocationId === filters.locationId) {
          openingMap.set(pid, current + m.qty);
        } else if (m.fromLocationId === filters.locationId) {
          openingMap.set(pid, current - m.qty);
        }
      } else {
        // Global inventory
        if (m.toLocationId && !m.fromLocationId) {
          // Inbound (purchase, opening, return)
          openingMap.set(pid, current + m.qty);
        } else if (m.fromLocationId && !m.toLocationId) {
          // Outbound (sale, damage)
          openingMap.set(pid, current - m.qty);
        }
      }
    }

    // 4. Fetch invoice sales details for sales split
    const invoiceItems = await prisma.invoiceItem.findMany({
      where: {
        productId: { in: productIds },
        invoice: {
          status: { not: "CANCELLED" },
          createdAt: { gte: start, lte: end },
        },
      },
      include: {
        invoice: { select: { channel: true, status: true } },
      },
    });

    const salesChannelMap = new Map<
      string,
      { shop: number; van: number; online: number; valuePaise: number }
    >();
    for (const item of invoiceItems) {
      const existing = salesChannelMap.get(item.productId) || {
        shop: 0,
        van: 0,
        online: 0,
        valuePaise: 0,
      };
      if (item.invoice.channel === InvoiceChannel.VAN) {
        existing.van += item.qty;
      } else if (item.invoice.channel === InvoiceChannel.ONLINE) {
        existing.online += item.qty;
      } else {
        existing.shop += item.qty;
      }
      existing.valuePaise += item.unitPricePaise * item.qty;
      salesChannelMap.set(item.productId, existing);
    }

    // 5. Aggregate movements per product
    const productAggMap = new Map<
      string,
      {
        purchasedQty: number;
        transfersInQty: number;
        transfersOutQty: number;
        adjustmentsQty: number;
        vanReturnsQty: number;
      }
    >();

    for (const m of movements) {
      const pid = m.productId;
      const agg = productAggMap.get(pid) || {
        purchasedQty: 0,
        transfersInQty: 0,
        transfersOutQty: 0,
        adjustmentsQty: 0,
        vanReturnsQty: 0,
      };

      if (m.type === MovementType.PURCHASE_RECEIPT) {
        agg.purchasedQty += m.qty;
      } else if (m.type === MovementType.TRANSFER) {
        if (filters.locationId) {
          if (m.toLocationId === filters.locationId) agg.transfersInQty += m.qty;
          else if (m.fromLocationId === filters.locationId) agg.transfersOutQty += m.qty;
        } else {
          agg.transfersInQty += m.qty;
        }
      } else if (
        m.type === MovementType.ADJUSTMENT ||
        m.type === MovementType.DAMAGE
      ) {
        agg.adjustmentsQty += m.qty;
      } else if (m.type === MovementType.VAN_RETURN) {
        agg.vanReturnsQty += m.qty;
      }
      productAggMap.set(pid, agg);
    }

    // 6. Build final report rows
    const rows: ItemStockStatementRow[] = [];

    for (const prod of products) {
      const opening = openingMap.get(prod.id) || 0;
      const agg = productAggMap.get(prod.id) || {
        purchasedQty: 0,
        transfersInQty: 0,
        transfersOutQty: 0,
        adjustmentsQty: 0,
        vanReturnsQty: 0,
      };
      const sales = salesChannelMap.get(prod.id) || {
        shop: 0,
        van: 0,
        online: 0,
        valuePaise: 0,
      };
      const totalSoldQty = sales.shop + sales.van + sales.online;

      // Invariant: Opening + In - Out = Closing
      const closingQty =
        opening +
        agg.purchasedQty +
        agg.transfersInQty +
        agg.vanReturnsQty -
        (totalSoldQty + agg.transfersOutQty + agg.adjustmentsQty);

      if (
        filters.onlyWithMovement &&
        opening === 0 &&
        closingQty === 0 &&
        agg.purchasedQty === 0 &&
        totalSoldQty === 0
      ) {
        continue;
      }

      // Location stock breakdown
      let godownQty = 0;
      let shopQty = 0;
      let vanQty = 0;
      for (const sb of prod.stockBalances) {
        if (sb.location.type === "GODOWN") godownQty += sb.qty;
        else if (sb.location.type === "SHOP") shopQty += sb.qty;
        else if (sb.location.type === "VAN") vanQty += sb.qty;
      }

      const packSize = prod.packSize || 1;
      const closingCartons = Math.floor(Math.max(0, closingQty) / packSize);
      const closingLoose = Math.max(0, closingQty) % packSize;

      const avgSaleRatePaise =
        totalSoldQty > 0 ? Math.round(sales.valuePaise / totalSoldQty) : prod.mrpPaise || 0;

      rows.push({
        productId: prod.id,
        productName: prod.name,
        shortCode: prod.shortCode,
        companyName: prod.company?.name || "-",
        categoryName: prod.category?.name || "-",
        weightDisplay: prod.weight || (prod.weightValue ? `${prod.weightValue}${prod.weightUnit || "g"}` : "-"),
        packSize,
        packLabel: prod.packLabel,
        mrpPaise: prod.mrpPaise || 0,
        openingQty: opening,
        purchasedQty: agg.purchasedQty,
        purchasedValuePaise: 0, // at purchase cost
        soldShopQty: sales.shop,
        soldVanQty: sales.van,
        soldOnlineQty: sales.online,
        totalSoldQty,
        soldValuePaise: sales.valuePaise,
        transfersInQty: agg.transfersInQty,
        transfersOutQty: agg.transfersOutQty,
        adjustmentsQty: agg.adjustmentsQty,
        vanReturnsQty: agg.vanReturnsQty,
        closingQty,
        closingCartons,
        closingLoose,
        godownStockQty: godownQty,
        shopStockQty: shopQty,
        vanStockQty: vanQty,
        avgSaleRatePaise,
      });
    }

    const summary = {
      totalItems: rows.length,
      totalOpeningQty: rows.reduce((s, r) => s + r.openingQty, 0),
      totalPurchasedQty: rows.reduce((s, r) => s + r.purchasedQty, 0),
      totalPurchasedValuePaise: rows.reduce((s, r) => s + r.purchasedValuePaise, 0),
      totalSoldQty: rows.reduce((s, r) => s + r.totalSoldQty, 0),
      totalSoldValuePaise: rows.reduce((s, r) => s + r.soldValuePaise, 0),
      totalClosingQty: rows.reduce((s, r) => s + r.closingQty, 0),
      totalStockValueMrpPaise: rows.reduce((s, r) => s + r.closingQty * r.mrpPaise, 0),
    };

    return { rows, summary };
  }
}

export const itemStockStatementService = new ItemStockStatementService();
