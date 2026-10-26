"use client";

import React, { useState, useTransition } from "react";
import { OrderSummary, OrderStatus, PaymentMode } from "@/modules/order/order.types";
import { recordDeliveryPaymentAction } from "@/app/admin/orders/actions";
import {
  Package,
  Phone,
  MapPin,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  FileText,
  Banknote,
  QrCode,
  AlertCircle,
  Truck,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

interface VanHandedOverDeliveriesProps {
  orders: OrderSummary[];
  salespersonName?: string;
}

export function VanHandedOverDeliveries({
  orders,
  salespersonName,
}: VanHandedOverDeliveriesProps) {
  const [activeTab, setActiveTab] = useState<"pending" | "completed">("pending");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Delivery Modal State
  const [selectedOrder, setSelectedOrder] = useState<OrderSummary | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(PaymentMode.CASH);
  const [paymentReference, setPaymentReference] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  const pendingOrders = orders.filter(
    (o) => o.status !== OrderStatus.DELIVERED && o.status !== OrderStatus.CANCELLED
  );
  const completedOrders = orders.filter((o) => o.status === OrderStatus.DELIVERED);

  const totalCashToCollectPaise = pendingOrders.reduce((sum, o) => sum + o.totalPaise, 0);

  const handleOpenDeliveryModal = (order: OrderSummary) => {
    setSelectedOrder(order);
    setPaymentMode(PaymentMode.CASH);
    setPaymentReference("");
    setDeliveryNotes("");
  };

  const handleConfirmDelivery = () => {
    if (!selectedOrder) return;

    if (paymentMode === PaymentMode.UPI && !paymentReference.trim()) {
      if (!confirm("UPI Transaction reference is empty. Continue without entering UTR / ID?")) {
        return;
      }
    }

    startTransition(async () => {
      const res = await recordDeliveryPaymentAction({
        orderId: selectedOrder.id,
        paymentMode,
        paymentReference: paymentReference.trim() || undefined,
        notes: deliveryNotes.trim() || undefined,
      });

      if (res.success) {
        alert(`Order #${selectedOrder.orderNumber} successfully marked as DELIVERED!`);
        setSelectedOrder(null);
        window.location.reload();
      } else {
        alert(res.error || "Failed to complete delivery");
      }
    });
  };

  const currentList = activeTab === "pending" ? pendingOrders : completedOrders;

  return (
    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
      {/* Header Banner */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-700 border border-amber-500/30">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Handed-Over Deliveries
              </h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                सुपुर्द किए गए ऑर्डर्स
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Customer orders assigned to your van for doorstep delivery & cash collection.
            </p>
          </div>
        </div>

        {/* Status / Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "pending"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>Pending</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                pendingOrders.length > 0
                  ? "bg-amber-500 text-white"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {pendingOrders.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("completed")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "completed"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>Delivered</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600">
              {completedOrders.length}
            </span>
          </button>
        </div>
      </div>

      {/* Summary Alert when pending */}
      {pendingOrders.length > 0 && activeTab === "pending" && (
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              You have <strong>{pendingOrders.length} delivery</strong> to complete today.
            </span>
          </div>
          <div className="text-amber-900 font-bold">
            Cash to collect:{" "}
            <span className="text-emerald-700 text-sm font-black font-mono">
              ₹{(totalCashToCollectPaise / 100).toLocaleString("en-IN", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </span>
          </div>
        </div>
      )}

      {/* Order List */}
      <div className="p-4 sm:p-5 space-y-3">
        {currentList.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <Package className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">
              {activeTab === "pending"
                ? "No pending customer deliveries handed over right now."
                : "No customer deliveries marked as completed yet."}
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {activeTab === "pending"
                ? "When the Godown team dispatches and hands over customer delivery orders to you, they will appear here instantly."
                : "Completed deliveries will be archived here for your daily cash reconciliation."}
            </p>
          </div>
        ) : (
          currentList.map((order) => {
            const isExpanded = expandedOrderId === order.id;
            const phone = order.contactPhone || order.customerPhone;
            const isPendingOrder =
              order.status !== OrderStatus.DELIVERED &&
              order.status !== OrderStatus.CANCELLED;

            return (
              <div
                key={order.id}
                className={`rounded-2xl border transition overflow-hidden ${
                  isPendingOrder
                    ? "border-amber-200 bg-amber-50/20 hover:border-amber-300"
                    : "border-slate-200 bg-slate-50/40"
                }`}
              >
                {/* Order Top Bar */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-sm text-[#12355B]">
                        #{order.orderNumber}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${
                          order.status === OrderStatus.DISPATCHED
                            ? "bg-blue-100 text-blue-800 border border-blue-200"
                            : order.status === OrderStatus.DELIVERED
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {order.status}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {order.items.length} item{order.items.length > 1 ? "s" : ""}
                      </span>
                    </div>

                    {/* Customer & Location */}
                    <div className="text-xs text-slate-700 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <strong className="text-slate-900">{order.customerName}</strong>
                        {phone && (
                          <a
                            href={`tel:${phone}`}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{phone}</span>
                          </a>
                        )}
                      </div>
                      {order.deliveryAddress && (
                        <div className="flex items-start gap-1 text-[11px] text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span className="line-clamp-1">{order.deliveryAddress}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Amount & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-left sm:text-right">
                      <div className="text-[10px] uppercase font-bold text-slate-500">
                        Amount to Collect
                      </div>
                      <div className="text-base font-black text-emerald-700 font-mono">
                        ₹{(order.totalPaise / 100).toLocaleString("en-IN", {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isPendingOrder && (
                        <button
                          type="button"
                          onClick={() => handleOpenDeliveryModal(order)}
                          className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Deliver</span>
                        </button>
                      )}

                      {order.invoiceId && (
                        <Link
                          href={`/shop/invoices/${order.invoiceId}/print?format=thermal`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-xl text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 transition"
                          title="Print Thermal Bill"
                        >
                          <FileText className="w-4 h-4" />
                        </Link>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedOrderId(isExpanded ? null : order.id)
                        }
                        className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                        title={isExpanded ? "Collapse Items" : "View Items"}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Handed-over Products List (Expanded) */}
                {isExpanded && (
                  <div className="p-4 pt-0 border-t border-slate-100 bg-white/70">
                    <div className="mt-3">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Handed-Over Delivery Products ({order.items.length})
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-100 text-slate-400 text-left font-semibold">
                              <th className="pb-2">Product</th>
                              <th className="pb-2 text-center">Pack / Size</th>
                              <th className="pb-2 text-right">Quantity</th>
                              <th className="pb-2 text-right">Rate</th>
                              <th className="pb-2 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {order.items.map((item) => (
                              <tr key={item.id} className="text-slate-800">
                                <td className="py-2 pr-2 font-medium">
                                  <span>{item.productName}</span>
                                  {item.shortCode && (
                                    <span className="block text-[10px] text-slate-400 font-mono">
                                      {item.shortCode}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-2 text-center text-slate-500">
                                  {item.packSize > 1
                                    ? `${item.packSize} pcs/crt`
                                    : "Loose"}
                                </td>
                                <td className="py-2 px-2 text-right font-bold text-slate-900">
                                  {item.cartons > 0 && (
                                    <span className="text-amber-700 mr-1 font-mono">
                                      {item.cartons} crt
                                    </span>
                                  )}
                                  {item.loosePieces > 0 && (
                                    <span className="text-slate-700 font-mono">
                                      {item.loosePieces} pcs
                                    </span>
                                  )}
                                  {item.cartons === 0 && item.loosePieces === 0 && (
                                    <span className="font-mono">{item.qty} pcs</span>
                                  )}
                                </td>
                                <td className="py-2 px-2 text-right text-slate-500 font-mono">
                                  ₹{(item.unitPricePaise / 100).toFixed(2)}
                                </td>
                                <td className="py-2 pl-2 text-right font-bold text-slate-900 font-mono">
                                  ₹{((item.taxablePaise + item.taxPaise) / 100).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {order.customerNotes && (
                        <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600">
                          <strong className="text-slate-800">Delivery Notes:</strong>{" "}
                          {order.customerNotes}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Delivery Confirmation & Payment Collection Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white">
                  Confirm Doorstep Delivery
                </h3>
                <p className="text-xs text-slate-400">
                  Order #{selectedOrder.orderNumber} • {selectedOrder.customerName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="text-slate-400 hover:text-white text-sm p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              {/* Amount to collect banner */}
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <span className="text-xs text-emerald-400 uppercase font-bold tracking-wider block">
                  Amount to Collect
                </span>
                <span className="text-3xl font-black text-white font-mono mt-1 block">
                  ₹{(selectedOrder.totalPaise / 100).toFixed(2)}
                </span>
              </div>

              {/* Payment Mode Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300">
                  Payment Mode Received
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMode(PaymentMode.CASH)}
                    className={`p-3 rounded-2xl border text-left transition flex items-center gap-2.5 ${
                      paymentMode === PaymentMode.CASH
                        ? "bg-emerald-500/20 border-emerald-500 text-white font-bold"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    <Banknote className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-xs">Cash Received</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode(PaymentMode.UPI)}
                    className={`p-3 rounded-2xl border text-left transition flex items-center gap-2.5 ${
                      paymentMode === PaymentMode.UPI
                        ? "bg-emerald-500/20 border-emerald-500 text-white font-bold"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    <QrCode className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="text-xs">UPI / Online</span>
                  </button>
                </div>
              </div>

              {/* UPI Reference if applicable */}
              {paymentMode === PaymentMode.UPI && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">
                    UPI Transaction ID / UTR (Optional)
                  </label>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="e.g. 403819284918"
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              )}

              {/* Delivery Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Delivery Notes (Optional)
                </label>
                <input
                  type="text"
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="e.g. Delivered to shop owner in person"
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                disabled={isPending}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelivery}
                disabled={isPending}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {isPending ? "Confirming..." : "Confirm Delivery & Mark Done"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
