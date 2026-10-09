import { prisma } from "@/lib/prisma";
import { Prisma, Location, LocationType, MovementType, Product, User, VanDayStatus } from "@prisma/client";
import { stockService } from "@/modules/stock/stock.service";
import { getNextSequenceNumber } from "@/lib/invoice-number";
import {
  CreateVanIssueSheetInput,
  VanDayWithDetails,
  VanStockSummary,
  VanStockItem,
} from "./van.types";

export class CentralGodownNotFoundError extends Error {
  constructor() {
    super("Active Central Godown location not found");
    this.name = "CentralGodownNotFoundError";
  }
}

export class VanNotFoundError extends Error {
  constructor(id: string) {
    super(`Van location '${id}' not found or is not of type VAN`);
    this.name = "VanNotFoundError";
  }
}

export class SalespersonNotAssignedError extends Error {
  constructor(vanName: string) {
    super(`No active salesperson is assigned to '${vanName}'`);
    this.name = "SalespersonNotAssignedError";
  }
}

export class VanAlreadyActiveError extends Error {
  constructor(vanName: string, issueSheetNo: string) {
    super(`Van '${vanName}' already has an active issue sheet (${issueSheetNo}) for today`);
    this.name = "VanAlreadyActiveError";
  }
}

export class VanRepository {
  async listVanLocations(): Promise<(Location & { assignedUser: User | null })[]> {
    return prisma.location.findMany({
      where: {
        type: LocationType.VAN,
        active: true,
      },
      include: {
        assignedUser: true,
      },
      orderBy: { name: "asc" },
    });
  }

  async getVanLocationById(id: string): Promise<(Location & { assignedUser: User | null }) | null> {
    return prisma.location.findFirst({
      where: {
        id,
        type: LocationType.VAN,
      },
      include: {
        assignedUser: true,
      },
    });
  }

  async getCentralGodown(): Promise<Location | null> {
    return prisma.location.findFirst({
      where: {
        type: LocationType.GODOWN,
        active: true,
      },
    });
  }

  async getVanDayById(id: string): Promise<VanDayWithDetails | null> {
    return prisma.vanDay.findUnique({
      where: { id },
      include: {
        vanLocation: true,
        salesperson: true,
        lines: {
          include: {
            product: true,
          },
          orderBy: { product: { name: "asc" } },
        },
      },
    });
  }

