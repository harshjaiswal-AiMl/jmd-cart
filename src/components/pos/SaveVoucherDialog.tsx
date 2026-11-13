"use client";

import React, { useEffect, useRef, useState } from "react";
import { Printer, X, AlertCircle, AlertTriangle, CreditCard } from "lucide-react";
import { paiseToIndianWords } from "@/lib/number-to-words";
import { formatUnitTotals } from "@/modules/catalog/units";

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

export type DialogPaymentMode = "CASH" | "UPI" | "CREDIT" | "SPLIT";
export type PrintPaperFormat = "thermal" | "a5" | "a4";

export interface SaveVoucherDialogProps {
  isOpen: boolean;
  onConfirm: (printFormat: PrintPaperFormat) => void;
  onCancel: () => void;
  partyName: string;
  hasLinkedParty?: boolean;
  creditEnabled?: boolean;
  creditLimitPaise?: number;
  currentOutstandingPaise?: number;
  documentType?: "RETAIL" | "GST";
  itemsCount: number;
  totalQtyPcs: number;
  totalAmountPaise: number;
  paymentMode: DialogPaymentMode;
  splitCashRupees?: string;
  splitUpiRupees?: string;
  onSplitChange?: (cashRupees: string, upiRupees: string) => void;
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
  onPaymentModeChange?: (mode: DialogPaymentMode) => void;
}

