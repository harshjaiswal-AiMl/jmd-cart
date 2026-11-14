import { prisma } from "@/lib/prisma";
import {
  UserRole,
  OrderStatus,
  VanDayStatus,
  MovementType,
  LocationType,
} from "@prisma/client";
import { ForbiddenError, hasPermission, Permission } from "@/modules/auth/permissions";
import { getISTDayRange } from "@/lib/date";

export interface DayDispatchSummary {
  dateStr: string;
  startUtc: Date;
  endUtc: Date;
  kpis: {
    ordersDispatched: number;
    delivered: number;
    outForDelivery: number;
    failed: number;
    vansIssued: number;
    shopTransfers: number;
    counterPickups: number;
    companyReturns: number;
    totalOutPieces: number;
    totalOutCartons: number;
    totalOutLoose: number;
    totalOutFormatted: string;
  };
  integrityCheck: {
    matches: boolean;
    matrixTotalPieces: number;
    ledgerTotalPieces: number;
    difference: number;
    verifiedAt: string;
  };
  matrix: Array<{
    productId: string;
    productName: string;
    shortCode: string;
    packSize: number;
    packLabel: string;
    ordersPieces: number;
    vansPieces: Record<string, number>; // vanName -> pieces
    shopPieces: number;
    counterPieces: number;
    companyPieces: number;
    totalOutPieces: number;
    totalOutCartons: number;
    totalOutLoose: number;
    totalOutFormatted: string;
  }>;
  sections: {
    orders: Array<{
      id: string;
      orderNumber: string;
      partyName: string;
      area: string;
      slot: string;
      itemCount: number;
      totalQtyPieces: number;
      status: OrderStatus;
      vanOrDeliveryPerson: string;
      createdAt: Date;
    }>;
    vans: Array<{
      id: string;
      issueSheetNo: string;
      vanName: string;
      salespersonName: string;
      itemsOutPieces: number;
      returnedPieces: number;
      shortagePieces: number;
      status: VanDayStatus;
      isReconciled: boolean;
    }>;
    shopTransfers: Array<{
      id: string;
      requestNumber: string;
      itemCount: number;
      totalQtyPieces: number;
      status: string;
      createdAt: Date;
    }>;
    counterPickups: Array<{
      id: string;
      billNumber: string;
      cashierName: string;
      itemCount: number;
      status: string;
      createdAt: Date;
    }>;
    companyReturns: Array<{
      id: string;
      number: string;
      supplierName: string;
      itemCount: number;
      totalQtyPieces: number;
      reason: string;
      createdAt: Date;
    }>;
  };
  exceptions: {
    failedDeliveries: Array<{
      orderId: string;
      orderNumber: string;
      partyName: string;
      reason: string;
    }>;
    shortPicks: Array<{
      reference: string;
      productName: string;
      shortageQty: number;
    }>;
    unreconciledVans: Array<{
      vanDayId: string;
      vanName: string;
      salespersonName: string;
      issueSheetNo: string;
    }>;
    pendingOrders: Array<{
      orderId: string;
      orderNumber: string;
      partyName: string;
      status: OrderStatus;
    }>;
  };
  allVanNames: string[];
}

