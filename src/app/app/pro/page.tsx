import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { OrderStatus, LocationType } from "@prisma/client";
import { ProMobileClient } from "./pro-mobile-client";

export const dynamic = "force-dynamic";

export default async function ProAppPage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const role = session.user.role as any;
  if (role !== "PRO" && role !== "ADMIN" && role !== "SUPER_ADMIN") {
    redirect("/app/shop");
  }

  // 1. Fetch products with prices and current stock
  const [products, locations] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        shortCode: true,
        weight: true,
        packSize: true,
        packLabel: true,
        mrpPaise: true,
        priceAPaise: true,
        priceBPaise: true,
        priceCPaise: true,
        stockBalances: {
          select: {
            locationId: true,
            qty: true,
          },
        },
      },
    }),
    prisma.location.findMany({
      where: { active: true },
      select: { id: true, type: true },
    }),
  ]);

  const shopLocIds = new Set(locations.filter((l) => l.type === LocationType.SHOP).map((l) => l.id));
  const godownLocIds = new Set(locations.filter((l) => l.type === LocationType.GODOWN).map((l) => l.id));

  const proProducts = products.map((p) => {
    let shopQty = 0;
    let godownQty = 0;
    for (const b of p.stockBalances) {
      if (shopLocIds.has(b.locationId)) shopQty += b.qty;
      if (godownLocIds.has(b.locationId)) godownQty += b.qty;
    }

    return {
      id: p.id,
      name: p.name,
      shortCode: p.shortCode,
      weight: p.weight,
      packSize: p.packSize > 0 ? p.packSize : 1,
      packLabel: p.packLabel || "Carton",
      mrpPaise: p.mrpPaise,
      priceAPaise: p.priceAPaise,
      priceBPaise: p.priceBPaise,
      priceCPaise: p.priceCPaise,
      shopQty,
      godownQty,
    };
  });

  // 2. Fetch active parties
  const parties = await prisma.party.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    take: 50,
  });

  const proParties = parties.map((p) => ({
    id: p.id,
    name: p.name,
    phone: p.phone,
    address: p.address,
    type: p.type,
    priceTier: p.type === 'WHOLESALER' ? 'C' : p.type === 'RETAILER' ? 'B' : 'A',
    creditLimitPaise: p.creditLimitPaise || 0,
    outstandingPaise: 0,
  }));

  // 3. Fetch past orders booked by this PRO user
  const orders = await prisma.order.findMany({
    where: {
      bookedByProId: session.user.id,
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
    take: 30,
  });

  const proOrders = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    partyName: o.party?.name || "Customer",
    partyPhone: o.party?.phone,
    totalPaise: o.totalPaise,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    items: o.items.map((it) => ({
      id: it.id,
      productId: it.productId,
      productName: it.product?.name || "Item",
      weight: it.product?.weight,
      quantity: it.qty,
      packSize: it.product?.packSize || 1,
      unitPricePaise: it.unitPricePaise,
      totalPaise: it.qty * it.unitPricePaise,
    })),
  }));

  // 4. Calculate today's summary
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const todayOrders = orders.filter((o) => new Date(o.createdAt) >= startOfDay);
  const todayTotalPaise = todayOrders.reduce(
    (sum, o) => sum + (o.status !== OrderStatus.CANCELLED ? o.totalPaise : 0),
    0
  );

  const todaySummary = {
    count: todayOrders.length,
    totalPaise: todayTotalPaise,
    bookedPending: todayOrders.filter((o) => o.status === (OrderStatus as any).BOOKED_BY_PRO).length,
    confirmed: todayOrders.filter((o) => o.status === OrderStatus.CONFIRMED).length,
    delivered: todayOrders.filter((o) => o.status === OrderStatus.DELIVERED).length,
  };

  return (
    <ProMobileClient
      initialProducts={proProducts}
      initialParties={proParties}
      initialOrders={proOrders}
      todaySummary={todaySummary}
      user={{
        id: session.user.id,
        name: session.user.name || "Field Agent",
        role: session.user.role,
        agentCode: (session.user as any).agentCode || null,
      }}
      initialTab={searchParams?.tab || "parties"}
    />
  );
}
