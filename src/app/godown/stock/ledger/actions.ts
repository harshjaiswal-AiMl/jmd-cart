"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, Permission } from "@/modules/auth/permissions";
import {
  stockLedgerService,
  ProductLedgerFilterParams,
  ProductLedgerReport,
} from "@/modules/stock/stock-ledger.service";
import { MovementType, LocationType } from "@prisma/client";

export async function getProductLedgerReportAction(
  params: ProductLedgerFilterParams
): Promise<ProductLedgerReport> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  if (!hasPermission(session.user.role, Permission.STOCK_VIEW)) {
    throw new Error("Forbidden: Missing STOCK_VIEW permission");
  }

  return stockLedgerService.getProductLedgerReport(session.user.role, params);
}

export async function searchLedgerProductsAction(query: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  if (!hasPermission(session.user.role, Permission.STOCK_VIEW)) {
    throw new Error("Forbidden: Missing STOCK_VIEW permission");
  }

  const q = query.trim();
  if (!q) {
    return prisma.product.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        shortCode: true,
        packSize: true,
        packLabel: true,
        mrpPaise: true,
        company: { select: { name: true } },
      },
      orderBy: { name: "asc" },
      take: 20,
    });
  }

  return prisma.product.findMany({
    where: {
      active: true,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { shortCode: { contains: q, mode: "insensitive" } },
        { company: { name: { contains: q, mode: "insensitive" } } },
      ],
    },
    select: {
      id: true,
      name: true,
      shortCode: true,
      packSize: true,
      packLabel: true,
      mrpPaise: true,
      company: { select: { name: true } },
    },
    orderBy: { name: "asc" },
    take: 30,
  });
}
