import { Prisma, LocationType, MovementType, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { stockRepository } from "./stock.repository";
import { stockService } from "./stock.service";

export interface StockAllocationItem {
  productId: string;
  productName?: string;
  packSize: number;
  requestedPieces: number;
  fromShopPieces: number;
  fromGodownPieces: number;
  fromGodownCartons: number;
  fromGodownLoose: number;
  requiresCounterPickup: boolean;
}

export interface StockPoolAvailability {
  productId: string;
  shopStock: number;
  godownStock: number;
  shopReserved: number;
  godownReserved: number;
  shopAvailable: number;
  godownAvailable: number;
  totalAvailable: number;
  packSize: number;
  buffer: number;
}

/**
 * Service to manage shared sellable pool (Shop + Godown), deterministic split allocation,
 * per-location reservations, Counter Pickups, and Shop Pick Tasks (Prompt 06 Section 5a).
 */
export class AllocationService {
  /**
   * Fetch live stock and active reservation balances for a product across Shop and Godown.
   */
  async getSellablePool(
    productId: string,
    buffer: number = 0,
    tx: Prisma.TransactionClient = prisma
  ): Promise<StockPoolAvailability> {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { id: true, packSize: true },
    });

    const packSize = Math.max(1, product?.packSize ?? 1);

    const locations = await tx.location.findMany({
      where: {
        type: { in: [LocationType.SHOP, LocationType.GODOWN] },
        active: true,
      },
      select: { id: true, type: true },
    });

    const shopLocIds = locations.filter((l) => l.type === LocationType.SHOP).map((l) => l.id);
    const godownLocIds = locations.filter((l) => l.type === LocationType.GODOWN).map((l) => l.id);

    const balances = await tx.stockBalance.findMany({
      where: {
        productId,
        locationId: { in: locations.map((l) => l.id) },
      },
    });

    const shopStock = balances
      .filter((b) => shopLocIds.includes(b.locationId))
      .reduce((sum, b) => sum + Math.max(0, b.qty), 0);

    const godownStock = balances
      .filter((b) => godownLocIds.includes(b.locationId))
      .reduce((sum, b) => sum + Math.max(0, b.qty), 0);

    const reservations = await tx.stockReservation.groupBy({
      by: ["locationId"],
      where: {
        productId,
        active: true,
      },
      _sum: { qty: true },
    });

    const shopReserved = reservations
      .filter((r) => shopLocIds.includes(r.locationId))
      .reduce((sum, r) => sum + (r._sum.qty ?? 0), 0);

    const godownReserved = reservations
      .filter((r) => godownLocIds.includes(r.locationId))
      .reduce((sum, r) => sum + (r._sum.qty ?? 0), 0);

    const shopAvailable = Math.max(0, shopStock - shopReserved);
    const godownAvailable = Math.max(0, godownStock - godownReserved);
    const totalAvailable = Math.max(0, shopAvailable + godownAvailable - buffer);

    return {
      productId,
      shopStock,
      godownStock,
      shopReserved,
      godownReserved,
      shopAvailable,
      godownAvailable,
      totalAvailable,
      packSize,
      buffer,
    };
  }

  /**
   * Compute allocation split according to Section 5a policy:
   * - Shop POS: SHOP first, then shortfall from GODOWN (creates Counter pickup)
   * - Online / Manual Orders: Whole cartons from GODOWN first, then loose from SHOP first, then rest from GODOWN.
   */
  async computeAllocation(
    channel: "SHOP" | "ONLINE" | "MANUAL",
    items: Array<{ productId: string; requestedPieces: number; packSize?: number; overrideFromShop?: number; overrideFromGodown?: number }>,
    tx: Prisma.TransactionClient = prisma
  ): Promise<StockAllocationItem[]> {
    const results: StockAllocationItem[] = [];

    for (const item of items) {
      const pool = await this.getSellablePool(item.productId, 0, tx);
      const packSize = item.packSize || pool.packSize;
      const requested = item.requestedPieces;

      if (item.overrideFromShop !== undefined && item.overrideFromGodown !== undefined) {
        // Manual override by warehouse manager
        results.push({
          productId: item.productId,
          packSize,
          requestedPieces: requested,
          fromShopPieces: item.overrideFromShop,
          fromGodownPieces: item.overrideFromGodown,
          fromGodownCartons: Math.floor(item.overrideFromGodown / packSize),
          fromGodownLoose: item.overrideFromGodown % packSize,
          requiresCounterPickup: channel === "SHOP" && item.overrideFromGodown > 0,
        });
        continue;
      }

      if (channel === "SHOP") {
        const fromShop = Math.min(pool.shopAvailable, requested);
        const fromGodown = requested - fromShop;

        results.push({
          productId: item.productId,
          packSize,
          requestedPieces: requested,
          fromShopPieces: fromShop,
          fromGodownPieces: fromGodown,
          fromGodownCartons: Math.floor(fromGodown / packSize),
          fromGodownLoose: fromGodown % packSize,
          requiresCounterPickup: fromGodown > 0,
        });
      } else {
        // ONLINE or MANUAL orders
        // Whole cartons from GODOWN first
        const wholeCartonPieces = Math.floor(requested / packSize) * packSize;
        const availableGodownCartonPieces = Math.floor(pool.godownAvailable / packSize) * packSize;
        const fromGodownCartons = Math.min(wholeCartonPieces, availableGodownCartonPieces);

        let remaining = requested - fromGodownCartons;

        // Loose pieces from SHOP first
        const fromShop = Math.min(pool.shopAvailable, remaining);
        remaining -= fromShop;

        // Rest from GODOWN
        const remainingGodownAvailable = pool.godownAvailable - fromGodownCartons;
        const fromGodownLoose = Math.min(remainingGodownAvailable, remaining);

        const fromGodownTotal = fromGodownCartons + fromGodownLoose;

        results.push({
          productId: item.productId,
          packSize,
          requestedPieces: requested,
          fromShopPieces: fromShop,
          fromGodownPieces: fromGodownTotal,
          fromGodownCartons: Math.floor(fromGodownTotal / packSize),
          fromGodownLoose: fromGodownTotal % packSize,
          requiresCounterPickup: false,
        });
      }
    }

    return results;
  }

  /**
   * Acquire row locks in deterministic order (SHOP then GODOWN) and create per-location reservations.
   */
  async reserveOrderStock(
    orderId: string,
    allocations: StockAllocationItem[],
    tx: Prisma.TransactionClient
  ): Promise<void> {
    const locations = await tx.location.findMany({
      where: { type: { in: [LocationType.SHOP, LocationType.GODOWN] }, active: true },
      select: { id: true, type: true },
    });

    const defaultShopLoc = locations.find((l) => l.type === LocationType.SHOP);
    const defaultGodownLoc = locations.find((l) => l.type === LocationType.GODOWN);

    if (!defaultShopLoc || !defaultGodownLoc) {
      throw new Error("Both SHOP and GODOWN locations must exist and be active");
    }

    const shopBalances = await tx.stockBalance.findMany({
      where: {
        productId: { in: allocations.map((a) => a.productId) },
        location: { type: LocationType.SHOP, active: true },
      },
      select: { locationId: true, productId: true, qty: true },
    });
    const godownBalances = await tx.stockBalance.findMany({
      where: {
        productId: { in: allocations.map((a) => a.productId) },
        location: { type: LocationType.GODOWN, active: true },
      },
      select: { locationId: true, productId: true, qty: true },
    });

    const getShopLocId = (pid: string) =>
      shopBalances.find((b) => b.productId === pid && b.qty > 0)?.locationId || defaultShopLoc.id;
    const getGodownLocId = (pid: string) =>
      godownBalances.find((b) => b.productId === pid && b.qty > 0)?.locationId || defaultGodownLoc.id;

    // Deterministic row locking: Lock Shop rows then Godown rows
    for (const alloc of allocations) {
      if (alloc.fromShopPieces > 0) {
        await stockRepository.lockAndGetBalance(tx, alloc.productId, getShopLocId(alloc.productId));
      }
    }
    for (const alloc of allocations) {
      if (alloc.fromGodownPieces > 0) {
        await stockRepository.lockAndGetBalance(tx, alloc.productId, getGodownLocId(alloc.productId));
      }
    }

    // Create reservations and tasks
    const shopTaskItems: Array<{ productId: string; qty: number }> = [];

    for (const alloc of allocations) {
      if (alloc.fromShopPieces > 0) {
        await tx.stockReservation.create({
          data: {
            productId: alloc.productId,
            locationId: getShopLocId(alloc.productId),
            orderId,
            qty: alloc.fromShopPieces,
            active: true,
          },
        });
        shopTaskItems.push({ productId: alloc.productId, qty: alloc.fromShopPieces });
      }

      if (alloc.fromGodownPieces > 0) {
        await tx.stockReservation.create({
          data: {
            productId: alloc.productId,
            locationId: getGodownLocId(alloc.productId),
            orderId,
            qty: alloc.fromGodownPieces,
            active: true,
          },
        });
      }
    }

    // If shop items were allocated for an online/manual order, create a ShopPickTask
    if (shopTaskItems.length > 0) {
      await tx.shopPickTask.create({
        data: {
          orderId,
          items: shopTaskItems,
          status: "PENDING",
        },
      });
    }
  }

  /**
   * Convert active reservations for an order into SALE stock movements upon run handover.
   */
  async convertReservationsToSale(
    orderId: string,
    invoiceId: string,
    actorId?: string,
    tx: Prisma.TransactionClient = prisma
  ): Promise<void> {
    const [reservations, order] = await Promise.all([
      tx.stockReservation.findMany({
        where: { orderId, active: true },
      }),
      tx.order.findUnique({
        where: { id: orderId },
        include: { party: true },
      }),
    ]);

    const isInternalShop = Boolean(
      order?.party &&
        (order.party.id === "party-jmd-shop" ||
          order.party.name.trim().toLowerCase().includes("jmd retail") ||
          order.party.name.trim().toLowerCase() === "jmd shop" ||
          order.party.name.trim().toLowerCase() === "jmd")
    );

    let shopLocId: string | null = null;
    if (isInternalShop) {
      const shopLoc = await tx.location.findFirst({
        where: { type: LocationType.SHOP, active: true },
      });
      shopLocId = shopLoc?.id ?? null;
    }

    for (const res of reservations) {
      if (isInternalShop && shopLocId && res.locationId !== shopLocId) {
        // Godown to Shop Transfer: auto-credit stock directly to the Shop
        await stockService.postMovement(
          {
            fromLocationId: res.locationId,
            toLocationId: shopLocId,
            productId: res.productId,
            qty: res.qty,
            type: MovementType.TRANSFER,
            reason: `Godown Dispatch to Shop for Order #${order?.orderNumber || orderId} (Customer: ${order?.party?.name})`,
            idempotencyKey: `shop-xfer-res-${res.id}-${orderId}`,
            actorId,
          },
          tx
        );
      } else {
        await stockService.postMovement(
          {
            fromLocationId: res.locationId,
            productId: res.productId,
            qty: res.qty,
            type: MovementType.SALE,
            reason: `Online/Manual Order Handover Invoice #${invoiceId}`,
            idempotencyKey: `sale-res-${res.id}-${orderId}`,
            actorId,
          },
          tx
        );
      }
    }

    await tx.stockReservation.updateMany({
      where: { orderId, active: true },
      data: { active: false },
    });
  }

  /**
   * Release active reservations on cancellation.
   */
  async releaseReservations(orderId: string, tx: Prisma.TransactionClient = prisma): Promise<void> {
    await tx.stockReservation.updateMany({
      where: { orderId, active: true },
      data: { active: false },
    });
  }

  /**
   * Create a Counter Pickup task in Godown when a shop counter bill draws from Godown stock.
   */
  async createCounterPickup(
    input: {
      invoiceId: string;
      billNumber: string;
      cashierName?: string;
      items: Array<{ productId: string; productName?: string; qty: number; cartons: number; loose: number }>;
      notes?: string;
    },
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.counterPickup.create({
      data: {
        invoiceId: input.invoiceId,
        billNumber: input.billNumber,
        cashierName: input.cashierName,
        items: input.items,
        notes: input.notes,
        status: "PENDING",
      },
    });
  }
}

export const allocationService = new AllocationService();
