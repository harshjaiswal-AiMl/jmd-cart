import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { orderService } from "@/modules/order/order.service";
import Link from "next/link";

export default async function BuyerOrdersPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/store/orders");
  }

  const orders = await orderService.listUserOrders(session.user.id);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DELIVERED":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "DISPATCHED":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "PROCESSING":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "CONFIRMED":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "CANCELLED":
        return "bg-rose-100 text-rose-800 border-rose-200";
      default:
        return "bg-amber-100 text-amber-800 border-amber-200";
    }
  };

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

          <div className="flex items-center gap-4 text-sm">
            <Link
              href="/store"
              className="text-xs font-semibold px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
            >
              ← Back to Store
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Your Online Orders</h1>
          <p className="text-xs text-slate-500">
            Track real-time status and stock reservation from Saharsa distribution center.
          </p>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
            <span className="text-5xl block">📦</span>
            <h2 className="text-lg font-bold text-slate-800">No Orders Placed Yet</h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You haven&apos;t placed any orders yet. Explore our wholesale catalogue with live quantity discounts!
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
          <div className="space-y-4">
            {orders.map((order) => {
              const totalRupees = (order.totalPaise / 100).toFixed(2);
              const itemsSubtotalRupees = (order.subtotalPaise / 100).toFixed(2);
              const deliveryFeeRupees = (order.deliveryFeePaise / 100).toFixed(2);

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 transition-all hover:border-slate-300"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-base text-slate-900 font-mono">
                          #{order.orderNumber}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadge(
                            order.status
                          )}`}
                        >
                          {order.status}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                          {order.buyerTag}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Placed on {new Date(order.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>

                    <div className="text-right sm:text-right">
                      <div className="text-xs text-slate-500">Total Payable:</div>
                      <div className="text-xl font-black text-blue-600 font-mono">
                        ₹{totalRupees}
                      </div>
                    </div>
                  </div>

                  {/* Delivery destination details */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <span className="text-slate-500 block">Destination Zone:</span>
                      <span className="font-semibold text-slate-800">{order.deliveryZoneName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Contact Phone:</span>
                      <span className="font-mono text-slate-800">{order.contactPhone}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Delivery Address:</span>
                      <span className="text-slate-800 truncate block" title={order.deliveryAddress}>
                        {order.deliveryAddress}
                      </span>
                    </div>
                  </div>

                  {/* Items list */}
                  <div className="space-y-2 pt-1">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Ordered Items ({order.items.length})
                    </h4>
                    <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                      {order.items.map((line) => {
                        const lineTotalRupees = (
                          (line.qty * line.unitPricePaise) /
                          100
                        ).toFixed(2);
                        const unitRupees = (line.unitPricePaise / 100).toFixed(2);

                        return (
                          <div
                            key={line.id}
                            className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/50"
                          >
                            <div className="flex items-center gap-3">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] font-bold">
                                {line.shortCode}
                              </span>
                              <div>
                                <span className="font-semibold text-slate-900 block">
                                  {line.productName}
                                </span>
                                <span className="text-slate-500 text-[11px]">
                                  {line.cartons > 0
                                    ? `${line.cartons} ctn (${line.cartons * line.packSize} pcs)`
                                    : ""}
                                  {line.cartons > 0 && line.loosePieces > 0 ? " + " : ""}
                                  {line.loosePieces > 0 ? `${line.loosePieces} pcs loose` : ""}
                                  {line.cartons === 0 && line.loosePieces === 0 ? `${line.qty} pcs` : ""}
                                </span>
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="font-bold text-slate-900 font-mono">
                                ₹{lineTotalRupees}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {line.qty} × ₹{unitRupees}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Fee footer */}
                  <div className="pt-2 flex justify-between text-xs text-slate-500 border-t border-slate-100">
                    <div>
                      <span>Items: ₹{itemsSubtotalRupees}</span>
                      <span className="mx-2">•</span>
                      <span>
                        Delivery Fee:{" "}
                        {order.deliveryFeePaise === 0 ? (
                          <span className="text-emerald-600 font-bold">FREE</span>
                        ) : (
                          `₹${deliveryFeeRupees}`
                        )}
                      </span>
                    </div>

                    <div className="text-blue-600 font-semibold">
                      Payment Mode: Cash / UPI on Delivery
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
