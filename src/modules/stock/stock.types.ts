import { MovementType } from "@prisma/client";

export { MovementType };

export interface PostMovementInput {
  type: MovementType;
  productId: string;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  qty: number; // positive integer pieces
  referenceType?: string | null;
  referenceId?: string | null;
  reason?: string | null;
  meta?: Record<string, unknown> | null;
  idempotencyKey: string;
  actorId?: string | null;
  branchId?: number;
}

export interface StockMovementResult {
  id: string;
  branchId: number;
  type: MovementType;
  productId: string;
  fromLocationId: string | null;
  toLocationId: string | null;
  qty: number;
  referenceType: string | null;
  referenceId: string | null;
  reason: string | null;
  meta: unknown;
  idempotencyKey: string;
  createdBy: string | null;
  createdAt: Date;
  isReplay?: boolean;
}

export class InsufficientStockError extends Error {
  constructor(
    public readonly productId: string,
    public readonly locationId: string,
    public readonly availableQty: number,
    public readonly requestedQty: number
  ) {
    super(
      `Insufficient stock for product ${productId} at location ${locationId}. Available: ${availableQty}, Requested: ${requestedQty}`
    );
    this.name = "InsufficientStockError";
  }
}

export class InvalidMovementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMovementError";
  }
}
