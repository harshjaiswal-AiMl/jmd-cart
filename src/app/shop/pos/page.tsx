import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole, LocationType, PartyType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { settingsService } from "@/modules/settings/settings.service";
import { PosClient } from "./pos-client";

export default async function ShopPosPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== UserRole.SHOP && session.user.role !== UserRole.SUPER_ADMIN) {
    redirect("/login");
  }

  // 1. Find main Shop location
  const shopLocation = await prisma.location.findFirst({
    where: { type: LocationType.SHOP, active: true },
    orderBy: { name: "asc" },
  });

  if (!shopLocation) {
    throw new Error("No active Shop location found. Please contact Administrator.");
  }

  // 2. Fetch products with their Shop stock balances
  const [productsRaw, companies, partiesRaw, roleLimits] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      include: {
        company: true,
        category: true,
        stockBalances: {
          where: { locationId: shopLocation.id },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.company.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.party.findMany({
      where: { type: { not: PartyType.SUPPLIER } },
      select: {
        id: true,
        name: true,
        phone: true,
        creditEnabled: true,
        creditLimitPaise: true,
        ledgerEntries: {
          select: { debitPaise: true, creditPaise: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    settingsService.getRoleDiscountLimits(),
  ]);

  const products = productsRaw.map((p) => ({
    id: p.id,
    name: p.name,
    shortCode: p.shortCode,
    companyId: p.companyId,
    companyName: p.company?.name ?? null,
    categoryId: p.categoryId,
    categoryName: p.category?.name ?? null,
    hsn: p.hsn,
    gstRateBp: p.gstRateBp,
    mrpPaise: p.mrpPaise,
    packSize: p.packSize,
    packLabel: p.packLabel,
    reorderLevel: p.reorderLevel,
    shopStockQty: p.stockBalances[0]?.qty ?? 0,
  }));

  const parties = partiesRaw.map((party) => {
    const totalDebit = party.ledgerEntries.reduce((sum, e) => sum + e.debitPaise, 0);
    const totalCredit = party.ledgerEntries.reduce((sum, e) => sum + e.creditPaise, 0);
    const currentOutstandingPaise = totalDebit - totalCredit;

    return {
      id: party.id,
      name: party.name,
      phone: party.phone,
      creditEnabled: party.creditEnabled,
      creditLimitPaise: party.creditLimitPaise,
      currentOutstandingPaise,
    };
  });

  const roleDiscountLimitBp =
    session.user.role === UserRole.SUPER_ADMIN
      ? 10000
      : roleLimits[session.user.role] ?? 500;

  return (
    <PosClient
      locationId={shopLocation.id}
      locationName={shopLocation.name}
      cashierName={session.user.name || "Cashier"}
      cashierRole={session.user.role}
      roleDiscountLimitBp={roleDiscountLimitBp}
      products={products}
      companies={companies}
      parties={parties}
    />
  );
}
