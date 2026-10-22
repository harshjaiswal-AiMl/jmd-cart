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
    <div className="min-h-screen bg-surface font-body text-on-surface antialiased flex flex-col justify-between">
      {/* Top Header */}
      <header className="bg-surface-container-lowest border-b border-surface-container-high/80 sticky top-0 z-30 shadow-sm backdrop-blur-md">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/store"
              className="flex items-center gap-2 group"
            >
              <img
                src="/brand/jmd-cart-logo.png"
                alt="JMD Cart Logo"
                className="h-8 w-auto object-contain"
              />
              <span className="font-headline text-xl sm:text-2xl font-bold tracking-tight text-primary">
                JMD<span className="text-secondary">Cart</span>
              </span>
            </Link>
            <span className="text-xs bg-primary-fixed text-on-primary-fixed px-2.5 py-0.5 rounded-full font-bold">
              Order Tracking
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/store/account?tab=orders"
              className="text-xs font-bold px-3 py-1.5 border border-outline-variant/60 rounded-xl text-on-surface hover:bg-surface-container-low transition-colors"
            >
              ← All Orders
            </Link>
            <Link
              href="/store/checkout"
              className="text-xs font-bold px-3.5 py-1.5 bg-primary hover:bg-primary-container text-on-primary rounded-xl transition-all shadow-xs"
            >
              🛒 Checkout
            </Link>
          </div>
        </div>
      </header>

      {/* Main Tracking Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        <OrderTrackingClient order={order} isOwnerOrAdmin={true} />
      </main>
    </div>
  );
}
