"use client";

import React, { useState } from "react";
import { Package, ShoppingBag } from "lucide-react";

export interface QtyUnitPickerProps {
  productId: string;
  productName: string;
  packSize: number;
  packLabel?: string | null;
  mrpPaise: number;
  availablePieces: number;
  onAdd: (qty: number, unit: "PCS" | "CARTON") => void;
  disabled?: boolean;
}

export function QtyUnitPicker({
  productId,
  productName,
  packSize,
  packLabel,
  mrpPaise,
  availablePieces,
  onAdd,
  disabled,
}: QtyUnitPickerProps) {
  const [unit, setUnit] = useState<"PCS" | "CARTON">("PCS");
  const [qty, setQty] = useState(1);
  const [open, setOpen] = useState(false);

  const effectivePackSize = Math.max(1, packSize || 1);
  const cartonAvailable = effectivePackSize > 1 ? Math.floor(availablePieces / effectivePackSize) : 0;
  const looseAvailable = effectivePackSize > 1 ? availablePieces % effectivePackSize : availablePieces;
  const label = packLabel || "Carton";

  const piecesNeeded = unit === "CARTON" ? qty * effectivePackSize : qty;
  const isOverStock = piecesNeeded > availablePieces;
  const cartonDisabled = effectivePackSize <= 1 || cartonAvailable === 0;

  const pricePerUnit =
    unit === "CARTON"
      ? (mrpPaise * effectivePackSize) / 100
      : mrpPaise / 100;

  const maxAllowed = unit === "CARTON" ? cartonAvailable : availablePieces;

  const handleAdd = () => {
    if (isOverStock || maxAllowed <= 0) return;
    onAdd(qty, unit);
    setQty(1);
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setUnit(cartonDisabled ? "PCS" : "PCS");
          setQty(1);
          setOpen(true);
        }}
        disabled={disabled || availablePieces <= 0}
        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#12355B] hover:bg-[#0E2843] text-white disabled:opacity-30 disabled:cursor-not-allowed shadow-xs transition-all"
      >
        + Add
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 bg-white border border-slate-200 rounded-xl p-2.5 shadow-lg min-w-[210px] text-slate-900">
      {/* Unit Segmented Toggle */}
      <div className="flex rounded-lg overflow-hidden border border-slate-200 text-[11px] font-bold">
        <button
          type="button"
          onClick={() => {
            setUnit("PCS");
            setQty(1);
          }}
          className={`flex-1 py-1 px-1.5 flex items-center justify-center gap-1 transition-colors ${
            unit === "PCS"
              ? "bg-[#12355B] text-white"
              : "bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          <ShoppingBag className="w-3 h-3" /> Pcs
        </button>
        <button
          type="button"
          onClick={() => {
            if (!cartonDisabled) {
              setUnit("CARTON");
              setQty(1);
            }
          }}
          disabled={cartonDisabled}
          className={`flex-1 py-1 px-1.5 flex items-center justify-center gap-1 transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${
            unit === "CARTON"
              ? "bg-[#12355B] text-white"
              : "bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Package className="w-3 h-3" /> {label} (Peti)
        </button>
      </div>

      {/* Stock Information */}
      <div className="text-[10px] text-slate-500 text-center font-medium">
        Available: {cartonAvailable} ctn + {looseAvailable} loose ({availablePieces} pcs)
      </div>

      {/* Price info */}
      <div className="text-[11px] font-bold text-[#12355B] text-center">
        ₹{pricePerUnit.toFixed(2)} / {unit === "CARTON" ? `${label} (${effectivePackSize} pcs)` : "pc"}
      </div>

      {/* Quantity Stepper */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center hover:bg-slate-200 active:scale-95"
        >
          -
        </button>
        <input
          type="number"
          min={1}
          max={maxAllowed > 0 ? maxAllowed : 1}
          value={qty}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10) || 1;
            setQty(Math.max(1, v));
          }}
          className="flex-1 text-center font-bold text-xs border border-slate-200 rounded-lg py-1 focus:outline-none focus:ring-1 focus:ring-[#12355B]"
        />
        <button
          type="button"
          onClick={() => setQty((q) => Math.min(maxAllowed > 0 ? maxAllowed : 1, q + 1))}
          disabled={qty >= maxAllowed}
          className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center hover:bg-slate-200 active:scale-95 disabled:opacity-40"
        >
          +
        </button>
      </div>

      {/* Over-stock Warning */}
      {isOverStock && (
        <p className="text-[10px] text-rose-600 font-semibold text-center">
          Only {maxAllowed} {unit === "CARTON" ? `${label}(s)` : "pcs"} available
        </p>
      )}

      {/* Action Buttons */}
      <div className="flex gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setQty(1);
          }}
          className="flex-1 py-1 text-[11px] font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleAdd}
          disabled={isOverStock || maxAllowed <= 0}
          className="flex-1 py-1 text-[11px] font-bold text-white bg-[#12355B] hover:bg-[#0E2843] rounded-lg disabled:opacity-40"
        >
          Add {unit === "CARTON" ? label : "Pcs"}
        </button>
      </div>
    </div>
  );
}
