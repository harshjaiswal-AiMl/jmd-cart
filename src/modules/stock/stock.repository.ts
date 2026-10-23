import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PostMovementInput, StockMovementResult } from "./stock.types";

type TransactionClient = Prisma.TransactionClient;

export class StockRepository {
  /**
   * Find an existing stock movement by its unique idempotency key.
   */
  async findMovementByIdempotencyKey(
    tx: TransactionClient,
    idempotencyKey: string
  ): Promise<StockMovementResult | null> {
    const movement = await tx.stockMovement.findUnique({
      where: { idempotencyKey },
    });

    if (!movement) return null;

    return {
      ...movement,
      meta: movement.meta as unknown,
      isReplay: true,
    };
  }

  /**
   * Ensure a stock balance row exists and lock it with SELECT ... FOR UPDATE.
   * Returns the current locked quantity.
   */
  async lockAndGetBalance(
    tx: TransactionClient,
    productId: string,
    locationId: string,
    branchId: number = 1
  ): Promise<number> {
    // 1. Ensure the row exists using an atomic upsert
    await tx.$executeRaw`
      INSERT INTO "stock_balances" ("product_id", "location_id", "branch_id", "qty", "updated_at")
      VALUES (${productId}, ${locationId}, ${branchId}, 0, NOW())
      ON CONFLICT ("product_id", "location_id")
      DO NOTHING;
    `;

    // 2. Pessimistically lock the balance row for this product & location
    const rows = await tx.$queryRaw<{ qty: number }[]>`
      SELECT "qty"
      FROM "stock_balances"
      WHERE "product_id" = ${productId} AND "location_id" = ${locationId}
      FOR UPDATE;
    `;

    if (!rows || rows.length === 0) {
      throw new Error(`Failed to acquire lock for balance on product ${productId} at location ${locationId}`);
    }

    return rows[0].qty;
  }

