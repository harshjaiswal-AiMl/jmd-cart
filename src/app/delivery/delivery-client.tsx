"use client";

import { useState, useTransition } from "react";
import { OrderSummary, OrderStatus, PaymentMode } from "@/modules/order/order.types";
import { recordDeliveryPaymentAction } from "../admin/orders/actions";
import { Phone, MapPin, CheckCircle2, ChevronDown, ChevronUp, Package, QrCode, Banknote } from "lucide-react";

interface DeliveryClientProps {
  orders: OrderSummary[];
  currentUserId: string;
  userRole: string;
}

export function DeliveryClient({
  orders,
}: DeliveryClientProps) {
  const [activeTab, setActiveTab] = useState<"pending" | "completed">("pending");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Modal state
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
      if (!confirm("UPI reference is empty. Continue without entering transaction ID?")) {
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
    <div className="space-y-6">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wide">
            Pending Runs
          </span>
          <span className="text-2xl font-black text-blue-400 mt-1 block">
            {pendingOrders.length}
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wide">
            Delivered Today
          </span>
          <span className="text-2xl font-black text-emerald-400 mt-1 block">
            {completedOrders.length}
          </span>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wide">
            Cash to Collect
          </span>
          <span className="text-2xl font-black text-amber-400 mt-1 block font-mono">
            ₹{(totalCashToCollectPaise / 100).toFixed(0)}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => setActiveTab("pending")}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === "pending"
              ? "bg-blue-600 text-white shadow"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Active Deliveries ({pendingOrders.length})
        </button>
        <button
          onClick={() => setActiveTab("completed")}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === "completed"
              ? "bg-emerald-600 text-white shadow"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Completed ({completedOrders.length})
        </button>
      </div>

      {/* Orders List */}
      {currentList.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center space-y-2">
          <Package className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-300">
            {activeTab === "pending" ? "No pending deliveries" : "No completed deliveries"}
          </h3>
          <p className="text-xs text-slate-500">
            {activeTab === "pending"
              ? "All your assigned orders have been delivered. Check back when dispatchers assign new runs."
              : "Completed runs for today will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {currentList.map((order) => {
            const isExpanded = expandedOrderId === order.id;
            const amountDueRupees = (order.totalPaise / 100).toFixed(2);

            return (
              <div
                key={order.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 hover:border-slate-700 transition-colors"
              >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-white font-mono">
                        #{order.orderNumber}
                      </span>
                      {order.invoiceNumber && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/30 font-mono">
                          INV: {order.invoiceNumber}
                        </span>
                      )}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {order.buyerTag}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-100 mt-1">
                      {order.customerName}
                    </h3>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-400 block font-medium">To Collect</span>
                    <span className="text-lg font-black text-emerald-400 font-mono">
                      ₹{amountDueRupees}
                    </span>
                  </div>
                </div>

                {/* Customer Contact & Navigation Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={`tel:${order.contactPhone}`}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-bold transition-colors"
                  >
                    <Phone className="w-4 h-4 text-blue-400" />
                    <span>Call Customer</span>
                  </a>

                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      order.deliveryAddress + " Saharsa"
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-colors"
                  >
                    <MapPin className="w-4 h-4 text-rose-400" />
                    <span>Open Maps</span>
                  </a>
                </div>

                {/* Address Box */}
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-400 font-semibold">
                    <span>Destination ({order.deliveryZoneName}):</span>
                  </div>
                  <p className="text-slate-200 font-medium whitespace-pre-wrap">
                    {order.deliveryAddress}
                  </p>
                  {order.customerNotes && (
                    <p className="text-amber-400/90 italic pt-1 border-t border-slate-800/60">
                      Note: &ldquo;{order.customerNotes}&rdquo;
                    </p>
                  )}
                </div>

                {/* Toggle Items Breakdown */}
                <div>
                  <button
                    onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                    className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 font-semibold"
                  >
                    <span>
                      {isExpanded ? "Hide" : "View"} {order.items.length} Order Items
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="mt-2.5 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-2">
                      {order.items.map((line) => (
                        <div
                          key={line.id}
                          className="flex items-center justify-between border-b border-slate-800/60 pb-1.5 last:border-0 last:pb-0"
                        >
                          <div>
                            <span className="font-semibold text-slate-200 block">
                              {line.productName}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {line.cartons > 0 ? `${line.cartons} ctn (${line.cartons * line.packSize} pcs)` : ""}
                              {line.cartons > 0 && line.loosePieces > 0 ? " + " : ""}
                              {line.loosePieces > 0 ? `${line.loosePieces} pcs loose` : ""}
                              {line.cartons === 0 && line.loosePieces === 0 ? `${line.qty} pcs` : ""}
                            </span>
                          </div>
                          <span className="font-mono text-slate-300 font-bold">
                            ₹{((line.qty * line.unitPricePaise) / 100).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Main Action Button */}
                {order.status !== OrderStatus.DELIVERED ? (
                  <button
                    onClick={() => handleOpenDeliveryModal(order)}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-black shadow-lg shadow-emerald-950 flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Record Delivery & Payment (₹{amountDueRupees})</span>
                  </button>
                ) : (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-800/40 rounded-xl text-xs text-emerald-300 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Delivered & Paid</span>
                    </div>
                    {order.deliveredAt && (
                      <div className="text-slate-400">
                        Timestamp: {new Date(order.deliveredAt).toLocaleString("en-IN")}
                      </div>
                    )}
                    <div className="text-emerald-400 font-semibold">
                      Mode: {order.paymentMode || "CASH"}
                      {order.paymentReference && ` • Ref: ${order.paymentReference}`}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Payment & Delivery Confirmation Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-5 sm:p-6 space-y-5 text-white animate-in fade-in duration-200">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-semibold text-slate-400 block uppercase">
                  Proof of Delivery & Collection
                </span>
                <h3 className="text-lg font-black font-mono">
                  Order #{selectedOrder.orderNumber}
                </h3>
                <span className="text-xs text-slate-300">{selectedOrder.customerName}</span>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Total Due Banner */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase">Amount Due</span>
              <span className="text-2xl font-black font-mono text-emerald-400">
                ₹{(selectedOrder.totalPaise / 100).toFixed(2)}
              </span>
            </div>

            {/* Payment Mode Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide block">
                Payment Collection Mode
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMode(PaymentMode.CASH)}
                  className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                    paymentMode === PaymentMode.CASH
                      ? "bg-emerald-600 border-emerald-500 text-white shadow"
                      : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750"
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  <span>Cash Payment</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode(PaymentMode.UPI)}
                  className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                    paymentMode === PaymentMode.UPI
                      ? "bg-blue-600 border-blue-500 text-white shadow"
                      : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750"
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  <span>UPI / QR Scan</span>
                </button>
              </div>
            </div>

            {/* UPI Reference Input */}
            {paymentMode === PaymentMode.UPI && (
              <div className="space-y-1.5 p-3.5 bg-blue-950/40 border border-blue-800/40 rounded-xl">
                <label className="text-xs font-semibold text-blue-300 block">
                  UPI UTR / Reference ID:
                </label>
                <input
                  type="text"
                  placeholder="e.g. 429381902849"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-blue-400">
                  Ask customer for the 12-digit UPI reference number.
                </p>
              </div>
            )}

            {/* Optional Delivery Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide block">
                Delivery Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Handed to Shop Owner Mr. Ramesh"
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Confirm Actions */}
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDelivery}
                disabled={isPending}
                className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-950 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isPending ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Delivery (₹{(selectedOrder.totalPaise / 100).toFixed(0)})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
