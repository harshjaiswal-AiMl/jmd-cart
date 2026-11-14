import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasPermission, Permission } from "@/modules/auth/permissions";
import { stockLedgerService } from "@/modules/stock/stock-ledger.service";
import { LedgerClient } from "./ledger-client";

interface PageProps {
  searchParams: Promise<{
    productId?: string;
    locationId?: string;
  }>;
}

export default async function ProductLedgerPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!hasPermission(session.user.role, Permission.STOCK_VIEW)) {
    redirect("/login");
  }

  const { productId, locationId } = await searchParams;

  // 1. Load active locations
  const locations = await prisma.location.findMany({
    where: { active: true },
    select: { id: true, name: true, type: true },
    orderBy: { name: "asc" },
  });

  // 2. Load initial products list
  const initialProducts = await prisma.product.findMany({
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
    take: 30,
  });

  // 3. Resolve target product
  let targetProduct = productId
    ? await prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          name: true,
          shortCode: true,
          packSize: true,
          packLabel: true,
          mrpPaise: true,
          company: { select: { name: true } },
        },
      })
    : initialProducts[0] || null;

  // 4. Generate initial report if product is available
  let initialReport = null;
  if (targetProduct) {
    try {
      initialReport = await stockLedgerService.getProductLedgerReport(
        session.user.role,
        {
          productId: targetProduct.id,
          locationId: locationId || undefined,
        }
      );
    } catch (err) {
      console.error("Failed to generate initial stock ledger report:", err);
    }
  }

  return (
    <LedgerClient
      initialReport={initialReport}
      locations={locations}
      initialProducts={initialProducts}
    />
  );
}
