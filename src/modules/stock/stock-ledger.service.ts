import { prisma } from "@/lib/prisma";
import { UserRole, MovementType, LocationType } from "@prisma/client";
import { hasPermission, Permission, ForbiddenError } from "@/modules/auth/permissions";

export interface ProductLedgerFilterParams {
  productId: string;
  locationId?: string; // "ALL" or specific location ID (default: Main Godown)
  startDate?: Date;
  endDate?: Date;
  types?: MovementType[];
  search?: string;
  page?: number;
  limit?: number;
}

export interface ProductLedgerRow {
  id: string;
  createdAt: Date;
  type: MovementType;
  typeLabel: string;
  typeBadgeClass: string;
  referenceType: string | null;
  referenceId: string | null;
  referenceUrl: string | null;
  partyOrDestination: string;
  inQty: number;
  outQty: number;
  runningBalance: number;
  balanceCartons: number;
  balanceLoose: number;
  balanceFormatted: string;
  userName: string | null;
  reason: string | null;
}

export interface ProductLedgerSummary {
  openingBalance: number;
  openingCartons: number;
  openingLoose: number;
  totalIn: number;
  totalInCartons: number;
  totalInLoose: number;
  totalOut: number;
  totalOutCartons: number;
  totalOutLoose: number;
  closingBalance: number;
  closingCartons: number;
  closingLoose: number;
  currentStock: number;
  currentStockCartons: number;
  currentStockLoose: number;
  matchesCurrentStock: boolean;
  difference: number;
}

