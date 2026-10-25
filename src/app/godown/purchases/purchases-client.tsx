"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cancelPurchaseAction, updatePurchaseAction } from "./actions";
import {
  Search,
  Plus,
  FileText,
  AlertTriangle,
  Edit2,
  Trash2,
  X,
  CheckCircle2,
  Calendar,
  Building2,
  Package,
  Eye,
  Camera,
} from "lucide-react";

interface SupplierOption {
  id: string;
  name: string;
}

interface PurchaseItemData {
  id: string;
  productId: string;
  qty: number;
  billedQty: number | null;
  acceptedQty: number | null;
  varianceReason: string | null;
  ratePaise: number;
  gstRateBp: number;
  product?: {
    id: string;
    name: string;
    shortCode: string;
    packSize?: number;
    unitType?: string;
  };
}

interface PurchaseData {
  id: string;
  billNo: string;
  billDate: string | Date;
  locationId: string;
  totalPaise: number;
  status: string;
  billScanId?: string | null;
  billTotalPaise?: number | null;
  createdAt: string | Date;
  supplier?: {
    id: string;
    name: string;
    phone?: string | null;
  } | null;
  location: {
    id: string;
    name: string;
  };
  creator?: {
    id: string;
    name: string | null;
  } | null;
  items: PurchaseItemData[];
}

interface PurchasesClientProps {
  purchases: PurchaseData[];
  suppliers: SupplierOption[];
  userRole?: string;
}

