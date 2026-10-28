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
  updatePackingStatusAction,
} from "./actions";

interface Props {
  boardData: any;
  vans: Array<{ id: string; name: string }>;
  deliveryStaff: Array<{ id: string; name: string }>;
  userRole: string;
}

function getPackingState(saleOrPickup: any) {
  const pickup = saleOrPickup.counterPickups ? saleOrPickup.counterPickups[0] : saleOrPickup;
  if (!pickup) {
    return {
      status: "PENDING" as const,
      label: "Needs Packing",
      badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
      pickupId: null,
    };
  }
  if (pickup.status === "COMPLETED") {
    return {
      status: "COMPLETED" as const,
      label: "Handed Over",
      badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
      pickupId: pickup.id,
    };
  }
  const notes = pickup.notes || "";
  if (notes.startsWith("[PACKED]")) {
    return {
      status: "PACKED" as const,
      label: "Packed & Ready",
      badgeClass: "bg-purple-100 text-purple-800 border-purple-300",
      pickupId: pickup.id,
    };
  }
  if (notes.startsWith("[PACKING]")) {
    return {
      status: "PACKING" as const,
      label: "Packing In Progress",
      badgeClass: "bg-blue-100 text-blue-800 border-blue-300",
      pickupId: pickup.id,
    };
  }
  return {
    status: "PENDING" as const,
    label: "Needs Packing",
    badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
    pickupId: pickup.id,
  };
}