  /**
   * Update the balance quantity for a locked row.
   */
  async setBalance(
    tx: TransactionClient,
    productId: string,
    locationId: string,
    newQty: number
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE "stock_balances"
      SET "qty" = ${newQty}, "updated_at" = NOW()
      WHERE "product_id" = ${productId} AND "location_id" = ${locationId};
    `;
  }

  /**
   * Insert a new immutable stock movement record.
   */
  async createMovement(
    tx: TransactionClient,
    input: PostMovementInput
  ): Promise<StockMovementResult> {
    const movement = await tx.stockMovement.create({
      data: {
        branchId: input.branchId ?? 1,
        type: input.type,
        productId: input.productId,
        fromLocationId: input.fromLocationId ?? null,
        toLocationId: input.toLocationId ?? null,
        qty: input.qty,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        reason: input.reason ?? null,
        meta: input.meta ? (input.meta as Prisma.InputJsonValue) : Prisma.JsonNull,
        idempotencyKey: input.idempotencyKey,
        createdBy: input.actorId ?? null,
      },
    });

    return {
      ...movement,
      meta: movement.meta as unknown,
      isReplay: false,
    };
  }

  /**
   * Read-only query: Get current balance for a product at a location.
   */
  async getBalance(
    productId: string,
    locationId: string,
    client: PrismaClient | TransactionClient = prisma
  ): Promise<number> {
    const balance = await client.stockBalance.findUnique({
      where: {
        productId_locationId: { productId, locationId },
      },
      select: { qty: true },
    });

    return balance?.qty ?? 0;
  }

  /**
   * Read-only query: Get balances for a product across all locations.
   */
  async getBalancesByProduct(
    productId: string,
    client: PrismaClient | TransactionClient = prisma
  ) {
    return client.stockBalance.findMany({
      where: { productId },
      include: { location: true },
    });
  }

  /**
   * Read-only query: Get balances for all products at a specific location.
   */
  async getBalancesByLocation(
    locationId: string,
    client: PrismaClient | TransactionClient = prisma
  ) {
    return client.stockBalance.findMany({
      where: { locationId },
      include: { product: true },
    });
  }

  /**
   * Read-only query: Get movements history for a product.
   */
  async getMovements(
    productId: string,
    limit: number = 50,
    offset: number = 0,
    client: PrismaClient | TransactionClient = prisma
  ) {
    return client.stockMovement.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        fromLocation: true,
        toLocation: true,
      },
    });
  }

  /**
   * Filter and list stock balances for products with location breakdown and low-stock detection.
   */
  async getStockBalances(
    filters: import("./stock.types").StockFilterOptions = {},
    client: PrismaClient | TransactionClient = prisma
  ): Promise<{ items: import("./stock.types").ProductStockBalanceItem[]; total: number }> {
    const where: Prisma.ProductWhereInput = {
      active: true,
    };

    if (filters.companyId) {
      where.companyId = filters.companyId;
    }

    if (filters.search && filters.search.trim().length > 0) {
      const term = filters.search.trim();
      where.OR = [
        { name: { contains: term, mode: "insensitive" } },
        { shortCode: { contains: term, mode: "insensitive" } },
        { company: { name: { contains: term, mode: "insensitive" } } },
      ];
    }

    const locations = await client.location.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });

    const products = await client.product.findMany({
      where,
      include: {
        company: true,
        category: true,
        stockBalances: {
          include: { location: true },
        },
      },
      orderBy: { name: "asc" },
    });

    let items: import("./stock.types").ProductStockBalanceItem[] = products.map((p) => {
      const balanceMap = new Map<string, number>();
      for (const sb of p.stockBalances) {
        balanceMap.set(sb.locationId, sb.qty);
      }

      const balances: import("./stock.types").LocationStockBalance[] = locations.map((loc) => {
        const qty = balanceMap.get(loc.id) ?? 0;
        return {
          locationId: loc.id,
          locationName: loc.name,
          locationType: loc.type,
          qty,
          packsCount: Math.floor(qty / p.packSize),
          looseCount: qty % p.packSize,
        };
      });

      const totalQty = balances.reduce((sum, b) => sum + b.qty, 0);
      const locationQty = filters.locationId
        ? balances.find((b) => b.locationId === filters.locationId)?.qty ?? 0
        : undefined;

      const isLowStock =
        locationQty !== undefined
          ? locationQty <= p.reorderLevel
          : totalQty <= p.reorderLevel;

      const displayQty = locationQty !== undefined ? locationQty : totalQty;

      return {
        productId: p.id,
        productName: p.name,
        shortCode: p.shortCode,
        companyId: p.companyId,
        companyName: p.company?.name ?? null,
        categoryId: p.categoryId,
        categoryName: p.category?.name ?? null,
        hsn: p.hsn,
        gstRateBp: p.gstRateBp,
        mrpPaise: p.mrpPaise ?? p.priceCPaise ?? 0,
        packSize: p.packSize,
        packLabel: p.packLabel,
        reorderLevel: p.reorderLevel,
        totalQty,
        locationQty,
        isLowStock,
        packsCount: Math.floor(displayQty / p.packSize),
        looseCount: displayQty % p.packSize,
        balances,
      };
    });

    if (filters.lowStockOnly) {
      items = items.filter((item) => item.isLowStock);
    }

    // Out-of-stock last: in-stock items appear first, out-of-stock (0 pcs) items appear last
    items.sort((a, b) => {
      const aStock = (a.locationQty !== undefined ? a.locationQty : a.totalQty) > 0 ? 0 : 1;
      const bStock = (b.locationQty !== undefined ? b.locationQty : b.totalQty) > 0 ? 0 : 1;
      if (aStock !== bStock) {
        return aStock - bStock;
      }
      return a.productName.localeCompare(b.productName, undefined, { sensitivity: "base" });
    });

    const total = items.length;
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 100;
    const paginatedItems = items.slice(offset, offset + limit);

    return { items: paginatedItems, total };
  }

  /**
   * Get detailed product stock information across all locations.
   */
  async getProductDetails(
    productId: string,
    client: PrismaClient | TransactionClient = prisma
  ): Promise<import("./stock.types").ProductStockDetails | null> {
    const p = await client.product.findUnique({
      where: { id: productId },
      include: {
        company: true,
        category: true,
        stockBalances: {
          include: { location: true },
        },
      },
    });

    if (!p) return null;

    const locations = await client.location.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });

    const balanceMap = new Map<string, number>();
    for (const sb of p.stockBalances) {
      balanceMap.set(sb.locationId, sb.qty);
    }

    const balances: import("./stock.types").LocationStockBalance[] = locations.map((loc) => {
      const qty = balanceMap.get(loc.id) ?? 0;
      return {
        locationId: loc.id,
        locationName: loc.name,
        locationType: loc.type,
        qty,
        packsCount: Math.floor(qty / p.packSize),
        looseCount: qty % p.packSize,
      };
    });

    const totalQty = balances.reduce((sum, b) => sum + b.qty, 0);

    return {
      product: {
        id: p.id,
        name: p.name,
        shortCode: p.shortCode,
        companyId: p.companyId,
        companyName: p.company?.name ?? null,
        categoryId: p.categoryId,
        categoryName: p.category?.name ?? null,
        hsn: p.hsn,
        gstRateBp: p.gstRateBp,
        mrpPaise: p.mrpPaise ?? p.priceCPaise ?? 0,
        packSize: p.packSize,
        packLabel: p.packLabel,
        reorderLevel: p.reorderLevel,
        active: p.active,
      },
      totalQty,
      isLowStock: totalQty <= p.reorderLevel,
      packsCount: Math.floor(totalQty / p.packSize),
      looseCount: totalQty % p.packSize,
      balances,
    };
  }

  /**
   * Get full chronological movement ledger for a product with IST-ready items and user details.
   */
  async getProductMovementsLedger(
    productId: string,
    options: { limit?: number; offset?: number } = {},
    client: PrismaClient | TransactionClient = prisma
  ): Promise<import("./stock.types").StockMovementLedgerItem[]> {
    const limit = options.limit ?? 100;
    const offset = options.offset ?? 0;

    const movements = await client.stockMovement.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        product: true,
        fromLocation: true,
        toLocation: true,
      },
    });

    const userIds = Array.from(
      new Set(movements.map((m) => m.createdBy).filter((id): id is string => Boolean(id)))
    );

    const userMap = new Map<string, string>();
    if (userIds.length > 0) {
      const users = await client.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      });
      for (const u of users) {
        userMap.set(u.id, u.name);
      }
    }

    return movements.map((m) => {
      const packSize = m.product.packSize || 1;
      return {
        id: m.id,
        type: m.type,
        productId: m.productId,
        productName: m.product.name,
        shortCode: m.product.shortCode,
        fromLocationId: m.fromLocationId,
        fromLocationName: m.fromLocation?.name ?? null,
        toLocationId: m.toLocationId,
        toLocationName: m.toLocation?.name ?? null,
        qty: m.qty,
        packsCount: Math.floor(m.qty / packSize),
        looseCount: m.qty % packSize,
        referenceType: m.referenceType,
        referenceId: m.referenceId,
        reason: m.reason,
        createdBy: m.createdBy,
        creatorName: m.createdBy ? userMap.get(m.createdBy) ?? null : null,
        createdAt: m.createdAt,
      };
    });
  }

  /**
   * Get high-level inventory KPIs (total SKUs, low stock count, godown/shop/van balances).
   */
  async getStockKPIs(
    client: PrismaClient | TransactionClient = prisma
  ): Promise<import("./stock.types").StockSummaryKPIs> {
    const [totalProducts, locations, balances, products] = await Promise.all([
      client.product.count({ where: { active: true } }),
      client.location.findMany({ where: { active: true }, select: { id: true, type: true } }),
      client.stockBalance.findMany({
        include: { location: true },
      }),
      client.product.findMany({
        where: { active: true },
        select: { id: true, reorderLevel: true },
      }),
    ]);

    const locTypeMap = new Map<string, string>();
    for (const loc of locations) {
      locTypeMap.set(loc.id, loc.type);
    }

    let godownQty = 0;
    let shopQty = 0;
    let vansQty = 0;
    let totalQty = 0;

    const productTotalMap = new Map<string, number>();

    for (const b of balances) {
      totalQty += b.qty;
      const type = locTypeMap.get(b.locationId);
      if (type === "GODOWN") godownQty += b.qty;
      else if (type === "SHOP") shopQty += b.qty;
      else if (type === "VAN") vansQty += b.qty;

      const curr = productTotalMap.get(b.productId) ?? 0;
      productTotalMap.set(b.productId, curr + b.qty);
    }

    let lowStockCount = 0;
    for (const p of products) {
      const pQty = productTotalMap.get(p.id) ?? 0;
      if (pQty <= p.reorderLevel) {
        lowStockCount++;
      }
    }

    return {
      totalProducts,
      lowStockCount,
      godownQty,
      shopQty,
      vansQty,
      totalQty,
    };
  }
}

export const stockRepository = new StockRepository();
