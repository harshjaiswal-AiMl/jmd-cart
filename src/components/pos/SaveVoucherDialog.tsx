"use client";

import React, { useEffect, useRef } from "react";
import { Printer, X, AlertCircle, AlertTriangle } from "lucide-react";
import { paiseToIndianWords } from "@/lib/number-to-words";

export interface VoucherPreviewLine {
  id: string;
  name: string;
  weight?: string | null;
  qty: number;
  unit: string;
  totalPieces: number;
  ratePaise: number;
  discountPercent: number;
  amountPaise: number;
  isShortage?: boolean;
  isZeroRate?: boolean;
}

export interface SaveVoucherDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  partyName: string;
  itemsCount: number;
  totalQtyPcs: number;
  totalAmountPaise: number;
  paymentMode: string;
  paymentStatus?: string;
  tier?: string;
  billDate?: string;
  discountPaise?: number;
  isSaving?: boolean;
  lines?: VoucherPreviewLine[];
  isEditMode?: boolean;
  editInvoiceNumber?: string;
  editReason?: string;
  onEditReasonChange?: (reason: string) => void;
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
  paymentStatus = "PAID",
  tier = "C",
  billDate,
  discountPaise = 0,
  isSaving = false,
  lines = [],
  isEditMode = false,
  editInvoiceNumber,
  editReason = "",
  onEditReasonChange,
}: SaveVoucherDialogProps) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const hasShortage = lines.some((l) => l.isShortage);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" || e.key === "n" || e.key === "N") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Enter" && !isSaving && !hasShortage) {
        if (isEditMode && (!editReason || editReason.trim().length < 3)) return;
        e.preventDefault();
        onConfirm();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (tableContainerRef.current) {
          tableContainerRef.current.scrollTop += 40;
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (tableContainerRef.current) {
          tableContainerRef.current.scrollTop -= 40;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onConfirm, onCancel, isSaving, isEditMode, editReason, hasShortage]);

  if (!isOpen) return null;

  const amountInWords = paiseToIndianWords(totalAmountPaise);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border-2 border-slate-300 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden font-sans">
        {/* Header */}
        <div className="bg-[#0f172a] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs bg-amber-400 text-slate-950 px-2 py-0.5 rounded font-black">
              [F2]
            </span>
            <h3 className="font-bold text-sm tracking-tight">{isEditMode ? `Save Revision: ${editInvoiceNumber || "Invoice"}` : "Save Voucher Confirmation"}</h3>
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

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1">
          <div className="text-center">
            <p className="text-base font-bold text-slate-800">
              Save this sales voucher and finalize bill?
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-[11px] font-bold">Enter</kbd> to Confirm &amp; Print, or <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-[11px] font-bold">Esc</kbd> to return to editing.
            </p>
          </div>

          {/* Insufficient Stock Warning Banner */}
          {hasShortage && (
            <div className="p-3 bg-rose-50 border-2 border-rose-400 rounded-xl text-rose-900 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <p className="font-extrabold text-rose-950">STRICT STOCK BLOCK: Insufficient Stock Detected</p>
                <p className="text-[11px] text-rose-700 font-normal">One or more items in this bill have 0 or insufficient stock (highlighted in red below). Bill cannot be saved until stock is corrected or quantities reduced.</p>
              </div>
            </div>
          )}

          {/* Scrollable Item Preview Table (Part D) */}
          {lines.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200 flex justify-between items-center text-[11px] font-bold text-slate-700">
                <span>Items in Voucher ({lines.length})</span>
                <span className="text-slate-500 font-normal">Use ↑/↓ arrows to scroll table</span>
              </div>
              <div
                ref={tableContainerRef}
                className="max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs"
              >
                <table className="w-full border-collapse">
                  <thead className="bg-slate-50 sticky top-0 text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                    <tr>
                      <th className="py-1.5 px-2 text-center w-8">#</th>
                      <th className="py-1.5 px-2 text-left">Item Description</th>
                      <th className="py-1.5 px-2 text-right">Qty</th>
                      <th className="py-1.5 px-2 text-right">Rate</th>
                      <th className="py-1.5 px-2 text-right">Disc %</th>
                      <th className="py-1.5 px-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map((line, idx) => {
                      const isProblem = line.isZeroRate || line.ratePaise <= 0 || line.isShortage;
                      return (
                        <tr
                          key={line.id || idx}
                          className={isProblem ? "bg-rose-50/70" : "hover:bg-slate-50/60"}
                        >
                          <td className="py-1.5 px-2 text-center font-mono text-[11px] text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-1.5 px-2 font-medium text-slate-900 truncate max-w-[220px]">
                            {line.name} {line.weight ? `· ${line.weight}` : ""}
                            {line.isShortage && (
                              <span className="ml-1.5 inline-flex items-center text-[10px] text-rose-600 font-bold">
                                <AlertTriangle className="w-3 h-3 mr-0.5 inline" /> Stock Short
                              </span>
                            )}
                            {line.ratePaise <= 0 && (
                              <span className="ml-1.5 inline-flex items-center text-[10px] text-amber-600 font-bold">
                                <AlertCircle className="w-3 h-3 mr-0.5 inline" /> No Rate
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono text-slate-700">
                            {line.qty} {line.unit}{" "}
                            {line.unit !== "Pcs" && (
                              <span className="text-[10px] text-slate-400">({line.totalPieces} pcs)</span>
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono text-slate-800">
                            ₹{(line.ratePaise / 100).toFixed(2)}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono text-slate-600">
                            {line.discountPercent > 0 ? `${line.discountPercent}%` : "0%"}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900">
                            ₹{(line.amountPaise / 100).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Voucher Summary Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex justify-between items-center py-0.5 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Billed Party:</span>
                <span className="font-bold text-slate-900 truncate max-w-[150px]">{partyName}</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Pricing Tier:</span>
                <span className="font-bold text-blue-900 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                  List {tier}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex justify-between items-center py-0.5 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Total Lines / Pieces:</span>
                <span className="font-mono font-bold text-slate-900">
                  {itemsCount} lines ({totalQtyPcs} pcs)
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Payment Mode &amp; Status:</span>
                <span className="font-bold uppercase tracking-wider text-slate-900 px-1.5 py-0.2 bg-white border border-slate-200 rounded">
                  {paymentMode} · {paymentStatus}
                </span>
              </div>
            </div>

            {discountPaise > 0 && (
              <div className="flex justify-between items-center py-0.5 text-emerald-700 font-semibold">
                <span>Total Discount / Savings:</span>
                <span className="font-mono">-₹{(discountPaise / 100).toFixed(2)}</span>
              </div>
            )}

            <div className="border-t border-slate-300 pt-2 flex justify-between items-baseline">
              <div>
                <span className="text-slate-800 font-bold text-sm">Grand Total:</span>
                <span className="text-[10px] text-slate-500 italic ml-1.5">(GST included)</span>
              </div>
              <span className="text-lg font-mono font-black text-emerald-700">
                ₹{(totalAmountPaise / 100).toFixed(2)}
              </span>
            </div>

            {amountInWords && (
              <div className="text-[11px] text-slate-500 italic text-right">
                {amountInWords}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-slate-100 px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving || (isEditMode && (!editReason || editReason.trim().length < 3))}
            className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl transition shadow-2xs active:scale-95"
          >
            No, Continue Editing [Esc / N]
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSaving || hasShortage}
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
