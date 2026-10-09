import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertPermission, Permission } from "@/modules/auth/permissions";
import { stockRepository, StockRepository } from "./stock.repository";
import {
  PostMovementInput,
  StockMovementResult,
  InsufficientStockError,
  InvalidMovementError,
  StockFilterOptions,
  ProductStockBalanceItem,
  StockMovementLedgerItem,
  ProductStockDetails,
  StockSummaryKPIs,
} from "./stock.types";

export class StockService {
  constructor(private readonly repo: StockRepository = stockRepository) {}

  /**
   * The single authorized entry point for changing stock in the system.
   * Runs in an isolated PostgreSQL transaction with row-level locks (FOR UPDATE).
   */
  async postMovement(input: PostMovementInput): Promise<StockMovementResult> {
    this.validateInput(input);

    return prisma.$transaction(
      async (tx) => {
        // 1. Check idempotency: If this key has already been posted, return existing movement safely
        const existing = await this.repo.findMovementByIdempotencyKey(tx, input.idempotencyKey);
        if (existing) {
          return existing;
        }

        const { fromLocationId, toLocationId, productId, qty, branchId = 1 } = input;

        // 2. Determine locking order to prevent deadlocks when locking multiple location rows
        // Deterministic ordering by location ID prevents circular lock wait deadlocks
        const locationsToLock = [fromLocationId, toLocationId]
          .filter((id): id is string => Boolean(id))
          .sort();

        // Map to store locked balances
        const lockedBalances: Record<string, number> = {};

        // Acquire row locks in sorted order
        for (const locId of locationsToLock) {
          lockedBalances[locId] = await this.repo.lockAndGetBalance(
            tx,
            productId,
            locId,
            branchId
          );
        }

        // 3. Validate and apply deduction from source location (if any)
        if (fromLocationId) {
          const currentFromQty = lockedBalances[fromLocationId] ?? 0;
          if (currentFromQty < qty) {
            throw new InsufficientStockError(productId, fromLocationId, currentFromQty, qty);
          }

          const newFromQty = currentFromQty - qty;
          await this.repo.setBalance(tx, productId, fromLocationId, newFromQty);
        }

        // 4. Apply addition to destination location (if any)
        if (toLocationId) {
          const currentToQty = lockedBalances[toLocationId] ?? 0;
          const newToQty = currentToQty + qty;
          await this.repo.setBalance(tx, productId, toLocationId, newToQty);
        }

        // 5. Insert immutable stock movement row
        return this.repo.createMovement(tx, input);
      },
      {
        // Set transaction timeout and isolation
        maxWait: 5000,
        timeout: 10000,
      }
    );
  }

  /**
   * Validate movement topology and quantity rules.
   */
  private validateInput(input: PostMovementInput): void {
    if (!input.productId) {
      throw new InvalidMovementError("Product ID is required for stock movements");
    }

    if (!input.idempotencyKey || input.idempotencyKey.trim().length === 0) {
      throw new InvalidMovementError("Idempotency key is required for all stock movements");
    }

    if (!input.qty || !Number.isInteger(input.qty) || input.qty <= 0) {
      throw new InvalidMovementError(`Movement quantity must be a positive integer, got ${input.qty}`);
    }

    const { type, fromLocationId, toLocationId } = input;

    if (fromLocationId && toLocationId && fromLocationId === toLocationId) {
      throw new InvalidMovementError("Source and destination locations cannot be identical");
    }

    switch (type) {
      case "PURCHASE_RECEIPT":
        if (!toLocationId || fromLocationId) {
          throw new InvalidMovementError("PURCHASE_RECEIPT must have toLocationId and no fromLocationId");
        }
        break;

      case "SALE":
      case "DAMAGE":
      case "RETURN_TO_COMPANY":
        if (!fromLocationId || toLocationId) {
          throw new InvalidMovementError(`${type} must have fromLocationId and no toLocationId`);
        }
        break;

      case "SALE_CANCEL":
        if (!toLocationId || fromLocationId) {
          throw new InvalidMovementError("SALE_CANCEL must have toLocationId and no fromLocationId");
        }
        break;

      case "TRANSFER":
      case "CARTON_BREAK":
      case "VAN_ISSUE":
      case "VAN_RETURN":
        if (!fromLocationId || !toLocationId) {
          throw new InvalidMovementError(`${type} requires both fromLocationId and toLocationId`);
        }
        break;

      case "ADJUSTMENT":
        if ((!fromLocationId && !toLocationId) || (fromLocationId && toLocationId)) {
          throw new InvalidMovementError("ADJUSTMENT must specify either fromLocationId or toLocationId, not both");
        }
        break;

      default:
        throw new InvalidMovementError(`Unsupported movement type: ${type}`);
    }
  }

  /**
   * Read-only helper: Get balance for product at location.
   */
  async getBalance(productId: string, locationId: string): Promise<number> {
    return this.repo.getBalance(productId, locationId);
  }

  /**
   * Read-only helper: Get movements for product.
   */
  async getMovements(productId: string, limit: number = 50, offset: number = 0) {
    return this.repo.getMovements(productId, limit, offset);
  }

  /**
   * Filter and list stock balances across products and locations. Guarded by STOCK_VIEW.
   */
  async listStockBalances(
    role: UserRole,
    filters: StockFilterOptions = {}
  ): Promise<{ items: ProductStockBalanceItem[]; total: number }> {
    assertPermission(role, Permission.STOCK_VIEW);
    return this.repo.getStockBalances(filters);
  }

  /**
   * Get detailed product stock breakdown across all locations. Guarded by STOCK_VIEW.
   */
  async getProductStockDetails(
    role: UserRole,
    productId: string
  ): Promise<ProductStockDetails | null> {
    assertPermission(role, Permission.STOCK_VIEW);
    return this.repo.getProductDetails(productId);
  }

  /**
   * Get chronological movement history for a product. Guarded by STOCK_VIEW.
   */
  async getProductMovements(
    role: UserRole,
    productId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<StockMovementLedgerItem[]> {
    assertPermission(role, Permission.STOCK_VIEW);
    return this.repo.getProductMovementsLedger(productId, options);
  }

  /**
   * Get high-level inventory KPIs. Guarded by STOCK_VIEW.
   */
  async getStockKPIs(role: UserRole): Promise<StockSummaryKPIs> {
    assertPermission(role, Permission.STOCK_VIEW);
    return this.repo.getStockKPIs();
  }
}

export const stockService = new StockService();
