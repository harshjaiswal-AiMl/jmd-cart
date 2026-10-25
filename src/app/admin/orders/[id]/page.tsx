import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { orderService } from "@/modules/order/order.service";
import { OrderDetailClient } from "./order-detail-client";
import Link from "next/link";

export default async function OrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (
    session.user.role !== UserRole.SUPER_ADMIN &&
    session.user.role !== UserRole.GODOWN &&
    session.user.role !== UserRole.SHOP
  ) {
    redirect("/store");
  }

  const order = await orderService.getOrderById(params.id);

  if (!order) {
    notFound();
  }

  const deliveryStaff = await prisma.user.findMany({
    where: {
      role: { in: [UserRole.DELIVERY, UserRole.SALESPERSON, UserRole.SUPER_ADMIN] },
      active: true,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/admin/orders"
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
          >
            ← Back to Orders Directory
          </Link>
        </div>

        <OrderDetailClient
          order={order}
          actorRole={session.user.role}
          deliveryStaff={deliveryStaff}
        />
      </div>
    </div>
  );
}
