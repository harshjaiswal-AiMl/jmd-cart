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
  effectiveDate?: Date | null;
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
  effectiveDate?: Date | null;
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

export interface StockFilterOptions {
  locationId?: string;
  companyId?: string;
  search?: string;
  lowStockOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface LocationStockBalance {
  locationId: string;
  locationName: string;
  locationType: string;
  qty: number;
  packsCount: number;
  looseCount: number;
}

export interface ProductStockBalanceItem {
  productId: string;
  productName: string;
  shortCode: string;
  companyId: string | null;
  companyName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  hsn: string;
  gstRateBp: number;
  mrpPaise: number;
  packSize: number;
  packLabel: string;
  reorderLevel: number;
  totalQty: number;
  locationQty?: number;
  isLowStock: boolean;
  packsCount: number;
  looseCount: number;
  balances: LocationStockBalance[];
}

export interface StockMovementLedgerItem {
  id: string;
  type: MovementType;
  productId: string;
  productName: string;
  shortCode: string;
  fromLocationId: string | null;
  fromLocationName: string | null;
  toLocationId: string | null;
  toLocationName: string | null;
  qty: number;
  packsCount: number;
  looseCount: number;
  referenceType: string | null;
  referenceId: string | null;
  reason: string | null;
  createdBy: string | null;
  creatorName: string | null;
  createdAt: Date;
}

export interface ProductStockDetails {
  product: {
    id: string;
    name: string;
    shortCode: string;
    companyId: string | null;
    companyName: string | null;
    categoryId: string | null;
    categoryName: string | null;
    hsn: string;
    gstRateBp: number;
    mrpPaise: number;
    packSize: number;
    packLabel: string;
    reorderLevel: number;
    active: boolean;
  };
  totalQty: number;
  isLowStock: boolean;
  packsCount: number;
  looseCount: number;
  balances: LocationStockBalance[];
}

export interface StockSummaryKPIs {
  totalProducts: number;
  lowStockCount: number;
  godownQty: number;
  shopQty: number;
  vansQty: number;
  totalQty: number;
}