  async getActiveVanDayForVan(vanLocationId: string): Promise<VanDayWithDetails | null> {
    return prisma.vanDay.findFirst({
      where: {
        vanLocationId,
        status: VanDayStatus.OPEN,
      },
      include: {
        vanLocation: true,
        salesperson: true,
        lines: {
          include: {
            product: true,
          },
          orderBy: { product: { name: "asc" } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getActiveVanDayForSalesperson(salespersonId: string): Promise<VanDayWithDetails | null> {
    return prisma.vanDay.findFirst({
      where: {
        salespersonId,
        status: VanDayStatus.OPEN,
      },
      include: {
        vanLocation: true,
        salesperson: true,
        lines: {
          include: {
            product: true,
          },
          orderBy: { product: { name: "asc" } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async listVanDays(filters?: {
    vanLocationId?: string;
    salespersonId?: string;
    status?: VanDayStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ vanDays: VanDayWithDetails[]; total: number }> {
    const where: Prisma.VanDayWhereInput = {};

    if (filters?.vanLocationId) where.vanLocationId = filters.vanLocationId;
    if (filters?.salespersonId) where.salespersonId = filters.salespersonId;
    if (filters?.status) where.status = filters.status;

    const [vanDays, total] = await Promise.all([
      prisma.vanDay.findMany({
        where,
        include: {
          vanLocation: true,
          salesperson: true,
          lines: {
            include: {
              product: true,
            },
            orderBy: { product: { name: "asc" } },
          },
        },
        orderBy: { createdAt: "desc" },
        take: filters?.limit ?? 50,
        skip: filters?.offset ?? 0,
      }),
      prisma.vanDay.count({ where }),
    ]);

    return { vanDays, total };
  }

  async createVanIssueSheet(
    actorId: string,
    input: CreateVanIssueSheetInput,
    txClient?: Prisma.TransactionClient
  ): Promise<VanDayWithDetails> {
    const execute = async (tx: Prisma.TransactionClient) => {
      // 1. Fetch Van Location
      const van = await tx.location.findFirst({
        where: { id: input.vanLocationId, type: LocationType.VAN, active: true },
        include: { assignedUser: true },
      });

      if (!van) {
        throw new VanNotFoundError(input.vanLocationId);
      }

      if (!van.assignedUser) {
        throw new SalespersonNotAssignedError(van.name);
      }

      // 2. Check if Van already has an OPEN van day
      const existingOpen = await tx.vanDay.findFirst({
        where: { vanLocationId: van.id, status: VanDayStatus.OPEN },
      });

      if (existingOpen) {
        throw new VanAlreadyActiveError(van.name, existingOpen.issueSheetNo);
      }

      // 3. Fetch Central Godown
      const godown = await tx.location.findFirst({
        where: { type: LocationType.GODOWN, active: true },
      });

      if (!godown) {
        throw new CentralGodownNotFoundError();
      }

      // 4. Fetch Products to calculate total pieces and validate
      const productIds = input.items.map((i) => i.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, active: true },
      });

      const productMap = new Map<string, Product>();
      products.forEach((p) => productMap.set(p.id, p));

      // 5. Generate gapless Sequence for Van Issue Sheet (e.g. VIS/26-27/000001)
      const now = new Date();
      const seq = await getNextSequenceNumber(tx, "VIS", now);
      const issueSheetNo = seq.number;

      // 6. Create VanDay record
      const vanDay = await tx.vanDay.create({
        data: {
          vanLocationId: van.id,
          salespersonId: van.assignedUser.id,
          date: now,
          status: VanDayStatus.OPEN,
          issueSheetNo,
          notes: input.notes?.trim() || null,
          issuedBy: actorId,
        },
      });

      // 7. For each item, create VanDayLine and post TRANSFER stock movement from Godown to Van
      for (const item of input.items) {
        const product = productMap.get(item.productId);
        if (!product) {
          throw new Error(`Product '${item.productId}' not found or inactive`);
        }

        const totalPieces = item.cartons * product.packSize + item.pieces;
        if (totalPieces <= 0) continue;

        // Create line
        await tx.vanDayLine.create({
          data: {
            vanDayId: vanDay.id,
            productId: product.id,
            issuedQty: totalPieces,
            soldQty: 0,
            returnedQty: 0,
            shortageQty: 0,
            excessQty: 0,
          },
        });

        // Post TRANSFER movement in stock ledger
        const idempotencyKey = `VAN_ISSUE_${vanDay.id}_${product.id}`;
        await stockService.postMovement(
          {
            type: MovementType.TRANSFER,
            productId: product.id,
            fromLocationId: godown.id,
            toLocationId: van.id,
            qty: totalPieces,
            referenceType: "VAN_ISSUE",
            referenceId: vanDay.id,
            reason: `Morning Van Load: ${issueSheetNo} to ${van.name}`,
            idempotencyKey,
            actorId,
          },
          tx
        );
      }

      // 8. Return complete record
      const result = await tx.vanDay.findUniqueOrThrow({
        where: { id: vanDay.id },
        include: {
          vanLocation: true,
          salesperson: true,
          lines: {
            include: {
              product: true,
            },
            orderBy: { product: { name: "asc" } },
          },
        },
      });

      return result;
    };

    if (txClient) {
      return execute(txClient);
    }
    return prisma.$transaction(execute);
  }

  async getVanStockSummary(vanLocationId: string): Promise<VanStockSummary> {
    const van = await this.getVanLocationById(vanLocationId);
    if (!van) {
      throw new VanNotFoundError(vanLocationId);
    }

    const activeVanDay = await this.getActiveVanDayForVan(vanLocationId);

    // Fetch live stock balances in this van
    const balances = await prisma.stockBalance.findMany({
      where: {
        locationId: vanLocationId,
        qty: { gt: 0 },
      },
      include: {
        product: true,
      },
      orderBy: { product: { name: "asc" } },
    });

    let totalPieces = 0;
    let totalValuationPaise = 0;

    const inventory: VanStockItem[] = balances.map((b) => {
      const cartons = Math.floor(b.qty / b.product.packSize);
      const loosePieces = b.qty % b.product.packSize;
      const valuationPaise = b.qty * b.product.mrpPaise;

      totalPieces += b.qty;
      totalValuationPaise += valuationPaise;

      return {
        product: b.product,
        qty: b.qty,
        cartons,
        loosePieces,
        valuationPaise,
      };
    });

    return {
      vanLocation: van,
      salesperson: van.assignedUser,
      activeVanDay,
      inventory,
      totalPieces,
      totalValuationPaise,
    };
  }
}

export const vanRepository = new VanRepository();
