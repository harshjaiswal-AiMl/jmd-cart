"use client";

import React, { useEffect } from "react";
import { X, Package, Warehouse, Store, Tag, IndianRupee, Layers } from "lucide-react";
import { SearchableProduct } from "@/lib/search/smart-search";

interface ItemInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: SearchableProduct | null;
  lastPartyRatePaise?: number | null;
  partyName?: string;
}

export function ItemInfoModal({
  isOpen,
  onClose,
  product,
  lastPartyRatePaise,
  partyName,
}: ItemInfoModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !product) return null;

  const weightText = product.weight || (product.weightValue ? `${product.weightValue}${product.weightUnit || "g"}` : "N/A");
  const packSize = Math.max(1, product.packSize || 1);
  const shopPcs = product.shopStockQty ?? 0;
  const godownPcs = product.godownStockQty ?? 0;
  const godownCartons = Math.floor(godownPcs / packSize);
  const godownLoose = godownPcs % packSize;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-lg overflow-hidden font-sans">
        {/* Header */}
        <div className="bg-[#0f172a] text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs bg-slate-800 text-amber-300 px-2 py-0.5 rounded border border-slate-700 font-bold">
              [F8]
            </span>
            <h3 className="font-bold text-sm tracking-tight">Item Master Diagnostics</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
            title="Close [Esc]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Product Title Bar */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                {product.companyName || "Generic FMCG"} • {product.categoryName || "General"}
              </span>
              <h2 className="text-lg font-black text-slate-900 mt-0.5">
                {product.name} {weightText}
              </h2>
            </div>
            <div className="text-right shrink-0">
              <span className="font-mono text-xs bg-white text-slate-800 px-2 py-1 rounded-md border border-slate-300 font-bold block shadow-2xs">
                {product.shortCode}
              </span>
              <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                HSN: {product.hsn || "1905"} ({((product.gstRateBp || 0) / 100).toFixed(0)}% GST)
              </span>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="p-5 space-y-4 text-xs">
          {/* Inventory Breakdown */}
          <div>
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-2">
              Live Stock Distribution
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                <div className="flex items-center gap-1.5 text-emerald-800 font-bold mb-1">
                  <Store className="w-4 h-4" />
                  <span>Shop Floor (Retail Loose)</span>
                </div>
                <div className="text-xl font-mono font-black text-emerald-950">
                  {shopPcs} <span className="text-xs font-normal text-emerald-800">pcs</span>
                </div>
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                <div className="flex items-center gap-1.5 text-blue-800 font-bold mb-1">
                  <Warehouse className="w-4 h-4" />
                  <span>Godown Reserve</span>
                </div>
                <div className="text-xl font-mono font-black text-blue-950">
                  {godownCartons} <span className="text-xs font-normal text-blue-800">ctn</span>
                  {godownLoose > 0 && (
                    <span className="text-xs font-normal text-blue-700 ml-1">+{godownLoose} pcs</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Packaging & Rates */}
          <div>
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-2">
              Packaging & Pricing Slabs
            </span>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[10px] text-slate-500 block font-bold">PACK SIZE</span>
                <span className="text-sm font-mono font-black text-slate-900 mt-0.5 block">
                  {packSize} pcs/ctn
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[10px] text-slate-500 block font-bold">LIST PRICE (MRP)</span>
                <span className="text-sm font-mono font-black text-slate-900 mt-0.5 block">
                  ₹{((product.mrpPaise || 0) / 100).toFixed(2)}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[10px] text-slate-500 block font-bold">TIER A / B / C</span>
                <span className="text-sm font-mono font-bold text-slate-900 mt-0.5 block">
                  ₹{((product.priceAPaise || product.mrpPaise || 0) / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Party Billed Rate History */}
          <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold text-amber-800 uppercase block">
                Last Billed Rate to {partyName || "Current Party"}
              </span>
              <span className="text-xs text-amber-950 mt-0.5 block font-medium">
                {lastPartyRatePaise
                  ? `₹${(lastPartyRatePaise / 100).toFixed(2)} per piece`
                  : "No prior purchase on record for this party"}
              </span>
            </div>
            <IndianRupee className="w-5 h-5 text-amber-600 shrink-0" />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-5 py-3 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition shadow-2xs"
          >
            Close [Esc]
          </button>
        </div>
      </div>
    </div>
  );
}
