import { Prisma, OrderStatus, DispatchRunStatus, ShopRequestStatus, CounterPickupStatus, MovementType, InvoiceChannel, PaymentStatus, InvoiceStatus, LocationType, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { allocationService } from "@/modules/stock/allocation.service";
import { stockService } from "@/modules/stock/stock.service";
import { auditService } from "@/modules/audit/audit.service";
import { ForbiddenError } from "@/modules/auth/permissions";
import { getNextSequenceNumber } from "@/lib/invoice-number";

export interface CreateDispatchRunInput {
  vanId?: string;
  deliveryUserId?: string;
  slot?: string;
  notes?: string;
  orderIds: string[];
}

export interface TodayLoadItem {
  productId: string;
  productName: string;
  packSize: number;
  neededPieces: number;
  neededCartons: number;
  neededLoose: number;
  availablePieces: number;
  availableCartons: number;
  availableLoose: number;
  shortagePieces: number;
  isShortage: boolean;
}

export class DispatchService {
  /**
   * Load summary for today: total pieces that must leave today vs available stock.
   */
  async getTodaysLoadSummary(date: Date = new Date()): Promise<TodayLoadItem[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // 1. Confirmed online/manual order lines needing dispatch
    const pendingOrders = await prisma.order.findMany({
      where: {
        status: { in: [OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.PICKING, OrderStatus.PACKED] },
        invoiceId: null,
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, packSize: true } },
          },
        },
      },
    });

    const neededByProduct = new Map<string, { product: { id: string; name: string; packSize: number }; needed: number }>();

    for (const order of pendingOrders) {
      for (const item of order.items) {
        const existing = neededByProduct.get(item.productId);
        if (existing) {
          existing.needed += item.qty;
        } else {
          neededByProduct.set(item.productId, {
            product: {
              id: item.product.id,
              name: item.product.name,
              packSize: Math.max(1, item.product.packSize || 1),
            },
            needed: item.qty,
          });
        }
      }
    }

    // 2. Approved shop request lines
    const approvedShopRequests = await prisma.shopRequest.findMany({
      where: {
        status: ShopRequestStatus.APPROVED,
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
      include: {
        lines: {
          include: {
            product: { select: { id: true, name: true, packSize: true } },
          },
        },
      },
    });

    for (const req of approvedShopRequests) {
      for (const line of req.lines) {
        const qty = line.approvedQty ?? line.requestedQty;
        const existing = neededByProduct.get(line.productId);
        if (existing) {
          existing.needed += qty;
        } else {
          neededByProduct.set(line.productId, {
            product: {
              id: line.product.id,
              name: line.product.name,
              packSize: Math.max(1, line.product.packSize || 1),
            },
            needed: qty,
          });
        }
      }
    }

    // 3. For each needed product, calculate availability & shortages
    const results: TodayLoadItem[] = [];

    for (const [productId, entry] of neededByProduct.entries()) {
      const pool = await allocationService.getSellablePool(productId, 0);
      const shortagePieces = Math.max(0, entry.needed - pool.totalAvailable);

      results.push({
        productId,
        productName: entry.product.name,
        packSize: entry.product.packSize,
        neededPieces: entry.needed,
        neededCartons: Math.floor(entry.needed / entry.product.packSize),
        neededLoose: entry.needed % entry.product.packSize,
        availablePieces: pool.totalAvailable,
        availableCartons: Math.floor(pool.totalAvailable / entry.product.packSize),
        availableLoose: pool.totalAvailable % entry.product.packSize,
        shortagePieces,
        isShortage: shortagePieces > 0,
      });
    }

    return results.sort((a, b) => (b.isShortage ? 1 : 0) - (a.isShortage ? 1 : 0));
  }

  /**
   * Complete live dashboard data for the Dispatch Board.
   */
  async getDispatchBoardData() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      loadSummary,
      orders,
      runs,
      shopRequests,
      counterPickups,
      recentShopSales,
      shopBalances,
    ] = await Promise.all([
      this.getTodaysLoadSummary(),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          party: { select: { id: true, name: true, type: true, phone: true } },
          createdByUser: { select: { id: true, name: true, role: true } },
          assignedDeliveryUser: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, packSize: true } },
            },
          },
          packages: true,
          shopPickTasks: true,
        },
      }),
      prisma.dispatchRun.findMany({
        orderBy: { date: "desc" },
        take: 20,
        include: {
          van: { select: { id: true, name: true } },
          deliveryUser: { select: { id: true, name: true, phone: true } },
          orders: {
            orderBy: { sequence: "asc" },
            include: {
              order: {
                include: {
                  party: { select: { name: true, phone: true } },
                  items: {
                    include: {
                      product: { select: { name: true, packSize: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.shopRequest.findMany({
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          lines: {
            include: {
              product: { select: { id: true, name: true, packSize: true } },
            },
          },
        },
      }),
      prisma.counterPickup.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      // Live feed of shop counter sales & packing queue
      prisma.invoice.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          party: { select: { id: true, name: true, phone: true } },
          creator: { select: { id: true, name: true } },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  shortCode: true,
                  packSize: true,
                  packLabel: true,
                  reorderLevel: true,
                },
              },
            },
          },
          counterPickups: {
            orderBy: { createdAt: "desc" },
          },
        },
      }),
      // Shop stock balances for stock panel
      prisma.stockBalance.findMany({
        where: {
          location: { type: LocationType.SHOP, active: true },
        },
        include: {
          product: { select: { id: true, name: true, reorderLevel: true, packSize: true } },
        },
      }),
    ]);

    return {
      loadSummary,
      orders,
      runs,
      shopRequests,
      counterPickups,
      recentShopSales,
      shopBalances,
    };
  }

  /**
   * Create a new dispatch run with assigned orders.
   */
  async createDispatchRun(input: CreateDispatchRunInput, actor: { id: string; role: UserRole; name: string }) {
    if (
      actor.role !== UserRole.SUPER_ADMIN &&
      actor.role !== UserRole.ADMIN &&
      actor.role !== UserRole.WAREHOUSE_MANAGER
    ) {
      throw new ForbiddenError("Insufficient permissions to create dispatch runs");
    }

    if (!input.orderIds || input.orderIds.length === 0) {
      throw new Error("Dispatch run must contain at least one order");
    }

    const run = await prisma.$transaction(async (tx) => {
      const seq = await getNextSequenceNumber(tx, "RUN");
      const runNumber = `RUN/${seq.fy}/${String(seq.sequenceValue).padStart(5, "0")}`;

      const created = await tx.dispatchRun.create({
        data: {
          runNumber,
          branchId: 1,
          vanId: input.vanId,
          deliveryUserId: input.deliveryUserId,
          slot: input.slot,
          notes: input.notes,
          status: DispatchRunStatus.DRAFT,
          orders: {
            create: input.orderIds.map((orderId, idx) => ({
              orderId,
              sequence: idx + 1,
            })),
          },
        },
        include: {
          orders: true,
        },
      });

      // Update orders to PICKING status
      await tx.order.updateMany({
        where: { id: { in: input.orderIds } },
        data: {
          status: OrderStatus.PICKING,
          assignedDeliveryUserId: input.deliveryUserId,
        },
      });

      return created;
    });

    await auditService.log({
      actorId: actor.id,
      action: "CREATE_DISPATCH_RUN",
      entity: "DispatchRun",
      entityId: run.id,
      after: { runNumber: run.runNumber, orderIds: input.orderIds },
    });

    return run;
  }

  /**
   * Hand over dispatch run: finalizes invoices, converts reservations to SALE movements, marks orders OUT_FOR_DELIVERY.
   */
  async handoverDispatchRun(runId: string, actor: { id: string; role: UserRole; name: string }) {
    const run = await prisma.dispatchRun.findUnique({
      where: { id: runId },
      include: {
        orders: {
          include: {
            order: {
              include: { items: true },
            },
          },
        },
      },
    });

    if (!run) {
      throw new Error("Dispatch run not found");
    }

    if (run.status === DispatchRunStatus.OUT || run.status === DispatchRunStatus.CLOSED) {
      throw new Error("Dispatch run has already been handed over");
    }

    await prisma.$transaction(async (tx) => {
      // Hand over each order
      for (const runOrder of run.orders) {
        const order = runOrder.order;

        // If no invoice yet, create finalized invoice
        let invoiceId = order.invoiceId;
        if (!invoiceId) {
          const seq = await getNextSequenceNumber(tx, "INV");

          const godownLoc = await tx.location.findFirst({
            where: { type: LocationType.GODOWN, active: true },
          });

          const createdInvoice = await tx.invoice.create({
            data: {
              number: seq.number,
              fy: seq.fy,
              status: InvoiceStatus.FINAL,
              channel: InvoiceChannel.ONLINE,
              locationId: godownLoc?.id || "loc-godown-1",
              partyId: order.partyId,
              buyerType: order.buyerTag,
              subtotalPaise: order.subtotalPaise,
              taxablePaise: order.taxablePaise,
              cgstPaise: order.cgstPaise,
              sgstPaise: order.sgstPaise,
              igstPaise: order.igstPaise,
              totalPaise: order.totalPaise,
              paymentStatus: PaymentStatus.PENDING,
              createdBy: actor.id,
              finalizedAt: new Date(),
              items: {
                create: order.items.map((item) => ({
                  productId: item.productId,
                  qty: item.qty,
                  mrpPaise: item.mrpPaise,
                  discountBp: item.discountBp,
                  unitPricePaise: item.unitPricePaise,
                  taxablePaise: item.taxablePaise,
                  gstRateBp: item.gstRateBp,
                  taxPaise: item.taxPaise,
                  hsn: item.hsn,
                })),
              },
            },
          });

          invoiceId = createdInvoice.id;
          await tx.order.update({
            where: { id: order.id },
            data: { invoiceId },
          });
        }

        // Convert reservations to SALE movements per location
        await allocationService.convertReservationsToSale(order.id, invoiceId!, actor.id, tx);

        // Update status to OUT_FOR_DELIVERY
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.OUT_FOR_DELIVERY },
        });
      }

      // Update run status to OUT
      await tx.dispatchRun.update({
        where: { id: runId },
        data: { status: DispatchRunStatus.OUT },
      });
    });

    await auditService.log({
      actorId: actor.id,
      action: "HANDOVER_DISPATCH_RUN",
      entity: "DispatchRun",
      entityId: runId,
      after: { status: DispatchRunStatus.OUT },
    });

    return { success: true, runId };
  }

  /**
   * Handle failed delivery: returns goods to godown by counter-movement, reschedules or cancels order.
   */
  async handleFailedDelivery(
    orderId: string,
    reason: string,
    actor: { id: string; role: UserRole; name: string },
    targetLocationId?: string
  ) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new Error("Order not found");
    }

    let godownLocId = targetLocationId;
    if (!godownLocId) {
      const godownLoc = await prisma.location.findFirst({
        where: { type: LocationType.GODOWN, active: true },
      });
      if (!godownLoc) {
        throw new Error("Active Godown location not found");
      }
      godownLocId = godownLoc.id;
    }

    await prisma.$transaction(async (tx) => {
      // Return each item to godown via ADJUSTMENT counter-movement
      for (const item of order.items) {
        await stockService.postMovement(
          {
            toLocationId: godownLocId!,
            productId: item.productId,
            qty: item.qty,
            type: MovementType.ADJUSTMENT,
            reason: `Failed delivery return Order #${order.orderNumber}: ${reason}`,
            idempotencyKey: `failed-return-${order.id}-${item.productId}`,
            actorId: actor.id,
          },
          tx
        );
      }

      // Mark order FAILED
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.FAILED,
          customerNotes: `Failed delivery: ${reason}`,
        },
      });
    });

    await auditService.log({
      actorId: actor.id,
      action: "FAILED_DELIVERY_RETURN",
      entity: "Order",
      entityId: orderId,
      after: { reason, status: OrderStatus.FAILED },
    });

    return { success: true };
  }

  /**
   * Complete a counter pickup in the Godown.
   */
  async completeCounterPickup(pickupId: string, actor: { id: string; name: string }) {
    const updated = await prisma.counterPickup.update({
      where: { id: pickupId },
      data: {
        status: CounterPickupStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    await auditService.log({
      actorId: actor.id,
      action: "COMPLETE_COUNTER_PICKUP",
      entity: "CounterPickup",
      entityId: pickupId,
      after: { status: CounterPickupStatus.COMPLETED },
    });

    return updated;
  }

  /**
   * Update packing / fulfillment status for an invoice or counter pickup.
   * Statuses: PENDING -> PACKING -> PACKED -> COMPLETED
   */
  async updatePackingStatus(
    input: {
      pickupId?: string;
      invoiceId?: string;
      status: "PENDING" | "PACKING" | "PACKED" | "COMPLETED";
      items?: any;
      notes?: string;
    },
    actor: { id: string; name: string }
  ) {
    const { pickupId, invoiceId, status, items, notes } = input;

    let targetPickupId = pickupId;

    if (!targetPickupId && invoiceId) {
      // Find existing or lazy-create for this invoice
      const existing = await prisma.counterPickup.findFirst({
        where: { invoiceId },
      });
      if (existing) {
        targetPickupId = existing.id;
      } else {
        const inv = await prisma.invoice.findUnique({
          where: { id: invoiceId },
          include: {
            items: {
              include: {
                product: { select: { id: true, name: true, shortCode: true, packSize: true, packLabel: true } },
              },
            },
            creator: { select: { name: true } },
          },
        });
        if (!inv) throw new Error("Invoice not found");

        const created = await prisma.counterPickup.create({
          data: {
            invoiceId: inv.id,
            billNumber: inv.number,
            cashierName: inv.creator?.name || "Cashier",
            status: status === "COMPLETED" ? CounterPickupStatus.COMPLETED : CounterPickupStatus.PENDING,
            notes: notes || `[${status}] Started by ${actor.name}`,
            items: inv.items.map((line) => {
              const packSize = line.product?.packSize || 1;
              const cartons = packSize > 1 ? Math.floor(line.qty / packSize) : 0;
              const loose = packSize > 1 ? line.qty % packSize : line.qty;
              return {
                productId: line.productId,
                productName: line.product?.name || line.productId,
                shortCode: line.product?.shortCode || "",
                packSize,
                packLabel: line.product?.packLabel || "Carton",
                qty: line.qty,
                cartons,
                loose,
                packed: status === "PACKED" || status === "COMPLETED",
              };
            }),
          },
        });
        targetPickupId = created.id;
      }
    }

    if (!targetPickupId) {
      throw new Error("Either pickupId or invoiceId must be provided");
    }

    const counterStatus =
      status === "COMPLETED" ? CounterPickupStatus.COMPLETED : CounterPickupStatus.PENDING;

    const updated = await prisma.counterPickup.update({
      where: { id: targetPickupId },
      data: {
        status: counterStatus,
        notes: notes || `[${status}] Updated by ${actor.name} at ${new Date().toLocaleTimeString()}`,
        ...(status === "COMPLETED" ? { completedAt: new Date() } : {}),
        ...(items ? { items } : {}),
      },
    });

    await auditService.log({
      actorId: actor.id,
      action: "UPDATE_PACKING_STATUS",
      entity: "CounterPickup",
      entityId: targetPickupId,
      after: { status, notes: updated.notes },
    });

    return updated;
  }
}

export const dispatchService = new DispatchService();
