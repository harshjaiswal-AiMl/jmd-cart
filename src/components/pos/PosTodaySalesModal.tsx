"use client";

import React, { useEffect, useState } from "react";
import { X, Calendar, RefreshCw, Banknote, Smartphone, CreditCard, Clock, Receipt } from "lucide-react";
import { getPosTodaySalesSummaryAction } from "@/app/shop/pos/actions";

interface PosTodaySalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationId: string;
  locationName: string;
}

export function PosTodaySalesModal({
  isOpen,
  onClose,
  locationId,
  locationName,
}: PosTodaySalesModalProps) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{
    totalBills: number;
    totalSalesPaise: number;
    cashPaise: number;
    upiPaise: number;
    creditPaise: number;
    pendingCount: number;
  } | null>(null);

  const fetchSummary = async () => {
    setLoading(true);
    const res = await getPosTodaySalesSummaryAction(locationId);
    setLoading(false);
    if (res.success && res.summary) {
      setSummary(res.summary);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, locationId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-md overflow-hidden font-sans">
        {/* Header */}
        <div className="bg-[#0f172a] text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs bg-blue-500 text-white px-2 py-0.5 rounded font-black">
              [F9]
            </span>
            <h3 className="font-bold text-sm tracking-tight">Today&apos;s Total Sales &mdash; {locationName}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchSummary}
              disabled={loading}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {loading && !summary ? (
            <div className="p-8 text-center text-xs text-slate-500">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-blue-600 mb-2" />
              <span>Loading today&apos;s sales figures...</span>
            </div>
          ) : summary ? (
            <>
              {/* Grand Total Card */}
              <div className="p-4 bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-xl shadow-xs space-y-1 text-center">
                <span className="text-[11px] font-bold text-blue-200 uppercase tracking-wider">
                  Total Sales Amount
                </span>
                <div className="text-2xl font-black font-mono">
                  ₹{((summary.totalSalesPaise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-blue-200">
                  {summary.totalBills} Bills Issued Today
                </div>
              </div>

              {/* Breakdown by Payment Mode */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-1">
                  <Banknote className="w-4 h-4 text-emerald-700 mx-auto" />
                  <div className="text-[10px] font-bold text-emerald-800 uppercase">Cash</div>
                  <div className="text-xs font-mono font-bold text-emerald-950">
                    ₹{((summary.cashPaise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-center space-y-1">
                  <Smartphone className="w-4 h-4 text-purple-700 mx-auto" />
                  <div className="text-[10px] font-bold text-purple-800 uppercase">UPI</div>
                  <div className="text-xs font-mono font-bold text-purple-950">
                    ₹{((summary.upiPaise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-1">
                  <CreditCard className="w-4 h-4 text-amber-700 mx-auto" />
                  <div className="text-[10px] font-bold text-amber-800 uppercase">Credit</div>
                  <div className="text-xs font-mono font-bold text-amber-950">
                    ₹{((summary.creditPaise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Status footer */}
              {summary.pendingCount > 0 && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-700">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>Unsettled / Pending Bills</span>
                  </div>
                  <span className="font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                    {summary.pendingCount}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="p-6 text-center text-xs text-slate-500">
              No sales recorded for today yet.
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
            >
              Close [Esc]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
