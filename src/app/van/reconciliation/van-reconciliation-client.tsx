"use client";

import React, { useState } from "react";
import { VanReconciliationReport, CashHandoverWithDetails } from "@/modules/van/van.types";
import { reconcileVanDayAction, confirmCashHandoverAction } from "./actions";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Printer,
  FileCheck,
  Coins,
  QrCode,
  PackageCheck,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Props {
  initialReport: VanReconciliationReport;
  initialHandover?: CashHandoverWithDetails | null;
  userRole: string;
}

export function VanReconciliationClient({ initialReport, initialHandover, userRole }: Props) {
  const router = useRouter();
  const [report, setReport] = useState<VanReconciliationReport>(initialReport);
  const [handover, setHandover] = useState<CashHandoverWithDetails | null>(
    initialHandover ?? null
  );
  const [notes, setNotes] = useState(initialReport.vanDay.notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Cash Handover State
  const [receivedCashRupees, setReceivedCashRupees] = useState<number>(
    initialHandover
      ? Math.round(initialHandover.receivedCashPaise / 100)
      : Math.round(initialReport.financials.totalCashInHandPaise / 100)
  );
  const [handoverNotes, setHandoverNotes] = useState(initialHandover?.notes || "");
  const [isConfirmingHandover, setIsConfirmingHandover] = useState(false);

  // Form state: counts per productId { cartons, pieces }
  const [counts, setCounts] = useState<Record<string, { cartons: number; pieces: number }>>(() => {
    const initial: Record<string, { cartons: number; pieces: number }> = {};
    for (const line of initialReport.lines) {
      if (initialReport.isReconciled) {
        initial[line.productId] = {
          cartons: Math.floor(line.returnedQty / line.packSize),
          pieces: line.returnedQty % line.packSize,
        };
      } else {
        // Default to expected quantity
        initial[line.productId] = {
          cartons: Math.floor(line.expectedQty / line.packSize),
          pieces: line.expectedQty % line.packSize,
        };
      }
    }
    return initial;
  });

  const isReconciled = report.isReconciled;

  // Compute live discrepancy totals based on client edits
  const liveStats = React.useMemo(() => {
    let totalShortagePaise = 0;
    let totalExcessPaise = 0;
    let totalReturnedPieces = 0;

    for (const line of report.lines) {
      const c = counts[line.productId] || { cartons: 0, pieces: 0 };
      const returnedPieces = c.cartons * line.packSize + c.pieces;
      totalReturnedPieces += returnedPieces;

      if (returnedPieces < line.expectedQty) {
        totalShortagePaise += (line.expectedQty - returnedPieces) * line.mrpPaise;
      } else if (returnedPieces > line.expectedQty) {
        totalExcessPaise += (returnedPieces - line.expectedQty) * line.mrpPaise;
      }
    }

    return {
      totalShortagePaise,
      totalExcessPaise,
      totalReturnedPieces,
      hasDiscrepancy: totalShortagePaise > 0 || totalExcessPaise > 0,
    };
  }, [counts, report.lines]);

  const updateCount = (productId: string, field: "cartons" | "pieces", val: number) => {
    if (isReconciled) return;
    const cleanVal = Math.max(0, isNaN(val) ? 0 : val);
    setCounts((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: cleanVal,
      },
    }));
  };

  const handleResetToExpected = () => {
    if (isReconciled) return;
    const updated: Record<string, { cartons: number; pieces: number }> = {};
    for (const line of report.lines) {
      updated[line.productId] = {
        cartons: Math.floor(line.expectedQty / line.packSize),
        pieces: line.expectedQty % line.packSize,
      };
    }
    setCounts(updated);
  };

  const handleZeroReturns = () => {
    if (isReconciled) return;
    const updated: Record<string, { cartons: number; pieces: number }> = {};
    for (const line of report.lines) {
      updated[line.productId] = { cartons: 0, pieces: 0 };
    }
    setCounts(updated);
  };

  const handleSubmit = async () => {
    if (isReconciled || isSubmitting) return;

    if (liveStats.hasDiscrepancy) {
      const confirmDiscrepancy = window.confirm(
        `Discrepancy detected:\nShortage: ₹${(liveStats.totalShortagePaise / 100).toFixed(
          2
        )}\nExcess: ₹${(liveStats.totalExcessPaise / 100).toFixed(
          2
        )}\n\nAre you sure you want to finalize this reconciliation?`
      );
      if (!confirmDiscrepancy) return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    const items = report.lines.map((l) => ({
      productId: l.productId,
      cartons: counts[l.productId]?.cartons ?? 0,
      pieces: counts[l.productId]?.pieces ?? 0,
    }));

    const res = await reconcileVanDayAction({
      vanDayId: report.vanDay.id,
      notes,
      items,
    });

    setIsSubmitting(false);

    if (res.success && res.data) {
      setReport(res.data);
      setSuccessMsg("Van day successfully reconciled! Stock returned to Central Godown.");
      router.refresh();
    } else {
      setError(res.error || "Failed to reconcile van day");
    }
  };

  const handleConfirmHandover = async () => {
    if (isConfirmingHandover) return;
    setIsConfirmingHandover(true);
    setError(null);
    setSuccessMsg(null);

    const receivedCashPaise = Math.round(receivedCashRupees * 100);
    const res = await confirmCashHandoverAction({
      vanDayId: report.vanDay.id,
      receivedCashPaise,
      notes: handoverNotes,
    });

    setIsConfirmingHandover(false);
    if (res.success && res.data) {
      setHandover(res.data);
      setReport((prev) => ({
        ...prev,
        vanDay: {
          ...prev.vanDay,
          status: "CLOSED",
          closedBy: res.data.receivedById,
        },
      }));
      setSuccessMsg("Cash handover confirmed by owner! Van Day is officially CLOSED.");
      router.refresh();
    } else {
      setError(res.error || "Failed to confirm cash handover");
    }
  };

  const { financials, vanDay } = report;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 space-y-6 pb-24">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/van"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white">Evening Return & Day End</h1>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                  vanDay.status === "OPEN"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : vanDay.status === "RECONCILED"
                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                }`}
              >
                {vanDay.status}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Sheet: <span className="font-mono text-slate-300">{vanDay.issueSheetNo}</span> • Van:{" "}
              {vanDay.vanLocation.name} • Driver: {vanDay.salesperson.name}
            </p>
          </div>
        </div>

        {isReconciled && (
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
          >
            <Printer className="w-4 h-4 text-slate-400" />
            Print Report
          </button>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Key Financial Handover Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Cash in Hand */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/60 to-slate-900 border border-emerald-500/30">
          <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-bold uppercase tracking-wider mb-1">
            <Coins className="w-3.5 h-3.5" />
            Cash In Hand
          </div>
          <div className="text-xl font-black text-emerald-400 font-mono">
            ₹{(financials.totalCashInHandPaise / 100).toFixed(2)}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Bills: ₹{(financials.invoiceCashPaise / 100).toFixed(2)} | Coll: ₹
            {(financials.routeCollectionCashPaise / 100).toFixed(2)}
          </p>
        </div>

        {/* UPI Collected */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center gap-1.5 text-blue-400 text-[11px] font-bold uppercase tracking-wider mb-1">
            <QrCode className="w-3.5 h-3.5" />
            UPI Collected
          </div>
          <div className="text-xl font-black text-white font-mono">
            ₹{(financials.totalUpiReceivedPaise / 100).toFixed(2)}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Bills: ₹{(financials.invoiceUpiPaise / 100).toFixed(2)} | Coll: ₹
            {(financials.routeCollectionUpiPaise / 100).toFixed(2)}
          </p>
        </div>

        {/* Route Sales */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center gap-1.5 text-indigo-400 text-[11px] font-bold uppercase tracking-wider mb-1">
            <ShoppingBag className="w-3.5 h-3.5" />
            Route Bills
          </div>
          <div className="text-xl font-black text-white font-mono">
            ₹{(financials.invoiceTotalPaise / 100).toFixed(2)}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            {financials.invoiceCount} invoices • Credit: ₹
            {(financials.invoiceCreditPaise / 100).toFixed(2)}
          </p>
        </div>

        {/* Variance Status */}
        <div
          className={`p-4 rounded-2xl border ${
            liveStats.hasDiscrepancy
              ? "bg-rose-950/30 border-rose-500/40 text-rose-300"
              : "bg-slate-900/90 border-slate-800 text-slate-300"
          }`}
        >
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider mb-1">
            <PackageCheck className="w-3.5 h-3.5" />
            Stock Variance
          </div>
          {liveStats.hasDiscrepancy ? (
            <div>
              <div className="text-base font-black text-rose-400">
                -₹{(liveStats.totalShortagePaise / 100).toFixed(2)}
              </div>
              <p className="text-[10px] text-rose-300/80 mt-1">
                Shortage detected (Excess: ₹{(liveStats.totalExcessPaise / 100).toFixed(2)})
              </p>
            </div>
          ) : (
            <div>
              <div className="text-base font-black text-emerald-400">Match 100%</div>
              <p className="text-[10px] text-slate-400 mt-1">Zero physical discrepancy</p>
            </div>
          )}
        </div>
      </div>

      {/* Stock Return Verification Section */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white">Itemized Return Count Verification</h2>
            <p className="text-xs text-slate-400">
              Count physically returned stock (cartons & loose pieces) to transfer back to Central Godown
            </p>
          </div>

          {!isReconciled && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetToExpected}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700"
                title="Fill return counts with 100% of expected items"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Fill All Expected
              </button>
              <button
                type="button"
                onClick={handleZeroReturns}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700"
                title="Set all return quantities to zero"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Zero Returns
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-3 py-3 text-center">Issued</th>
                <th className="px-3 py-3 text-center">Sold</th>
                <th className="px-3 py-3 text-center text-blue-400">Expected</th>
                <th className="px-3 py-3 text-center text-emerald-400 w-44">
                  Returned Count
                </th>
                <th className="px-4 py-3 text-right">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {report.lines.map((line) => {
                const count = counts[line.productId] || { cartons: 0, pieces: 0 };
                const returnedPieces = count.cartons * line.packSize + count.pieces;
                const diff = returnedPieces - line.expectedQty;

                return (
                  <tr key={line.productId} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{line.productName}</div>
                      <div className="text-[11px] text-slate-400">
                        {line.shortCode} • {line.packSize} pcs/ctn • ₹{(line.mrpPaise / 100).toFixed(2)}
                      </div>
                    </td>

                    {/* Issued */}
                    <td className="px-3 py-3 text-center text-slate-300 font-mono">
                      {Math.floor(line.issuedQty / line.packSize)}c + {line.issuedQty % line.packSize}p
                      <span className="text-[10px] text-slate-500 block">({line.issuedQty})</span>
                    </td>

                    {/* Sold */}
                    <td className="px-3 py-3 text-center text-slate-300 font-mono">
                      {Math.floor(line.soldQty / line.packSize)}c + {line.soldQty % line.packSize}p
                      <span className="text-[10px] text-slate-500 block">({line.soldQty})</span>
                    </td>

                    {/* Expected */}
                    <td className="px-3 py-3 text-center font-mono font-bold text-blue-300 bg-blue-950/20">
                      {Math.floor(line.expectedQty / line.packSize)}c + {line.expectedQty % line.packSize}p
                      <span className="text-[10px] text-blue-400/80 block">({line.expectedQty})</span>
                    </td>

                    {/* Returned Count Inputs */}
                    <td className="px-3 py-3 text-center bg-emerald-950/10">
                      {isReconciled ? (
                        <div className="font-mono font-bold text-emerald-300">
                          {count.cartons}c + {count.pieces}p
                          <span className="text-[10px] text-emerald-400/70 block">
                            ({returnedPieces} pcs)
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1">
                            <input
                              type="number"
                              min="0"
                              value={count.cartons}
                              onChange={(e) =>
                                updateCount(line.productId, "cartons", parseInt(e.target.value))
                              }
                              className="w-10 bg-transparent text-center font-mono font-bold text-white focus:outline-none text-xs"
                            />
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">ctn</span>
                          </div>

                          <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1">
                            <input
                              type="number"
                              min="0"
                              value={count.pieces}
                              onChange={(e) =>
                                updateCount(line.productId, "pieces", parseInt(e.target.value))
                              }
                              className="w-10 bg-transparent text-center font-mono font-bold text-white focus:outline-none text-xs"
                            />
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">pcs</span>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Variance */}
                    <td className="px-4 py-3 text-right">
                      {diff === 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Match
                        </span>
                      ) : diff < 0 ? (
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400">
                            Short {Math.abs(diff)} pcs
                          </span>
                          <span className="text-[10px] text-rose-400/80 block font-mono">
                            -₹{((Math.abs(diff) * line.mrpPaise) / 100).toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-400">
                            Excess +{diff} pcs
                          </span>
                          <span className="text-[10px] text-purple-400/80 block font-mono">
                            +₹{((diff * line.mrpPaise) / 100).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes & Actions Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
            Reconciliation & Return Notes
          </label>
          <textarea
            disabled={isReconciled}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Returned crates counted with Godown manager. Minor shortage due to damaged seal on 1 packet."
            rows={2}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {!isReconciled ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <p className="text-xs text-slate-400">
              ⚠️ Finalizing will post <code className="text-blue-400">VAN_RETURN</code> stock movements to Central Godown and lock billing for this van day.
            </p>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-600/20 disabled:opacity-50"
            >
              <FileCheck className="w-4 h-4" />
              {isSubmitting ? "Finalizing Reconciliation..." : "Submit Evening Return"}
            </button>
          </div>
        ) : (
          <div className="p-3 bg-blue-950/30 border border-blue-500/30 rounded-xl text-blue-300 text-xs flex items-center justify-between">
            <span>
              ✅ This van day has been reconciled. Unsold stock is safely returned to Central Godown.
            </span>
            <span className="text-[11px] text-blue-400 font-mono">
              Reconciled by: {vanDay.reconciledBy || "Godown Staff"}
            </span>
          </div>
        )}
      </div>

      {/* Cash Handover Confirmation & Day Closing Section */}
      {isReconciled && (
        <div className="space-y-4">
          {vanDay.status === "CLOSED" || handover ? (
            <div className="bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-500/40 rounded-2xl p-5 space-y-3 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Cash Handover Confirmed — Day Officially Closed
                    </h3>
                    <p className="text-xs text-slate-400">
                      Received by <span className="text-white font-medium">{handover?.receivedBy?.name || "Sachin Prakash (Owner)"}</span> • {handover?.confirmedAt ? new Date(handover.confirmedAt).toLocaleDateString("en-IN") : "Today"}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xl font-mono font-black text-emerald-400">
                    ₹{((handover?.receivedCashPaise ?? financials.totalCashInHandPaise) / 100).toFixed(2)}
                  </div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">
                    Physical Cash Handed Over
                  </span>
                </div>
              </div>

              {/* Handover Details Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-medium">Expected Cash</span>
                  <span className="font-mono text-slate-300">
                    ₹{((handover?.expectedCashPaise ?? financials.totalCashInHandPaise) / 100).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-medium">Actual Received</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    ₹{((handover?.receivedCashPaise ?? financials.totalCashInHandPaise) / 100).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-medium">Cash Variance</span>
                  <span className={`font-mono font-semibold ${
                    (handover?.shortagePaise ?? 0) > 0
                      ? "text-rose-400"
                      : (handover?.excessPaise ?? 0) > 0
                      ? "text-purple-400"
                      : "text-emerald-400"
                  }`}>
                    {(handover?.shortagePaise ?? 0) > 0
                      ? `-₹${((handover?.shortagePaise ?? 0) / 100).toFixed(2)} Short`
                      : (handover?.excessPaise ?? 0) > 0
                      ? `+₹${((handover?.excessPaise ?? 0) / 100).toFixed(2)} Excess`
                      : "Zero Variance"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-medium">Status</span>
                  <span className="text-emerald-400 font-bold uppercase tracking-wider text-[11px]">
                    Closed & Locked
                  </span>
                </div>
              </div>

              {handover?.notes && (
                <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                  📝 {handover.notes}
                </p>
              )}
            </div>
          ) : userRole === "SUPER_ADMIN" || userRole === "ACCOUNTS" ? (
            /* Owner / Accounts Confirmation Panel */
            <div className="bg-gradient-to-br from-slate-900 to-emerald-950/40 border border-emerald-500/30 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Coins className="w-4 h-4 text-emerald-400" />
                    Owner Cash Handover Confirmation
                  </h3>
                  <p className="text-xs text-slate-400">
                    Verify cash received from {vanDay.salesperson.name} to officially lock and close this van day.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase font-semibold">Expected Handover</span>
                  <span className="font-mono font-bold text-emerald-400 text-base">
                    ₹{(financials.totalCashInHandPaise / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Physical Cash Counted (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 text-sm font-bold">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={receivedCashRupees}
                      onChange={(e) => setReceivedCashRupees(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-sm text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="flex gap-2 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setReceivedCashRupees(Math.round(financials.totalCashInHandPaise / 100))}
                      className="text-[11px] text-emerald-400 hover:underline font-medium"
                    >
                      Fill Exact: ₹{(financials.totalCashInHandPaise / 100).toFixed(2)}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Handover Remarks
                  </label>
                  <input
                    type="text"
                    value={handoverNotes}
                    onChange={(e) => setHandoverNotes(e.target.value)}
                    placeholder="e.g. Counted in safe room, verified by Sachin Prakash"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Variance & Confirm Button */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
                <div className="text-xs">
                  {Math.round(receivedCashRupees * 100) === financials.totalCashInHandPaise ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Exact cash match — zero variance
                    </span>
                  ) : Math.round(receivedCashRupees * 100) < financials.totalCashInHandPaise ? (
                    <span className="text-rose-400 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Cash Shortage: ₹{((financials.totalCashInHandPaise - Math.round(receivedCashRupees * 100)) / 100).toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-purple-400 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      Cash Excess: ₹{((Math.round(receivedCashRupees * 100) - financials.totalCashInHandPaise) / 100).toFixed(2)}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  disabled={isConfirmingHandover}
                  onClick={handleConfirmHandover}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                >
                  <Coins className="w-4 h-4" />
                  {isConfirmingHandover ? "Confirming..." : "Confirm Handover & Close Van Day"}
                </button>
              </div>
            </div>
          ) : (
            /* Salesperson Waiting Banner */
            <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 text-sm font-bold">
                <Coins className="w-4 h-4" />
                Awaiting Owner Cash Handover Confirmation
              </div>
              <p className="text-xs text-slate-300">
                Unsold stock is reconciled. Please present <strong className="text-emerald-400 font-mono">₹{(financials.totalCashInHandPaise / 100).toFixed(2)}</strong> in cash to Sachin Prakash (Owner) or the accounts manager to officially close this van day.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
