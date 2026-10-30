import { prisma } from "@/lib/prisma";
import { UserRole, LocationType, MovementType } from "@prisma/client";
import { auditService } from "@/modules/audit/audit.service";
import { formatDmy } from "@/lib/datetime";

export interface OpeningStockItemDto {
  id: string;
  name: string;
  shortCode: string;
  weight: string | null;
  packSize: number;
  packLabel: string;
  mrpPaise: number | null;
  companyName: string | null;
  categoryName: string | null;
  openingStockGodownQty: number;
  openingStockShopQty: number;
  openingStockQty: number;
  openingStockDate: string; // DD-MM-YYYY
  godownCartons: number;
  godownLoose: number;
  openingValuePaise: number;
  liveGodownQty: number;
  liveShopQty: number;
}

export interface OpeningStockSummary {
  totalItems: number;
  itemsWithStock: number;
  totalOpeningPcs: number;
  totalOpeningCartons: number;
  godownOpeningPcs: number;
  shopOpeningPcs: number;
  totalOpeningValuePaise: number;
  baselineDate: string;
}

export class OpeningStockService {
  /**
   * Fetches full Opening Stock inventory list with live comparisons & summary KPIs.
   */
  async getOpeningStockList(params?: {
    search?: string;
    companyId?: string;
    categoryId?: string;
    onlyWithStock?: boolean;
  }): Promise<{ items: OpeningStockItemDto[]; summary: OpeningStockSummary; companies: Array<{ id: string; name: string }>; categories: Array<{ id: string; name: string }> }> {
    const [shopLoc, godownLoc] = await Promise.all([
      prisma.location.findFirst({ where: { type: LocationType.SHOP, active: true } }),
      prisma.location.findFirst({ where: { type: LocationType.GODOWN, active: true } }),
    ]);

    const relevantLocIds = [
      ...(godownLoc ? [godownLoc.id] : []),
      ...(shopLoc ? [shopLoc.id] : []),
    ];

    const [products, companies, categories] = await Promise.all([
      prisma.product.findMany({
        where: {
          active: true,
          ...(params?.companyId ? { companyId: params.companyId } : {}),
          ...(params?.categoryId ? { categoryId: params.categoryId } : {}),
          ...(params?.search ? {
            OR: [
              { name: { contains: params.search, mode: "insensitive" } },
              { shortCode: { contains: params.search, mode: "insensitive" } },
            ],
          } : {}),
        },
        include: {
          company: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          stockBalances: {
            where: { locationId: { in: relevantLocIds } },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.company.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.category.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);

    let totalOpeningPcs = 0;
    let totalOpeningCartons = 0;
    let godownOpeningPcs = 0;
    let shopOpeningPcs = 0;
    let totalOpeningValuePaise = 0;
    let itemsWithStock = 0;

    const items: OpeningStockItemDto[] = [];

    for (const p of products) {
      const packSize = Math.max(1, p.packSize);
      const godownBal = godownLoc ? (p.stockBalances.find((b) => b.locationId === godownLoc.id)?.qty ?? 0) : 0;
      const shopBal = shopLoc ? (p.stockBalances.find((b) => b.locationId === shopLoc.id)?.qty ?? 0) : 0;

      // If opening stock is not yet set in columns, fall back to initial balances
      const godownQty = p.openingStockGodownQty || godownBal;
      const shopQty = p.openingStockShopQty || shopBal;
      const totalQty = p.openingStockQty || (godownQty + shopQty);

      if (params?.onlyWithStock && totalQty <= 0) {
        continue;
      }

      if (totalQty > 0) {
        itemsWithStock++;
      }

      const ctn = Math.floor(godownQty / packSize);
      const loose = godownQty % packSize;
      const valPaise = totalQty * (p.mrpPaise || 0);

      totalOpeningPcs += totalQty;
      totalOpeningCartons += ctn;
      godownOpeningPcs += godownQty;
      shopOpeningPcs += shopQty;
      totalOpeningValuePaise += valPaise;

      const dateStr = p.openingStockDate ? formatDmy(p.openingStockDate) : "18-10-2026";

      items.push({
        id: p.id,
        name: p.name,
        shortCode: p.shortCode,
        weight: p.weight?.trim() || null,
        packSize,
        packLabel: p.packLabel,
        mrpPaise: p.mrpPaise,
        companyName: p.company?.name || null,
        categoryName: p.category?.name || null,
        openingStockGodownQty: godownQty,
        openingStockShopQty: shopQty,
        openingStockQty: totalQty,
        openingStockDate: dateStr,
        godownCartons: ctn,
        godownLoose: loose,
        openingValuePaise: valPaise,
        liveGodownQty: godownBal,
        liveShopQty: shopBal,
      });
    }

    return {
      items,
      summary: {
        totalItems: products.length,
        itemsWithStock,
        totalOpeningPcs,
        totalOpeningCartons,
        godownOpeningPcs,
        shopOpeningPcs,
        totalOpeningValuePaise,
        baselineDate: "18-10-2026",
      },
      companies,
      categories,
    };
  }

  /**
   * Updates Opening Stock for a single product and synchronizes stock balances.
   */
  async updateProductOpeningStock(
    actorRole: UserRole,
    actorId: string,
    input: {
      productId: string;
      godownCartons: number;
      godownLoose: number;
      shopPieces: number;
      reason?: string;
    }
  ) {
    if (
      actorRole !== UserRole.SUPER_ADMIN &&
      actorRole !== UserRole.ADMIN &&
      actorRole !== UserRole.WAREHOUSE_MANAGER &&
      actorRole !== UserRole.GODOWN
    ) {
      throw new Error("Unauthorized to edit opening stock");
    }

    const product = await prisma.product.findUnique({
      where: { id: input.productId },
      select: {
        id: true,
        name: true,
        shortCode: true,
        packSize: true,
        openingStockQty: true,
        openingStockGodownQty: true,
        openingStockShopQty: true,
      },
    });

    if (!product) {
      throw new Error("Product not found");
    }

    const packSize = Math.max(1, product.packSize);
    const godownTotalPieces = Math.max(0, input.godownCartons * packSize + Math.max(0, input.godownLoose));
    const shopPieces = Math.max(0, input.shopPieces);
    const totalOpeningQty = godownTotalPieces + shopPieces;

    const openingDate = new Date("2026-10-18T00:00:00.000+05:30");

    const [shopLoc, godownLoc] = await Promise.all([
      prisma.location.findFirst({ where: { type: LocationType.SHOP, active: true } }),
      prisma.location.findFirst({ where: { type: LocationType.GODOWN, active: true } }),
    ]);

    await prisma.$transaction(async (tx) => {
      // 1. Update Product opening stock fields
      await tx.product.update({
        where: { id: input.productId },
        data: {
          openingStockGodownQty: godownTotalPieces,
          openingStockShopQty: shopPieces,
          openingStockQty: totalOpeningQty,
          openingStockDate: openingDate,
        },
      });

      // 2. Sync Godown StockBalance
      if (godownLoc) {
        await tx.stockBalance.upsert({
          where: {
            productId_locationId: {
              productId: input.productId,
              locationId: godownLoc.id,
            },
          },
          update: { qty: godownTotalPieces, updatedAt: new Date() },
          create: {
            productId: input.productId,
            locationId: godownLoc.id,
            qty: godownTotalPieces,
          },
        });

        // Record or update Opening Stock Movement for Godown
        const godownIdempKey = `open-stock-godown-${input.productId}`;
        await tx.stockMovement.upsert({
          where: { idempotencyKey: godownIdempKey },
          update: {
            qty: godownTotalPieces,
            effectiveDate: openingDate,
            reason: input.reason || "Opening Stock as of 18-10-2026",
          },
          create: {
            type: MovementType.ADJUSTMENT,
            productId: input.productId,
            toLocationId: godownLoc.id,
            qty: godownTotalPieces,
            referenceType: "OPENING_STOCK",
            reason: input.reason || "Opening Stock as of 18-10-2026",
            effectiveDate: openingDate,
            createdAt: openingDate,
            idempotencyKey: godownIdempKey,
            createdBy: actorId,
          },
        });
      }

      // 3. Sync Shop StockBalance
      if (shopLoc) {
        await tx.stockBalance.upsert({
          where: {
            productId_locationId: {
              productId: input.productId,
              locationId: shopLoc.id,
            },
          },
          update: { qty: shopPieces, updatedAt: new Date() },
          create: {
            productId: input.productId,
            locationId: shopLoc.id,
            qty: shopPieces,
          },
        });

        // Record or update Opening Stock Movement for Shop
        const shopIdempKey = `open-stock-shop-${input.productId}`;
        await tx.stockMovement.upsert({
          where: { idempotencyKey: shopIdempKey },
          update: {
            qty: shopPieces,
            effectiveDate: openingDate,
            reason: input.reason || "Opening Stock as of 18-10-2026",
          },
          create: {
            type: MovementType.ADJUSTMENT,
            productId: input.productId,
            toLocationId: shopLoc.id,
            qty: shopPieces,
            referenceType: "OPENING_STOCK",
            reason: input.reason || "Opening Stock as of 18-10-2026",
            effectiveDate: openingDate,
            createdAt: openingDate,
            idempotencyKey: shopIdempKey,
            createdBy: actorId,
          },
        });
      }
    });

    // 4. Audit Log
    await auditService.log({
      actorId,
      action: "OPENING_STOCK_UPDATED",
      entity: "Product",
      entityId: input.productId,
      before: {
        godownQty: product.openingStockGodownQty,
        shopQty: product.openingStockShopQty,
        totalQty: product.openingStockQty,
      },
      after: {
        godownQty: godownTotalPieces,
        shopQty: shopPieces,
        totalQty: totalOpeningQty,
        reason: input.reason,
      },
    });

    return {
      success: true,
      productId: input.productId,
      godownTotalPieces,
      shopPieces,
      totalOpeningQty,
    };
  }
}

export const openingStockService = new OpeningStockService();
