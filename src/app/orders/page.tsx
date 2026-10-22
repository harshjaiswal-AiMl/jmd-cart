import { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { orderService } from "@/modules/order/order.service";
import { StoreShell } from "@/components/store/StoreShell";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";

export const metadata: Metadata = {
  title: "My Orders | JMD Cart Saharsa",
  description: "Track your grocery orders, download GST invoices, and reorder previous items.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function OrdersPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/orders");
  }

  const orders = await orderService.listUserOrders(session.user.id);

  return (
    <StoreShell>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "My Account", href: "/account" },
            { label: "Order History" },
          ]}
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif text-on-surface">
              Order History
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
              Track live dispatch journey, view line items, and download official GST tax invoices.
            </p>
          </div>

          <Link
            href="/"
            className="self-start sm:self-auto px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary-container transition-colors shadow-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">shopping_cart</span>
            New Order
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/20 p-10 sm:p-14 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-surface-container-low text-outline flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-3xl">inventory_2</span>
            </div>
            <h2 className="text-lg font-bold text-on-surface">No Orders Placed Yet</h2>
            <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
              You haven&apos;t placed any orders yet. Explore our wholesale catalogue with live quantity slab discounts!
            </p>
            <div className="pt-2">
              <Link
                href="/categories"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-sm hover:bg-primary-container transition-colors shadow-sm"
              >
                Start Shopping →
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order: any) => {
              const totalAmount = order.totalPaise / 100;
              const dateFormatted = new Date(order.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });

              return (
                <div
                  key={order.id}
                  className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-5 shadow-sm space-y-4 hover:border-primary/40 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant/15 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-primary text-sm sm:text-base">
                          #{order.orderNumber || order.id.slice(0, 8)}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-tertiary-fixed/30 text-tertiary">
                          {order.status}
                        </span>
                      </div>
                      <div className="text-xs text-on-surface-variant mt-0.5">
                        Placed on {dateFormatted}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/orders/${order.id}/track`}
                        className="px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container text-xs font-bold transition-colors flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm text-primary">local_shipping</span>
                        Track Dispatch
                      </Link>
                      <Link
                        href={`/orders/${order.id}`}
                        className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary-container transition-colors shadow-sm"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                    <div className="space-y-1">
                      <div className="font-medium text-on-surface">
                        {order.items?.length || 0} Item(s)
                      </div>
                      <div className="text-on-surface-variant line-clamp-1">
                        {order.items?.map((it: any) => it.product?.name || it.name).join(", ")}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-on-surface-variant text-[11px] block">Grand Total</span>
                      <span className="text-base font-bold font-mono text-primary">
                        ₹{totalAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </StoreShell>
  );
}
