"use client";

import React, { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { InvoiceWithDetails } from "@/modules/billing/billing.types";
import { formatDmy, toIstDateString } from "@/lib/datetime";
import { previewInvoiceEditAction, modifyInvoiceAction } from "../../actions";
import { InvoiceEditPreview } from "@/modules/billing/invoice-edit.service";
import { searchItems } from "@/lib/search/smart-search";
import {
  ArrowLeft,
  Calendar,
  Save,
  Trash2,
  Plus,
  Search,
  History,
  CheckCircle,
  AlertTriangle,
  FileText,
  User,
  Tag,
} from "lucide-react";

interface ProductOption {
  id: string;
  name: string;
  shortCode: string;
  weight: string | null;
  weightValue: number | null;
  weightUnit: string | null;
  bagSize: number | null;
  mrpPaise: number | null;
  priceAPaise: number | null;
  priceBPaise: number | null;
  priceCPaise: number | null;
  packSize: number;
  packLabel: string;
  gstRateBp: number;
  hsn: string;
}

interface PartyOption {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  creditLimitPaise: number;
}

interface EditLineItem {
  id: string; // unique key for rendering
  productId: string;
  name: string;
  shortCode: string;
  weightDisplay: string;
  packSize: number;
  bagSize: number;
  unit: "Pcs" | "Carton" | "Dozen" | "Bag";
  unitQty: number; // qty in the selected unit
  qty: number; // total quantity in integer pieces
  mrpPaise: number;
  ratePaise: number;
  discountBp: number;
  gstRateBp: number;
  lineTotalPaise: number;
}

interface InvoiceEditClientProps {
  invoice: InvoiceWithDetails;
  products: ProductOption[];
  parties: PartyOption[];
  userRole: string;
  userName: string;
}

export function InvoiceEditClient({
  invoice,
  products,
  parties,
  userRole,
  userName,
}: InvoiceEditClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"EDIT" | "HISTORY">("EDIT");

  // Party state
  const [selectedPartyId, setSelectedPartyId] = useState<string>(invoice.partyId || "");
  const [customerName, setCustomerName] = useState(invoice.customerName || "");
  const [customerPhone, setCustomerPhone] = useState(invoice.customerPhone || "");
  const [customerAddress, setCustomerAddress] = useState(invoice.customerAddress || "");

  // Date state (in YYYY-MM-DD for native input)
  const initialDateStr = toIstDateString(invoice.invoiceDate || invoice.createdAt);
  const [invoiceDateStr, setInvoiceDateStr] = useState(initialDateStr);
  const [dateChangeReason, setDateChangeReason] = useState(invoice.dateChangeReason || "");

  // Items state
  const prodMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const [lines, setLines] = useState<EditLineItem[]>(() => {
    return invoice.items.map((it, idx) => {
      const prod = prodMap.get(it.productId);
      const packSize = prod?.packSize || it.product?.packSize || 1;
      const bagSize = prod?.bagSize || 1;
      const weightDisplay =
        prod?.weight || (prod?.weightValue ? `${prod.weightValue}${prod.weightUnit || "g"}` : "");

      const ratePaise = it.unitPricePaise;
      const mrpPaise = it.mrpPaise;
      const discountBp =
        mrpPaise > ratePaise ? Math.round(((mrpPaise - ratePaise) / mrpPaise) * 10000) : 0;

      return {
        id: `line_${idx}_${it.id}`,
        productId: it.productId,
        name: it.product?.name || prod?.name || "Product",
        shortCode: it.product?.shortCode || prod?.shortCode || "",
        weightDisplay,
        packSize,
        bagSize,
        unit: "Pcs",
        unitQty: it.qty,
        qty: it.qty,
        mrpPaise,
        ratePaise,
        discountBp,
        gstRateBp: it.gstRateBp,
        lineTotalPaise: ratePaise * it.qty,
      };
    });
  });

  // Autocomplete search state
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return searchItems(searchTerm, products, 8);
  }, [products, searchTerm]);

  // Handle party change
  const handlePartyChange = (pid: string) => {
    setSelectedPartyId(pid);
    if (!pid) {
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      return;
    }
    const found = parties.find((p) => p.id === pid);
    if (found) {
      setCustomerName(found.name);
      setCustomerPhone(found.phone);
      setCustomerAddress(found.address || "");
    }
  };

  // Convert unit & unitQty to integer pieces
  const calculatePieces = (
    unitQty: number,
    unit: "Pcs" | "Carton" | "Dozen" | "Bag",
    packSize: number,
    bagSize: number
  ) => {
    if (unit === "Carton") return unitQty * Math.max(1, packSize);
    if (unit === "Dozen") return unitQty * 12;
    if (unit === "Bag") return unitQty * Math.max(1, bagSize);
    return unitQty;
  };

  // Line modification handlers
  const updateLine = (id: string, updates: Partial<EditLineItem>) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const merged = { ...l, ...updates };

        // Recalculate pieces if unit or unitQty changed
        if (updates.unit !== undefined || updates.unitQty !== undefined) {
          merged.qty = calculatePieces(
            merged.unitQty,
            merged.unit,
            merged.packSize,
            merged.bagSize
          );
        }

        // Recalculate discount if rate changed
        if (updates.ratePaise !== undefined && merged.mrpPaise > 0) {
          merged.discountBp =
            merged.mrpPaise > merged.ratePaise
              ? Math.round(((merged.mrpPaise - merged.ratePaise) / merged.mrpPaise) * 10000)
              : 0;
        }

        merged.lineTotalPaise = merged.ratePaise * merged.qty;
        return merged;
      })
    );
  };

  const removeLine = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const addProductToInvoice = (prod: ProductOption) => {
    const packSize = prod.packSize || 1;
    const bagSize = prod.bagSize || 1;
    const mrpPaise = prod.mrpPaise || 0;
    const ratePaise = prod.priceAPaise || mrpPaise;
    const weightDisplay =
      prod.weight || (prod.weightValue ? `${prod.weightValue}${prod.weightUnit || "g"}` : "");

    const newLine: EditLineItem = {
      id: `line_new_${Date.now()}_${prod.id}`,
      productId: prod.id,
      name: prod.name,
      shortCode: prod.shortCode,
      weightDisplay,
      packSize,
      bagSize,
      unit: "Pcs",
      unitQty: 1,
      qty: 1,
      mrpPaise,
      ratePaise,
      discountBp: mrpPaise > ratePaise ? Math.round(((mrpPaise - ratePaise) / mrpPaise) * 10000) : 0,
      gstRateBp: prod.gstRateBp,
      lineTotalPaise: ratePaise,
    };

    setLines((prev) => [...prev, newLine]);
    setSearchTerm("");
    setSearchOpen(false);
  };

  // Grand totals
  const subtotalPaise = useMemo(
    () => lines.reduce((sum, l) => sum + l.mrpPaise * l.qty, 0),
    [lines]
  );
  const grandTotalPaise = useMemo(
    () => lines.reduce((sum, l) => sum + l.lineTotalPaise, 0),
    [lines]
  );
  const totalDiscountPaise = Math.max(0, subtotalPaise - grandTotalPaise);

  // Preview & Save Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState<InvoiceEditPreview | null>(null);
  const [editReason, setEditReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleOpenPreview = async () => {
    if (lines.length === 0) {
      alert("Invoice must have at least one line item.");
      return;
    }
    setErrorMsg(null);

    const payload = {
      invoiceId: invoice.id,
      expectedVersion: invoice.version,
      reason: editReason || "Editing invoice details",
      partyId: selectedPartyId || null,
      customerName,
      customerPhone,
      customerAddress,
      invoiceDate: invoiceDateStr,
      dateChangeReason,
      items: lines.map((l) => ({
        productId: l.productId,
        qty: l.qty,
        mrpPaise: l.mrpPaise,
        ratePaise: l.ratePaise,
        discountBp: l.discountBp,
      })),
    };

    startTransition(async () => {
      const res = await previewInvoiceEditAction(payload);
      if (res.success && res.data) {
        setPreviewData(res.data);
        setPreviewModalOpen(true);
      } else {
        setErrorMsg(res.error || "Failed to generate change preview");
      }
    });
  };

  const handleConfirmSave = async () => {
    if (!editReason || editReason.trim().length < 3) {
      setErrorMsg("A reason of at least 3 characters is mandatory to save invoice changes.");
      return;
    }

    const payload = {
      invoiceId: invoice.id,
      expectedVersion: invoice.version,
      reason: editReason.trim(),
      partyId: selectedPartyId || null,
      customerName,
      customerPhone,
      customerAddress,
      invoiceDate: invoiceDateStr,
      dateChangeReason,
      items: lines.map((l) => ({
        productId: l.productId,
        qty: l.qty,
        mrpPaise: l.mrpPaise,
        ratePaise: l.ratePaise,
        discountBp: l.discountBp,
      })),
    };

    startTransition(async () => {
      const res = await modifyInvoiceAction(payload);
      if (res.success) {
        setPreviewModalOpen(false);
        router.push(`/shop/invoices/${invoice.id}`);
        router.refresh();
      } else {
        setErrorMsg(res.error || "Failed to save invoice changes");
      }
    });
  };

  return (
    <div className="space-y-6 select-none font-sans">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href={`/shop/invoices/${invoice.id}`}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            title="Back to Invoice Details"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Edit Invoice: <span className="font-mono text-blue-700">{invoice.number}</span>
              </h1>
              <span className="px-2 py-0.5 rounded-full font-black text-[10px] uppercase bg-amber-100 text-amber-900 border border-amber-300">
                Rev {invoice.version}
              </span>
              {invoice.isRevised && (
                <span className="px-2 py-0.5 rounded-full font-black text-[10px] uppercase bg-purple-100 text-purple-900 border border-purple-300">
                  Previously Revised
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Editing leaves stock deltas, GST, and ledger entries fully auditable and consistent.
            </p>
          </div>
        </div>

        {/* Tab Switcher & Save Button */}
        <div className="flex items-center gap-2">
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setActiveTab("EDIT")}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === "EDIT"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Modify Fields
            </button>
            <button
              onClick={() => setActiveTab("HISTORY")}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === "HISTORY"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <History className="w-3.5 h-3.5 text-blue-600" />
              <span>Revision History ({invoice.revisions?.length || 0})</span>
            </button>
          </div>

          {activeTab === "EDIT" && (
            <button
              onClick={handleOpenPreview}
              disabled={isPending}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-2 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>Preview & Save</span>
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-red-50 border-2 border-red-300 rounded-xl text-red-800 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {activeTab === "HISTORY" ? (
        /* Revision History View */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            <span>Audit Trail & Revision History</span>
          </h2>

          {!invoice.revisions || invoice.revisions.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No revisions have been made to this invoice yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {invoice.revisions.map((rev) => (
                <div key={rev.id} className="py-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs bg-blue-100 text-blue-900 px-2.5 py-0.5 rounded-full">
                      Revision #{rev.revisionNumber}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {formatDmy(rev.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-800 font-semibold">
                    Reason: <span className="font-normal italic">&quot;{rev.reason}&quot;</span>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Modified by: <strong>{rev.editor?.name || "Staff"}</strong> ({rev.editor?.role || "USER"})
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Interactive Edit Form */
        <div className="space-y-6">
          {/* Party & Customer Strip */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <label className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                <User className="w-4 h-4 text-blue-600" />
                <span>Customer & Party Details</span>
              </label>
              <span className="text-[11px] text-slate-400">Editable for all authorized roles</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Registered Party
                </label>
                <select
                  value={selectedPartyId}
                  onChange={(e) => handlePartyChange(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Walk-in Cash Customer</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
                  placeholder="Customer Name"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-blue-500"
                  placeholder="10-digit mobile"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Address</label>
                <input
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500"
                  placeholder="Address / Area"
                />
              </div>
            </div>
          </div>

          {/* Business Date Strip */}
          <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/80 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase text-amber-950 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-700" />
                <span>Invoice Business Date</span>
              </label>
              {invoiceDateStr !== initialDateStr && (
                <span className="text-[10px] font-black uppercase bg-amber-600 text-white px-2 py-0.5 rounded-full">
                  Date Modified
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="w-44">
                <input
                  type="date"
                  value={invoiceDateStr}
                  onChange={(e) => setInvoiceDateStr(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-white border border-amber-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex-1 min-w-[240px]">
                <input
                  type="text"
                  value={dateChangeReason}
                  onChange={(e) => setDateChangeReason(e.target.value)}
                  placeholder="Reason for backdating or modifying invoice date (required if altered)..."
                  className="w-full px-3 py-2 text-xs bg-white border border-amber-300 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
            <p className="text-[10px] text-amber-900 font-medium">
              Note: Invoice number remains gapless <span className="font-bold">{invoice.number}</span> and will not be re-ordered.
            </p>
          </div>

          {/* Items Grid & Autocomplete */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <h3 className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-emerald-600" />
                <span>Invoice Line Items</span>
              </h3>

              {/* Add Item Search */}
              <div className="relative w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Add item to invoice..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />

                {searchOpen && filteredProducts.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-56 overflow-y-auto divide-y divide-slate-100">
                    {filteredProducts.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => addProductToInvoice(p)}
                        className="p-2.5 hover:bg-emerald-50 cursor-pointer flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{p.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {p.shortCode} {p.weight && `• ${p.weight}`}
                          </div>
                        </div>
                        <div className="font-mono font-bold text-emerald-800">
                          ₹{((p.priceAPaise || p.mrpPaise || 0) / 100).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 w-8">#</th>
                    <th className="p-2.5">Product & SKU</th>
                    <th className="p-2.5 w-24">Unit</th>
                    <th className="p-2.5 w-24 text-right">Unit Qty</th>
                    <th className="p-2.5 w-24 text-right">Total Pcs</th>
                    <th className="p-2.5 w-28 text-right">MRP (₹)</th>
                    <th className="p-2.5 w-28 text-right">Rate (₹)</th>
                    <th className="p-2.5 w-24 text-right">Disc %</th>
                    <th className="p-2.5 w-28 text-right">Amount (₹)</th>
                    <th className="p-2.5 w-12 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((line, idx) => (
                    <tr key={line.id} className="hover:bg-slate-50/60 transition">
                      <td className="p-2.5 font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-2.5">
                        <div className="font-bold text-slate-900">{line.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {line.shortCode} {line.weightDisplay && `• ${line.weightDisplay}`}
                        </div>
                      </td>
                      <td className="p-2.5">
                        <select
                          value={line.unit}
                          onChange={(e) =>
                            updateLine(line.id, {
                              unit: e.target.value as "Pcs" | "Carton" | "Dozen" | "Bag",
                            })
                          }
                          className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded font-semibold text-slate-800"
                        >
                          <option value="Pcs">Pcs</option>
                          <option value="Carton">Carton ({line.packSize})</option>
                          <option value="Dozen">Dozen (12)</option>
                          {line.bagSize > 1 && (
                            <option value="Bag">Bag ({line.bagSize})</option>
                          )}
                        </select>
                      </td>
                      <td className="p-2.5 text-right">
                        <input
                          type="number"
                          min={1}
                          value={line.unitQty}
                          onChange={(e) =>
                            updateLine(line.id, {
                              unitQty: Math.max(1, parseInt(e.target.value, 10) || 1),
                            })
                          }
                          className="w-20 px-2 py-1 text-xs text-right bg-white border border-slate-300 rounded font-mono font-bold text-slate-900 focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-700">
                        {line.qty} pcs
                      </td>
                      <td className="p-2.5 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={(line.mrpPaise / 100).toFixed(2)}
                          onChange={(e) =>
                            updateLine(line.id, {
                              mrpPaise: Math.round(parseFloat(e.target.value || "0") * 100),
                            })
                          }
                          className="w-24 px-2 py-1 text-xs text-right bg-white border border-slate-300 rounded font-mono text-slate-900 focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-2.5 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={(line.ratePaise / 100).toFixed(2)}
                          onChange={(e) =>
                            updateLine(line.id, {
                              ratePaise: Math.round(parseFloat(e.target.value || "0") * 100),
                            })
                          }
                          className="w-24 px-2 py-1 text-xs text-right bg-white border border-slate-300 rounded font-mono font-bold text-emerald-800 focus:ring-1 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="p-2.5 text-right font-mono text-slate-600">
                        {(line.discountBp / 100).toFixed(1)}%
                      </td>
                      <td className="p-2.5 text-right font-mono font-black text-slate-900">
                        ₹{(line.lineTotalPaise / 100).toFixed(2)}
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Summary */}
            <div className="flex flex-col sm:flex-row items-end justify-between gap-4 pt-4 border-t border-slate-100">
              <div className="text-xs text-slate-500">
                Total Items: <strong className="text-slate-900">{lines.length}</strong> | Total Pieces:{" "}
                <strong className="text-slate-900">{lines.reduce((s, l) => s + l.qty, 0)}</strong>
              </div>

              <div className="w-72 bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Gross Total:</span>
                  <span className="font-mono">₹{(subtotalPaise / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Discount:</span>
                  <span className="font-mono">-₹{(totalDiscountPaise / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-black text-sm text-slate-900 pt-1.5 border-t border-slate-200">
                  <span>Net Payable:</span>
                  <span className="font-mono text-emerald-800">₹{(grandTotalPaise / 100).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Preview Modal */}
      {previewModalOpen && previewData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <span>Confirm Invoice Revision</span>
              </h3>
              <button
                onClick={() => setPreviewModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-black text-sm"
              >
                ✕
              </button>
            </div>

            {/* Impact Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-slate-500 font-medium">Original Total</div>
                <div className="text-base font-black font-mono text-slate-900">
                  ₹{(previewData.oldTotalPaise / 100).toFixed(2)}
                </div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <div className="text-emerald-800 font-medium">New Total</div>
                <div className="text-base font-black font-mono text-emerald-900">
                  ₹{(previewData.newTotalPaise / 100).toFixed(2)}
                </div>
              </div>

              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 col-span-2 sm:col-span-1">
                <div className="text-blue-800 font-medium">Total Delta</div>
                <div className={`text-base font-black font-mono ${previewData.totalDiffPaise >= 0 ? "text-blue-900" : "text-amber-900"}`}>
                  {previewData.totalDiffPaise >= 0 ? "+" : ""}
                  ₹{(previewData.totalDiffPaise / 100).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Stock Delta Impact */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700">Stock Movements Impact (Append-Only):</div>
              <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl text-xs">
                {previewData.stockChanges.map((sc) => (
                  <div key={sc.productId} className="p-2 flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{sc.productName}</span>
                    <span className="font-mono text-[11px]">
                      {sc.oldQty} pcs → {sc.newQty} pcs (
                      <strong className={sc.deltaQty > 0 ? "text-red-700" : sc.deltaQty < 0 ? "text-emerald-700" : "text-slate-500"}>
                        {sc.deltaQty > 0 ? `-${sc.deltaQty} pcs stock` : sc.deltaQty < 0 ? `+${Math.abs(sc.deltaQty)} pcs restored` : "No change"}
                      </strong>
                      )
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mandatory Reason Input */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Reason for Revision <span className="text-red-500">*</span>
              </label>
              <textarea
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Describe why this invoice is being edited (e.g. rate correction per owner, customer swapped flavor)..."
                rows={3}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={isPending || !editReason.trim()}
                className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition disabled:opacity-50"
              >
                {isPending ? "Applying Revision..." : "Confirm & Save Revision"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
