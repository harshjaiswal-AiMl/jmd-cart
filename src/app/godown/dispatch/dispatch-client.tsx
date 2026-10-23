"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Truck,
  PlusCircle,
  Package,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowRight,
  Store,
  Receipt,
  RotateCcw,
  RefreshCw,
  Search,
  Filter,
  User,
  MapPin,
  Calendar,
} from "lucide-react";
import {
  createDispatchRunAction,
  handoverDispatchRunAction,
  handleFailedDeliveryAction,
  completeCounterPickupAction,
} from "./actions";

interface Props {
  boardData: any;
  vans: Array<{ id: string; name: string }>;
  deliveryStaff: Array<{ id: string; name: string }>;
  userRole: string;
}

export function DispatchClient({ boardData, vans, deliveryStaff, userRole }: Props) {
  const [activeTab, setActiveTab] = useState<string>("load");
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [selectedVan, setSelectedVan] = useState<string>("");
  const [selectedStaff, setSelectedStaff] = useState<string>("");
  const [slot, setSlot] = useState<string>("Morning (9 AM - 1 PM)");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const { loadSummary, orders, runs, counterPickups, recentShopSales, shopBalances } = boardData;

  const toggleOrderSelection = (id: string) => {
    setSelectedOrders((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCreateRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedOrders.length === 0) {
      setMessage({ type: "error", text: "Please select at least one order for the run" });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    const res = await createDispatchRunAction({
      vanId: selectedVan || undefined,
      deliveryUserId: selectedStaff || undefined,
      slot,
      notes,
      orderIds: selectedOrders,
    });

    setIsSubmitting(false);

    if (res.error) {
      setMessage({ type: "error", text: res.error });
    } else {
      setMessage({ type: "success", text: `Dispatch run #${res.runNumber} created successfully!` });
      setSelectedOrders([]);
      setActiveTab("runs");
    }
  };

  const handleHandover = async (runId: string) => {
    if (!confirm("Are you sure you want to hand over this dispatch run? Invoices will be finalized and stock deducted.")) {
      return;
    }

    setIsSubmitting(true);
    const res = await handoverDispatchRunAction(runId);
    setIsSubmitting(false);

    if (res.error) {
      setMessage({ type: "error", text: res.error });
    } else {
      setMessage({ type: "success", text: "Dispatch run handed over! Delivery status updated to Out for Delivery." });
    }
  };

  const handleCompletePickup = async (pickupId: string) => {
    setIsSubmitting(true);
    const res = await completeCounterPickupAction(pickupId);
    setIsSubmitting(false);

    if (res.error) {
      setMessage({ type: "error", text: res.error });
    } else {
      setMessage({ type: "success", text: "Counter pickup completed and handed over!" });
    }
  };

  const handleFailDelivery = async (orderId: string) => {
    const reason = prompt("Enter failure reason (e.g. Customer unavailable, Address not found, Rejected):");
    if (!reason) return;

    setIsSubmitting(true);
    const res = await handleFailedDeliveryAction(orderId, reason);
    setIsSubmitting(false);

    if (res.error) {
      setMessage({ type: "error", text: res.error });
    } else {
      setMessage({ type: "success", text: "Failed delivery recorded. Goods returned to Godown stock." });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Title and Create Order CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Truck className="h-7 w-7 text-maroon-800" />
            Dispatch Board
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Godown & Shop shared dispatch board, load summary, delivery trips, and counter pickups.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/godown/dispatch/new-order"
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 transition"
          >
            <PlusCircle className="h-4 w-4" />
            + Create Order (Manual)
          </Link>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg text-sm font-medium ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 text-sm font-medium">
        <button
          onClick={() => setActiveTab("load")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition ${
            activeTab === "load"
              ? "border-maroon-800 text-maroon-900 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          Today&apos;s Load Summary
        </button>
        <button
          onClick={() => setActiveTab("orders")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition ${
            activeTab === "orders"
              ? "border-maroon-800 text-maroon-900 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          <Package className="h-4 w-4" />
          Orders ({orders.length})
        </button>
        <button
          onClick={() => setActiveTab("runs")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition ${
            activeTab === "runs"
              ? "border-maroon-800 text-maroon-900 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          <Truck className="h-4 w-4" />
          Delivery Runs ({runs.length})
        </button>
        <button
          onClick={() => setActiveTab("counter-pickups")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition ${
            activeTab === "counter-pickups"
              ? "border-maroon-800 text-maroon-900 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          <Store className="h-4 w-4" />
          Counter Pickups ({counterPickups.filter((p: any) => p.status === "PENDING").length} pending)
        </button>
        <button
          onClick={() => setActiveTab("shop-sales")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition ${
            activeTab === "shop-sales"
              ? "border-maroon-800 text-maroon-900 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          <Receipt className="h-4 w-4" />
          Shop Sales Feed &amp; Stock
        </button>
      </div>

      {/* Tab 1: Today's Load Summary */}
      {activeTab === "load" && (
        <div className="space-y-4">
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Today&apos;s Dispatch Load vs Sellable Stock Pool</p>
              <p className="text-amber-800 text-xs mt-0.5">
                Compares confirmed orders and approved transfers with live sellable pool (Shop + Godown - Reservations). Items with shortage are highlighted in red.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-600 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-right">Pack Size</th>
                  <th className="px-4 py-3 text-right">Needed Today</th>
                  <th className="px-4 py-3 text-right">Available Pool</th>
                  <th className="px-4 py-3 text-right">Shortage</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-800">
                {loadSummary.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      No orders or dispatches scheduled for today.
                    </td>
                  </tr>
                ) : (
                  loadSummary.map((item: any) => (
                    <tr key={item.productId} className={item.isShortage ? "bg-red-50/60" : "hover:bg-gray-50"}>
                      <td className="px-4 py-3 font-medium text-gray-900">{item.productName}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{item.packSize} pcs/ctn</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {item.neededPieces} pcs{" "}
                        <span className="text-xs text-gray-500">
                          ({item.neededCartons} ctn + {item.neededLoose} loose)
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {item.availablePieces} pcs{" "}
                        <span className="text-xs text-gray-500">
                          ({item.availableCartons} ctn + {item.availableLoose} loose)
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {item.isShortage ? (
                          <span className="font-bold text-red-600">-{item.shortagePieces} pcs</span>
                        ) : (
                          <span className="text-green-600 font-medium">Sufficient</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.isShortage ? (
                          <Link
                            href="/godown/purchases/new"
                            className="inline-flex items-center text-xs font-semibold text-red-700 bg-red-100 px-2.5 py-1 rounded hover:bg-red-200"
                          >
                            + Create GRN
                          </Link>
                        ) : (
                          <span className="inline-flex items-center text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded">
                            Ready
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Orders Kanban & Run Builder */}
      {activeTab === "orders" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order selection table */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">
                Confirmed Orders Awaiting Dispatch ({orders.filter((o: any) => o.status === "CONFIRMED" || o.status === "PENDING").length})
              </h2>
              <span className="text-xs text-gray-500">Select orders to bundle into a delivery run</span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs font-semibold uppercase">
                  <tr>
                    <th className="px-3 py-3 text-center w-10">Select</th>
                    <th className="px-4 py-3 text-left">Order #</th>
                    <th className="px-4 py-3 text-left">Customer / Party</th>
                    <th className="px-4 py-3 text-left">Zone / Address</th>
                    <th className="px-4 py-3 text-right">Items / Total</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {orders.map((order: any) => (
                    <tr
                      key={order.id}
                      onClick={() => toggleOrderSelection(order.id)}
                      className={`cursor-pointer transition ${
                        selectedOrders.includes(order.id)
                          ? "bg-amber-50/70"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedOrders.includes(order.id)}
                          onChange={() => {}}
                          className="h-4 w-4 rounded border-gray-300 text-maroon-700 focus:ring-maroon-600"
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        {order.orderNumber}
                        {order.channel === "MANUAL" && (
                          <span className="ml-2 inline-block rounded bg-purple-100 text-purple-800 text-[10px] font-bold px-1.5 py-0.5">
                            MANUAL
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {order.party?.name || "Retail Buyer"}
                        <div className="text-xs text-gray-400">{order.contactPhone}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        <div className="font-semibold text-gray-800">{order.deliveryZoneName}</div>
                        <div className="truncate max-w-[180px]">{order.deliveryAddress}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-medium text-gray-900">{order.items.length} items</div>
                        <div className="text-xs text-gray-500">₹{(order.totalPaise / 100).toFixed(2)}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                            order.status === "OUT_FOR_DELIVERY"
                              ? "bg-blue-100 text-blue-800"
                              : order.status === "DELIVERED"
                              ? "bg-green-100 text-green-800"
                              : order.status === "FAILED"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Run Builder Form Panel */}
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm space-y-4 h-fit">
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <Truck className="h-5 w-5 text-maroon-800" />
              Build Delivery Run
            </h3>
            <p className="text-xs text-gray-500">
              Selected: <span className="font-bold text-gray-800">{selectedOrders.length}</span> orders
            </p>

            <form onSubmit={handleCreateRun} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Assign Van</label>
                <select
                  value={selectedVan}
                  onChange={(e) => setSelectedVan(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-maroon-600 focus:outline-none"
                >
                  <option value="">-- Select Van (Optional) --</option>
                  {vans.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Assign Delivery Staff</label>
                <select
                  value={selectedStaff}
                  onChange={(e) => setSelectedStaff(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-maroon-600 focus:outline-none"
                >
                  <option value="">-- Select Staff (Optional) --</option>
                  {deliveryStaff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Time Slot</label>
                <input
                  type="text"
                  value={slot}
                  onChange={(e) => setSlot(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-maroon-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Trip Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Route: Ward 1 to Ward 10"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-maroon-600 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || selectedOrders.length === 0}
                className="w-full rounded-lg bg-maroon-900 py-2.5 font-semibold text-white shadow hover:bg-maroon-800 disabled:opacity-50 transition"
              >
                {isSubmitting ? "Creating Run..." : "Create Dispatch Run"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab 3: Delivery Runs */}
      {activeTab === "runs" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {runs.map((run: any) => (
              <div key={run.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">{run.runNumber}</h3>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {new Date(run.date).toLocaleDateString()} | Slot: {run.slot || "Morning"}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      run.status === "OUT"
                        ? "bg-blue-100 text-blue-800"
                        : run.status === "CLOSED"
                        ? "bg-green-100 text-green-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {run.status}
                  </span>
                </div>

                <div className="text-xs text-gray-600 space-y-1">
                  <div>
                    <span className="font-semibold text-gray-700">Van:</span> {run.van?.name || "Not assigned"}
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Driver/Staff:</span>{" "}
                    {run.deliveryUser?.name || "Not assigned"} ({run.deliveryUser?.phone || "-"})
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Stops:</span> {run.orders.length} orders
                  </div>
                </div>

                <div className="divide-y divide-gray-100 border-t border-gray-100 pt-2 text-xs">
                  {run.orders.map((item: any) => (
                    <div key={item.id} className="py-2 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-gray-800">#{item.sequence} {item.order.orderNumber}</span>
                        <div className="text-gray-500">{item.order.party?.name || "Retail"}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.order.status === "OUT_FOR_DELIVERY" && (
                          <button
                            onClick={() => handleFailDelivery(item.order.id)}
                            className="rounded bg-red-50 text-red-700 px-2 py-1 font-semibold hover:bg-red-100 text-[10px]"
                          >
                            Mark Failed
                          </button>
                        )}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                          {item.order.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {run.status === "DRAFT" && (
                  <button
                    onClick={() => handleHandover(run.id)}
                    disabled={isSubmitting}
                    className="w-full mt-2 rounded bg-green-700 py-2 text-xs font-bold text-white hover:bg-green-800 transition"
                  >
                    Hand Over Run &amp; Deduct Stock
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Counter Pickups */}
      {activeTab === "counter-pickups" && (
        <div className="space-y-4">
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-900">
            <p className="font-semibold">Shop Counter Shortfall Pickups (Section 5a)</p>
            <p className="text-xs text-blue-800 mt-0.5">
              When a shop POS bill sells more pieces than available in the shop, the shortfall is drawn from the Godown. Godown staff hand over physical goods to shop staff here.
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs font-semibold uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Bill #</th>
                  <th className="px-4 py-3 text-left">Cashier</th>
                  <th className="px-4 py-3 text-left">Items to Hand Over</th>
                  <th className="px-4 py-3 text-left">Time</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {counterPickups.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      No counter pickups pending.
                    </td>
                  </tr>
                ) : (
                  counterPickups.map((pickup: any) => (
                    <tr key={pickup.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-900">{pickup.billNumber}</td>
                      <td className="px-4 py-3 text-gray-700">{pickup.cashierName || "Counter 1"}</td>
                      <td className="px-4 py-3 text-gray-800">
                        {Array.isArray(pickup.items) ? (
                          pickup.items.map((it: any, i: number) => (
                            <div key={i} className="text-xs">
                              {it.productName || it.productId}: <span className="font-bold">{it.qty} pcs</span>
                            </div>
                          ))
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(pickup.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-bold ${
                            pickup.status === "COMPLETED"
                              ? "bg-green-100 text-green-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {pickup.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {pickup.status === "PENDING" && (
                          <button
                            onClick={() => handleCompletePickup(pickup.id)}
                            disabled={isSubmitting}
                            className="rounded bg-maroon-800 text-white px-3 py-1 text-xs font-semibold hover:bg-maroon-900 transition"
                          >
                            Mark Handed Over
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Shop Sales Feed & Stock Panel */}
      {activeTab === "shop-sales" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Shop Sales Feed (Read-only bills) */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Receipt className="h-5 w-5 text-maroon-800" />
              Live Shop POS Bills (Read-Only)
            </h2>

            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs font-semibold uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Invoice #</th>
                    <th className="px-4 py-3 text-left">Party / Buyer</th>
                    <th className="px-4 py-3 text-left">Cashier</th>
                    <th className="px-4 py-3 text-right">Items / Total</th>
                    <th className="px-4 py-3 text-center">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentShopSales.map((sale: any) => (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        <Link
                          href={`/shop/invoices/${sale.id}`}
                          className="text-maroon-800 hover:underline"
                        >
                          {sale.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{sale.party?.name || "Walk-in Customer"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{sale.creator?.name || "Cashier"}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-semibold text-gray-900">₹{(sale.totalPaise / 100).toFixed(2)}</div>
                        <div className="text-xs text-gray-500">{sale.items.length} lines</div>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-400">
                        {new Date(sale.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Shop Stock Panel & Restock Suggestions */}
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm space-y-4 h-fit">
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <Store className="h-5 w-5 text-maroon-800" />
              Shop Stock &amp; Restock Alerts
            </h3>

            <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto text-xs space-y-2">
              {shopBalances.map((sb: any) => {
                const isLow = sb.qty <= (sb.product.reorderLevel || 10);
                return (
                  <div key={sb.productId} className="py-2 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-800">{sb.product.name}</div>
                      <div className="text-gray-400">Reorder Level: {sb.product.reorderLevel} pcs</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${isLow ? "text-red-600" : "text-gray-900"}`}>
                        {sb.qty} pcs
                      </div>
                      {isLow && (
                        <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                          Low Stock
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
