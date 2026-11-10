"use client";

import React, { useState } from "react";
import { X, AlertTriangle, Check, ShieldAlert } from "lucide-react";
import { posStockCorrectionAction } from "@/app/shop/pos/actions";

interface StockCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newQty: number) => void;
  productId: string;
  productName: string;
  locationId: string;
  currentStock: number;
  neededStock: number;
  cashierRole: string;
}

export function StockCorrectionModal({
  isOpen,
  onClose,
  onSuccess,
  productId,
  productName,
  locationId,
  currentStock,
  neededStock,
  cashierRole,
}: StockCorrectionModalProps) {
  const defaultDiff = Math.max(1, neededStock - currentStock);
  const [addQty, setAddQty] = useState(String(defaultDiff));
  const [reason, setReason] = useState("Physical stock found on shelf / uncounted");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const qtyNum = parseInt(addQty, 10) || 0;
  const isShopRole = cashierRole === "SHOP";
  const exceedsCashierLimit = isShopRole && qtyNum > 500;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (qtyNum <= 0) {
      setErrorMsg("Quantity must be greater than zero");
      return;
    }
    if (exceedsCashierLimit) {
      setErrorMsg("Cashier quick stock correction limit is 500 pieces. Above 500 requires Admin approval.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await posStockCorrectionAction({
      productId,
      locationId,
      addQty: qtyNum,
      reason: reason.trim() || "POS on-the-spot stock correction",
    });

    setIsSubmitting(false);

    if (res.success && res.newQty !== undefined) {
      onSuccess(res.newQty);
      onClose();
    } else {
      setErrorMsg(res.error || "Failed to update stock");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border-2 border-amber-300 w-full max-w-md overflow-hidden font-sans">
        {/* Header */}
        <div className="bg-amber-600 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs bg-amber-900 text-amber-100 px-2 py-0.5 rounded font-black">
              Stock Fix
            </span>
            <h3 className="font-bold text-sm tracking-tight">On-The-Spot Stock Correction</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-amber-100 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 space-y-1">
            <div className="text-xs font-bold text-amber-950">{productName}</div>
            <div className="flex items-center justify-between text-xs text-amber-900 pt-1">
              <span>System Stock: <strong>{currentStock} pcs</strong></span>
              <span>Requested in Bill: <strong>{neededStock} pcs</strong></span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">
              Quantity to Add to Shop Stock (Pieces) *
            </label>
            <input
              type="number"
              min="1"
              max={isShopRole ? 500 : 50000}
              value={addQty}
              onChange={(e) => setAddQty(e.target.value)}
              required
              autoFocus
              className="w-full text-sm font-mono font-bold px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            {isShopRole && (
              <p className="text-[10px] text-slate-500">
                Cashier limit: up to 500 pieces per day. Above 500 requires Admin approval.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">Correction Reason *</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Physical stock found on shelf / uncounted"
              required
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
            />
            <p className="text-[10px] text-slate-400">
              Logged in audit trail and reviewable by Administrator / Accountant.
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
              disabled={isSubmitting || exceedsCashierLimit}
              className="px-5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? "Updating..." : "Update Stock & Continue [Enter]"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
