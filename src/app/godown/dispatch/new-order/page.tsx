import React from "react";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { NewOrderClient } from "./new-order-client";

export default async function NewManualOrderPage() {
  const session = await auth();
  const user = session?.user;
  if (!user) {
    redirect("/login?next=/godown/dispatch/new-order");
  }

  if (
    user.role !== UserRole.SUPER_ADMIN &&
    user.role !== UserRole.ADMIN &&
    user.role !== UserRole.WAREHOUSE_MANAGER
  ) {
    redirect("/unauthorized");
  }

  const [parties, products, deliveryStaff] = await Promise.all([
    prisma.party.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        type: true,
        phone: true,
        address: true,
        creditEnabled: true,
        creditLimitPaise: true,
      },
    }),
    prisma.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        packSize: true,
        mrpPaise: true,
        priceAPaise: true,
        priceBPaise: true,
        priceCPaise: true,
        stockBalances: {
          select: {
            qty: true,
            location: { select: { active: true } },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { role: UserRole.DELIVERY, active: true },
      select: { id: true, name: true },
    }),
  ]);

  const productsWithStock = products.map((p) => {
    const totalStock = p.stockBalances.reduce((sum, sb) => {
      if (sb.location.active) return sum + Math.max(0, sb.qty);
      return sum;
    }, 0);
    return {
      id: p.id,
      name: p.name,
      packSize: p.packSize,
      mrpPaise: p.mrpPaise,
      priceAPaise: p.priceAPaise,
      priceBPaise: p.priceBPaise,
      priceCPaise: p.priceCPaise,
      totalStock,
      inStock: totalStock > 0,
    };
  });

  // Out-of-stock items ranked last
  productsWithStock.sort((a, b) => {
    if (a.inStock !== b.inStock) {
      return a.inStock ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <NewOrderClient
        parties={parties}
        products={productsWithStock}
        deliveryStaff={deliveryStaff}
        userRole={user.role}
      />
    </div>
  );
}
