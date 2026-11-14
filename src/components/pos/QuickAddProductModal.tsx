"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, AlertTriangle, Package } from "lucide-react";
import { posQuickAddProductAction } from "@/app/shop/pos/actions";

interface QuickAddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductCreated: (newProduct: any, initialQtyPcs: number) => void;
  onProductSavedOnly?: (newProduct: any) => void;
  companies: Array<{ id: string; name: string }>;
  locationId: string;
  initialSearchName?: string;
}

export function QuickAddProductModal({
  isOpen,
  onClose,
  onProductCreated,
  onProductSavedOnly,
  companies,
  locationId,
  initialSearchName = "",
}: QuickAddProductModalProps) {
  const [name, setName] = useState(initialSearchName);
  const [closeAfterSave, setCloseAfterSave] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [weight, setWeight] = useState("");
  const [packSize, setPackSize] = useState("1");
  const [mrpRs, setMrpRs] = useState("");

  // 3 Pricing Tiers (A, B, C) with Rates & Percentages
  const [priceARs, setPriceARs] = useState("");
  const [discAPercent, setDiscAPercent] = useState("");

  const [priceBRs, setPriceBRs] = useState("");
  const [discBPercent, setDiscBPercent] = useState("");

  const [priceCRs, setPriceCRs] = useState("");
  const [discCPercent, setDiscCPercent] = useState("");

  // Helper when MRP changes: update all tiers accordingly
  const handleMrpChange = (val: string) => {
    setMrpRs(val);
    const mrp = parseFloat(val) || 0;
    if (mrp <= 0) return;

    // Recalculate A if % exists, else if rate exists recalculate %
    if (discAPercent && !isNaN(parseFloat(discAPercent))) {
      setPriceARs((mrp * (1 - parseFloat(discAPercent) / 100)).toFixed(2));
    } else if (priceARs && parseFloat(priceARs) > 0) {
      setDiscAPercent((((mrp - parseFloat(priceARs)) / mrp) * 100).toFixed(1));
    }

    // Recalculate B
    if (discBPercent && !isNaN(parseFloat(discBPercent))) {
      setPriceBRs((mrp * (1 - parseFloat(discBPercent) / 100)).toFixed(2));
    } else if (priceBRs && parseFloat(priceBRs) > 0) {
      setDiscBPercent((((mrp - parseFloat(priceBRs)) / mrp) * 100).toFixed(1));
    }

    // Recalculate C
    if (discCPercent && !isNaN(parseFloat(discCPercent))) {
      setPriceCRs((mrp * (1 - parseFloat(discCPercent) / 100)).toFixed(2));
    } else if (priceCRs && parseFloat(priceCRs) > 0) {
      setDiscCPercent((((mrp - parseFloat(priceCRs)) / mrp) * 100).toFixed(1));
    }
  };

  // Tier A handlers
  const handleRateAChange = (val: string) => {
    setPriceARs(val);
    const mrp = parseFloat(mrpRs) || 0;
    const rate = parseFloat(val) || 0;
    if (mrp > 0 && rate > 0) {
      setDiscAPercent((((mrp - rate) / mrp) * 100).toFixed(1));
    }
  };
  const handlePercentAChange = (val: string) => {
    setDiscAPercent(val);
    const mrp = parseFloat(mrpRs) || 0;
    const pct = parseFloat(val);
    if (mrp > 0 && !isNaN(pct) && pct >= 0 && pct < 100) {
      setPriceARs((mrp * (1 - pct / 100)).toFixed(2));
    }
  };

  // Tier B handlers
  const handleRateBChange = (val: string) => {
    setPriceBRs(val);
    const mrp = parseFloat(mrpRs) || 0;
    const rate = parseFloat(val) || 0;
    if (mrp > 0 && rate > 0) {
      setDiscBPercent((((mrp - rate) / mrp) * 100).toFixed(1));
    }
  };
  const handlePercentBChange = (val: string) => {
    setDiscBPercent(val);
    const mrp = parseFloat(mrpRs) || 0;
    const pct = parseFloat(val);
    if (mrp > 0 && !isNaN(pct) && pct >= 0 && pct < 100) {
      setPriceBRs((mrp * (1 - pct / 100)).toFixed(2));
    }
  };

  // Tier C handlers
  const handleRateCChange = (val: string) => {
    setPriceCRs(val);
    const mrp = parseFloat(mrpRs) || 0;
    const rate = parseFloat(val) || 0;
    if (mrp > 0 && rate > 0) {
      setDiscCPercent((((mrp - rate) / mrp) * 100).toFixed(1));
    }
  };
  const handlePercentCChange = (val: string) => {
    setDiscCPercent(val);
    const mrp = parseFloat(mrpRs) || 0;
    const pct = parseFloat(val);
    if (mrp > 0 && !isNaN(pct) && pct >= 0 && pct < 100) {
      setPriceCRs((mrp * (1 - pct / 100)).toFixed(2));
    }
  };

  const [gstRatePercent, setGstRatePercent] = useState("5");
  const [hsn, setHsn] = useState("21069099");
  const [stockCartons, setStockCartons] = useState("1");
  const [stockLoose, setStockLoose] = useState("0");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

    const handleQuickSave = async () => {
    const pSize = Math.max(1, parseInt(packSize, 10) || 1);
    const mrp = parseFloat(mrpRs) || 0;
    const rateA = parseFloat(priceARs) || mrp;
    const rateB = parseFloat(priceBRs) || mrp;
    const rateC = parseFloat(priceCRs) || mrp;

    if (!name.trim()) {
      setErrorMsg("Please enter product name");
      return;
    }
    if (mrp <= 0) {
      setErrorMsg("Please enter a valid MRP greater than 0");
      return;
    }

    const ctn = parseInt(stockCartons, 10) || 0;
    const loose = parseInt(stockLoose, 10) || 0;
    const initialQty = ctn * pSize + loose;

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await posQuickAddProductAction({
      name: name.trim(),
      companyName: companyName.trim(),
      weight: weight.trim(),
      packSize: pSize,
      mrpPaise: Math.round(mrp * 100),
      priceAPaise: Math.round(rateA * 100),
      priceBPaise: Math.round(rateB * 100),
      priceCPaise: Math.round(rateC * 100),
      hsn: hsn.trim() || "21069099",
      gstRateBp: Math.round((parseFloat(gstRatePercent) || 5) * 100),
      initialStockQty: initialQty,
      locationId,
    });

    setIsSubmitting(false);

    if (res.success && res.product) {
      if (onProductSavedOnly) {
        onProductSavedOnly(res.product);
      } else {
        onProductCreated(res.product, 0);
      }
      if (closeAfterSave) {
        onClose();
      } else {
        setName("");
        setMrpRs("");
        setPriceARs("");
        setPriceBRs("");
        setPriceCRs("");
        setDiscAPercent("");
        setDiscBPercent("");
        setDiscCPercent("");
        setStockCartons("0");
        setStockLoose("0");
      }
    } else {
      setErrorMsg(res.error || "Failed to save product");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("Please enter product name");
      return;
    }
    const mrp = parseFloat(mrpRs) || 0;
    if (mrp <= 0) {
      setErrorMsg("Please enter a valid MRP greater than zero");
      return;
    }

    const rateC = parseFloat(priceCRs) || mrp;
    const rateA = parseFloat(priceARs) || rateC;
    const rateB = parseFloat(priceBRs) || rateC;

    const ctn = parseInt(stockCartons, 10) || 0;
    const loose = parseInt(stockLoose, 10) || 0;
    const pSize = Math.max(1, parseInt(packSize, 10) || 1);
    const initialQty = ctn * pSize + loose;

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await posQuickAddProductAction({
      name: name.trim(),
      companyName: companyName.trim(),
      weight: weight.trim(),
      packSize: pSize,
      mrpPaise: Math.round(mrp * 100),
      priceAPaise: Math.round(rateA * 100),
      priceBPaise: Math.round(rateB * 100),
      priceCPaise: Math.round(rateC * 100),
      hsn: hsn.trim() || "21069099",
      gstRateBp: Math.round((parseFloat(gstRatePercent) || 5) * 100),
      initialStockQty: initialQty,
      locationId,
    });

    setIsSubmitting(false);

    if (res.success && res.product) {
      onProductCreated(res.product, initialQty > 0 ? 1 : 1);
      onClose();
    } else {
      setErrorMsg(res.error || "Failed to add product");
    }
  };

    useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopPropagation();
        handleQuickSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, name, companyName, weight, packSize, mrpRs, priceARs, priceBRs, priceCRs, stockCartons, stockLoose, closeAfterSave]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-xl overflow-hidden font-sans">
        {/* Header */}
        <div className="bg-[#0f172a] text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs bg-emerald-500 text-slate-950 px-2 py-0.5 rounded font-black">
              [F6]
            </span>
            <h3 className="font-bold text-sm tracking-tight">Quick Add Product to POS</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">
              Product Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bikaji Bhujia"
              required
              autoFocus
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Company / Brand</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Bikaji"
                list="pos-companies-list"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
              <datalist id="pos-companies-list">
                {companies.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Weight / Size</label>
              <input
                type="text"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="e.g. 400g, 1kg, 250ml"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>
          </div>

          {/* MRP & Pack Size */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">MRP (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={mrpRs}
                onChange={(e) => handleMrpChange(e.target.value)}
                placeholder="100.00"
                required
                className="w-full text-sm px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Pcs / Ctn</label>
              <input
                type="number"
                min="1"
                value={packSize}
                onChange={(e) => setPackSize(e.target.value)}
                placeholder="1"
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold"
              />
            </div>
          </div>

          {/* 3 Pricing Tiers (A, B, C) with Rates and % */}
          <div className="bg-slate-50 border border-slate-300 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
              <span className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                <span>🏷️</span> 3 Pricing Tiers (A, B, C) &amp; Percentages
              </span>
              <span className="text-[10px] text-slate-500 font-semibold">Rate &amp; % Auto-Calculated</span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {/* Tier A */}
              <div className="bg-white p-2.5 rounded-xl border border-blue-200 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-blue-900 uppercase">Tier A</span>
                  <span className="text-[9px] text-blue-600 font-medium">Distributor</span>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Rate (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={priceARs}
                    onChange={(e) => handleRateAChange(e.target.value)}
                    placeholder={mrpRs || "0.00"}
                    className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Disc (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="99.9"
                      value={discAPercent}
                      onChange={(e) => handlePercentAChange(e.target.value)}
                      placeholder="0.0"
                      className="w-full text-xs pl-2 pr-5 py-1.5 border border-blue-300 rounded-lg font-mono font-bold text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-blue-700">%</span>
                  </div>
                </div>
              </div>

              {/* Tier B */}
              <div className="bg-white p-2.5 rounded-xl border border-amber-200 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-amber-900 uppercase">Tier B</span>
                  <span className="text-[9px] text-amber-600 font-medium">Wholesale</span>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Rate (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={priceBRs}
                    onChange={(e) => handleRateBChange(e.target.value)}
                    placeholder={mrpRs || "0.00"}
                    className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Disc (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="99.9"
                      value={discBPercent}
                      onChange={(e) => handlePercentBChange(e.target.value)}
                      placeholder="0.0"
                      className="w-full text-xs pl-2 pr-5 py-1.5 border border-amber-300 rounded-lg font-mono font-bold text-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-amber-700">%</span>
                  </div>
                </div>
              </div>

              {/* Tier C */}
              <div className="bg-emerald-50/50 p-2.5 rounded-xl border-2 border-emerald-400 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-emerald-900 uppercase">Tier C *</span>
                  <span className="text-[9px] text-emerald-700 font-bold">Retail / POS</span>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-0.5">Rate (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={priceCRs}
                    onChange={(e) => handleRateCChange(e.target.value)}
                    placeholder={mrpRs || "0.00"}
                    className="w-full text-xs px-2 py-1.5 border border-emerald-400 rounded-lg font-mono font-black text-emerald-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-0.5">Disc (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="99.9"
                      value={discCPercent}
                      onChange={(e) => handlePercentCChange(e.target.value)}
                      placeholder="0.0"
                      className="w-full text-xs pl-2 pr-5 py-1.5 border border-emerald-400 rounded-lg font-mono font-black text-emerald-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-700">%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">GST Slab (%)</label>
              <select
                value={gstRatePercent}
                onChange={(e) => setGstRatePercent(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
              >
                <option value="0">0% (Nil)</option>
                <option value="5">5% (Grocery / Food)</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">HSN Code</label>
              <input
                type="text"
                value={hsn}
                onChange={(e) => setHsn(e.target.value)}
                placeholder="21069099"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>
          </div>

          {/* Initial Stock at Shop */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-blue-600" />
              <span>Initial Stock at Shop (Optional)</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-600 mb-0.5">Cartons</label>
                <input
                  type="number"
                  min="0"
                  value={stockCartons}
                  onChange={(e) => setStockCartons(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-0.5">Loose Pcs</label>
                <input
                  type="number"
                  min="0"
                  value={stockLoose}
                  onChange={(e) => setStockLoose(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-mono font-bold"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500">
              Product will be saved with all 3 price tiers and appear immediately in billing.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-between gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={closeAfterSave}
                onChange={(e) => setCloseAfterSave(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Close after save</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl transition"
              >
                Cancel [Esc]
              </button>
              <button
                type="button"
                onClick={handleQuickSave}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white rounded-xl shadow-sm transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <span>{isSubmitting ? "Saving..." : "Quick Save [Ctrl+S]"}</span>
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isSubmitting ? "Creating..." : "Add to Bill Immediately [Enter]"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
