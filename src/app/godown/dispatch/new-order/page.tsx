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
      },
    }),
    prisma.user.findMany({
      where: { role: UserRole.DELIVERY, active: true },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <NewOrderClient
        parties={parties}
        products={products}
        deliveryStaff={deliveryStaff}
        userRole={user.role}
      />
    </div>
  );
}