export function SaveVoucherDialog({
  isOpen,
  onConfirm,
  onCancel,
  partyName,
  hasLinkedParty = false,
  creditEnabled = false,
  creditLimitPaise = 0,
  currentOutstandingPaise = 0,
  documentType = "RETAIL",
  itemsCount,
  totalQtyPcs,
  totalAmountPaise,
  paymentMode,
  splitCashRupees = "",
  splitUpiRupees = "",
  onSplitChange,
  paymentStatus = "PAID",
  tier = "C",
  discountPaise = 0,
  isSaving = false,
  lines = [],
  isEditMode = false,
  editInvoiceNumber,
  editReason = "",
  onEditReasonChange,
  onPaymentModeChange,
}: SaveVoucherDialogProps) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const splitCashRef = useRef<HTMLInputElement>(null);
  const hasShortage = lines.some((l) => l.isShortage);

  const [printFormat, setPrintFormat] = useState<PrintPaperFormat>("thermal");

  const selectFormat = (fmt: PrintPaperFormat) => {
    setPrintFormat(fmt);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`jmd_pos_print_fmt_${paymentMode}`, fmt);
      } catch {}
    }
  };

  useEffect(() => {
    if (isOpen && typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(`jmd_pos_print_fmt_${paymentMode}`) as PrintPaperFormat | null;
        if (saved && (saved === "thermal" || saved === "a5" || saved === "a4")) {
          setPrintFormat(saved);
        } else {
          setPrintFormat("thermal");
        }
      } catch {}
    }
  }, [isOpen, paymentMode]);

  // Compute Credit availability reason
  const creditDisabledReason = (() => {
    if (!hasLinkedParty) return "Select a party for credit";
    if (!creditEnabled) return "No credit for this party";
    if (creditLimitPaise > 0) {
      const projected = currentOutstandingPaise + totalAmountPaise;
      if (projected > creditLimitPaise) {
        const overRupees = Math.ceil((projected - creditLimitPaise) / 100);
        return `Over limit by ₹${overRupees}`;
      }
    }
    return null;
  })();

  const isCreditDisabled = Boolean(creditDisabledReason);
  const canToggleA4 = true;

  // Calculate Split amounts
  const parsedCashPaise = Math.max(0, Math.round((parseFloat(splitCashRupees || "0") || 0) * 100));
  const parsedUpiPaise = Math.max(0, Math.round((parseFloat(splitUpiRupees || "0") || 0) * 100));
  const splitCreditRemainderPaise = Math.max(0, totalAmountPaise - parsedCashPaise - parsedUpiPaise);
  const splitOverpaidPaise = Math.max(0, parsedCashPaise + parsedUpiPaise - totalAmountPaise);
  const splitNeedsParty = paymentMode === "SPLIT" && splitCreditRemainderPaise > 0 && !hasLinkedParty;
  const splitInvalid =
    paymentMode === "SPLIT" &&
    (splitOverpaidPaise > 0 || (parsedCashPaise === 0 && parsedUpiPaise === 0 && !hasLinkedParty) || splitNeedsParty);

  const derivedStatusLabel =
    paymentMode === "CASH" || paymentMode === "UPI"
      ? "PAID (Done)"
      : paymentMode === "CREDIT"
      ? "PENDING (Credit)"
      : splitCreditRemainderPaise === 0
      ? "PAID (Split)"
      : "PARTIAL (Cash/UPI + Credit)";

  useEffect(() => {
    if (!isOpen) return;

    // Focus Split input when Split is selected; otherwise blur background controls
    if (paymentMode === "SPLIT") {
      const t = setTimeout(() => {
        splitCashRef.current?.focus();
        splitCashRef.current?.select();
      }, 20);
      return () => clearTimeout(t);
    }

    if (
      document.activeElement instanceof HTMLElement &&
      document.activeElement.id !== "pos-edit-reason-input" &&
      document.activeElement.id !== "pos-split-cash-input" &&
      document.activeElement.id !== "pos-split-upi-input"
    ) {
      document.activeElement.blur();
    }
  }, [isOpen, paymentMode]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isTypingText =
        target instanceof HTMLInputElement &&
        (target.id === "pos-edit-reason-input" ||
          target.id === "pos-split-cash-input" ||
          target.id === "pos-split-upi-input");

      if (e.key === "Escape" || (!isTypingText && (e.key === "n" || e.key === "N"))) {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
        return;
      }

      if (e.key === "Enter" && !isSaving) {
        if (splitInvalid) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        onConfirm(printFormat);
        return;
      }

      if (!isTypingText) {
        const k = e.key.toLowerCase();
        if (e.key === "1" || k === "c") {
          e.preventDefault();
          e.stopPropagation();
          onPaymentModeChange?.("CASH");
          return;
        }
        if (e.key === "2" || k === "u") {
          e.preventDefault();
          e.stopPropagation();
          onPaymentModeChange?.("UPI");
          return;
        }
        if (e.key === "3" || k === "r") {
          e.preventDefault();
          e.stopPropagation();
          if (!isCreditDisabled) {
            onPaymentModeChange?.("CREDIT");
          }
          return;
        }
        if (e.key === "4" || k === "s") {
          e.preventDefault();
          e.stopPropagation();
          onPaymentModeChange?.("SPLIT");
          return;
        }
        if (k === "t") {
          e.preventDefault();
          e.stopPropagation();
          selectFormat("thermal");
          return;
        }
        if (e.key === "5") {
          e.preventDefault();
          e.stopPropagation();
          selectFormat("a5");
          return;
        }
        if (e.key === "4" || k === "a") {
          e.preventDefault();
          e.stopPropagation();
          selectFormat("a4");
          return;
        }
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          e.stopPropagation();
          const modes: DialogPaymentMode[] = isCreditDisabled
            ? ["CASH", "UPI", "SPLIT"]
            : ["CASH", "UPI", "CREDIT", "SPLIT"];
          const curr = Math.max(0, modes.indexOf(paymentMode));
          const delta = e.key === "ArrowRight" ? 1 : -1;
          const next = (curr + delta + modes.length) % modes.length;
          onPaymentModeChange?.(modes[next]);
          return;
        }
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        if (tableContainerRef.current) {
          tableContainerRef.current.scrollTop += 40;
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        if (tableContainerRef.current) {
          tableContainerRef.current.scrollTop -= 40;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    isOpen,
    onConfirm,
    onCancel,
    isSaving,
    paymentMode,
    onPaymentModeChange,
    isCreditDisabled,
    canToggleA4,
    printFormat,
    splitInvalid,
  ]);

  if (!isOpen) return null;

  const amountInWords = paiseToIndianWords(totalAmountPaise);

  const modesConfig: Array<{
    mode: DialogPaymentMode;
    hotkey: string;
    label: string;
    activeClass: string;
    disabled?: boolean;
    disabledReason?: string | null;
  }> = [
    {
      mode: "CASH",
      hotkey: "C",
      label: "CASH",
      activeClass: "bg-[#790E11] text-white border-[#790E11] ring-2 ring-[#FC830D]",
    },
    {
      mode: "UPI",
      hotkey: "U",
      label: "UPI",
      activeClass: "bg-[#790E11] text-white border-[#790E11] ring-2 ring-[#FC830D]",
    },
    {
      mode: "CREDIT",
      hotkey: "R",
      label: "CREDIT",
      activeClass: "bg-[#790E11] text-white border-[#790E11] ring-2 ring-[#FC830D]",
      disabled: isCreditDisabled,
      disabledReason: creditDisabledReason,
    },
    {
      mode: "SPLIT",
      hotkey: "S",
      label: "SPLIT",
      activeClass: "bg-[#790E11] text-white border-[#790E11] ring-2 ring-[#FC830D]",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      data-testid="pos-finish-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Finish and Print Bill"
    >
      <div className="bg-[#FEFDF7] rounded-2xl shadow-2xl border-2 border-[#790E11] w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden font-sans">
        {/* Header */}
        <div className="bg-[#790E11] text-white px-5 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs bg-[#FDAF18] text-slate-950 px-2 py-0.5 rounded font-black">
              [F2]
            </span>
            <h3 className="font-bold text-base tracking-tight">
              {isEditMode ? `Save Revision: ${editInvoiceNumber || "Invoice"}` : "Finish & Print Bill"}
            </h3>
            <span className="ml-2 text-[11px] font-bold px-2 py-0.5 rounded bg-white/15 text-[#FDAF18]">
              {documentType === "GST" ? "GST Tax Invoice" : "Retail Bill"} (Alt+G)
            </span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-white/80 hover:text-white p-1 rounded-lg transition cursor-pointer"
            title="Cancel [Esc]"
            aria-label="Close Finish Modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1">
          <div className="text-center">
            <p className="text-base font-bold text-slate-900">
              Press <kbd className="px-2 py-0.5 bg-[#FEF3C7] border border-[#FC830D] rounded font-mono text-xs font-black">Enter</kbd> to Save &amp; Print, or <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono text-xs font-bold">Esc</kbd> to return
            </p>
          </div>

          {isEditMode && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-1 text-xs">
              <label className="font-bold text-amber-950 block">Reason for Edit / Revision:</label>
              <input
                id="pos-edit-reason-input"
                type="text"
                value={editReason}
                onChange={(e) => onEditReasonChange?.(e.target.value)}
                placeholder="Reason (e.g. rate correction, discount update) — defaults to: POS voucher edit"
                className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>
          )}

          {hasShortage && (
            <div className="p-3 bg-rose-50 border-2 border-rose-300 rounded-xl text-rose-900 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <p className="font-extrabold text-rose-950">Stock Notice: Negative/Short Inventory</p>
                <p className="text-[11px] text-rose-700 font-normal">Items highlighted below will post negative stock movements and finalize cleanly.</p>
              </div>
            </div>
          )}

          {/* Scrollable Item Preview Table */}
          {lines.length > 0 && (
            <div className="border border-slate-300 rounded-xl overflow-hidden bg-white">
              <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200 flex justify-between items-center text-xs font-bold text-slate-700">
                <span>Items in Bill ({lines.length})</span>
                <span className="text-slate-500 font-normal">↑/↓ scroll</span>
              </div>
              <div
                ref={tableContainerRef}
                className="max-h-40 overflow-y-auto divide-y divide-slate-100 text-xs"
              >
                <table className="w-full border-collapse">
                  <thead className="bg-slate-50 sticky top-0 text-[11px] text-slate-600 uppercase font-bold">
                    <tr>
                      <th className="py-1.5 px-2 text-center w-8">#</th>
                      <th className="py-1.5 px-2 text-left">Product</th>
                      <th className="py-1.5 px-2 text-right">Qty</th>
                      <th className="py-1.5 px-2 text-right">Rate</th>
                      <th className="py-1.5 px-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map((line, idx) => (
                      <tr key={line.id || idx} className={line.isZeroRate ? "bg-rose-50" : ""}>
                        <td className="py-1.5 px-2 text-center font-mono text-slate-500">{idx + 1}</td>
                        <td className="py-1.5 px-2 font-semibold text-slate-900 truncate max-w-[230px]">
                          {line.name} {line.weight ? `· ${line.weight}` : ""}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono text-slate-800">
                          {line.qty} {line.unit}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono text-slate-800">
                          ₹{(line.ratePaise / 100).toFixed(2)}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900">
                          ₹{(line.amountPaise / 100).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Mode of Payment Selector */}
          <div className="bg-white border-2 border-slate-300 rounded-xl p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-[#790E11]" />
                <span>Payment Mode (← / → or C / U / R / S):</span>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {modesConfig.map((cfg) => {
                const active = paymentMode === cfg.mode;
                return (
                  <button
                    key={cfg.mode}
                    type="button"
                    data-payment-mode={cfg.mode}
                    data-active={active ? "true" : "false"}
                    aria-pressed={active}
                    disabled={cfg.disabled}
                    onClick={() => {
                      if (!cfg.disabled) onPaymentModeChange?.(cfg.mode);
                    }}
                    className={`py-2.5 px-2.5 rounded-xl text-xs font-black flex flex-col items-center justify-center gap-1 border-2 transition ${
                      cfg.disabled
                        ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-70"
                        : active
                        ? `${cfg.activeClass} shadow-md cursor-pointer`
                        : "bg-slate-50 text-slate-800 border-slate-200 hover:bg-amber-50 hover:border-[#FC830D] cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <kbd
                        className={`font-mono text-[11px] px-1.5 py-0.5 rounded font-black ${
                          active ? "bg-[#FDAF18] text-slate-950" : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {cfg.hotkey}
                      </kbd>
                      <span>{cfg.label}</span>
                      {active && <span className="ml-0.5 text-[#FDAF18] font-black">↵</span>}
                    </div>
                    {cfg.disabledReason && (
                      <span className="text-[10px] font-semibold text-rose-600 leading-tight text-center">
                        {cfg.disabledReason}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Split Breakdown Panel */}
            {paymentMode === "SPLIT" && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-2 text-xs">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Cash (₹)</label>
                    <input
                      ref={splitCashRef}
                      id="pos-split-cash-input"
                      type="number"
                      step="0.01"
                      min="0"
                      value={splitCashRupees}
                      onChange={(e) => onSplitChange?.(e.target.value, splitUpiRupees)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#790E11] outline-none"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">UPI (₹)</label>
                    <input
                      id="pos-split-upi-input"
                      type="number"
                      step="0.01"
                      min="0"
                      value={splitUpiRupees}
                      onChange={(e) => onSplitChange?.(splitCashRupees, e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#790E11] outline-none"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Credit Rem. (₹)</label>
                    <div className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg font-mono font-bold text-slate-900">
                      ₹{(splitCreditRemainderPaise / 100).toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-slate-700">
                    Settled: ₹{((parsedCashPaise + parsedUpiPaise) / 100).toFixed(2)} / Total: ₹{(totalAmountPaise / 100).toFixed(2)}
                  </span>
                  {splitOverpaidPaise > 0 ? (
                    <span className="text-rose-700">Exceeds bill total by ₹{(splitOverpaidPaise / 100).toFixed(2)}</span>
                  ) : splitNeedsParty ? (
                    <span className="text-rose-700">Walk-in cannot carry Credit remainder</span>
                  ) : (
                    <span className="text-emerald-700">Balance on Credit: ₹{(splitCreditRemainderPaise / 100).toFixed(2)}</span>
                  )}
                </div>
              </div>
            )}

            {/* Print format selector */}
            <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 text-xs flex-wrap gap-2">
              <span className="font-bold text-slate-700">
                Print Format:
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => selectFormat("thermal")}
                  className={`px-2.5 py-1 rounded-lg font-bold border text-xs cursor-pointer transition flex items-center gap-1 ${
                    printFormat === "thermal"
                      ? "bg-[#790E11] text-white border-[#790E11] shadow-xs"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <Printer className="w-3 h-3" />
                  <span>Thermal [T]</span>
                </button>
                <button
                  type="button"
                  onClick={() => selectFormat("a5")}
                  className={`px-2.5 py-1 rounded-lg font-bold border text-xs cursor-pointer transition flex items-center gap-1 ${
                    printFormat === "a5"
                      ? "bg-[#12355B] text-white border-[#12355B] shadow-xs"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <Printer className="w-3 h-3" />
                  <span>A5 [5]</span>
                </button>
                <button
                  type="button"
                  onClick={() => selectFormat("a4")}
                  className={`px-2.5 py-1 rounded-lg font-bold border text-xs cursor-pointer transition flex items-center gap-1 ${
                    printFormat === "a4"
                      ? "bg-[#12355B] text-white border-[#12355B] shadow-xs"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <Printer className="w-3 h-3" />
                  <span>A4 [4]</span>
                </button>
              </div>
            </div>
          </div>

          {/* Summary Card */}
          <div className="bg-white border border-slate-300 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                <span className="text-slate-600 font-medium">Party:</span>
                <span className="font-bold text-slate-900 truncate max-w-[160px]">{partyName}</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                <span className="text-slate-600 font-medium">Status:</span>
                <span className="font-bold text-slate-900 px-1.5 py-0.5 bg-slate-100 rounded">
                  {derivedStatusLabel || paymentStatus} · Tier {tier}
                </span>
              </div>
            </div>

            {discountPaise > 0 && (
              <div className="flex justify-between items-center py-0.5 text-emerald-700 font-semibold">
                <span>Savings:</span>
                <span className="font-mono">-₹{(discountPaise / 100).toFixed(2)}</span>
              </div>
            )}

            <div className="border-t border-slate-200 pt-2 flex justify-between items-baseline">
              <div>
                <span className="text-slate-900 font-bold text-sm">Grand Total ({itemsCount} lines, {formatUnitTotals(lines)}):</span>
              </div>
              <span className="text-xl font-mono font-black text-[#790E11]">
                ₹{(totalAmountPaise / 100).toFixed(2)}
              </span>
            </div>

            {amountInWords && (
              <div className="text-[11px] text-slate-600 text-right font-medium">
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
            disabled={isSaving}
            className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Back [Esc]
          </button>
          <button
            type="button"
            onClick={() => !splitInvalid && onConfirm(printFormat)}
            disabled={isSaving || splitInvalid}
            className="px-5 py-2 bg-[#790E11] hover:bg-[#5E0A0D] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-[#FDAF18]" />
            <span>{isSaving ? "Saving..." : "Save & Print [Enter]"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
