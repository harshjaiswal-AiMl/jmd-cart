import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { orderService } from "@/modules/order/order.service";
import { OrderTrackingClient } from "./order-tracking-client";
import Link from "next/link";

interface OrderTrackingPageProps {
  params: { id: string };
}

export default async function OrderTrackingPage({
  params,
}: OrderTrackingPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/store/orders/${params.id}`);
  }

  const order = await orderService.getOrderById(params.id);

  if (!order) {
    notFound();
  }

  // Authorization check: User must own the order or be Super Admin
  const isOwner = order.userId === session.user.id;
  const isSuperAdmin = session.user.role === UserRole.SUPER_ADMIN;

  if (!isOwner && !isSuperAdmin) {
    redirect("/store/orders");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/store"
              className="text-2xl font-black text-blue-600 tracking-tight"
            >
              JMD CART
            </Link>
            <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-semibold border border-blue-200">
              Order Tracking
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/store/orders"
              className="text-xs font-semibold px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
            >
              ← All Orders
            </Link>
            <Link
              href="/store/cart"
              className="text-xs font-semibold px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              🛒 Cart
            </Link>
          </div>
        </div>
      </header>

      {/* Main Tracking Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <OrderTrackingClient order={order} isOwnerOrAdmin={true} />
      </main>
    </div>
  );
}
