import { prisma } from "@/lib/prisma";
import { PartyType } from "@prisma/client";
import { PurchaseListFilter, PurchaseWithDetails } from "./purchase.types";

export class PurchaseRepository {
  async getPurchaseById(id: string): Promise<PurchaseWithDetails | null> {
    return prisma.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        location: true,
        creator: {
          select: { id: true, name: true, role: true },
        },
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  async listPurchases(filter: PurchaseListFilter = {}): Promise<PurchaseWithDetails[]> {
    const { locationId, supplierId, status, limit = 50, offset = 0 } = filter;

    return prisma.purchase.findMany({
      where: {
        ...(locationId ? { locationId } : {}),
        ...(supplierId ? { supplierId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        supplier: true,
        location: true,
        creator: {
          select: { id: true, name: true, role: true },
        },
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
  }

  async countPurchases(filter: PurchaseListFilter = {}): Promise<number> {
    const { locationId, supplierId, status } = filter;
    return prisma.purchase.count({
      where: {
        ...(locationId ? { locationId } : {}),
        ...(supplierId ? { supplierId } : {}),
        ...(status ? { status } : {}),
      },
    });
  }

  async listSuppliers() {
    return prisma.party.findMany({
      where: {
        type: PartyType.SUPPLIER,
        active: true,
      },
      orderBy: { name: "asc" },
    });
  }

  async listLocations() {
    return prisma.location.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });
  }
}

export const purchaseRepository = new PurchaseRepository();
