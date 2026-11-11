import React, { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LocationType, MovementType, OrderStatus, UserRole } from "@prisma/client";
import { ensureRolePermissionsLoaded } from "@/modules/auth/role-matrix.service";
import { ManagementShell } from "./management-shell";

const getCachedShellData = unstable_cache(
  async (isGodownOnly: boolean) => {
    const [pendingOrders, autoConverted, locations, products] = await Promise.all([
      prisma.order.count({
        where: {
          status: {
            in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING],
          },
        },
      }),
      prisma.stockMovement.count({
        where: { type: MovementType.CARTON_BREAK },
      }),
      prisma.location.findMany({
        where: {
          active: true,
          ...(isGodownOnly ? { type: LocationType.GODOWN } : {}),
        },
        select: { id: true, name: true, type: true },
        orderBy: { name: "asc" },
      }),
      prisma.product.findMany({
        where: { active: true },
        select: {
          id: true,
          shortCode: true,
          name: true,
          reorderLevel: true,
          mrpPaise: true,
          priceCPaise: true,
          company: { select: { name: true } },
          stockBalances: { select: { qty: true } },
        },
        orderBy: { name: "asc" },
        take: 150,
      }),
    ]);

    let lowStock = 0;
    for (const p of products) {
      const totalQty = p.stockBalances.reduce((s, b) => s + b.qty, 0);
      if (totalQty <= p.reorderLevel) lowStock++;
    }

    const quickProducts = products.map((p) => ({
      id: p.id,
      shortCode: p.shortCode,
      name: p.name,
      brandName: p.company?.name ?? null,
      priceCPaise: p.priceCPaise ?? p.mrpPaise ?? 0,
    }));

    return { pendingOrders, autoConverted, locations, lowStock, quickProducts };
  },
  ["management-shell-data-v1"],
  { revalidate: 30 }
);

export async function ManagementShellServer({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const isGodownOnly = session.user.role === UserRole.GODOWN;
  const [shellData, roleMatrix] = await Promise.all([
    getCachedShellData(isGodownOnly),
    ensureRolePermissionsLoaded(),
  ]);
  const { pendingOrders, autoConverted, locations, lowStock, quickProducts } = shellData;
  const userPermissions = roleMatrix[session.user.role as UserRole] || [];

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FEFDF7]" />}>
      <ManagementShell
        user={{
          id: session.user.id,
          name: session.user.name || "Staff User",
          role: session.user.role,
          permissions: userPermissions,
        }}
        badges={{
          pendingOrders,
          lowStock,
          autoConverted,
        }}
        locations={locations}
        quickProducts={quickProducts}
        signOutAction={handleSignOut}
      >
        {children}
      </ManagementShell>
    </Suspense>
  );
}
