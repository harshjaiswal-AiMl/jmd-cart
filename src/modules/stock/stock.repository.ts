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
}

export const stockRepository = new StockRepository();
