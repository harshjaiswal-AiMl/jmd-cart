"use client";

import React, { useState } from "react";
import { recordCollectionAction } from "@/app/van/collections/actions";
import { BluetoothCollectionPrintButton } from "./bluetooth-collection-print-button";
import {
  X,
  Banknote,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Wallet,
} from "lucide-react";

interface CollectionModalProps {
  party: {
    id: string;
    name: string;
    phone?: string | null;
    outstandingPaise: number;
  } | null;
  vanLocationId?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CollectionModal({
  party,
  vanLocationId,
  isOpen,
  onClose,
  onSuccess,
}: CollectionModalProps) {
  const [amountStr, setAmountStr] = useState("");
  const [mode, setMode] = useState<"CASH" | "UPI">("CASH");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedReceipt, setCompletedReceipt] = useState<{
    id: string;
    receiptNo: string;
    amountPaise: number;
    currentOutstandingPaise: number;
  } | null>(null);

  if (!isOpen || !party) return null;

  const handleQuickAmount = (rupees: number) => {
    setAmountStr(String(rupees));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amountRupees = parseFloat(amountStr);
    if (isNaN(amountRupees) || amountRupees <= 0) {
      setError("Please enter a valid amount greater than ₹0.");
      return;
    }

    const amountPaise = Math.round(amountRupees * 100);

    setIsSubmitting(true);
    try {
      const res = await recordCollectionAction({
        partyId: party.id,
        amountPaise,
        mode,
        vanLocationId: vanLocationId || null,
        notes: notes.trim() || undefined,
      });

      if (!res.success || !res.receipt) {
        throw new Error(res.error || "Failed to record collection.");
      }

      setCompletedReceipt({
        id: res.receipt.id,
        receiptNo: res.receipt.receiptNo,
        amountPaise: res.receipt.amountPaise,
        currentOutstandingPaise: res.receipt.currentOutstandingPaise,
      });
      onSuccess?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error recording collection");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setAmountStr("");
    setNotes("");
    setError(null);
    setCompletedReceipt(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Record Payment Collection</h2>
              <p className="text-xs text-slate-400">On-Route / Ledger Receipt</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto">
          {/* Party Info Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Customer / Retailer</p>
              <h3 className="text-sm font-black text-white mt-0.5">{party.name}</h3>
              {party.phone && (
                <p className="text-xs text-slate-400 mt-0.5">Ph: {party.phone}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 font-medium">Current Due</p>
              <p
                className={`text-base font-black ${
                  party.outstandingPaise > 0 ? "text-amber-400" : "text-emerald-400"
                }`}
              >
                ₹{(party.outstandingPaise / 100).toFixed(2)}
              </p>
            </div>
          </div>

          {completedReceipt ? (
            /* Success State */
            <div className="space-y-4 py-2 animate-in fade-in">
              <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/30 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">Collection Successful!</h3>
                <p className="text-xs font-mono font-bold text-emerald-300">
                  Receipt #{completedReceipt.receiptNo}
                </p>
                <div className="pt-2 text-xs text-slate-300 flex justify-between px-4 border-t border-emerald-500/20">
                  <span>Collected:</span>
                  <strong className="text-white">
                    ₹{(completedReceipt.amountPaise / 100).toFixed(2)}
                  </strong>
                </div>
                <div className="text-xs text-slate-300 flex justify-between px-4">
                  <span>Remaining Due:</span>
                  <strong className="text-amber-300">
                    ₹{(completedReceipt.currentOutstandingPaise / 100).toFixed(2)}
                  </strong>
                </div>
              </div>

              {/* 1-Tap Bluetooth Print */}
              <BluetoothCollectionPrintButton
                receiptId={completedReceipt.id}
                receiptNo={completedReceipt.receiptNo}
                variant="primary"
              />

              <button
                type="button"
                onClick={handleClose}
                className="w-full py-2.5 rounded-2xl text-xs font-bold bg-slate-800 text-white hover:bg-slate-700 transition"
              >
                Done / Close
              </button>
            </div>
          ) : (
            /* Form State */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Payment Mode */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Payment Tender</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("CASH")}
                    className={`p-3 rounded-2xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                      mode === "CASH"
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300 ring-1 ring-emerald-500/40"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Cash</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("UPI")}
                    className={`p-3 rounded-2xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                      mode === "UPI"
                        ? "bg-blue-500/10 border-blue-500/40 text-blue-300 ring-1 ring-blue-500/40"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>UPI / QR</span>
                  </button>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Amount Received (₹)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-lg font-black text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              {/* Quick Amount Chips */}
              <div className="flex flex-wrap gap-1.5">
                {party.outstandingPaise > 0 && (
                  <button
                    type="button"
                    onClick={() => handleQuickAmount(party.outstandingPaise / 100)}
                    className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20"
                  >
                    Full: ₹{(party.outstandingPaise / 100).toFixed(0)}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleQuickAmount(500)}
                  className="px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  ₹500
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAmount(1000)}
                  className="px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  ₹1,000
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAmount(2000)}
                  className="px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  ₹2,000
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAmount(5000)}
                  className="px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  ₹5,000
                </button>
              </div>

              {/* Notes Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Notes / Reference (Optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. UPI Ref / Cash at shop"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-2xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Recording Collection...</span>
                  </>
                ) : (
                  <span>Confirm Collection & Issue Receipt</span>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