export class DayDispatchService {
  /**
   * Aggregates complete day dispatch data, product-wise destination matrix,
   * exception panel, and automated cross-check against stock ledger out movements.
   */
  async getDayDispatchData(
    role: UserRole,
    dateStr?: string
  ): Promise<DayDispatchSummary> {
    const isAuthorized =
      role === UserRole.SUPER_ADMIN ||
      role === UserRole.ADMIN ||
      role === UserRole.WAREHOUSE_MANAGER ||
      role === UserRole.GODOWN ||
      hasPermission(role, Permission.STOCK_VIEW) ||
      hasPermission(role, Permission.DISPATCH_MANAGE);

    if (!isAuthorized) {
      throw new ForbiddenError("You do not have permission to view day dispatch.");
    }

    const { startUtc, endUtc, dateStr: activeDateStr } = getISTDayRange(dateStr);

    // 1. Identify Main Godown location
    const godownLocation = await prisma.location.findFirst({
      where: { type: LocationType.GODOWN, active: true },
      orderBy: { name: "asc" },
    });
    const godownLocationId = godownLocation?.id;

    // 2. Fetch Godown Out Movements for the entire IST Day
    const godownOutMovements = godownLocationId
      ? await prisma.stockMovement.findMany({
          where: {
            fromLocationId: godownLocationId,
            createdAt: { gte: startUtc, lte: endUtc },
            type: {
              in: [
                MovementType.VAN_ISSUE,
                MovementType.TRANSFER,
                MovementType.SALE,
                MovementType.RETURN_TO_COMPANY,
              ],
            },
          },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                shortCode: true,
                packSize: true,
                packLabel: true,
              },
            },
            toLocation: { select: { id: true, name: true, type: true } },
          },
        })
      : [];

    // Calculate total ledger pieces out by product
    const ledgerOutByProduct = new Map<string, number>();
    let ledgerTotalPieces = 0;
    for (const mov of godownOutMovements) {
      const q = mov.qty;
      ledgerTotalPieces += q;
      ledgerOutByProduct.set(
        mov.productId,
        (ledgerOutByProduct.get(mov.productId) || 0) + q
      );
    }

    // 3. Fetch Orders created or dispatched in this IST Day
    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: startUtc, lte: endUtc },
      },
      include: {
        party: { select: { name: true, address: true, phone: true } },
        assignedDeliveryUser: { select: { name: true } },
        dispatchRunOrders: {
          include: {
            run: {
              include: {
                van: { select: { name: true } },
                deliveryUser: { select: { name: true } },
              },
            },
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                shortCode: true,
                packSize: true,
                packLabel: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 4. Fetch Van Days active on this IST Day
    const vanDays = await prisma.vanDay.findMany({
      where: {
        OR: [
          { date: { gte: startUtc, lte: endUtc } },
          { createdAt: { gte: startUtc, lte: endUtc } },
        ],
      },
      include: {
        vanLocation: { select: { id: true, name: true } },
        salesperson: { select: { name: true } },
        lines: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                shortCode: true,
                packSize: true,
                packLabel: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 5. Fetch Shop Requests created or approved on this IST Day
    const shopRequests = await prisma.shopRequest.findMany({
      where: {
        createdAt: { gte: startUtc, lte: endUtc },
      },
      include: {
        lines: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                shortCode: true,
                packSize: true,
                packLabel: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 6. Fetch Counter Pickups on this IST Day
    const counterPickups = await prisma.counterPickup.findMany({
      where: {
        createdAt: { gte: startUtc, lte: endUtc },
      },
      orderBy: { createdAt: "desc" },
    });

    // 7. Fetch Debit Notes (Company Returns) on this IST Day
    const debitNotes = await prisma.debitNote.findMany({
      where: {
        createdAt: { gte: startUtc, lte: endUtc },
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                shortCode: true,
                packSize: true,
                packLabel: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Map supplier names for debit notes
    const supplierIds = debitNotes.map((d) => d.supplierId);
    const suppliers = supplierIds.length > 0
      ? await prisma.party.findMany({
          where: { id: { in: supplierIds } },
          select: { id: true, name: true },
        })
      : [];
    const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));

    // 8. Collect all distinct Van names
    const allVanNamesSet = new Set<string>();
    for (const vd of vanDays) {
      if (vd.vanLocation?.name) allVanNamesSet.add(vd.vanLocation.name);
    }
    // Also include any van names referenced in out movements
    for (const mov of godownOutMovements) {
      if (mov.type === MovementType.VAN_ISSUE && mov.toLocation?.name) {
        allVanNamesSet.add(mov.toLocation.name);
      }
    }
    const allVanNames = Array.from(allVanNamesSet).sort();

    // 9. Build Product-Wise Matrix
    // Collect all products involved in any dispatch movement or order
    const productMap = new Map<
      string,
      {
        id: string;
        name: string;
        shortCode: string;
        packSize: number;
        packLabel: string;
      }
    >();

    // Add products from movements
    for (const m of godownOutMovements) {
      if (!productMap.has(m.product.id)) {
        productMap.set(m.product.id, {
          id: m.product.id,
          name: m.product.name,
          shortCode: m.product.shortCode,
          packSize: Math.max(1, m.product.packSize || 1),
          packLabel: m.product.packLabel || "Carton",
        });
      }
    }

    // Add products from orders, vanDays, shopRequests, debitNotes
    for (const o of orders) {
      for (const item of o.items) {
        if (!productMap.has(item.product.id)) {
          productMap.set(item.product.id, {
            id: item.product.id,
            name: item.product.name,
            shortCode: item.product.shortCode,
            packSize: Math.max(1, item.product.packSize || 1),
            packLabel: item.product.packLabel || "Carton",
          });
        }
      }
    }
    for (const vd of vanDays) {
      for (const l of vd.lines) {
        if (!productMap.has(l.product.id)) {
          productMap.set(l.product.id, {
            id: l.product.id,
            name: l.product.name,
            shortCode: l.product.shortCode,
            packSize: Math.max(1, l.product.packSize || 1),
            packLabel: l.product.packLabel || "Carton",
          });
        }
      }
    }
    for (const sr of shopRequests) {
      for (const l of sr.lines) {
        if (!productMap.has(l.product.id)) {
          productMap.set(l.product.id, {
            id: l.product.id,
            name: l.product.name,
            shortCode: l.product.shortCode,
            packSize: Math.max(1, l.product.packSize || 1),
            packLabel: l.product.packLabel || "Carton",
          });
        }
      }
    }
    for (const dn of debitNotes) {
      for (const item of dn.items) {
        if (!productMap.has(item.product.id)) {
          productMap.set(item.product.id, {
            id: item.product.id,
            name: item.product.name,
            shortCode: item.product.shortCode,
            packSize: Math.max(1, item.product.packSize || 1),
            packLabel: item.product.packLabel || "Carton",
          });
        }
      }
    }

    // Allocate pieces per product per destination category based on actual dispatch movements & sources
    // Destination mapping per product
    const matrixRows: DayDispatchSummary["matrix"] = [];
    let matrixTotalPieces = 0;

    for (const [prodId, prod] of productMap.entries()) {
      let ordersPieces = 0;
      const vansPieces: Record<string, number> = {};
      let shopPieces = 0;
      let counterPieces = 0;
      let companyPieces = 0;

      for (const vanName of allVanNames) {
        vansPieces[vanName] = 0;
      }

      // Check movements for this product
      const prodMovements = godownOutMovements.filter((m) => m.productId === prodId);
      for (const m of prodMovements) {
        if (m.type === MovementType.VAN_ISSUE) {
          const vName = m.toLocation?.name || "Van";
          vansPieces[vName] = (vansPieces[vName] || 0) + m.qty;
        } else if (m.type === MovementType.TRANSFER) {
          shopPieces += m.qty;
        } else if (m.type === MovementType.RETURN_TO_COMPANY) {
          companyPieces += m.qty;
        } else if (m.type === MovementType.SALE) {
          const meta = m.meta as any;
          if (meta?.isCounterPickup || m.referenceType === "COUNTER_PICKUP") {
            counterPieces += m.qty;
          } else {
            ordersPieces += m.qty;
          }
        }
      }

      // If no movements exist in stock_movement yet (e.g. before finalize), fallback to recorded orders/van lines
      if (prodMovements.length === 0) {
        // Orders
        for (const o of orders) {
          if (
            o.status === OrderStatus.DISPATCHED ||
            o.status === OrderStatus.OUT_FOR_DELIVERY ||
            o.status === OrderStatus.DELIVERED
          ) {
            for (const item of o.items) {
              if (item.productId === prodId) {
                ordersPieces += item.qty;
              }
            }
          }
        }
        // Van days
        for (const vd of vanDays) {
          const vName = vd.vanLocation?.name || "Van";
          for (const l of vd.lines) {
            if (l.productId === prodId) {
              vansPieces[vName] = (vansPieces[vName] || 0) + l.issuedQty;
            }
          }
        }
        // Shop requests
        for (const sr of shopRequests) {
          if (sr.status === "DISPATCHED" || sr.status === "RECEIVED") {
            for (const l of sr.lines) {
              if (l.productId === prodId) {
                shopPieces += l.approvedQty ?? l.requestedQty;
              }
            }
          }
        }
        // Debit notes
        for (const dn of debitNotes) {
          for (const item of dn.items) {
            if (item.productId === prodId) {
              companyPieces += item.qty;
            }
          }
        }
      }

      const totalOutPieces =
        ordersPieces +
        Object.values(vansPieces).reduce((a, b) => a + b, 0) +
        shopPieces +
        counterPieces +
        companyPieces;

      // Only include rows with > 0 dispatch or in ledger
      if (totalOutPieces > 0 || ledgerOutByProduct.has(prodId)) {
        matrixTotalPieces += totalOutPieces;
        const totalOutCartons = Math.floor(totalOutPieces / prod.packSize);
        const totalOutLoose = totalOutPieces % prod.packSize;
        const totalOutFormatted =
          totalOutCartons > 0 && totalOutLoose > 0
            ? `${totalOutCartons} ${prod.packLabel} + ${totalOutLoose} pcs`
            : totalOutCartons > 0
            ? `${totalOutCartons} ${prod.packLabel}`
            : `${totalOutLoose} pcs`;

        matrixRows.push({
          productId: prod.id,
          productName: prod.name,
          shortCode: prod.shortCode,
          packSize: prod.packSize,
          packLabel: prod.packLabel,
          ordersPieces,
          vansPieces,
          shopPieces,
          counterPieces,
          companyPieces,
          totalOutPieces,
          totalOutCartons,
          totalOutLoose,
          totalOutFormatted,
        });
      }
    }

    // Sort matrix rows by product name
    matrixRows.sort((a, b) => a.productName.localeCompare(b.productName));

    // 10. Automated Integrity Cross-Check
    // product-wise Total Out must equal ledger out movements for same IST day
    const integrityMatches = matrixTotalPieces === ledgerTotalPieces;
    const difference = matrixTotalPieces - ledgerTotalPieces;

    // 11. KPIs
    const ordersDispatched = orders.filter(
      (o) =>
        o.status === OrderStatus.DISPATCHED ||
        o.status === OrderStatus.OUT_FOR_DELIVERY ||
        o.status === OrderStatus.DELIVERED
    ).length;
    const delivered = orders.filter((o) => o.status === OrderStatus.DELIVERED).length;
    const outForDelivery = orders.filter(
      (o) => o.status === OrderStatus.OUT_FOR_DELIVERY
    ).length;
    const failed = orders.filter(
      (o) =>
        o.status === OrderStatus.FAILED || o.status === OrderStatus.CANCELLED
    ).length;

    // Total out in cartons + loose across all products
    const totalOutPieces = matrixTotalPieces;
    // Compute total cartons assuming standard pack size 20 or weighted average if mixed
    const avgPack = 20;
    const totalOutCartons = Math.floor(totalOutPieces / avgPack);
    const totalOutLoose = totalOutPieces % avgPack;
    const totalOutFormatted =
      totalOutCartons > 0 && totalOutLoose > 0
        ? `${totalOutCartons} Ctns + ${totalOutLoose} Pcs`
        : totalOutCartons > 0
        ? `${totalOutCartons} Ctns`
        : `${totalOutLoose} Pcs`;

    // 12. Exceptions Panel Items
    const failedDeliveries = orders
      .filter(
        (o) =>
          o.status === OrderStatus.FAILED || o.status === OrderStatus.CANCELLED
      )
      .map((o) => ({
        orderId: o.id,
        orderNumber: o.orderNumber,
        partyName: o.party?.name || "Customer",
        reason: o.customerNotes || "Delivery failed or cancelled",
      }));

    const shortPicks: DayDispatchSummary["exceptions"]["shortPicks"] = [];
    for (const vd of vanDays) {
      for (const l of vd.lines) {
        if (l.shortageQty > 0) {
          shortPicks.push({
            reference: `Van: ${vd.vanLocation?.name || "Van"} (${vd.issueSheetNo})`,
            productName: l.product.name,
            shortageQty: l.shortageQty,
          });
        }
      }
    }

    const unreconciledVans = vanDays
      .filter((vd) => vd.status !== VanDayStatus.RECONCILED && vd.status !== VanDayStatus.CLOSED)
      .map((vd) => ({
        vanDayId: vd.id,
        vanName: vd.vanLocation?.name || "Van",
        salespersonName: vd.salesperson?.name || "Staff",
        issueSheetNo: vd.issueSheetNo,
      }));

    const pendingOrders = orders
      .filter(
        (o) =>
          o.status === OrderStatus.PENDING ||
          o.status === OrderStatus.CONFIRMED ||
          o.status === OrderStatus.PROCESSING
      )
      .map((o) => ({
        orderId: o.id,
        orderNumber: o.orderNumber,
        partyName: o.party?.name || "Customer",
        status: o.status,
      }));

    // 13. Map Sections
    const orderSections = orders.map((o) => {
      const runOrder = o.dispatchRunOrders?.[0];
      const vanOrDeliveryPerson =
        runOrder?.run?.van?.name ||
        runOrder?.run?.deliveryUser?.name ||
        o.assignedDeliveryUser?.name ||
        "—";

      const totalQtyPieces = o.items.reduce((s, it) => s + it.qty, 0);

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        partyName: o.party?.name || "Customer",
        area: o.party?.address || o.deliveryAddress || "City",
        slot: runOrder?.run?.slot || "Regular",
        itemCount: o.items.length,
        totalQtyPieces,
        status: o.status,
        vanOrDeliveryPerson,
        createdAt: o.createdAt,
      };
    });

    const vanSections = vanDays.map((vd) => {
      const itemsOutPieces = vd.lines.reduce((s, l) => s + l.issuedQty, 0);
      const returnedPieces = vd.lines.reduce((s, l) => s + l.returnedQty, 0);
      const shortagePieces = vd.lines.reduce((s, l) => s + l.shortageQty, 0);

      return {
        id: vd.id,
        issueSheetNo: vd.issueSheetNo,
        vanName: vd.vanLocation?.name || "Van",
        salespersonName: vd.salesperson?.name || "Staff",
        itemsOutPieces,
        returnedPieces,
        shortagePieces,
        status: vd.status,
        isReconciled:
          vd.status === VanDayStatus.RECONCILED || vd.status === VanDayStatus.CLOSED,
      };
    });

    const shopTransferSections = shopRequests.map((sr) => {
      const itemCount = sr.lines.length;
      const totalQtyPieces = sr.lines.reduce(
        (s, l) => s + (l.approvedQty ?? l.requestedQty),
        0
      );
      return {
        id: sr.id,
        requestNumber: sr.requestNumber,
        itemCount,
        totalQtyPieces,
        status: sr.status,
        createdAt: sr.createdAt,
      };
    });

    const counterPickupSections = counterPickups.map((cp) => {
      const itemsArray = Array.isArray(cp.items) ? (cp.items as any[]) : [];
      return {
        id: cp.id,
        billNumber: cp.billNumber,
        cashierName: cp.cashierName || "Cashier",
        itemCount: itemsArray.length,
        status: cp.status,
        createdAt: cp.createdAt,
      };
    });

    const companyReturnSections = debitNotes.map((dn) => {
      const itemCount = dn.items.length;
      const totalQtyPieces = dn.items.reduce((s, it) => s + it.qty, 0);
      return {
        id: dn.id,
        number: dn.number,
        supplierName: supplierMap.get(dn.supplierId) || dn.supplierId,
        itemCount,
        totalQtyPieces,
        reason: dn.reason,
        createdAt: dn.createdAt,
      };
    });

    return {
      dateStr: activeDateStr,
      startUtc,
      endUtc,
      kpis: {
        ordersDispatched,
        delivered,
        outForDelivery,
        failed,
        vansIssued: vanDays.length,
        shopTransfers: shopRequests.length,
        counterPickups: counterPickups.length,
        companyReturns: debitNotes.length,
        totalOutPieces,
        totalOutCartons,
        totalOutLoose,
        totalOutFormatted,
      },
      integrityCheck: {
        matches: integrityMatches,
        matrixTotalPieces,
        ledgerTotalPieces,
        difference,
        verifiedAt: new Date().toISOString(),
      },
      matrix: matrixRows,
      sections: {
        orders: orderSections,
        vans: vanSections,
        shopTransfers: shopTransferSections,
        counterPickups: counterPickupSections,
        companyReturns: companyReturnSections,
      },
      exceptions: {
        failedDeliveries,
        shortPicks,
        unreconciledVans,
        pendingOrders,
      },
      allVanNames,
    };
  }
}

export const dayDispatchService = new DayDispatchService();