export interface ProductLedgerReport {
  product: {
    id: string;
    name: string;
    shortCode: string;
    packSize: number;
    packLabel: string;
    mrpPaise: number | null;
    companyName: string | null;
    categoryName: string | null;
  };
  location: {
    id: string;
    name: string;
    type: string;
  };
  dateRange: {
    startDate: Date | null;
    endDate: Date | null;
  };
  summary: ProductLedgerSummary;
  rows: ProductLedgerRow[];
  totalRows: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class StockLedgerService {
  /**
   * Generates product movement ledger report with chronological running balance
   * and live stock reconciliation.
   */
  async getProductLedgerReport(
    role: UserRole,
    params: ProductLedgerFilterParams
  ): Promise<ProductLedgerReport> {
    if (!hasPermission(role, Permission.STOCK_VIEW)) {
      throw new ForbiddenError("You do not have permission to view stock movement ledgers.");
    }

    const { productId } = params;
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        company: { select: { name: true } },
        category: { select: { name: true } },
      },
    });

    if (!product) {
      throw new Error(`Product not found: ${productId}`);
    }

    const packSize = Math.max(1, product.packSize || 1);

    // Resolve target location
    let targetLocationId = params.locationId;
    let locationName = "All Locations";
    let locationType = "ALL";

    if (!targetLocationId || targetLocationId === "DEFAULT") {
      const defaultGodown = await prisma.location.findFirst({
        where: { type: LocationType.GODOWN, active: true },
        orderBy: { name: "asc" },
      });
      if (defaultGodown) {
        targetLocationId = defaultGodown.id;
        locationName = defaultGodown.name;
        locationType = defaultGodown.type;
      } else {
        targetLocationId = "ALL";
      }
    } else if (targetLocationId !== "ALL") {
      const loc = await prisma.location.findUnique({
        where: { id: targetLocationId },
      });
      if (loc) {
        locationName = loc.name;
        locationType = loc.type;
      }
    }

    const isAllLocations = targetLocationId === "ALL";

    // 1. Fetch all movements for this product chronologically to build accurate running balances
    const allMovements = await prisma.stockMovement.findMany({
      where: {
        productId,
        ...(isAllLocations
          ? {}
          : {
              OR: [
                { fromLocationId: targetLocationId },
                { toLocationId: targetLocationId },
              ],
            }),
      },
      include: {
        fromLocation: { select: { id: true, name: true, type: true } },
        toLocation: { select: { id: true, name: true, type: true } },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    // Collect user IDs for creator names
    const userIds = Array.from(
      new Set(allMovements.map((m) => m.createdBy).filter((id): id is string => Boolean(id)))
    );
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    // 2. Compute full chronological running balances
    let running = 0;
    const computedMovements: Array<{
      m: (typeof allMovements)[number];
      inQty: number;
      outQty: number;
      runningBalance: number;
    }> = [];

    for (const m of allMovements) {
      let inQty = 0;
      let outQty = 0;

      if (isAllLocations) {
        // Across company: inward if no fromLocation, outward if no toLocation
        if (!m.fromLocationId && m.toLocationId) {
          inQty = m.qty;
        } else if (m.fromLocationId && !m.toLocationId) {
          outQty = m.qty;
        } else if (m.fromLocationId && m.toLocationId) {
          // Internal transfer across company has 0 net effect on total company stock
          inQty = 0;
          outQty = 0;
        } else {
          // General adjustment
          if (m.qty >= 0) inQty = m.qty;
          else outQty = Math.abs(m.qty);
        }
      } else {
        // Location specific
        const isTo = m.toLocationId === targetLocationId;
        const isFrom = m.fromLocationId === targetLocationId;

        if (isTo && !isFrom) {
          inQty = m.qty;
        } else if (isFrom && !isTo) {
          outQty = m.qty;
        } else if (isTo && isFrom) {
          // Internal adjustment / carton break within same location
          inQty = 0;
          outQty = 0;
        } else {
          if (m.qty >= 0) inQty = m.qty;
          else outQty = Math.abs(m.qty);
        }
      }

      running += inQty - outQty;
      computedMovements.push({ m, inQty, outQty, runningBalance: running });
    }

    // 3. Opening balance at start of range
    const startMs = params.startDate ? params.startDate.getTime() : null;
    const endMs = params.endDate ? params.endDate.getTime() : null;

    let openingBalance = 0;
    if (startMs !== null) {
      // Find the last running balance before startDate
      for (let i = computedMovements.length - 1; i >= 0; i--) {
        if (computedMovements[i].m.createdAt.getTime() < startMs) {
          openingBalance = computedMovements[i].runningBalance;
          break;
        }
      }
    }

    // 4. Filter movements within the requested range, types, and search
    let filtered = computedMovements.filter(({ m }) => {
      const time = m.createdAt.getTime();
      if (startMs !== null && time < startMs) return false;
      if (endMs !== null && time > endMs) return false;
      if (params.types && params.types.length > 0 && !params.types.includes(m.type)) {
        return false;
      }
      if (params.search && params.search.trim()) {
        const query = params.search.trim().toLowerCase();
        const refMatch = m.referenceId?.toLowerCase().includes(query) ?? false;
        const typeMatch = m.type.toLowerCase().includes(query);
        const reasonMatch = m.reason?.toLowerCase().includes(query) ?? false;
        const metaStr = m.meta ? JSON.stringify(m.meta).toLowerCase() : "";
        const metaMatch = metaStr.includes(query);
        if (!refMatch && !typeMatch && !reasonMatch && !metaMatch) return false;
      }
      return true;
    });

    const totalIn = filtered.reduce((s, row) => s + row.inQty, 0);
    const totalOut = filtered.reduce((s, row) => s + row.outQty, 0);
    const closingBalance = openingBalance + totalIn - totalOut;

    // 5. Query live stock balance for verification
    let currentStock = 0;
    if (isAllLocations) {
      const allBalances = await prisma.stockBalance.findMany({
        where: { productId },
        select: { qty: true },
      });
      currentStock = allBalances.reduce((sum, b) => sum + b.qty, 0);
    } else {
      const sb = await prisma.stockBalance.findUnique({
        where: {
          productId_locationId: { productId, locationId: targetLocationId! },
        },
        select: { qty: true },
      });
      currentStock = sb?.qty ?? 0;
    }

    const matchesCurrentStock = closingBalance === currentStock;
    const difference = closingBalance - currentStock;

    // Helper for reference URL
    const getReferenceUrl = (refType?: string | null, refId?: string | null) => {
      if (!refId || !refType) return null;
      switch (refType.toUpperCase()) {
        case "GRN":
        case "PURCHASE":
          return `/godown/purchases/${refId}`;
        case "INVOICE":
          return `/shop/invoices/${refId}`;
        case "ORDER":
          return `/godown/dispatch/${refId}`;
        case "VAN":
        case "VAN_ISSUE":
        case "VAN_RETURN":
          return `/godown/van-issues/${refId}`;
        default:
          return null;
      }
    };

    // Helper for badge styling & label
    const getTypeMeta = (type: MovementType, inQty: number, outQty: number) => {
      switch (type) {
        case MovementType.PURCHASE_RECEIPT:
          return { label: "Purchase Receipt", badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300" };
        case MovementType.TRANSFER:
          return inQty > 0
            ? { label: "Transfer In", badgeClass: "bg-blue-100 text-blue-800 border-blue-300" }
            : { label: "Transfer Out", badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-300" };
        case MovementType.CARTON_BREAK:
          return { label: "Carton Break", badgeClass: "bg-purple-100 text-purple-800 border-purple-300" };
        case MovementType.VAN_ISSUE:
          return { label: "Van Issue", badgeClass: "bg-amber-100 text-amber-800 border-amber-300" };
        case MovementType.VAN_RETURN:
          return { label: "Van Return", badgeClass: "bg-cyan-100 text-cyan-800 border-cyan-300" };
        case MovementType.SALE:
          return { label: "Sale / Dispatch", badgeClass: "bg-rose-100 text-rose-800 border-rose-300" };
        case MovementType.SALE_CANCEL:
          return { label: "Sale Cancel", badgeClass: "bg-teal-100 text-teal-800 border-teal-300" };
        case MovementType.RETURN_TO_COMPANY:
          return { label: "Return to Co.", badgeClass: "bg-orange-100 text-orange-800 border-orange-300" };
        case MovementType.DAMAGE:
          return { label: "Damage", badgeClass: "bg-red-100 text-red-800 border-red-300" };
        case MovementType.ADJUSTMENT:
          return { label: "Adjustment", badgeClass: "bg-slate-200 text-slate-800 border-slate-300" };
        default:
          return { label: type, badgeClass: "bg-gray-100 text-gray-800 border-gray-300" };
      }
    };

    // 6. Pagination
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(200, params.limit || 100));
    const totalRows = filtered.length;
    const totalPages = Math.ceil(totalRows / limit) || 1;
    const paginated = filtered.slice((page - 1) * limit, page * limit);

    const rows: ProductLedgerRow[] = paginated.map(({ m, inQty, outQty, runningBalance }) => {
      const typeMeta = getTypeMeta(m.type, inQty, outQty);
      const balanceCartons = Math.floor(runningBalance / packSize);
      const balanceLoose = runningBalance % packSize;

      let partyOrDestination = "—";
      const meta = m.meta as any;
      if (meta?.partyName) {
        partyOrDestination = meta.partyName;
      } else if (meta?.supplierName) {
        partyOrDestination = meta.supplierName;
      } else if (m.toLocation?.name && m.toLocation.id !== targetLocationId) {
        partyOrDestination = `To: ${m.toLocation.name}`;
      } else if (m.fromLocation?.name && m.fromLocation.id !== targetLocationId) {
        partyOrDestination = `From: ${m.fromLocation.name}`;
      } else if (m.toLocation?.name) {
        partyOrDestination = m.toLocation.name;
      }

      return {
        id: m.id,
        createdAt: m.createdAt,
        type: m.type,
        typeLabel: typeMeta.label,
        typeBadgeClass: typeMeta.badgeClass,
        referenceType: m.referenceType,
        referenceId: m.referenceId,
        referenceUrl: getReferenceUrl(m.referenceType, m.referenceId),
        partyOrDestination,
        inQty,
        outQty,
        runningBalance,
        balanceCartons,
        balanceLoose,
        balanceFormatted: `${runningBalance} pcs (= ${balanceCartons} ctn + ${balanceLoose} loose)`,
        userName: m.createdBy ? userMap.get(m.createdBy) || "Staff" : "System",
        reason: m.reason,
      };
    });

    return {
      product: {
        id: product.id,
        name: product.name,
        shortCode: product.shortCode,
        packSize,
        packLabel: product.packLabel || "Carton",
        mrpPaise: product.mrpPaise,
        companyName: product.company?.name || null,
        categoryName: product.category?.name || null,
      },
      location: {
        id: targetLocationId!,
        name: locationName,
        type: locationType,
      },
      dateRange: {
        startDate: params.startDate || null,
        endDate: params.endDate || null,
      },
      summary: {
        openingBalance,
        openingCartons: Math.floor(openingBalance / packSize),
        openingLoose: openingBalance % packSize,
        totalIn,
        totalInCartons: Math.floor(totalIn / packSize),
        totalInLoose: totalIn % packSize,
        totalOut,
        totalOutCartons: Math.floor(totalOut / packSize),
        totalOutLoose: totalOut % packSize,
        closingBalance,
        closingCartons: Math.floor(closingBalance / packSize),
        closingLoose: closingBalance % packSize,
        currentStock,
        currentStockCartons: Math.floor(currentStock / packSize),
        currentStockLoose: currentStock % packSize,
        matchesCurrentStock,
        difference,
      },
      rows,
      totalRows,
      page,
      limit,
      totalPages,
    };
  }
}

export const stockLedgerService = new StockLedgerService();
