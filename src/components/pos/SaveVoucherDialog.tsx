"use client";

import React, { useEffect } from "react";
import { Check, X, Printer, AlertCircle } from "lucide-react";

interface SaveVoucherDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  partyName: string;
  itemsCount: number;
  totalQtyPcs: number;
  totalAmountPaise: number;
  paymentMode: string;
  isSaving?: boolean;
}

export function SaveVoucherDialog({
  isOpen,
  onConfirm,
  onCancel,
  partyName,
  itemsCount,
  totalQtyPcs,
  totalAmountPaise,
  paymentMode,
  isSaving = false,
}: SaveVoucherDialogProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !isSaving) {
        e.preventDefault();
        onConfirm();
      } else if (e.key === "Escape" || e.key === "n" || e.key === "N") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "y" || e.key === "Y") {
        e.preventDefault();
        onConfirm();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onConfirm, onCancel, isSaving]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border-2 border-slate-300 w-full max-w-md overflow-hidden font-sans">
        {/* Header */}
        <div className="bg-[#0f172a] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs bg-amber-400 text-slate-950 px-2 py-0.5 rounded font-black">
              [F2]
            </span>
            <h3 className="font-bold text-sm tracking-tight">Save Voucher Confirmation</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
            title="Cancel [Esc / N]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="text-center">
            <p className="text-base font-bold text-slate-800">
              Save this sales voucher and finalize bill?
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-[11px] font-bold">Enter</kbd> to Confirm &amp; Print, or <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-[11px] font-bold">Esc</kbd> to return to editing.
            </p>
          </div>

          {/* Voucher Summary Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs">
            <div className="flex justify-between items-center py-0.5">
              <span className="text-slate-500 font-medium">Billed Party:</span>
              <span className="font-bold text-slate-900 truncate max-w-[200px]">{partyName}</span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-slate-500 font-medium">Items / Total Pieces:</span>
              <span className="font-mono font-bold text-slate-900">
                {itemsCount} lines ({totalQtyPcs} pcs)
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-slate-500 font-medium">Payment Mode:</span>
              <span className="font-bold uppercase tracking-wider text-slate-900 px-2 py-0.5 bg-white border border-slate-200 rounded">
                {paymentMode}
              </span>
            </div>
            <div className="border-t border-slate-200 pt-2 flex justify-between items-center">
              <span className="text-slate-700 font-bold text-sm">Grand Total:</span>
              <span className="text-base font-mono font-black text-emerald-700">
                ₹{(totalAmountPaise / 100).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="bg-slate-100 px-5 py-3.5 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl transition shadow-2xs active:scale-95"
          >
            No, Continue Editing [Esc / N]
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSaving}
            className="px-5 py-2 bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition shadow-2xs flex items-center gap-2 active:scale-95"
          >
            {isSaving ? (
              <span>Saving...</span>
            ) : (
              <>
                <Printer className="w-3.5 h-3.5" />
                <span>Yes, Save &amp; Print [Enter]</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
