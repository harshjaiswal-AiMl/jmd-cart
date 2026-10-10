import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { orderService } from "@/modules/order/order.service";
import { OrdersListClient } from "./orders-list-client";
import Link from "next/link";

export default async function BuyerOrdersPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/store/orders");
  }

  const orders = await orderService.listUserOrders(session.user.id);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/store" className="text-2xl font-black text-blue-600 tracking-tight">
              JMD CART
            </Link>
            <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-semibold border border-blue-200">
              My Orders
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/store"
              className="text-xs font-semibold px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
            >
              ← Back to Store
            </Link>
            <Link
              href="/store/cart"
              className="text-xs font-semibold px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
            >
              🛒 Cart
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Your Online Orders</h1>
            <p className="text-xs text-slate-500">
              Track live order journey, reorder previous items, and download official GST tax invoices.
            </p>
          </div>
          <Link
            href="/store"
            className="text-xs font-bold text-blue-600 hover:text-blue-800 self-start sm:self-auto"
          >
            + Browse Catalogue
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
            <span className="text-5xl block">📦</span>
            <h2 className="text-lg font-bold text-slate-800">No Orders Placed Yet</h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You haven&apos;t placed any orders yet. Explore our wholesale catalogue with live quantity slab discounts!
            </p>
            <div className="pt-2">
              <Link
                href="/store"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition-colors shadow-sm"
              >
                Start Shopping →
              </Link>
            </div>
          </div>
        ) : (
          <OrdersListClient orders={orders} />
        )}
      </main>
    </div>
  );
}
