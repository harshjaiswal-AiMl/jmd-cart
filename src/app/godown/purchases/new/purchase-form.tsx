"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Package,
  HelpCircle,
  X,
  ArrowLeft,
  Calendar,
  Building2,
  Clock,
  Layers,
  ChevronDown,
} from "lucide-react";
import { recordPurchaseAction } from "../actions";
import { searchItems, SearchableProduct } from "@/lib/search/smart-search";
import { paiseToIndianWords } from "@/lib/number-to-words";
import { ItemInfoModal } from "@/components/pos/ItemInfoModal";
import { QuickAddProductModal } from "@/components/pos/QuickAddProductModal";

export type UnitType = "Pcs" | "Carton" | "Dozen" | "Bag" | "Jar" | "Hanger";

export interface GrnLineItem {
  id: string;
  productId: string;
  product?: SearchableProduct | null;
  qtyInput: string;
  unit: UnitType;
  rateInput: string; // Rate per selected unit
  gstRateBp: number;
}

export interface SupplierItem {
  id: string;
  name: string;
  phone?: string | null;
  companyId?: string | null;
  company?: { id: string; name: string } | null;
}

export interface ProductItem {
  id: string;
  name: string;
  shortCode: string;
  gstRateBp: number;
  mrpPaise: number;
  companyId?: string | null;
  company?: { id: string; name: string } | null;
  packSize?: number;
  weight?: string | null;
  weightValue?: number | null;
  weightUnit?: string | null;
  bagSize?: number | null;
  shopStockQty?: number;
  godownStockQty?: number;
}

export interface PurchaseFormProps {
  suppliers: SupplierItem[];
  locations: { id: string; name: string }[];
  products: ProductItem[];
}

