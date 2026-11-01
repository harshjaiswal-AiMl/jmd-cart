import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LocationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { vanService } from "@/modules/van/van.service";
import { GodownMobileClient } from "./godown-mobile-client";

export const dynamic = "force-dynamic";

export default async function GodownAppPage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // 1. Fetch available Van locations
  const vanLocations = await vanService.listVanLocations(session.user.role);

  // 2. Fetch Central Godown
  const godown = await prisma.location.findFirst({
    where: { type: LocationType.GODOWN, active: true },
  });

  // 3. Fetch products and their Godown stock balance
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  const godownBalances = godown
    ? await prisma.stockBalance.findMany({
        where: { locationId: godown.id },
      })
    : [];

  const balanceMap = new Map<string, number>();
  godownBalances.forEach((b) => balanceMap.set(b.productId, b.qty));

  const godownProducts = products.map((p) => {
    const qty = balanceMap.get(p.id) || 0;
    const packSize = p.packSize > 0 ? p.packSize : 1;
    return {
      id: p.id,
      name: p.name,
      shortCode: p.shortCode,
      weight: p.weight,
      packSize: p.packSize,
      packLabel: p.packLabel,
      mrpPaise: p.mrpPaise,
      godownQty: qty,
      godownCartons: Math.floor(qty / packSize),
      godownLoose: qty % packSize,
    };
  });

  // 4. Low stock count
  const lowStockCount = godownProducts.filter((p) => p.godownQty <= 10).length;

  // 5. Unreviewed corrections count
  const unreviewedCorrectionsCount = await prisma.stockCorrection.count({
    where: { reviewedByUserId: null },
  });

  // 6. Pending Orders for Godown
  const orders = await prisma.order.findMany({
    where: {
      status: { in: ["PENDING", "CONFIRMED", "BOOKED_BY_PRO"] as any },
    },
    include: {
      orderItems: {
        include: {
          product: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const pendingOrders = orders.map((o) => {
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName || "Customer",
      contactPhone: o.contactPhone || "",
      totalPaise: o.totalPaise,
      createdAt: o.createdAt.toISOString(),
      status: o.status,
      items: o.orderItems.map((item) => {
        const packSize = item.product?.packSize || 1;
        return {
          id: item.id,
          productName: item.product?.name || "Item",
          weight: item.product?.weight || null,
          cartons: Math.floor(item.quantity / packSize),
          loose: item.quantity % packSize,
          totalPieces: item.quantity,
        };
      }),
    };
  });

  return (
    <GodownMobileClient
      initialProducts={godownProducts}
      vanLocations={vanLocations}
      pendingOrders={pendingOrders}
      lowStockCount={lowStockCount}
      unreviewedCorrectionsCount={unreviewedCorrectionsCount}
      initialTab={searchParams?.tab || "home"}
      user={{
        id: session.user.id || "",
        name: session.user.name || "Warehouse Manager",
        role: session.user.role,
      }}
    />
  );
}
