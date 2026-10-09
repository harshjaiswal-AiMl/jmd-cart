"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { OrderSummary, OrderStatus } from "@/modules/order/order.types";
import { updateOrderStatusAction } from "./actions";

interface AdminOrdersClientProps {
  initialOrders: OrderSummary[];
}

export function AdminOrdersClient({ initialOrders }: AdminOrdersClientProps) {
  const [orders, setOrders] = useState<OrderSummary[]>(initialOrders);
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const handleStatusChange = (orderId: string, newStatus: OrderStatus) => {
    startTransition(async () => {
      const res = await updateOrderStatusAction(orderId, newStatus);
      if (res.success) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
        );
      } else {
        alert(res.error || "Failed to update order status");
      }
    });
  };

  const filteredOrders = orders.filter((order) => {
    const matchesStatus =
      selectedStatus === "ALL" || order.status === selectedStatus;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      order.orderNumber.toLowerCase().includes(q) ||
      order.customerName.toLowerCase().includes(q) ||
      order.customerPhone.includes(q) ||
      order.deliveryZoneName.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

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
      {/* Filters Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 flex items-center gap-3">
          <input
            type="text"
            placeholder="Search by order #, customer, phone, or zone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:max-w-md px-3.5 py-2 border border-slate-300 rounded-lg text-xs focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {["ALL", "PENDING", "CONFIRMED", "PROCESSING", "DISPATCHED", "DELIVERED", "CANCELLED"].map(
            (status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border ${
                  selectedStatus === status
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {status}
              </button>
            )
          )}
        </div>
      </div>

      {/* Orders Directory Table */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
          <span className="text-4xl block mb-2">📦</span>
          <p className="font-semibold text-sm">No orders matching the selected filter</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Order # / Date</th>
                  <th className="p-3.5">Buyer</th>
                  <th className="p-3.5">Destination Zone</th>
                  <th className="p-3.5 text-center">Items</th>
                  <th className="p-3.5 text-right">Amount</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-center">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((order) => {
                  const totalRupees = (order.totalPaise / 100).toFixed(2);

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3.5">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="font-mono font-bold text-blue-600 hover:underline block"
                        >
                          #{order.orderNumber}
                        </Link>
                        <span className="text-[11px] text-slate-400">
                          {new Date(order.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <div className="font-semibold text-slate-900">{order.customerName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{order.contactPhone}</div>
                      </td>

                      <td className="p-3.5">
                        <div className="font-semibold text-slate-800">{order.deliveryZoneName}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-xs" title={order.deliveryAddress}>
                          {order.deliveryAddress}
                        </div>
                      </td>

                      <td className="p-3.5 text-center font-mono font-semibold text-slate-700">
                        {order.items.length} lines
                      </td>

                      <td className="p-3.5 text-right">
                        <div className="font-mono font-extrabold text-slate-900">₹{totalRupees}</div>
                        <div className="text-[10px] text-slate-400">
                          {order.deliveryFeePaise === 0
                            ? "FREE Delivery"
                            : `+₹${(order.deliveryFeePaise / 100).toFixed(0)} fee`}
                        </div>
                      </td>

                      <td className="p-3.5 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border inline-block ${getStatusBadge(
                            order.status
                          )}`}
                        >
                          {order.status}
                        </span>
                      </td>

                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {order.status === OrderStatus.PENDING && (
                            <button
                              onClick={() => handleStatusChange(order.id, OrderStatus.CONFIRMED)}
                              disabled={isPending}
                              className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-[11px] font-bold transition-colors disabled:opacity-50"
                            >
                              Confirm
                            </button>
                          )}

                          {order.status === OrderStatus.CONFIRMED && (
                            <button
                              onClick={() => handleStatusChange(order.id, OrderStatus.PROCESSING)}
                              disabled={isPending}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-[11px] font-bold transition-colors disabled:opacity-50"
                            >
                              Process
                            </button>
                          )}

                          <Link
                            href={`/admin/orders/${order.id}/pick-list`}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-bold transition-colors inline-block"
                            title="Split Pick List (Shop Loose / Godown Packs)"
                          >
                            📋 Split Pick List
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