export function PurchaseForm({ suppliers, locations, products: initialProducts }: PurchaseFormProps) {
  const router = useRouter();

  // Master product catalog state (supports instant addition via Quick Add F6)
  const [catalog, setCatalog] = useState<ProductItem[]>(initialProducts);

  // Header State
  const [supplierId, setSupplierId] = useState<string>(suppliers[0]?.id || "");
  const [billNo, setBillNo] = useState("");
  const [billDate, setBillDate] = useState(() => {
    try {
      const d = new Date();
      return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    } catch {
      return new Date().toISOString().split("T")[0];
    }
  });
  const [locationId, setLocationId] = useState<string>(
    locations.find((l) => l.name.toLowerCase().includes("godown"))?.id || locations[0]?.id || ""
  );
  const [narration, setNarration] = useState("");

  // Modals & UI State
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [infoModalProduct, setInfoModalProduct] = useState<SearchableProduct | null>(null);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [heldVoucher, setHeldVoucher] = useState<{
    supplierId: string;
    billNo: string;
    billDate: string;
    locationId: string;
    narration: string;
    items: GrnLineItem[];
  } | null>(null);

  // Active / Selected row for Status Line diagnostics
  const [activeLineId, setActiveLineId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Supplier Search Dropdown State [Alt+S]
  const [supplierSearchOpen, setSupplierSearchOpen] = useState(false);
  const [supplierSearchQuery, setSupplierSearchQuery] = useState("");
  const supplierInputRef = useRef<HTMLInputElement>(null);

  // Helper to construct a new line
  const createEmptyLine = useCallback(
    (defaultProd?: ProductItem): GrnLineItem => {
      const p = defaultProd || catalog[0];
      const rate = p ? ((p.mrpPaise || 0) * 0.7) / 100 : 50;
      return {
        id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        productId: p?.id || "",
        product: p as any,
        qtyInput: "1",
        unit: "Carton",
        rateInput: rate > 0 ? (rate * (p?.packSize || 1)).toFixed(2) : "100.00",
        gstRateBp: p?.gstRateBp ?? 500,
      };
    },
    [catalog]
  );

  // Grid Lines State
  const [lines, setLines] = useState<GrnLineItem[]>(() => [createEmptyLine()]);

  // Set initial active row
  useEffect(() => {
    if (lines.length > 0 && !activeLineId) {
      setActiveLineId(lines[0].id);
    }
  }, [lines, activeLineId]);

  // Extract selected supplier
  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === supplierId),
    [suppliers, supplierId]
  );

  // Filtered suppliers for Alt+S search
  const filteredSuppliers = useMemo(() => {
    const q = supplierSearchQuery.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.company?.name && s.company.name.toLowerCase().includes(q))
    );
  }, [suppliers, supplierSearchQuery]);

  // Distinct Companies list for Quick Add
  const companies = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of catalog) {
      if (p.companyId && p.company?.name) {
        map.set(p.companyId, p.company.name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [catalog]);

  // Calculation of Line Totals
  const lineCalculations = useMemo(() => {
    return lines.map((line) => {
      const prod = catalog.find((p) => p.id === line.productId);
      const packSize = Math.max(1, prod?.packSize || 1);
      const rawQty = parseFloat(line.qtyInput) || 0;

      let multiplier = 1;
      if (line.unit === "Carton") multiplier = packSize;
      else if (line.unit === "Dozen") multiplier = 12;
      else if (line.unit === "Bag") multiplier = prod?.bagSize || packSize;
      else if (line.unit === "Hanger") multiplier = 60;
      else if (line.unit === "Jar") multiplier = packSize;
      else multiplier = 1;

      const totalPieces = Math.round(rawQty * multiplier);
      const rateVal = parseFloat(line.rateInput) || 0;
      // Taxable value is rawQty * unit rate
      const taxable = rawQty * rateVal;
      const tax = taxable * ((line.gstRateBp || 0) / 10000);
      const total = taxable + tax;

      return {
        totalPieces,
        taxable,
        tax,
        total,
        ratePerPiece: totalPieces > 0 ? taxable / totalPieces : 0,
      };
    });
  }, [lines, catalog]);

  // Grand Totals
  const grandTaxable = lineCalculations.reduce((sum, l) => sum + l.taxable, 0);
  const grandTax = lineCalculations.reduce((sum, l) => sum + l.tax, 0);
  const grandTotal = grandTaxable + grandTax;
  const grandTotalPaise = Math.round(grandTotal * 100);

  // Active line for diagnostics status bar
  const activeLine = useMemo(() => {
    return lines.find((l) => l.id === activeLineId) || lines[0];
  }, [lines, activeLineId]);

  const activeProduct = useMemo(() => {
    if (!activeLine) return null;
    return catalog.find((p) => p.id === activeLine.productId) || null;
  }, [activeLine, catalog]);

  // Line Handlers
  const handleUpdateProduct = (lineId: string, prodId: string) => {
    const p = catalog.find((x) => x.id === prodId);
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const ratePerPc = p ? ((p.mrpPaise || 0) * 0.7) / 100 : 50;
        const multiplier = l.unit === "Carton" ? (p?.packSize || 1) : 1;
        return {
          ...l,
          productId: prodId,
          product: p as any,
          gstRateBp: p?.gstRateBp ?? l.gstRateBp,
          rateInput: (ratePerPc * multiplier).toFixed(2),
        };
      })
    );
  };

  const handleUpdateQty = (lineId: string, val: string) => {
    setLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, qtyInput: val } : l))
    );
  };

  const handleUpdateUnit = (lineId: string, newUnit: UnitType) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const p = catalog.find((x) => x.id === l.productId);
        const ratePerPc = p ? ((p.mrpPaise || 0) * 0.7) / 100 : 50;
        let mult = 1;
        if (newUnit === "Carton") mult = p?.packSize || 1;
        else if (newUnit === "Dozen") mult = 12;
        else if (newUnit === "Bag") mult = p?.bagSize || p?.packSize || 1;

        return {
          ...l,
          unit: newUnit,
          rateInput: (ratePerPc * mult).toFixed(2),
        };
      })
    );
  };

  const handleUpdateRate = (lineId: string, val: string) => {
    setLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, rateInput: val } : l))
    );
  };

  const handleUpdateGst = (lineId: string, bp: number) => {
    setLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, gstRateBp: bp } : l))
    );
  };

  const handleRemoveLine = (lineId: string) => {
    if (lines.length <= 1) return;
    setLines((prev) => {
      const next = prev.filter((l) => l.id !== lineId);
      if (activeLineId === lineId && next[0]) {
        setActiveLineId(next[0].id);
      }
      return next;
    });
  };

  const handleAddLine = () => {
    const newLine = createEmptyLine();
    setLines((prev) => [...prev, newLine]);
    setActiveLineId(newLine.id);
  };

  const handleRepeatLine = () => {
    if (!activeLine) return;
    const newLine: GrnLineItem = {
      ...activeLine,
      id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };
    setLines((prev) => [...prev, newLine]);
    setActiveLineId(newLine.id);
  };

  // Hold / Resume
  const handleHold = () => {
    setHeldVoucher({
      supplierId,
      billNo,
      billDate,
      locationId,
      narration,
      items: lines,
    });
    // Reset to fresh voucher
    setBillNo("");
    setNarration("");
    setLines([createEmptyLine()]);
  };

  const handleResumeHeld = () => {
    if (!heldVoucher) return;
    setSupplierId(heldVoucher.supplierId);
    setBillNo(heldVoucher.billNo);
    setBillDate(heldVoucher.billDate);
    setLocationId(heldVoucher.locationId);
    setNarration(heldVoucher.narration);
    setLines(heldVoucher.items);
    setHeldVoucher(null);
  };

  // Post Submission
  const handleConfirmAndPost = async () => {
    if (lines.length === 0) return;
    if (!billNo.trim()) {
      setFormError("Please enter Supplier Invoice / Bill No.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const payload = {
      supplierId: supplierId || null,
      billNo: billNo.trim(),
      billDate,
      locationId,
      items: lines.map((line, idx) => {
        const calc = lineCalculations[idx];
        const safePieces = Math.max(1, calc?.totalPieces || 1);
        const taxablePaise = Math.round((calc?.taxable || 0) * 100);
        const ratePaise = Math.round(taxablePaise / safePieces);

        return {
          productId: line.productId,
          qty: safePieces,
          ratePaise,
          gstRateBp: Number(line.gstRateBp),
        };
      }),
    };

    const formData = new FormData();
    formData.append("purchaseData", JSON.stringify(payload));
    formData.append("payload", JSON.stringify(payload));

    const res = await recordPurchaseAction(undefined, formData);
    setIsSubmitting(false);

    if (res?.success) {
      router.push("/godown/purchases");
    } else {
      setFormError(res?.error || "Failed to record GRN receipt.");
      setSaveConfirmOpen(false);
    }
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid intercepting inside inputs when not specific functional keys
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA";

      if (e.key === "F2" || (e.ctrlKey && e.key === "Enter")) {
        e.preventDefault();
        setSaveConfirmOpen(true);
      } else if (e.key === "F3") {
        e.preventDefault();
        setLines([createEmptyLine()]);
        setBillNo("");
      } else if (e.key === "F4") {
        e.preventDefault();
        handleHold();
      } else if (e.key === "F6") {
        e.preventDefault();
        setQuickAddOpen(true);
      } else if (e.key === "F7") {
        e.preventDefault();
        handleRepeatLine();
      } else if (e.key === "F8") {
        e.preventDefault();
        if (activeProduct) {
          setInfoModalProduct(activeProduct as any);
        }
      } else if (e.key === "F9") {
        e.preventDefault();
        if (activeLineId) {
          handleRemoveLine(activeLineId);
        }
      } else if (e.altKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        setSupplierSearchOpen(true);
        setTimeout(() => supplierInputRef.current?.focus(), 50);
      } else if (e.key === "?") {
        if (!isInput) {
          e.preventDefault();
          setHelpOpen(true);
        }
      } else if (e.key === "Escape") {
        if (supplierSearchOpen) {
          setSupplierSearchOpen(false);
        } else if (helpOpen) {
          setHelpOpen(false);
        } else if (saveConfirmOpen) {
          setSaveConfirmOpen(false);
        } else if (lines.length > 1 || billNo.trim()) {
          setDiscardConfirmOpen(true);
        } else {
          router.push("/godown/purchases");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    lines,
    billNo,
    activeLineId,
    activeProduct,
    supplierSearchOpen,
    helpOpen,
    saveConfirmOpen,
    router,
    createEmptyLine,
  ]);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-h-screen bg-slate-100 font-sans select-none overflow-hidden text-slate-900">
      {/* 1. Command Header (at most ~140px above grid) */}
      <div className="bg-[#0f172a] text-white px-4 py-2 flex items-center justify-between border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/godown/purchases"
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
            title="Back to Purchases List [Esc]"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs bg-blue-600 text-white px-2 py-0.5 rounded font-black tracking-wider">
              GRN
            </span>
            <h1 className="font-bold text-sm tracking-tight text-white flex items-center gap-2">
              Purchase Voucher Entry
              <span className="text-xs font-normal text-slate-400">
                (Stock Receipt to Ledger)
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {heldVoucher && (
            <button
              type="button"
              onClick={handleResumeHeld}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded hover:bg-amber-500/30 transition animate-pulse"
            >
              <Clock className="w-3.5 h-3.5" />
              Resume Held Voucher
            </button>
          )}
          <button
            type="button"
            onClick={() => setQuickAddOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            + New Product [F6]
          </button>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="p-1 text-slate-400 hover:text-white rounded"
            title="Keyboard Shortcuts [?]"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Voucher Meta Toolbar */}
      <div className="bg-white border-b border-slate-300 px-4 py-2 shrink-0 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end shadow-xs">
        {/* Supplier / Brand [Alt+S] */}
        <div className="relative md:col-span-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-1">
            <label className="flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              Supplier / Brand
              <span className="font-mono text-[10px] text-blue-600 bg-blue-50 px-1 py-0.2 rounded border border-blue-200">
                [Alt+S]
              </span>
            </label>
            {selectedSupplier?.company?.name && (
              <span className="text-[10px] bg-blue-100 text-blue-800 font-semibold px-1.5 py-0.2 rounded">
                Brand: {selectedSupplier.company.name}
              </span>
            )}
          </div>

          <div
            onClick={() => {
              setSupplierSearchOpen(true);
              setTimeout(() => supplierInputRef.current?.focus(), 50);
            }}
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-slate-50 flex items-center justify-between cursor-pointer hover:border-blue-500 hover:bg-white transition"
          >
            <span className="font-semibold text-slate-900 truncate">
              {selectedSupplier?.name || "-- Direct / Unlisted Supplier --"}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </div>

          {/* Supplier Search Modal Popup */}
          {supplierSearchOpen && (
            <div className="absolute left-0 top-full mt-1 w-full min-w-[340px] bg-white border border-slate-300 rounded-lg shadow-xl p-2 z-50">
              <input
                ref={supplierInputRef}
                type="text"
                placeholder="Type supplier or brand..."
                value={supplierSearchQuery}
                onChange={(e) => setSupplierSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setSupplierSearchOpen(false);
                  if (e.key === "Enter" && filteredSuppliers[0]) {
                    setSupplierId(filteredSuppliers[0].id);
                    setSupplierSearchOpen(false);
                  }
                }}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded mb-2 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              />
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setSupplierId("");
                    setSupplierSearchOpen(false);
                  }}
                  className="w-full text-left p-2 hover:bg-slate-100 font-medium text-slate-600"
                >
                  -- Direct / Unlisted Supplier --
                </button>
                {filteredSuppliers.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSupplierId(s.id);
                      setSupplierSearchOpen(false);
                    }}
                    className={`w-full text-left p-2 hover:bg-blue-50 transition flex items-center justify-between ${
                      s.id === supplierId ? "bg-blue-50/80 font-bold text-blue-900" : ""
                    }`}
                  >
                    <span className="truncate">{s.name}</span>
                    {s.company?.name && (
                      <span className="text-[10px] text-slate-400 ml-2">
                        {s.company.name}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bill No */}
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">
            Supplier Bill No.
          </label>
          <input
            type="text"
            required
            value={billNo}
            onChange={(e) => setBillNo(e.target.value)}
            placeholder="e.g. INV-9921"
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Bill Date */}
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">
            Bill Date
          </label>
          <input
            type="date"
            required
            value={billDate}
            onChange={(e) => setBillDate(e.target.value)}
            className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white font-medium"
          />
        </div>

        {/* Receiving Destination */}
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">
            Destination Location
          </label>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white font-semibold"
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {formError && (
        <div className="bg-red-50 border-b border-red-200 text-red-700 px-4 py-2 text-xs flex items-center justify-between shrink-0 font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
          <button
            type="button"
            onClick={() => setFormError(null)}
            className="text-red-500 hover:text-red-800"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. Voucher Grid Table */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="bg-[#f1f5f9] text-slate-700 uppercase tracking-wider font-extrabold sticky top-0 z-10 border-b-2 border-slate-300">
            <tr>
              <th className="py-2.5 px-3 w-12 text-center border-r border-slate-200">S.N.</th>
              <th className="py-2.5 px-3 min-w-[280px] border-r border-slate-200">
                Item Description (Smart Search / Fragment)
              </th>
              <th className="py-2.5 px-2 w-24 text-center border-r border-slate-200">Qty</th>
              <th className="py-2.5 px-2 w-28 text-center border-r border-slate-200">Unit</th>
              <th className="py-2.5 px-2 w-32 text-right border-r border-slate-200">
                Purchase Rate (₹)
              </th>
              <th className="py-2.5 px-2 w-20 text-center border-r border-slate-200">GST %</th>
              <th className="py-2.5 px-3 w-36 text-right border-r border-slate-200">Amount (₹)</th>
              <th className="py-2.5 px-2 w-10 text-center">✕</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {lines.map((line, idx) => {
              const calc = lineCalculations[idx];
              const isSelected = line.id === activeLineId;
              const prod = catalog.find((p) => p.id === line.productId);

              return (
                <tr
                  key={line.id}
                  onClick={() => setActiveLineId(line.id)}
                  className={`transition-colors cursor-pointer ${
                    isSelected ? "bg-amber-50/70" : "hover:bg-slate-50"
                  }`}
                >
                  {/* S.N. */}
                  <td className="py-2 px-3 text-center font-mono font-bold text-slate-500 border-r border-slate-200">
                    {idx + 1}
                  </td>

                  {/* Product Search */}
                  <td className="py-1 px-2 border-r border-slate-200">
                    <GridProductSelect
                      catalog={catalog}
                      selectedProductId={line.productId}
                      onChange={(newProdId) => handleUpdateProduct(line.id, newProdId)}
                    />
                  </td>

                  {/* Quantity */}
                  <td className="py-1 px-2 border-r border-slate-200">
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={line.qtyInput}
                      onChange={(e) => handleUpdateQty(line.id, e.target.value)}
                      className="w-full text-center py-1 px-1.5 font-mono font-bold text-xs border border-transparent hover:border-slate-300 focus:border-blue-500 rounded bg-transparent focus:bg-white"
                    />
                  </td>

                  {/* Unit Picker */}
                  <td className="py-1 px-2 border-r border-slate-200">
                    <select
                      value={line.unit}
                      onChange={(e) => handleUpdateUnit(line.id, e.target.value as UnitType)}
                      onKeyDown={(e) => {
                        const k = e.key.toUpperCase();
                        if (k === "P") { e.preventDefault(); handleUpdateUnit(line.id, "Pcs"); }
                        else if (k === "C") { e.preventDefault(); handleUpdateUnit(line.id, "Carton"); }
                        else if (k === "D") { e.preventDefault(); handleUpdateUnit(line.id, "Dozen"); }
                        else if (k === "B") { e.preventDefault(); handleUpdateUnit(line.id, "Bag"); }
                        else if (k === "J") { e.preventDefault(); handleUpdateUnit(line.id, "Jar"); }
                        else if (k === "H") { e.preventDefault(); handleUpdateUnit(line.id, "Hanger"); }
                      }}
                      className="w-full text-center py-1 px-1.5 text-xs font-semibold border border-transparent hover:border-slate-300 focus:border-blue-500 rounded bg-transparent focus:bg-white"
                    >
                      <option value="Carton">Carton ({prod?.packSize || 1})</option>
                      <option value="Pcs">Pcs</option>
                      <option value="Dozen">Dozen (12)</option>
                      <option value="Bag">Bag ({prod?.bagSize || prod?.packSize || 1})</option>
                      <option value="Jar">Jar ({prod?.packSize || 1})</option>
                      <option value="Hanger">Hanger (60)</option>
                    </select>
                  </td>

                  {/* Purchase Rate */}
                  <td className="py-1 px-2 border-r border-slate-200">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.rateInput}
                      onChange={(e) => handleUpdateRate(line.id, e.target.value)}
                      className="w-full text-right py-1 px-1.5 font-mono font-bold text-xs border border-transparent hover:border-slate-300 focus:border-blue-500 rounded bg-transparent focus:bg-white"
                    />
                  </td>

                  {/* GST % */}
                  <td className="py-1 px-2 border-r border-slate-200">
                    <select
                      value={line.gstRateBp}
                      onChange={(e) => handleUpdateGst(line.id, parseInt(e.target.value, 10))}
                      className="w-full text-center py-1 px-1 text-xs border border-transparent hover:border-slate-300 focus:border-blue-500 rounded bg-transparent focus:bg-white"
                    >
                      <option value="0">0%</option>
                      <option value="500">5%</option>
                      <option value="1200">12%</option>
                      <option value="1800">18%</option>
                      <option value="2800">28%</option>
                    </select>
                  </td>

                  {/* Line Amount */}
                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 border-r border-slate-200">
                    ₹{(calc?.total || 0).toFixed(2)}
                  </td>

                  {/* Remove Line */}
                  <td className="py-2 px-2 text-center">
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveLine(line.id);
                        }}
                        className="text-slate-400 hover:text-red-600 p-1 rounded font-bold"
                        title="Delete line [F9]"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Add Row Prompt button */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={handleAddLine}
            className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 bg-white border border-blue-200 px-3 py-1.5 rounded shadow-2xs hover:bg-blue-50 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            + Add Line [Enter on last cell]
          </button>
          <span className="text-[11px] text-slate-400">
            Total {lines.length} line items &bull; Press [F7] to duplicate current row
          </span>
        </div>
      </div>

      {/* 4. Status Line for Highlighted Item (Diagnostics) */}
      <div className="bg-slate-900 text-slate-300 px-4 py-1.5 text-xs border-t border-slate-800 flex items-center justify-between shrink-0 font-medium">
        <div className="flex items-center gap-4 truncate">
          <span className="text-white font-bold truncate">
            {activeProduct?.name || "No item selected"}
          </span>
          {activeProduct && (
            <>
              <span className="text-slate-400">
                Code: <strong className="text-amber-300 font-mono">{activeProduct.shortCode}</strong>
              </span>
              <span className="text-slate-400">
                Pack Size: <strong className="text-white">{activeProduct.packSize || 1} pcs/ctn</strong>
              </span>
              <span className="text-slate-400">
                MRP: <strong className="text-white font-mono">₹{((activeProduct.mrpPaise || 0) / 100).toFixed(2)}</strong>
              </span>
              <span className="text-slate-400">
                Current Stock: Shop <strong className="text-white">{activeProduct.shopStockQty ?? 0}</strong> &bull; Godown <strong className="text-white">{activeProduct.godownStockQty ?? 0}</strong>
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => activeProduct && setInfoModalProduct(activeProduct as any)}
            className="text-[11px] text-sky-400 hover:text-sky-300 font-bold bg-slate-800 px-2 py-0.5 rounded border border-slate-700"
          >
            [F8] Item Diagnostics
          </button>
        </div>
      </div>

      {/* 5. Action Summary Bar (Always visible at 1366x768) */}
      <div className="bg-white border-t border-slate-300 px-4 py-2 shrink-0 flex items-center justify-between shadow-md">
        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSaveConfirmOpen(true)}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-sm rounded-lg shadow-sm transition disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            Confirm &amp; Post [F2]
          </button>
          <button
            type="button"
            onClick={handleHold}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg border border-slate-300 transition"
          >
            Hold [F4]
          </button>
          <button
            type="button"
            onClick={() => setDiscardConfirmOpen(true)}
            className="px-3.5 py-2 bg-white hover:bg-red-50 text-red-600 font-bold text-xs rounded-lg border border-red-200 transition"
          >
            Cancel [Esc]
          </button>
        </div>

        {/* Financial Summary */}
        <div className="text-right flex items-center gap-6">
          <div className="text-xs text-slate-500 space-y-0.5">
            <div>
              Taxable: <span className="font-mono font-bold text-slate-700">₹{grandTaxable.toFixed(2)}</span>
            </div>
            <div>
              GST Total: <span className="font-mono font-bold text-slate-700">₹{grandTax.toFixed(2)}</span>
            </div>
          </div>

          <div className="border-l border-slate-300 pl-4 text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Grand Total
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-slate-900 leading-none">
              ₹{grandTotal.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-500 font-medium truncate max-w-xs mt-0.5">
              {paiseToIndianWords(grandTotalPaise)}
            </div>
          </div>
        </div>
      </div>

      {/* 6. Function-Key Footer */}
      <div className="bg-[#0f172a] text-slate-400 text-[11px] px-4 py-1.5 flex items-center justify-between border-t border-slate-800 shrink-0 font-mono">
        <div className="flex items-center gap-3 overflow-x-auto">
          <span><strong className="text-sky-400">[F2]</strong> Post</span>
          <span><strong className="text-sky-400">[F3]</strong> New</span>
          <span><strong className="text-sky-400">[F4]</strong> Hold</span>
          <span><strong className="text-sky-400">[F6]</strong> Add Product</span>
          <span><strong className="text-sky-400">[F7]</strong> Repeat Line</span>
          <span><strong className="text-sky-400">[F8]</strong> Item Info</span>
          <span><strong className="text-sky-400">[F9]</strong> Delete Line</span>
          <span><strong className="text-sky-400">[Alt+S]</strong> Supplier</span>
          <span><strong className="text-sky-400">[Esc]</strong> Back</span>
          <span><strong className="text-sky-400">[?]</strong> Help</span>
        </div>
        <div className="text-slate-500 shrink-0 text-[10px]">
          Saharsa FMCG &bull; Busy Style GRN
        </div>
      </div>

      {/* Save Confirmation Dialog [F2] */}
      {saveConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100 font-sans">
            <div className="bg-[#0f172a] text-white px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm">Confirm Goods Receipt Note (GRN)</h3>
              </div>
              <button
                type="button"
                onClick={() => setSaveConfirmOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600">
                Are you sure you want to post this receipt? Stock ledger will immediately update for all items.
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 font-medium">
                <div className="flex justify-between">
                  <span className="text-slate-500">Supplier:</span>
                  <span className="font-bold text-slate-800">{selectedSupplier?.name || "Direct / Unlisted"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Bill No:</span>
                  <span className="font-mono font-bold text-slate-800">{billNo || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Items Count:</span>
                  <span className="font-bold text-slate-800">{lines.length} lines</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5">
                  <span className="font-bold text-slate-700">Total Payable:</span>
                  <span className="font-mono font-black text-sm text-slate-900">₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSaveConfirmOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-100 transition"
                >
                  Cancel [Esc]
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAndPost}
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-lg shadow-sm transition disabled:opacity-50"
                  autoFocus
                >
                  {isSubmitting ? "Posting..." : "Confirm & Post [Enter]"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Discard Confirmation Dialog */}
      {discardConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-sm overflow-hidden p-5 space-y-4">
            <h3 className="font-bold text-sm text-slate-900">Discard Current Voucher?</h3>
            <p className="text-xs text-slate-600">
              You have unsaved changes in this voucher. Are you sure you want to discard and exit?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDiscardConfirmOpen(false)}
                className="px-3 py-1.5 border border-slate-300 rounded text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => router.push("/godown/purchases")}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold"
              >
                Discard &amp; Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Product Drawer [F6] */}
      {quickAddOpen && (
        <QuickAddProductModal
          isOpen={quickAddOpen}
          onClose={() => setQuickAddOpen(false)}
          onProductCreated={(newProd) => {
            setCatalog((prev) => [newProd as any, ...prev]);
            // Automatically add as a new row
            const newLine: GrnLineItem = {
              id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              productId: newProd.id,
              product: newProd as any,
              qtyInput: "1",
              unit: "Carton",
              rateInput: ((newProd.mrpPaise * 0.7) / 100 * (newProd.packSize || 1)).toFixed(2),
              gstRateBp: newProd.gstRateBp ?? 500,
            };
            setLines((prev) => [...prev, newLine]);
            setActiveLineId(newLine.id);
            setQuickAddOpen(false);
          }}
          companies={companies}
          locationId={locationId}
        />
      )}

      {/* Item Info Diagnostics Modal [F8] */}
      {infoModalProduct && (
        <ItemInfoModal
          isOpen={Boolean(infoModalProduct)}
          onClose={() => setInfoModalProduct(null)}
          product={infoModalProduct}
        />
      )}

      {/* Help Overlay Modal [?] */}
      {helpOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-md overflow-hidden">
            <div className="bg-[#0f172a] text-white px-4 py-3 flex items-center justify-between">
              <h3 className="font-bold text-sm">Purchase Voucher Keyboard Shortcuts</h3>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-sky-600 font-bold">[F2] / [Ctrl+Enter]</span>
                <span className="text-slate-700">Confirm &amp; Post GRN</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-sky-600 font-bold">[F3]</span>
                <span className="text-slate-700">New / Clear Voucher</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-sky-600 font-bold">[F4]</span>
                <span className="text-slate-700">Hold Voucher Draft</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-sky-600 font-bold">[F6]</span>
                <span className="text-slate-700">Quick Add New Product</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-sky-600 font-bold">[F7]</span>
                <span className="text-slate-700">Duplicate / Repeat Active Row</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-sky-600 font-bold">[F8]</span>
                <span className="text-slate-700">Item Master Diagnostics &amp; Stock</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-sky-600 font-bold">[F9]</span>
                <span className="text-slate-700">Delete Selected Row</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-sky-600 font-bold">[Alt+S]</span>
                <span className="text-slate-700">Focus Supplier Search</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-sky-600 font-bold">[Esc]</span>
                <span className="text-slate-700">Close Dialog / Back to Purchases</span>
              </div>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="px-3 py-1 bg-slate-900 text-white rounded text-xs font-bold"
              >
                Close [Esc]
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline smart searchable item select for grid rows
function GridProductSelect({
  catalog,
  selectedProductId,
  onChange,
}: {
  catalog: ProductItem[];
  selectedProductId: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedProd = useMemo(
    () => catalog.find((p) => p.id === selectedProductId),
    [catalog, selectedProductId]
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return catalog.slice(0, 50);
    return searchItems(q, catalog as any, { limit: 50 }) as ProductItem[];
  }, [catalog, query]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => !prev);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="w-full text-left py-1 px-2 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded bg-transparent focus:bg-white flex items-center justify-between text-xs transition"
      >
        <span className="truncate">
          {selectedProd ? (
            <span className="font-semibold text-slate-900">
              <span className="font-mono text-blue-700 font-bold mr-1">
                {selectedProd.shortCode}
              </span>
              {selectedProd.name}
              {selectedProd.company?.name && (
                <span className="text-[10px] text-slate-400 ml-1">
                  ({selectedProd.company.name})
                </span>
              )}
            </span>
          ) : (
            <span className="text-slate-400">Select product...</span>
          )}
        </span>
        <ChevronDown className="w-3 h-3 text-slate-400 shrink-0 ml-1" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-[460px] max-w-[85vw] bg-white border border-slate-300 rounded-lg shadow-2xl p-2 z-50">
          <input
            ref={inputRef}
            type="text"
            placeholder="Type code, brand, or name fragment..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "Enter" && filtered[0]) {
                onChange(filtered[0].id);
                setOpen(false);
              }
            }}
            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded mb-2 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
          />
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
            {filtered.length === 0 ? (
              <div className="p-3 text-center text-slate-400">No matching products</div>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onChange(p.id);
                    setOpen(false);
                  }}
                  className={`w-full text-left p-2 hover:bg-blue-50 transition flex items-center justify-between ${
                    p.id === selectedProductId ? "bg-blue-50 font-bold" : ""
                  }`}
                >
                  <div className="truncate pr-2">
                    <span className="font-mono text-blue-700 font-bold mr-1.5">
                      {p.shortCode}
                    </span>
                    <span className="text-slate-900 font-semibold">{p.name}</span>
                    {p.company?.name && (
                      <span className="text-[10px] text-slate-400 ml-1.5">
                        Brand: {p.company.name}
                      </span>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono text-slate-600 bg-slate-100 px-1 py-0.2 rounded text-[10px]">
                      MRP ₹{((p.mrpPaise || 0) / 100).toFixed(2)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
