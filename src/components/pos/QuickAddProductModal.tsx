"use client";

import React, { useState } from "react";
import { X, Plus, AlertTriangle, Package, Check } from "lucide-react";
import { posQuickAddProductAction } from "@/app/shop/pos/actions";

interface QuickAddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductCreated: (newProduct: any, initialQtyPcs: number) => void;
  companies: Array<{ id: string; name: string }>;
  locationId: string;
  initialSearchName?: string;
}

export function QuickAddProductModal({
  isOpen,
  onClose,
  onProductCreated,
  companies,
  locationId,
  initialSearchName = "",
}: QuickAddProductModalProps) {
  const [name, setName] = useState(initialSearchName);
  const [companyName, setCompanyName] = useState("");
  const [weight, setWeight] = useState("");
  const [packSize, setPackSize] = useState("1");
  const [mrpRs, setMrpRs] = useState("");
  const [priceCRs, setPriceCRs] = useState("");
  const [discPercent, setDiscPercent] = useState("");

  const handleMrpChange = (val: string) => {
    setMrpRs(val);
    const mrp = parseFloat(val) || 0;
    const rate = parseFloat(priceCRs) || 0;
    if (mrp > 0 && rate > 0) {
      setDiscPercent(((mrp - rate) / mrp * 100).toFixed(1));
    }
  };

  const handleRateChange = (val: string) => {
    setPriceCRs(val);
    const mrp = parseFloat(mrpRs) || 0;
    const rate = parseFloat(val) || 0;
    if (mrp > 0 && rate > 0) {
      setDiscPercent(((mrp - rate) / mrp * 100).toFixed(1));
    }
  };

  const handlePercentChange = (val: string) => {
    setDiscPercent(val);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("Please enter product name");
      return;
    }
    const mrp = parseFloat(mrpRs) || 0;
    const rate = parseFloat(priceCRs) || mrp;
    if (mrp <= 0) {
      setErrorMsg("Please enter a valid MRP greater than zero");
      return;
    }

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
      priceCPaise: Math.round(rate * 100),
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

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-lg overflow-hidden font-sans">
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

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
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

          <div className="grid grid-cols-4 gap-2">
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
                className="w-full text-xs px-2 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Sale Rate (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={priceCRs}
                onChange={(e) => handleRateChange(e.target.value)}
                placeholder="95.00"
                className="w-full text-xs px-2 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold text-emerald-700"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Disc (%)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="99.9"
                  disabled={!mrpRs || parseFloat(mrpRs) <= 0}
                  value={discPercent}
                  onChange={(e) => handlePercentChange(e.target.value)}
                  placeholder="0.0"
                  className="w-full text-xs pl-2 pr-6 py-2 border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-emerald-800 disabled:bg-gray-100 disabled:opacity-50"
                />
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-700">%</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Pcs / Ctn</label>
              <input
                type="number"
                min="1"
                value={packSize}
                onChange={(e) => setPackSize(e.target.value)}
                placeholder="1"
                className="w-full text-xs px-2 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">GST Slab (%)</label>
              <select
                value={gstRatePercent}
                onChange={(e) => setGstRatePercent(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                  className="w-full text-xs px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-0.5">Loose Pcs</label>
                <input
                  type="number"
                  min="0"
                  value={stockLoose}
                  onChange={(e) => setStockLoose(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-mono"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500">
              Product will be flagged &quot;needs review&quot; and appear in Data Quality audit.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl transition"
            >
              Cancel [Esc]
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmitting ? "Creating..." : "Add to Bill Immediately [Enter]"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
