"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OrderSummary, OrderStatus } from "@/modules/order/order.types";
import { reorderOrderAction } from "./actions";
import { RotateCcw, FileText, ArrowRight, Truck, CheckCircle2 } from "lucide-react";

interface OrdersListClientProps {
  orders: OrderSummary[];
}

export function OrdersListClient({ orders }: OrdersListClientProps) {
  const router = useRouter();
  const [reorderingOrderId, setReorderingOrderId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleReorder = (orderId: string) => {
    setReorderingOrderId(orderId);
    startTransition(async () => {
      const res = await reorderOrderAction(orderId);
      if (res.success) {
        router.push("/store/cart");
      } else {
        alert(res.error || "Failed to reorder items");
        setReorderingOrderId(null);
      }
    });
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.DELIVERED:
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case OrderStatus.DISPATCHED:
        return "bg-blue-100 text-blue-800 border-blue-200";
      case OrderStatus.PROCESSING:
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case OrderStatus.CONFIRMED:
        return "bg-purple-100 text-purple-800 border-purple-200";
      case OrderStatus.CANCELLED:
        return "bg-rose-100 text-rose-800 border-rose-200";
      default:
        return "bg-amber-100 text-amber-800 border-amber-200";
    }
  };

  return (
    <div className="space-y-4">
      {orders.map((order) => {
        const totalRupees = (order.totalPaise / 100).toFixed(2);
        const itemsSubtotalRupees = (order.subtotalPaise / 100).toFixed(2);
        const deliveryFeeRupees = (order.deliveryFeePaise / 100).toFixed(2);
        const isReorderingThis = isPending && reorderingOrderId === order.id;

        return (
          <div
            key={order.id}
            className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 transition-all hover:border-slate-300"
          >
            {/* Header row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/store/orders/${order.id}`}
                    className="font-extrabold text-base text-blue-600 hover:underline font-mono"
                  >
                    #{order.orderNumber}
                  </Link>
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
                  {order.invoiceNumber && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      INV: {order.invoiceNumber}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Placed on{" "}
                  {new Date(order.createdAt).toLocaleDateString("en-IN", {
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

            {/* Delivery & Driver summary */}
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
                <span className="text-slate-500 block">Delivery Status:</span>
                {order.status === OrderStatus.DELIVERED ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Delivered ({order.paymentMode || "CASH"})</span>
                  </span>
                ) : order.assignedDeliveryUserName ? (
                  <span className="text-blue-700 font-semibold flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5" />
                    <span>With Driver: {order.assignedDeliveryUserName}</span>
                  </span>
                ) : (
                  <span className="text-slate-700 font-medium">Processing at Hub</span>
                )}
              </div>
            </div>

            {/* Items preview */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
                <span>Ordered Items ({order.items.length})</span>
                <Link
                  href={`/store/orders/${order.id}`}
                  className="text-blue-600 hover:underline text-[11px]"
                >
                  View itemized breakdown →
                </Link>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                {order.items.map((line) => (
                  <div
                    key={line.id}
                    className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50/50"
                  >
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

                    <div className="text-right font-mono font-bold text-slate-900">
                      ₹{((line.qty * line.unitPricePaise) / 100).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions Bar */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
              <div className="text-xs text-slate-500">
                <span>Items: ₹{itemsSubtotalRupees}</span>
                <span className="mx-2">•</span>
                <span>
                  Delivery:{" "}
                  {order.deliveryFeePaise === 0 ? (
                    <span className="text-emerald-600 font-bold">FREE</span>
                  ) : (
                    `₹${deliveryFeeRupees}`
                  )}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Reorder Button */}
                <button
                  type="button"
                  onClick={() => handleReorder(order.id)}
                  disabled={isPending}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                  title="Add items from this order to cart"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isReorderingThis ? "animate-spin" : ""}`} />
                  <span>{isReorderingThis ? "Adding..." : "Reorder"}</span>
                </button>

                {/* Tax Invoice Link if Invoiced */}
                {order.invoiceId && (
                  <Link
                    href={`/store/orders/${order.id}/invoice`}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Tax Invoice</span>
                  </Link>
                )}

                {/* Track Order Details Link */}
                <Link
                  href={`/store/orders/${order.id}`}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  <span>Track Order</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
