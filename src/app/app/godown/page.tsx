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
    where: { reviewed: false },
  });

  // 6. Pending Orders & Shop POS Carton Invoices for Godown To Pack
  const [orders, posInvoices] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: { in: ["PENDING", "CONFIRMED", "BOOKED_BY_PRO"] as any },
      },
      include: {
        party: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.invoice.findMany({
      where: {
        channel: "SHOP",
        status: "FINALIZED",
        createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
        items: {
          some: {
            unitLabel: { in: ["Carton", "Bag"] },
          },
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        counterPickups: true,
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const pendingOrders = orders.map((o) => {
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.party?.name || "Customer",
      contactPhone: o.contactPhone || "",
      totalPaise: o.totalPaise,
      createdAt: o.createdAt.toISOString(),
      status: o.status,
      isInvoice: false,
      items: o.items.map((item) => {
        const packSize = item.product?.packSize || 1;
        return {
          id: item.id,
          productName: item.product?.name || "Item",
          weight: item.product?.weight || null,
          cartons: Math.floor(item.qty / packSize),
          loose: item.qty % packSize,
          totalPieces: item.qty,
        };
      }),
    };
  });

  const pendingInvoices = posInvoices.filter((inv) => {
    if (inv.counterPickups && inv.counterPickups.length > 0) {
      return inv.counterPickups.some((p) => p.status === "PENDING");
    }
    return true;
  });

  const pendingInvoiceOrders = pendingInvoices.map((inv) => {
    const cartonItems = inv.items.filter((item) => {
      const isCtn = item.unitLabel === "Carton" || item.unitLabel === "Bag";
      const packSize = Math.max(1, item.product?.packSize || 1);
      return isCtn || item.qty >= packSize;
    });

    return {
      id: inv.id,
      orderNumber: inv.number,
      customerName: inv.customerName || "Shop POS Counter",
      contactPhone: inv.customerPhone || "",
      totalPaise: inv.totalPaise,
      createdAt: inv.createdAt.toISOString(),
      status: "CONFIRMED",
      isInvoice: true,
      items: cartonItems.map((item) => {
        const packSize = item.product?.packSize || 1;
        const cartons = item.unitLabel === "Carton" || item.unitLabel === "Bag"
          ? Math.max(1, Math.round(item.qty / packSize))
          : Math.floor(item.qty / packSize);
        return {
          id: item.id,
          productName: item.product?.name || "Item",
          weight: item.product?.weight || null,
          cartons: Math.max(1, cartons),
          loose: item.qty % packSize,
          totalPieces: item.qty,
        };
      }),
    };
  });

  const combinedOrders = [...pendingOrders, ...pendingInvoiceOrders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <GodownMobileClient
      initialProducts={godownProducts}
      vanLocations={vanLocations}
      pendingOrders={combinedOrders}
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