function renderPackBreakdown(qty: number, packSize: number, packLabel: string = "Carton") {
  if (packSize <= 1) {
    return <span className="font-bold text-gray-900">{qty} Pcs</span>;
  }
  const cartons = Math.floor(qty / packSize);
  const loose = qty % packSize;

  if (cartons > 0 && loose > 0) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs">
          📦 {cartons} {cartons > 1 ? packLabel + "s" : packLabel} ({cartons * packSize} pcs)
        </span>
        <span className="text-gray-400 font-bold">+</span>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 font-bold text-xs">
          🛍 {loose} Loose pcs
        </span>
        <span className="text-[11px] text-gray-500 font-medium">({qty} pcs total)</span>
      </div>
    );
  } else if (cartons > 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs">
        📦 {cartons} {cartons > 1 ? packLabel + "s" : packLabel} ({qty} pcs)
      </span>
    );
  } else {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 font-bold text-xs">
        🛍 {loose} Loose pcs
      </span>
    );
  }
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
  const [packingFilter, setPackingFilter] = useState<"ALL" | "PENDING" | "PACKING" | "PACKED" | "COMPLETED">("ALL");
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const { loadSummary, orders, runs, counterPickups, recentShopSales, shopBalances } = boardData;

  // Prompt #13 Part B: Warehouse queue shows only godown-fulfilled lines:
  // - Channel VAN: NEVER shown in warehouse queue
  // - Channel SHOP: show only carton lines (cartons come from godown; loose-only bills hidden)
  // - Channel ONLINE: show carton and loose lines (fulfilled from godown for delivery)
  const warehouseQueueInvoices = React.useMemo(() => {
    if (!recentShopSales) return [];
    return (recentShopSales as any[])
      .filter((sale) => {
        if (sale.channel === "VAN") return false;
        if (sale.channel === "SHOP") {
          return sale.items?.some((item: any) => {
            const packSize = Math.max(1, item.product?.packSize || 1);
            return packSize > 1 && Math.floor(item.qty / packSize) > 0;
          });
        }
        return true;
      })
      .map((sale) => {
        if (sale.channel === "SHOP") {
          const cartonItems = (sale.items || []).filter((item: any) => {
            const packSize = Math.max(1, item.product?.packSize || 1);
            return packSize > 1 && Math.floor(item.qty / packSize) > 0;
          });
          return { ...sale, items: cartonItems };
        }
        return sale;
      });
  }, [recentShopSales]);

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

  const handleUpdatePackingStatus = async (
    target: { pickupId?: string; invoiceId?: string },
    status: "PENDING" | "PACKING" | "PACKED" | "COMPLETED"
  ) => {
    setIsSubmitting(true);
    setMessage(null);
    const res = await updatePackingStatusAction({
      pickupId: target.pickupId,
      invoiceId: target.invoiceId,
      status,
    });
    setIsSubmitting(false);

    if (res.error) {
      setMessage({ type: "error", text: res.error });
    } else {
      const statusLabels = {
        PENDING: "Order reset to Pending packing",
        PACKING: "Packing started! Status updated to In Progress",
        PACKED: "Marked as Packed & Ready for Pickup!",
        COMPLETED: "Handed over successfully!",
      };
      setMessage({ type: "success", text: statusLabels[status] });
    }
  };

  const toggleCheckItem = (key: string) => {
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
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
          Live Packing &amp; Shop Queue ({recentShopSales.filter((s: any) => {
            const st = getPackingState(s);
            return st.status === "PENDING" || st.status === "PACKING";
          }).length} to pack)
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

      {/* Tab 5: Warehouse Live Packing Queue & Shop Feed */}
      {activeTab === "shop-sales" && (
        <div className="space-y-6">
          {/* Header & Filter Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Package className="h-6 w-6 text-maroon-800" />
                Live Warehouse Packing &amp; Dispatch Queue
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Bills generated at POS / Shop automatically appear here. Review products, pack cartons/loose pieces, and update fulfillment status.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold shadow-sm transition"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh Feed
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="font-bold text-gray-600 mr-1">Status Filter:</span>
            <button
              type="button"
              onClick={() => setPackingFilter("ALL")}
              className={`px-3 py-1 rounded-full font-bold transition ${
                packingFilter === "ALL"
                  ? "bg-maroon-800 text-white shadow-sm"
                  : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              All ({warehouseQueueInvoices.length})
            </button>
            <button
              type="button"
              onClick={() => setPackingFilter("PENDING")}
              className={`px-3 py-1 rounded-full font-bold transition ${
                packingFilter === "PENDING"
                  ? "bg-amber-500 text-gray-900 shadow-sm ring-1 ring-amber-600"
                  : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200"
              }`}
            >
              🟡 Needs Packing ({warehouseQueueInvoices.filter((s: any) => getPackingState(s).status === "PENDING").length})
            </button>
            <button
              type="button"
              onClick={() => setPackingFilter("PACKING")}
              className={`px-3 py-1 rounded-full font-bold transition ${
                packingFilter === "PACKING"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200"
              }`}
            >
              🔵 Packing In Progress ({warehouseQueueInvoices.filter((s: any) => getPackingState(s).status === "PACKING").length})
            </button>
            <button
              type="button"
              onClick={() => setPackingFilter("PACKED")}
              className={`px-3 py-1 rounded-full font-bold transition ${
                packingFilter === "PACKED"
                  ? "bg-purple-700 text-white shadow-sm"
                  : "bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200"
              }`}
            >
              🟣 Packed &amp; Ready ({warehouseQueueInvoices.filter((s: any) => getPackingState(s).status === "PACKED").length})
            </button>
            <button
              type="button"
              onClick={() => setPackingFilter("COMPLETED")}
              className={`px-3 py-1 rounded-full font-bold transition ${
                packingFilter === "COMPLETED"
                  ? "bg-emerald-700 text-white shadow-sm"
                  : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
              }`}
            >
              🟢 Handed Over ({warehouseQueueInvoices.filter((s: any) => getPackingState(s).status === "COMPLETED").length})
            </button>
          </div>

          {/* Packing Orders Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {warehouseQueueInvoices.filter((s: any) => {
                if (packingFilter === "ALL") return true;
                return getPackingState(s).status === packingFilter;
              }).length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
                  <Package className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                  <p className="font-semibold text-gray-700">No orders matching this filter</p>
                  <p className="text-xs text-gray-400 mt-1">Switch filter to &apos;All&apos; or wait for new bills from the shop</p>
                </div>
              ) : (
                warehouseQueueInvoices
                  .filter((s: any) => {
                    if (packingFilter === "ALL") return true;
                    return getPackingState(s).status === packingFilter;
                  })
                  .map((sale: any) => {
                    const packingState = getPackingState(sale);
                    const pickup = sale.counterPickups?.[0];

                    return (
                      <div
                        key={sale.id}
                        className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${
                          packingState.status === "PENDING"
                            ? "border-amber-300 ring-1 ring-amber-100"
                            : packingState.status === "PACKING"
                            ? "border-blue-300 ring-1 ring-blue-100"
                            : packingState.status === "PACKED"
                            ? "border-purple-300 ring-1 ring-purple-100"
                            : "border-gray-200"
                        }`}
                      >
                        {/* Order Card Header */}
                        <div className="p-4 bg-gray-50/70 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-sm text-maroon-900 bg-maroon-50 px-2.5 py-1 rounded border border-maroon-200">
                              {sale.number}
                            </span>
                            <div>
                              <div className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                                <span>{sale.party?.name || "Walk-in Retail Customer"}</span>
                                {sale.party?.phone && (
                                  <span className="text-xs text-gray-500 font-normal">({sale.party.phone})</span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                                <span>Cashier: <strong className="text-gray-700">{sale.creator?.name || "Cashier"}</strong></span>
                                <span>•</span>
                                <span>{new Date(sale.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold border ${packingState.badgeClass}`}
                            >
                              {packingState.label}
                            </span>
                            <div className="text-right">
                              <div className="font-bold text-sm text-gray-900">
                                ₹{(sale.totalPaise / 100).toFixed(2)}
                              </div>
                              <div className="text-[11px] text-gray-500">{sale.items.length} items</div>
                            </div>
                          </div>
                        </div>

                        {/* Items Checklist & Packing Breakdown */}
                        <div className="p-4 space-y-3">
                          <div className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center justify-between border-b pb-2">
                            <span>Packing Checklist (Item &amp; Carton Breakdown)</span>
                            <span className="text-gray-400 font-normal lowercase">check off items as you pack</span>
                          </div>

                          <div className="divide-y divide-gray-100">
                            {sale.items.map((item: any) => {
                              const checkKey = `${sale.id}_${item.productId}`;
                              const isChecked = !!checkedItems[checkKey] || packingState.status === "PACKED" || packingState.status === "COMPLETED";

                              return (
                                <div
                                  key={item.id}
                                  onClick={() => toggleCheckItem(checkKey)}
                                  className={`py-2.5 px-2 flex items-center justify-between rounded-lg cursor-pointer transition ${
                                    isChecked ? "bg-emerald-50/60" : "hover:bg-gray-50"
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {}}
                                      className="h-4 w-4 rounded text-maroon-800 focus:ring-maroon-800 border-gray-300 cursor-pointer"
                                    />
                                    <div>
                                      <div className={`text-sm font-semibold ${isChecked ? "text-gray-500 line-through" : "text-gray-900"}`}>
                                        {item.product?.name || item.productId}
                                      </div>
                                      <div className="text-xs text-gray-400 font-mono flex items-center gap-2 mt-0.5">
                                        <span>Code: {item.product?.shortCode || item.product?.sku || "N/A"}</span>
                                        {item.product?.packSize > 1 && <span>• {item.product.packSize} pcs/{item.product.packLabel || "Carton"}</span>}
                                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                          Fulfilled from: Godown
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="text-right">
                                    {renderPackBreakdown(
                                      item.qty,
                                      item.product?.packSize || 1,
                                      item.product?.packLabel || "Carton"
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Order Card Footer Actions */}
                        <div className="p-3 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            {packingState.status === "PENDING" && (
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() =>
                                  handleUpdatePackingStatus(
                                    { invoiceId: sale.id, pickupId: pickup?.id },
                                    "PACKING"
                                  )
                                }
                                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                              >
                                <span>▶</span> Start Packing
                              </button>
                            )}

                            {packingState.status === "PACKING" && (
                              <>
                                <button
                                  type="button"
                                  disabled={isSubmitting}
                                  onClick={() =>
                                    handleUpdatePackingStatus(
                                      { invoiceId: sale.id, pickupId: pickup?.id },
                                      "PACKED"
                                    )
                                  }
                                  className="px-3.5 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                                >
                                  <span>✓</span> Mark Packed &amp; Ready
                                </button>
                                <button
                                  type="button"
                                  disabled={isSubmitting}
                                  onClick={() =>
                                    handleUpdatePackingStatus(
                                      { invoiceId: sale.id, pickupId: pickup?.id },
                                      "PENDING"
                                    )
                                  }
                                  className="px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium"
                                >
                                  ↺ Reset
                                </button>
                              </>
                            )}

                            {packingState.status === "PACKED" && (
                              <>
                                <button
                                  type="button"
                                  disabled={isSubmitting}
                                  onClick={() =>
                                    handleUpdatePackingStatus(
                                      { invoiceId: sale.id, pickupId: pickup?.id },
                                      "COMPLETED"
                                    )
                                  }
                                  className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                                >
                                  <span>🚀</span> Hand Over / Complete
                                </button>
                                <button
                                  type="button"
                                  disabled={isSubmitting}
                                  onClick={() =>
                                    handleUpdatePackingStatus(
                                      { invoiceId: sale.id, pickupId: pickup?.id },
                                      "PACKING"
                                    )
                                  }
                                  className="px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium"
                                >
                                  ↺ Back to Packing
                                </button>
                              </>
                            )}

                            {packingState.status === "COMPLETED" && (
                              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg flex items-center gap-1">
                                <span>✓</span> Handed Over &amp; Completed
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <a
                              href={`/shop/invoices/${sale.id}/print?format=thermal`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold shadow-sm transition"
                            >
                              <span>🖨</span> Print Slip
                            </a>
                            <Link
                              href={`/shop/invoices/${sale.id}`}
                              className="text-xs text-maroon-800 hover:underline font-semibold"
                            >
                              View Bill →
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Shop Stock Panel & Restock Suggestions */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4 h-fit">
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
        </div>
      )}
    </div>
  );
}