export function PurchasesClient({
  purchases,
  suppliers,
  userRole,
}: PurchasesClientProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "RECEIVED" | "CANCELLED">("ALL");

  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseData | null>(null);
  const [editPurchase, setEditPurchase] = useState<PurchaseData | null>(null);
  const [voidPurchase, setVoidPurchase] = useState<PurchaseData | null>(null);

  // Edit form state
  const [editBillNo, setEditBillNo] = useState("");
  const [editBillDate, setEditBillDate] = useState("");
  const [editSupplierId, setEditSupplierId] = useState("");

  // Void form state
  const [voidReason, setVoidReason] = useState("");

  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filter purchases
  const filteredPurchases = purchases.filter((p) => {
    const matchesSearch =
      p.billNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.supplier?.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.location.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "ALL" ? true : p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalValuePaise = purchases
    .filter((p) => p.status === "RECEIVED")
    .reduce((sum, p) => sum + p.totalPaise, 0);

  const totalItemsCount = purchases
    .filter((p) => p.status === "RECEIVED")
    .reduce((sum, p) => sum + p.items.reduce((s, it) => s + it.qty, 0), 0);

  const openEditModal = (p: PurchaseData) => {
    setEditPurchase(p);
    setEditBillNo(p.billNo);
    const d = new Date(p.billDate);
    setEditBillDate(d.toISOString().split("T")[0]);
    setEditSupplierId(p.supplier?.id || "");
    setMessage(null);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPurchase) return;
    setMessage(null);

    startTransition(async () => {
      const res = await updatePurchaseAction(editPurchase.id, {
        billNo: editBillNo,
        billDate: editBillDate,
        supplierId: editSupplierId || null,
      });

      if (!res.success) {
        setMessage({ type: "error", text: res.error || "Failed to update purchase" });
      } else {
        setMessage({ type: "success", text: "Purchase receipt updated successfully." });
        setEditPurchase(null);
        router.refresh();
      }
    });
  };

  const handleConfirmVoid = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidPurchase) return;
    if (!voidReason.trim()) {
      setMessage({ type: "error", text: "Please enter a reason for cancelling this GRN." });
      return;
    }
    setMessage(null);

    startTransition(async () => {
      const res = await cancelPurchaseAction(voidPurchase.id, voidReason.trim());
      if (!res.success) {
        setMessage({ type: "error", text: res.error || "Failed to cancel purchase" });
      } else {
        setMessage({
          type: "success",
          text: `GRN #${voidPurchase.billNo} cancelled and inventory reversed safely.`,
        });
        setVoidPurchase(null);
        setVoidReason("");
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Package className="w-7 h-7 text-[#790E11]" />
            Purchase Receipts (GRN)
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Record, inspect, and manage incoming supplier inventory deliveries into Godown.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/godown/purchases/bill-scan"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-300 bg-white text-xs font-semibold text-gray-700 shadow-xs hover:bg-gray-50 transition"
          >
            <Camera className="w-4 h-4 text-gray-600" />
            Scan Bill (OCR)
          </Link>
          <Link
            href="/godown/purchases/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#790E11] text-xs font-bold text-white shadow-xs hover:bg-[#600b0e] transition"
          >
            <Plus className="w-4 h-4" />
            + Record Stock Receipt (GRN)
          </Link>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Received Notes</p>
          <p className="text-2xl font-bold text-gray-900 mt-1 font-mono">
            {purchases.filter((p) => p.status === "RECEIVED").length}
          </p>
          <span className="text-[11px] text-gray-400">active goods receipts</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value (Active)</p>
          <p className="text-2xl font-bold text-[#790E11] mt-1 font-mono">
            ₹{(totalValuePaise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-gray-400">supplier cost total</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Pieces Received</p>
          <p className="text-2xl font-bold text-gray-900 mt-1 font-mono">
            {totalItemsCount.toLocaleString("en-IN")} pcs
          </p>
          <span className="text-[11px] text-gray-400">added into godown stock</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Cancelled / Voided</p>
          <p className="text-2xl font-bold text-amber-600 mt-1 font-mono">
            {purchases.filter((p) => p.status === "CANCELLED").length}
          </p>
          <span className="text-[11px] text-gray-400">reversed movements</span>
        </div>
      </div>

      {/* Notifications */}
      {message && (
        <div
          className={`p-3.5 rounded-xl border text-sm flex items-center justify-between ${
            message.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search, Filter & Controls */}
      <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Bill No, Supplier, or Location..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#790E11] focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-lg">
          {(["ALL", "RECEIVED", "CANCELLED"] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                statusFilter === st
                  ? "bg-white text-gray-900 shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {st === "ALL" ? "All Receipts" : st === "RECEIVED" ? "Active" : "Cancelled"}
            </button>
          ))}
        </div>
      </div>

      {/* Purchases Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Purchase Receipts List ({filteredPurchases.length})
          </span>
          <span className="text-xs text-gray-400">Sorted by newest receipt</span>
        </div>

        {filteredPurchases.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FileText className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="text-sm font-medium text-gray-500">No purchase receipts found.</p>
            <Link
              href="/godown/purchases/new"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#790E11] hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              Create your first GRN
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-xs">
              <thead className="bg-gray-50 text-gray-600 uppercase font-bold tracking-wider text-left">
                <tr>
                  <th className="px-4 py-3">Bill / Invoice #</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Destination</th>
                  <th className="px-4 py-3 text-center">Items Received</th>
                  <th className="px-4 py-3 text-right">Total Amount (₹)</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Bill Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPurchases.map((p) => {
                  const isCancelled = p.status === "CANCELLED";
                  const totalUnits = p.items.reduce((s, it) => s + it.qty, 0);

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-gray-50/75 transition ${
                        isCancelled ? "bg-red-50/30 opacity-75" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 font-mono">
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-gray-400" />
                          <span className="font-bold">{p.billNo}</span>
                          {p.billScanId && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-sm bg-purple-100 text-purple-700">
                              OCR
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 font-medium text-gray-800">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span>{p.supplier?.name || "Direct / Unlisted"}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-gray-600">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700">
                          {p.location.name}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center text-gray-700">
                        <span className="font-semibold">{p.items.length} lines</span>{" "}
                        <span className="text-gray-400">({totalUnits} pcs)</span>
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">
                        ₹{(p.totalPaise / 100).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
                            isCancelled
                              ? "bg-red-100 text-red-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          <span>
                            {new Date(p.billDate).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* View button */}
                          <button
                            type="button"
                            onClick={() => setSelectedPurchase(p)}
                            className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition"
                            title="View receipt details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit button */}
                          {!isCancelled && (
                            <button
                              type="button"
                              onClick={() => openEditModal(p)}
                              className="p-1.5 text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded-md transition"
                              title="Edit Bill Details"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete/Void button */}
                          {!isCancelled && (
                            <button
                              type="button"
                              onClick={() => {
                                setVoidPurchase(p);
                                setVoidReason("");
                                setMessage(null);
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                              title="Void / Cancel GRN and reverse stock"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Details Drawer / Modal */}
      {selectedPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/75">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Package className="w-5 h-5 text-[#790E11]" />
                  Purchase Receipt Details: {selectedPurchase.billNo}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Supplier: {selectedPurchase.supplier?.name || "Direct / Unlisted"} | Destination: {selectedPurchase.location.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPurchase(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
                <div>
                  <span className="text-gray-400 text-[10px] uppercase font-bold">Status</span>
                  <p className="font-bold text-gray-900 mt-0.5">{selectedPurchase.status}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] uppercase font-bold">Bill Date</span>
                  <p className="font-bold text-gray-900 mt-0.5">
                    {new Date(selectedPurchase.billDate).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] uppercase font-bold">Total Amount</span>
                  <p className="font-mono font-bold text-[#790E11] mt-0.5">
                    ₹{(selectedPurchase.totalPaise / 100).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Items List */}
              <div className="border border-gray-200 rounded-xl overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100 text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="px-3 py-2 text-left">Product</th>
                      <th className="px-3 py-2 text-center">Billed Qty</th>
                      <th className="px-3 py-2 text-center">Received Qty</th>
                      <th className="px-3 py-2 text-right">Rate (₹)</th>
                      <th className="px-3 py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedPurchase.items.map((item, idx) => {
                      const rate = item.ratePaise / 100;
                      const lineTotal = (item.qty * item.ratePaise) / 100;
                      const packSize = item.product?.packSize || 1;
                      const cartons = Math.floor(item.qty / packSize);
                      const loose = item.qty % packSize;

                      return (
                        <tr key={item.id || idx}>
                          <td className="px-3 py-2.5">
                            <p className="font-semibold text-gray-900">
                              {item.product?.name || `Product #${item.productId}`}
                            </p>
                            <p className="text-[10px] text-gray-400 font-mono">
                              SKU: {item.product?.shortCode || "N/A"} | Pack: {packSize} pcs/ctn
                            </p>
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono text-gray-600">
                            {item.billedQty != null ? `${item.billedQty} pcs` : "-"}
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono font-bold text-gray-900">
                            {item.qty} pcs
                            {packSize > 1 && (
                              <span className="block text-[10px] text-gray-500 font-normal">
                                ({cartons}c + {loose}p)
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-gray-700">
                            ₹{rate.toFixed(2)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-gray-900">
                            ₹{lineTotal.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3.5 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedPurchase(null)}
                className="px-4 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Bill Modal */}
      {editPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/75">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-600" />
                Edit Purchase Bill Details
              </h3>
              <button
                type="button"
                onClick={() => setEditPurchase(null)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Bill / Invoice # <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editBillNo}
                  onChange={(e) => setEditBillNo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#790E11]"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Bill Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={editBillDate}
                  onChange={(e) => setEditBillDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#790E11]"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Supplier / Company
                </label>
                <select
                  value={editSupplierId}
                  onChange={(e) => setEditSupplierId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#790E11]"
                >
                  <option value="">-- Direct / Unlisted --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditPurchase(null)}
                  className="px-3.5 py-2 rounded-lg border border-gray-300 font-semibold text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-lg bg-[#790E11] text-white font-bold hover:bg-[#600b0e] disabled:opacity-50"
                >
                  {isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Void Confirmation Modal */}
      {voidPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-red-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-red-100 flex items-center justify-between bg-red-50">
              <h3 className="text-sm font-bold text-red-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Void / Cancel Purchase GRN
              </h3>
              <button
                type="button"
                onClick={() => setVoidPurchase(null)}
                className="p-1 text-red-400 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmVoid} className="p-4 space-y-3.5 text-xs">
              <div className="bg-red-50/70 p-3 rounded-xl border border-red-200 text-red-800 leading-relaxed">
                <p className="font-bold">⚠️ Warning: Immutable Ledger Reversal</p>
                <p className="mt-1">
                  Voiding Bill <strong>#{voidPurchase.billNo}</strong> will post compensating
                  movements deducting all received items (
                  <strong>{voidPurchase.items.reduce((s, it) => s + it.qty, 0)} pieces</strong>)
                  from <strong>{voidPurchase.location.name}</strong> inventory.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Reason for Cancellation <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="e.g. Duplicate bill entered / Wrong supplier invoice / Delivery rejected..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setVoidPurchase(null)}
                  className="px-3.5 py-2 rounded-lg border border-gray-300 font-semibold text-gray-700 hover:bg-gray-100"
                >
                  Keep GRN
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50"
                >
                  {isPending ? "Voiding & Reversing..." : "Confirm Void GRN"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
