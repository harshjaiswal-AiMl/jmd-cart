"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OrderSummary, OrderStatus } from "@/modules/order/order.types";
import { reorderOrderAction } from "../actions";
import {
  CheckCircle2,
  Clock,
  Package,
  Truck,
  Home,
  XCircle,
  FileText,
  Printer,
  RotateCcw,
  Phone,
  MapPin,
  ExternalLink,
} from "lucide-react";

interface OrderTrackingClientProps {
  order: OrderSummary;
  isOwnerOrAdmin: boolean;
}

export function OrderTrackingClient({
  order,
}: OrderTrackingClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleReorder = () => {
    startTransition(async () => {
      setFeedback(null);
      const res = await reorderOrderAction(order.id);
      if (res.success) {
        setFeedback(`Added ${res.addedCount} items to your shopping cart!`);
        setTimeout(() => {
          router.push("/store/cart");
        }, 800);
      } else {
        alert(res.error || "Failed to reorder items");
      }
    });
  };

  const mrpTotalRupees = (order.subtotalPaise / 100).toFixed(2);
  const discountRupees = (order.lineDiscountPaise / 100).toFixed(2);
  const taxableRupees = (order.taxablePaise / 100).toFixed(2);
  const totalTaxRupees = (
    (order.cgstPaise + order.sgstPaise + order.igstPaise) /
    100
  ).toFixed(2);
  const deliveryFeeRupees = (order.deliveryFeePaise / 100).toFixed(2);
  const grandTotalRupees = (order.totalPaise / 100).toFixed(2);

  // Stepper milestones
  const steps = [
    {
      key: OrderStatus.PENDING,
      label: "Order Placed",
      sublabel: "Received & Stock Reserved",
      icon: Clock,
      isCompleted: true,
      isCurrent: order.status === OrderStatus.PENDING,
    },
    {
      key: OrderStatus.CONFIRMED,
      label: "Confirmed",
      sublabel: "Verified by Hub Dispatcher",
      icon: CheckCircle2,
      isCompleted: (
        [
          OrderStatus.CONFIRMED,
          OrderStatus.PROCESSING,
          OrderStatus.DISPATCHED,
          OrderStatus.DELIVERED,
        ] as OrderStatus[]
      ).includes(order.status),
      isCurrent: order.status === OrderStatus.CONFIRMED,
    },
    {
      key: OrderStatus.PROCESSING,
      label: "Packing & Invoiced",
      sublabel: order.invoiceNumber
        ? `Invoice #${order.invoiceNumber}`
        : "Godown & Shop Picking",
      icon: Package,
      isCompleted: (
        [
          OrderStatus.PROCESSING,
          OrderStatus.DISPATCHED,
          OrderStatus.DELIVERED,
        ] as OrderStatus[]
      ).includes(order.status),
      isCurrent: order.status === OrderStatus.PROCESSING,
    },
    {
      key: OrderStatus.DISPATCHED,
      label: "Out for Delivery",
      sublabel: order.assignedDeliveryUserName
        ? `With ${order.assignedDeliveryUserName}`
        : "Assigned to Route Runner",
      icon: Truck,
      isCompleted: (
        [OrderStatus.DISPATCHED, OrderStatus.DELIVERED] as OrderStatus[]
      ).includes(order.status),
      isCurrent: order.status === OrderStatus.DISPATCHED,
    },
    {
      key: OrderStatus.DELIVERED,
      label: "Delivered & Paid",
      sublabel: order.deliveredAt
        ? `Completed on ${new Date(order.deliveredAt).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          })}`
        : "Payment Collected on Delivery",
      icon: Home,
      isCompleted: order.status === OrderStatus.DELIVERED,
      isCurrent: order.status === OrderStatus.DELIVERED,
    },
  ];

  const isCancelled = order.status === OrderStatus.CANCELLED;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Status Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 font-mono">
              Order #{order.orderNumber}
            </h1>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border ${
                isCancelled
                  ? "bg-rose-100 text-rose-800 border-rose-200"
                  : order.status === OrderStatus.DELIVERED
                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                  : "bg-blue-100 text-blue-800 border-blue-200"
              }`}
            >
              {order.status}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
              {order.buyerTag} PRICING
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
          {/* Reorder Button */}
          <button
            onClick={handleReorder}
            disabled={isPending}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <RotateCcw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
            <span>{isPending ? "Adding to Cart..." : "Reorder All Items"}</span>
          </button>

          {/* Tax Invoice Buttons if Invoiced */}
          {order.invoiceId && (
            <Link
              href={`/store/orders/${order.id}/invoice`}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              <span>Tax Invoice</span>
            </Link>
          )}
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center justify-between">
          <span>{feedback}</span>
          <Link href="/store/cart" className="underline font-bold">
            View Cart →
          </Link>
        </div>
      )}

      {/* Visual Tracking Stepper */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-6">
          Order Journey & Live Tracking
        </h2>

        {isCancelled ? (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800">
            <XCircle className="w-6 h-6 text-rose-600 shrink-0" />
            <div>
              <div className="font-bold text-sm">This order was cancelled</div>
              <p className="text-xs text-rose-600">
                Reserved inventory was released back to Saharsa central stock. You may reorder anytime using the Reorder button above.
              </p>
            </div>
          </div>
        ) : (
          <div className="relative">
            {/* Desktop Horizontal Stepper */}
            <div className="hidden md:grid grid-cols-5 gap-2 relative">
              {steps.map((step, idx) => {
                const IconComponent = step.icon;
                const isPast = step.isCompleted && !step.isCurrent;
                const isCurrent = step.isCurrent;

                return (
                  <div key={step.key} className="flex flex-col items-center text-center space-y-2 relative">
                    {/* Connecting line */}
                    {idx < steps.length - 1 && (
                      <div
                        className={`absolute top-5 left-1/2 w-full h-1 -z-0 ${
                          step.isCompleted && steps[idx + 1].isCompleted
                            ? "bg-emerald-500"
                            : "bg-slate-200"
                        }`}
                      />
                    )}

                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center relative z-10 transition-all ${
                        isCurrent
                          ? "bg-blue-600 text-white ring-4 ring-blue-100 shadow-md scale-110"
                          : isPast
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-100 text-slate-400 border border-slate-200"
                      }`}
                    >
                      <IconComponent className="w-5 h-5" />
                    </div>

                    <div>
                      <span
                        className={`text-xs block font-bold ${
                          isCurrent
                            ? "text-blue-600"
                            : isPast
                            ? "text-slate-900"
                            : "text-slate-400"
                        }`}
                      >
                        {step.label}
                      </span>
                      <span className="text-[11px] text-slate-500 block max-w-[130px] mx-auto mt-0.5">
                        {step.sublabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile Vertical Stepper */}
            <div className="md:hidden space-y-5">
              {steps.map((step, idx) => {
                const IconComponent = step.icon;
                const isPast = step.isCompleted && !step.isCurrent;
                const isCurrent = step.isCurrent;

                return (
                  <div key={step.key} className="flex items-start gap-3 relative">
                    {idx < steps.length - 1 && (
                      <div
                        className={`absolute left-4 top-8 bottom-0 w-0.5 -ml-[1px] ${
                          step.isCompleted && steps[idx + 1].isCompleted
                            ? "bg-emerald-500"
                            : "bg-slate-200"
                        }`}
                      />
                    )}

                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 relative z-10 ${
                        isCurrent
                          ? "bg-blue-600 text-white ring-4 ring-blue-100 shadow"
                          : isPast
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-100 text-slate-400 border border-slate-200"
                      }`}
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>

                    <div className="pb-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold ${
                            isCurrent
                              ? "text-blue-600"
                              : isPast
                              ? "text-slate-900"
                              : "text-slate-400"
                          }`}
                        >
                          {step.label}
                        </span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200">
                            Active Stage
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{step.sublabel}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Driver, Delivery & Invoice info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Assigned Driver Card */}
          {order.assignedDeliveryUserName && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-blue-600" />
                  <span>Delivery Personnel</span>
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  Assigned
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-400 block">Driver / Runner:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {order.assignedDeliveryUserName}
                  </span>
                </div>

                {order.assignedDeliveryUserPhone && (
                  <div className="pt-1">
                    <a
                      href={`tel:${order.assignedDeliveryUserPhone}`}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call Driver ({order.assignedDeliveryUserPhone})</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Proof of Delivery / Payment if Delivered */}
          {order.status === OrderStatus.DELIVERED && (
            <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase tracking-wide">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Delivery & Payment Completed</span>
              </div>

              <div className="text-xs space-y-1.5 text-emerald-950">
                {order.deliveredAt && (
                  <div>
                    <span className="text-emerald-700 block font-medium">Delivered At:</span>
                    <span className="font-semibold">
                      {new Date(order.deliveredAt).toLocaleString("en-IN")}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-emerald-700 block font-medium">Payment Mode:</span>
                  <span className="font-bold text-emerald-900">
                    {order.paymentMode || "CASH"} (PAID)
                  </span>
                </div>
                {order.paymentReference && (
                  <div>
                    <span className="text-emerald-700 block font-medium">UPI / Transaction Ref:</span>
                    <span className="font-mono font-semibold">{order.paymentReference}</span>
                  </div>
                )}
                {order.paymentNotes && (
                  <p className="italic text-emerald-800 pt-1">
                    &ldquo;{order.paymentNotes}&rdquo;
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Tax Invoice Card */}
          {order.invoiceId && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>GST Tax Invoice</span>
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {order.invoiceNumber}
                </span>
              </div>

              <p className="text-xs text-slate-500">
                Official GST tax invoice issued by Sachin Prakash FMCG Distributor, Saharsa.
              </p>

              <div className="pt-2 flex flex-col gap-2">
                <Link
                  href={`/store/orders/${order.id}/invoice`}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>View & Print Tax Invoice</span>
                </Link>

                <Link
                  href={`/store/orders/${order.id}/invoice?autoprint=1`}
                  target="_blank"
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Full Printable Page</span>
                </Link>
              </div>
            </div>
          )}

          {/* Delivery Information */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide pb-2 border-b border-slate-100 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-slate-600" />
              <span>Destination Information</span>
            </h3>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-400 block">Delivery Zone:</span>
                <span className="font-semibold text-slate-800">
                  {order.deliveryZoneName} ({order.deliveryZoneCode})
                </span>
              </div>

              <div>
                <span className="text-slate-400 block">Address:</span>
                <p className="text-slate-800 font-medium whitespace-pre-wrap">
                  {order.deliveryAddress}
                </p>
              </div>

              <div>
                <span className="text-slate-400 block">Contact Phone:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {order.contactPhone}
                </span>
              </div>

              {order.customerNotes && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-400 block">Delivery Instructions:</span>
                  <p className="text-slate-700 italic">&ldquo;{order.customerNotes}&rdquo;</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Items Table & Price Summary */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Ordered Products ({order.items.length})
              </h3>
              <span className="text-xs text-slate-500">
                Fulfilled from Central Godown & Shop
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Item</th>
                    <th className="p-3 text-center">Pack / Pieces</th>
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
                    const totalLineRupees = (
                      (line.qty * line.unitPricePaise) /
                      100
                    ).toFixed(2);

                    return (
                      <tr key={line.id} className="hover:bg-slate-50/50">
                        <td className="p-3">
                          <div className="font-semibold text-slate-900">
                            {line.productName}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {line.shortCode} • HSN: {line.hsn}
                          </div>
                        </td>

                        <td className="p-3 text-center font-medium text-slate-700">
                          {line.cartons > 0
                            ? `${line.cartons} ctn (${line.cartons * line.packSize} pcs)`
                            : ""}
                          {line.cartons > 0 && line.loosePieces > 0 ? " + " : ""}
                          {line.loosePieces > 0
                            ? `${line.loosePieces} pcs loose`
                            : ""}
                          {line.cartons === 0 && line.loosePieces === 0
                            ? `${line.qty} pcs`
                            : ""}
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

            {/* Price Calculation Footer */}
            <div className="p-5 bg-slate-50 border-t border-slate-200">
              <div className="max-w-xs ml-auto space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Retail MRP Subtotal:</span>
                  <span className="font-mono">₹{mrpTotalRupees}</span>
                </div>

                {order.lineDiscountPaise > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Wholesale Slab Savings:</span>
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
                  <span
                    className={`font-mono ${
                      order.deliveryFeePaise === 0
                        ? "text-emerald-600 font-bold"
                        : ""
                    }`}
                  >
                    {order.deliveryFeePaise === 0
                      ? "FREE"
                      : `+ ₹${deliveryFeeRupees}`}
                  </span>
                </div>

                <div className="flex justify-between items-baseline pt-2 border-t border-slate-200 text-slate-900">
                  <span className="text-sm font-bold">Total Payable:</span>
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
