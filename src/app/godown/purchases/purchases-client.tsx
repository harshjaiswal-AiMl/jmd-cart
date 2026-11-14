"use client";

import React, { useState, useTransition, useEffect, useRef, useMemo } from "react";
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
  Printer,
  ChevronDown,
  HelpCircle,
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
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "RECEIVED" | "CANCELLED">("ALL");

  // Selected row index for keyboard navigation
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(0);

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
  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.billNo.toLowerCase().includes(q) ||
        (p.supplier?.name || "").toLowerCase().includes(q) ||
        p.location.name.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "ALL" ? true : p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [purchases, searchTerm, statusFilter]);

  // Adjust selected row index when list changes
  useEffect(() => {
    if (selectedRowIndex >= filteredPurchases.length) {
      setSelectedRowIndex(Math.max(0, filteredPurchases.length - 1));
    }
  }, [filteredPurchases.length, selectedRowIndex]);

  // Totals for filtered register
  const filteredTotals = useMemo(() => {
    let totalPaise = 0;
    let totalPieces = 0;
    for (const p of filteredPurchases) {
      if (p.status === "RECEIVED") {
        totalPaise += p.totalPaise;
        totalPieces += p.items.reduce((acc, it) => acc + it.qty, 0);
      }
    }
    return {
      count: filteredPurchases.length,
      activeCount: filteredPurchases.filter((p) => p.status === "RECEIVED").length,
      cancelledCount: filteredPurchases.filter((p) => p.status === "CANCELLED").length,
      totalPaise,
      totalPieces,
    };
  }, [filteredPurchases]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA";

      // If modal is open, let modal handle its own Esc
      if (selectedPurchase || editPurchase || voidPurchase) {
        if (e.key === "Escape") {
          setSelectedPurchase(null);
          setEditPurchase(null);
          setVoidPurchase(null);
        }
        return;
      }

      if (e.key === "ArrowDown") {
        if (!isInput) {
          e.preventDefault();
          setSelectedRowIndex((prev) => Math.min(filteredPurchases.length - 1, prev + 1));
        }
      } else if (e.key === "ArrowUp") {
        if (!isInput) {
          e.preventDefault();
          setSelectedRowIndex((prev) => Math.max(0, prev - 1));
        }
      } else if (e.key === "Enter") {
        if (!isInput && filteredPurchases[selectedRowIndex]) {
          e.preventDefault();
          setSelectedPurchase(filteredPurchases[selectedRowIndex]);
        }
      } else if (e.key === "n" || e.key === "N" || e.key === "F3") {
        if (!isInput) {
          e.preventDefault();
          router.push("/godown/purchases/new");
        }
      } else if (e.key === "/") {
        if (!isInput) {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      } else if (e.key === "f" || e.key === "F") {
        if (!isInput) {
          e.preventDefault();
          setStatusFilter((prev) =>
            prev === "ALL" ? "RECEIVED" : prev === "RECEIVED" ? "CANCELLED" : "ALL"
          );
        }
      } else if (e.key === "p" || e.key === "P") {
        if (!isInput && filteredPurchases[selectedRowIndex]) {
          e.preventDefault();
          setSelectedPurchase(filteredPurchases[selectedRowIndex]);
          setTimeout(() => window.print(), 200);
        }
      } else if (e.key === "Escape") {
        if (searchTerm) {
          setSearchTerm("");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedRowIndex, filteredPurchases, selectedPurchase, editPurchase, voidPurchase, router, searchTerm]);

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
    <div className="flex flex-col h-[calc(100vh-64px)] max-h-screen bg-slate-100 font-sans select-none overflow-hidden text-slate-900">
      {/* 1. Header Toolbar */}
      <div className="bg-[#0f172a] text-white px-4 py-2 flex items-center justify-between border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs bg-red-700 text-white px-2 py-0.5 rounded font-black tracking-wider">
              REGISTER
            </span>
            <h1 className="font-bold text-sm tracking-tight text-white flex items-center gap-2">
              Goods Receipt Register (GRN)
              <span className="text-xs font-normal text-slate-400">
                (Incoming Supplier Invoices)
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/godown/purchases/bill-scan"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-700 bg-slate-800 text-xs font-bold text-slate-200 hover:bg-slate-700 transition"
          >
            <Camera className="w-3.5 h-3.5 text-sky-400" />
            Scan Bill (OCR)
          </Link>
          <Link
            href="/godown/purchases/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-black text-white shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            + New GRN [F3 / N]
          </Link>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="bg-white border-b border-slate-300 px-4 py-2 shrink-0 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Bill No, Supplier, or Location... [/]"
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium bg-slate-50 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-0.5 rounded border border-slate-200">
          {(["ALL", "RECEIVED", "CANCELLED"] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded text-xs font-bold transition ${
                statusFilter === st
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {st === "ALL" ? "All Receipts" : st === "RECEIVED" ? "Active" : "Cancelled"}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications */}
      {message && (
        <div
          className={`px-4 py-2 border-b text-xs flex items-center justify-between shrink-0 font-medium ${
            message.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. Register Table */}
      <div className="flex-1 overflow-auto bg-white">
        {filteredPurchases.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FileText className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-600">No purchase receipts found.</p>
            <Link
              href="/godown/purchases/new"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              Create a new Goods Receipt Note [N]
            </Link>
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-[#f1f5f9] text-slate-700 uppercase tracking-wider font-extrabold sticky top-0 z-10 border-b-2 border-slate-300">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center border-r border-slate-200">#</th>
                <th className="py-2.5 px-3 border-r border-slate-200">Bill / Invoice No.</th>
                <th className="py-2.5 px-3 border-r border-slate-200">Supplier Name</th>
                <th className="py-2.5 px-3 border-r border-slate-200">Destination</th>
                <th className="py-2.5 px-3 text-center border-r border-slate-200">Items / Qty</th>
                <th className="py-2.5 px-3 text-right border-r border-slate-200">Total Amount (₹)</th>
                <th className="py-2.5 px-3 text-center border-r border-slate-200">Status</th>
                <th className="py-2.5 px-3 border-r border-slate-200">Bill Date</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredPurchases.map((p, idx) => {
                const isSelected = idx === selectedRowIndex;
                const isCancelled = p.status === "CANCELLED";
                const totalUnits = p.items.reduce((s, it) => s + it.qty, 0);

                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedRowIndex(idx)}
                    onDoubleClick={() => setSelectedPurchase(p)}
                    className={`transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-amber-100/70 border-l-4 border-l-blue-600 font-medium"
                        : isCancelled
                        ? "bg-red-50/40 text-slate-500 hover:bg-red-50/70"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="py-2 px-3 text-center font-mono text-slate-500 border-r border-slate-200">
                      {idx + 1}
                    </td>

                    <td className="py-2 px-3 font-mono font-bold text-slate-900 border-r border-slate-200">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span>{p.billNo}</span>
                        {p.billScanId && (
                          <span className="px-1 py-0.2 text-[9px] font-bold rounded-sm bg-purple-100 text-purple-700 border border-purple-200">
                            OCR
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-2 px-3 font-medium text-slate-800 border-r border-slate-200">
                      <div className="flex items-center gap-1.5 truncate max-w-xs">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{p.supplier?.name || "Direct / Unlisted"}</span>
                      </div>
                    </td>

                    <td className="py-2 px-3 border-r border-slate-200">
                      <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {p.location.name}
                      </span>
                    </td>

                    <td className="py-2 px-3 text-center border-r border-slate-200">
                      <span className="font-bold">{p.items.length} lines</span>{" "}
                      <span className="text-slate-400 font-mono">({totalUnits} pcs)</span>
                    </td>

                    <td className="py-2 px-3 text-right font-mono font-black text-slate-900 border-r border-slate-200">
                      ₹{(p.totalPaise / 100).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>

                    <td className="py-2 px-3 text-center border-r border-slate-200">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
                          isCancelled
                            ? "bg-red-100 text-red-800 border border-red-200"
                            : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>

                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap border-r border-slate-200">
                      <div className="flex items-center gap-1 font-mono text-[11px]">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>
                          {new Date(p.billDate).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </td>

                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPurchase(p);
                          }}
                          className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="View Details [Enter]"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {!isCancelled && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(p);
                            }}
                            className="p-1 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded"
                            title="Edit Bill Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {!isCancelled && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setVoidPurchase(p);
                              setVoidReason("");
                              setMessage(null);
                            }}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Void / Cancel GRN"
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
        )}
      </div>

      {/* 4. Bottom Totals Summary Bar */}
      <div className="bg-white border-t border-slate-300 px-4 py-2 shrink-0 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-6 text-xs text-slate-600">
          <div>
            Total Records: <strong className="font-mono text-slate-900">{filteredTotals.count}</strong> (Active: {filteredTotals.activeCount}, Cancelled: {filteredTotals.cancelledCount})
          </div>
          <div>
            Total Stock In: <strong className="font-mono text-slate-900">{filteredTotals.totalPieces.toLocaleString("en-IN")} pcs</strong>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] font-bold uppercase text-slate-500 mr-2">
            Filtered Total Value:
          </span>
          <span className="text-base sm:text-lg font-black font-mono text-slate-900">
            ₹{(filteredTotals.totalPaise / 100).toLocaleString("en-IN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      </div>

      {/* 5. Function-Key Footer */}
      <div className="bg-[#0f172a] text-slate-400 text-[11px] px-4 py-1.5 flex items-center justify-between border-t border-slate-800 shrink-0 font-mono">
        <div className="flex items-center gap-3 overflow-x-auto">
          <span><strong className="text-sky-400">[↑/↓]</strong> Navigate</span>
          <span><strong className="text-sky-400">[Enter]</strong> View Details</span>
          <span><strong className="text-sky-400">[N / F3]</strong> New GRN</span>
          <span><strong className="text-sky-400">[/]</strong> Focus Search</span>
          <span><strong className="text-sky-400">[F]</strong> Toggle Filter</span>
          <span><strong className="text-sky-400">[P]</strong> Print Voucher</span>
          <span><strong className="text-sky-400">[Esc]</strong> Clear Search</span>
        </div>
        <div className="text-slate-500 shrink-0 text-[10px]">
          Row {selectedRowIndex + 1} of {filteredPurchases.length}
        </div>
      </div>

      {/* View Details Modal */}
      {selectedPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs font-sans">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-400" />
                  GRN Details: {selectedPurchase.billNo}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Supplier: {selectedPurchase.supplier?.name || "Direct / Unlisted"} &bull; Destination: {selectedPurchase.location.name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-white rounded border border-slate-700 flex items-center gap-1 font-mono font-bold"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print [P]
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPurchase(null)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Items Content */}
            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 font-medium">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Status</span>
                  <p className="font-bold text-slate-900 mt-0.5">{selectedPurchase.status}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Bill Date</span>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {new Date(selectedPurchase.billDate).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Total Amount</span>
                  <p className="font-mono font-black text-sm text-slate-900 mt-0.5">
                    ₹{(selectedPurchase.totalPaise / 100).toFixed(2)}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-2">
                  Received Items ({selectedPurchase.items.length})
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2 px-3">Product</th>
                        <th className="py-2 px-2 text-center">Qty (Pcs)</th>
                        <th className="py-2 px-2 text-right">Rate (₹)</th>
                        <th className="py-2 px-2 text-center">GST</th>
                        <th className="py-2 px-3 text-right">Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {selectedPurchase.items.map((it) => {
                        const taxable = (it.qty * it.ratePaise) / 100;
                        const tax = taxable * ((it.gstRateBp || 0) / 10000);
                        const lineTotal = taxable + tax;
                        return (
                          <tr key={it.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-medium">
                              <span className="font-mono text-blue-700 font-bold mr-1">
                                {it.product?.shortCode}
                              </span>
                              {it.product?.name || it.productId}
                            </td>
                            <td className="py-2 px-2 text-center font-mono font-bold">{it.qty}</td>
                            <td className="py-2 px-2 text-right font-mono">
                              ₹{(it.ratePaise / 100).toFixed(2)}
                            </td>
                            <td className="py-2 px-2 text-center">{(it.gstRateBp || 0) / 100}%</td>
                            <td className="py-2 px-3 text-right font-mono font-bold">
                              ₹{lineTotal.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedPurchase(null)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded text-xs font-bold"
              >
                Close [Esc]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs font-sans">
          <form
            onSubmit={handleSaveEdit}
            className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-md w-full overflow-hidden"
          >
            <div className="p-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Edit GRN Bill #{editPurchase.billNo}</h3>
              <button
                type="button"
                onClick={() => setEditPurchase(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Supplier Bill No</label>
                <input
                  type="text"
                  required
                  value={editBillNo}
                  onChange={(e) => setEditBillNo(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Bill Date</label>
                <input
                  type="date"
                  required
                  value={editBillDate}
                  onChange={(e) => setEditBillDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Supplier</label>
                <select
                  value={editSupplierId}
                  onChange={(e) => setEditSupplierId(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                >
                  <option value="">-- Direct / Unlisted Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditPurchase(null)}
                className="px-3 py-1.5 border border-slate-300 rounded text-xs font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Void Modal */}
      {voidPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs font-sans">
          <form
            onSubmit={handleConfirmVoid}
            className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-sm w-full overflow-hidden p-5 space-y-4"
          >
            <div className="flex items-center gap-2 text-red-600 font-bold text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Cancel / Void GRN #{voidPurchase.billNo}</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Cancelling this GRN will create compensating movements to reverse stock out of {voidPurchase.location.name} and adjust the supplier ledger.
            </p>
            <div>
              <label className="block font-bold text-slate-700 mb-1 text-xs">Reason for cancellation *</label>
              <input
                type="text"
                required
                placeholder="e.g. Returned to supplier / wrong invoice"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-medium"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setVoidPurchase(null)}
                className="px-3 py-1.5 border border-slate-300 rounded text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Keep Active
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold disabled:opacity-50"
              >
                {isPending ? "Cancelling..." : "Confirm Cancellation"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
