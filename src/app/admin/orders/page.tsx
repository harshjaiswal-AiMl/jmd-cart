import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { orderService } from "@/modules/order/order.service";
import { AdminOrdersClient } from "./admin-orders-client";
import Link from "next/link";

export default async function AdminOrdersPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Allowed for Super Admin, Godown, and Shop roles
  if (
    session.user.role !== UserRole.SUPER_ADMIN &&
    session.user.role !== UserRole.GODOWN &&
    session.user.role !== UserRole.SHOP
  ) {
    redirect("/store");
  }

  const orders = await orderService.listAllOrders();

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Online Store Orders</h1>
            <p className="text-xs text-slate-500">
              Manage incoming retail & wholesale orders, confirm reservations, and print split pick lists.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/catalog"
              className="text-xs font-semibold px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
            >
              Catalog Master
            </Link>
            <Link
              href="/godown/operations"
              className="text-xs font-semibold px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
            >
              Godown Operations
            </Link>
          </div>
        </div>

        <AdminOrdersClient initialOrders={orders} />
      </div>
    </div>
  );
}
