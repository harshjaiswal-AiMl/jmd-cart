"use client";

import { useTransition } from "react";
import Link from "next/link";
import { OrderSummary, OrderStatus } from "@/modules/order/order.types";
import { updateOrderStatusAction } from "../actions";

interface OrderDetailClientProps {
  order: OrderSummary;
  actorRole: string;
}

export function OrderDetailClient({ order, actorRole }: OrderDetailClientProps) {
  const [isPending, startTransition] = useTransition();

  const handleUpdateStatus = (newStatus: OrderStatus) => {
    if (confirm(`Change order status from ${order.status} to ${newStatus}?`)) {
      startTransition(async () => {
        const res = await updateOrderStatusAction(order.id, newStatus);
        if (res.success) {
          window.location.reload();
        } else {
          alert(res.error || "Failed to update order status");
        }
      });
    }
  };

  const mrpTotalRupees = (order.subtotalPaise / 100).toFixed(2);
  const discountRupees = (order.lineDiscountPaise / 100).toFixed(2);
  const taxableRupees = (order.taxablePaise / 100).toFixed(2);
  const totalTaxRupees = ((order.cgstPaise + order.sgstPaise + order.igstPaise) / 100).toFixed(2);
  const deliveryFeeRupees = (order.deliveryFeePaise / 100).toFixed(2);
  const grandTotalRupees = (order.totalPaise / 100).toFixed(2);

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.CONFIRMED:
        return "bg-purple-100 text-purple-800 border-purple-200";
      case OrderStatus.PROCESSING:
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case OrderStatus.DISPATCHED:
        return "bg-blue-100 text-blue-800 border-blue-200";
      case OrderStatus.DELIVERED:
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case OrderStatus.CANCELLED:
        return "bg-rose-100 text-rose-800 border-rose-200";
      default:
        return "bg-amber-100 text-amber-800 border-amber-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 font-mono">
              Order #{order.orderNumber}
            </h1>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadge(
                order.status
              )}`}
            >
              {order.status}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
              {order.buyerTag}
            </span>
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

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/orders/${order.id}/pick-list`}
            className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <span>📋 Split Pick Lists</span>
          </Link>

          {order.status === OrderStatus.PENDING && (
            <button
              onClick={() => handleUpdateStatus(OrderStatus.CONFIRMED)}
              disabled={isPending}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
            >
              Confirm Order
            </button>
          )}

          {order.status === OrderStatus.CONFIRMED && (
            <button
              onClick={() => handleUpdateStatus(OrderStatus.PROCESSING)}
              disabled={isPending}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
            >
              Send to Processing
            </button>
          )}

          {order.status === OrderStatus.PROCESSING && (
            <button
              onClick={() => handleUpdateStatus(OrderStatus.DISPATCHED)}
              disabled={isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
            >
              Mark Dispatched
            </button>
          )}

          {order.status === OrderStatus.DISPATCHED && (
            <button
              onClick={() => handleUpdateStatus(OrderStatus.DELIVERED)}
              disabled={isPending}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
            >
              Confirm Delivered
            </button>
          )}

          {order.status !== OrderStatus.CANCELLED && order.status !== OrderStatus.DELIVERED && (
            <button
              onClick={() => handleUpdateStatus(OrderStatus.CANCELLED)}
              disabled={isPending}
              className="px-3 py-2 border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Customer & Delivery Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 uppercase tracking-wide">
              Customer Details
            </h3>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-400 block">Name:</span>
                <span className="font-semibold text-slate-800 text-sm">{order.customerName}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Phone / Mobile:</span>
                <span className="font-mono font-semibold text-slate-800">{order.contactPhone}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Buyer Tier:</span>
                <span className="font-semibold text-blue-600">{order.buyerTag} PRICING</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 uppercase tracking-wide">
              Delivery Information
            </h3>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-400 block">Zone:</span>
                <span className="font-semibold text-slate-800">{order.deliveryZoneName} ({order.deliveryZoneCode})</span>
              </div>
              <div>
                <span className="text-slate-400 block">Destination Address:</span>
                <p className="text-slate-700 font-medium whitespace-pre-wrap">{order.deliveryAddress}</p>
              </div>
              {order.customerNotes && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-400 block">Dispatch Notes:</span>
                  <p className="text-slate-700 italic">&ldquo;{order.customerNotes}&rdquo;</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Items Table and Price Breakdown */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Ordered Items ({order.items.length})
              </h3>
              <span className="text-xs text-slate-500">Reserved from Central Stock</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Product</th>
                    <th className="p-3 text-center">Packaging Breakdown</th>
                    <th className="p-3 text-right">Rate</th>
                    <th className="p-3 text-right">Taxable</th>
                    <th className="p-3 text-right">GST</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items.map((line) => {
                    const unitRupees = (line.unitPricePaise / 100).toFixed(2);
                    const taxableLineRupees = (line.taxablePaise / 100).toFixed(2);
                    const taxLineRupees = (line.taxPaise / 100).toFixed(2);
                    const totalLineRupees = ((line.qty * line.unitPricePaise) / 100).toFixed(2);

                    return (
                      <tr key={line.id} className="hover:bg-slate-50/50">
                        <td className="p-3">
                          <div className="font-semibold text-slate-900">{line.productName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {line.shortCode} • HSN: {line.hsn}
                          </div>
                        </td>

                        <td className="p-3 text-center">
                          <span className="font-semibold text-slate-800">
                            {line.cartons > 0 ? `${line.cartons} ctn (${line.cartons * line.packSize} pcs)` : ""}
                            {line.cartons > 0 && line.loosePieces > 0 ? " + " : ""}
                            {line.loosePieces > 0 ? `${line.loosePieces} pcs loose` : ""}
                            {line.cartons === 0 && line.loosePieces === 0 ? `${line.qty} pcs` : ""}
                          </span>
                        </td>

                        <td className="p-3 text-right font-mono">₹{unitRupees}</td>
                        <td className="p-3 text-right font-mono">₹{taxableLineRupees}</td>
                        <td className="p-3 text-right font-mono text-slate-500">
                          ₹{taxLineRupees} ({line.gstRateBp / 100}%)
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">
                          ₹{totalLineRupees}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Price Breakdown Footer */}
            <div className="p-6 bg-slate-50 border-t border-slate-200">
              <div className="max-w-xs ml-auto space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Retail MRP Subtotal:</span>
                  <span className="font-mono">₹{mrpTotalRupees}</span>
                </div>
                {order.lineDiscountPaise > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Wholesale Slab Discount:</span>
                    <span className="font-mono">- ₹{discountRupees}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-200">
                  <span>Taxable Amount:</span>
                  <span className="font-mono">₹{taxableRupees}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Total GST:</span>
                  <span className="font-mono">₹{totalTaxRupees}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Delivery Charges ({order.deliveryZoneCode}):</span>
                  <span className={`font-mono ${order.deliveryFeePaise === 0 ? "text-emerald-600 font-bold" : ""}`}>
                    {order.deliveryFeePaise === 0 ? "FREE" : `+ ₹${deliveryFeeRupees}`}
                  </span>
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-slate-200 text-slate-900">
                  <span className="text-sm font-bold">Total Order Value:</span>
                  <span className="text-xl font-black font-mono text-blue-600">
                    ₹{grandTotalRupees}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
