"use client";

import React, { useState } from "react";
import { VanReconciliationReport, CashHandoverWithDetails } from "@/modules/van/van.types";
import { reconcileVanDayAction, confirmCashHandoverAction } from "@/app/van/reconciliation/actions";
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

export function GodownVanReconcileClient({ initialReport, initialHandover, userRole }: Props) {
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

  const [counts, setCounts] = useState<Record<string, { cartons: number; pieces: number }>>(() => {
    const initial: Record<string, { cartons: number; pieces: number }> = {};
    for (const line of initialReport.lines) {
      if (initialReport.isReconciled) {
        initial[line.productId] = {
          cartons: Math.floor(line.returnedQty / line.packSize),
          pieces: line.returnedQty % line.packSize,
        };
      } else {
        initial[line.productId] = {
          cartons: Math.floor(line.expectedQty / line.packSize),
          pieces: line.expectedQty % line.packSize,
        };
      }
    }
    return initial;
  });

  const isReconciled = report.isReconciled;

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
        `Discrepancy alert:\nShortage: ₹${(liveStats.totalShortagePaise / 100).toFixed(
          2
        )}\nExcess: ₹${(liveStats.totalExcessPaise / 100).toFixed(
          2
        )}\n\nConfirm reconciliation and post ledger adjustments?`
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
      setSuccessMsg("Evening return and reconciliation finalized! Physical stock received into Central Godown.");
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
    <div className="space-y-6 pb-20">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/godown/van-issues"
            className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">
                Evening Van Return & Reconciliation
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-semibold ${
                  vanDay.status === "OPEN"
                    ? "bg-amber-100 text-amber-800"
                    : vanDay.status === "RECONCILED"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-green-100 text-green-800"
                }`}
              >
                {vanDay.status}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Load Sheet: <span className="font-mono font-semibold">{vanDay.issueSheetNo}</span> • Van:{" "}
              {vanDay.vanLocation.name} • Driver: {vanDay.salesperson.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 shadow-sm"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            Print Report
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Cash in Hand to receive */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-1 text-slate-600 text-xs font-medium mb-1">
            <Coins className="w-4 h-4 text-emerald-600" />
            Cash Handover Amount
          </div>
          <div className="text-xl font-bold text-emerald-600 font-mono">
            ₹{(financials.totalCashInHandPaise / 100).toFixed(2)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Sales: ₹{(financials.invoiceCashPaise / 100).toFixed(2)} | Collections: ₹
            {(financials.routeCollectionCashPaise / 100).toFixed(2)}
          </p>
        </div>

        {/* UPI Collected */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-1 text-slate-600 text-xs font-medium mb-1">
            <QrCode className="w-4 h-4 text-blue-600" />
            UPI Collections
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono">
            ₹{(financials.totalUpiReceivedPaise / 100).toFixed(2)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Sales: ₹{(financials.invoiceUpiPaise / 100).toFixed(2)} | Collections: ₹
            {(financials.routeCollectionUpiPaise / 100).toFixed(2)}
          </p>
        </div>

        {/* Total Invoiced Value */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-1 text-slate-600 text-xs font-medium mb-1">
            <ShoppingBag className="w-4 h-4 text-indigo-600" />
            Total Route Sales
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono">
            ₹{(financials.invoiceTotalPaise / 100).toFixed(2)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {financials.invoiceCount} invoices • Credit: ₹
            {(financials.invoiceCreditPaise / 100).toFixed(2)}
          </p>
        </div>

        {/* Discrepancy KPI */}
        <div
          className={`border rounded-xl p-4 shadow-sm ${
            liveStats.hasDiscrepancy ? "bg-red-50/50 border-red-200" : "bg-white border-slate-200"
          }`}
        >
          <div className="flex items-center gap-1 text-slate-600 text-xs font-medium mb-1">
            <PackageCheck className="w-4 h-4 text-slate-600" />
            Stock Variance
          </div>
          {liveStats.hasDiscrepancy ? (
            <div>
              <div className="text-lg font-bold text-red-600">
                -₹{(liveStats.totalShortagePaise / 100).toFixed(2)}
              </div>
              <p className="text-[11px] text-red-700 mt-1">
                Shortage (Excess: ₹{(liveStats.totalExcessPaise / 100).toFixed(2)})
              </p>
            </div>
          ) : (
            <div>
              <div className="text-lg font-bold text-emerald-600">Zero Variance</div>
              <p className="text-[11px] text-slate-500 mt-1">Physical count matches expected</p>
            </div>
          )}
        </div>
      </div>

      {/* Stock Return Verification Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Physical Stock Count Verification</h2>
            <p className="text-xs text-slate-500">
              Enter returned crates and loose units physically counted with the delivery driver
            </p>
          </div>

          {!isReconciled && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetToExpected}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Fill Expected
              </button>
              <button
                type="button"
                onClick={handleZeroReturns}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                Zero Returns
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5">Product</th>
                <th className="px-3 py-2.5 text-center">Morning Issued</th>
                <th className="px-3 py-2.5 text-center">Sold on Route</th>
                <th className="px-3 py-2.5 text-center bg-blue-50/60 text-blue-900">
                  Expected Return
                </th>
                <th className="px-3 py-2.5 text-center bg-emerald-50/60 text-emerald-900 w-44">
                  Counted Returned
                </th>
                <th className="px-4 py-2.5 text-right">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {report.lines.map((line) => {
                const count = counts[line.productId] || { cartons: 0, pieces: 0 };
                const returnedPieces = count.cartons * line.packSize + count.pieces;
                const diff = returnedPieces - line.expectedQty;

                return (
                  <tr key={line.productId} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-900">{line.productName}</div>
                      <div className="text-[11px] text-slate-500">
                        {line.shortCode} • {line.packSize} pcs/ctn • MRP ₹{(line.mrpPaise / 100).toFixed(2)}
                      </div>
                    </td>

                    {/* Issued */}
                    <td className="px-3 py-2.5 text-center font-mono text-slate-700">
                      {Math.floor(line.issuedQty / line.packSize)}c + {line.issuedQty % line.packSize}p
                      <span className="text-[10px] text-slate-400 block">({line.issuedQty})</span>
                    </td>

                    {/* Sold */}
                    <td className="px-3 py-2.5 text-center font-mono text-slate-700">
                      {Math.floor(line.soldQty / line.packSize)}c + {line.soldQty % line.packSize}p
                      <span className="text-[10px] text-slate-400 block">({line.soldQty})</span>
                    </td>

                    {/* Expected */}
                    <td className="px-3 py-2.5 text-center font-mono font-semibold bg-blue-50/40 text-blue-800">
                      {Math.floor(line.expectedQty / line.packSize)}c + {line.expectedQty % line.packSize}p
                      <span className="text-[10px] text-blue-600 block">({line.expectedQty} pcs)</span>
                    </td>

                    {/* Counted Returned */}
                    <td className="px-3 py-2.5 text-center bg-emerald-50/40">
                      {isReconciled ? (
                        <div className="font-mono font-bold text-emerald-800">
                          {count.cartons}c + {count.pieces}p
                          <span className="text-[10px] text-emerald-600 block">
                            ({returnedPieces} pcs)
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="flex items-center gap-1 bg-white border border-slate-300 rounded px-1.5 py-0.5">
                            <input
                              type="number"
                              min="0"
                              value={count.cartons}
                              onChange={(e) =>
                                updateCount(line.productId, "cartons", parseInt(e.target.value))
                              }
                              className="w-10 text-center font-mono font-semibold text-slate-900 focus:outline-none"
                            />
                            <span className="text-[10px] text-slate-500 uppercase font-semibold">ctn</span>
                          </div>

                          <div className="flex items-center gap-1 bg-white border border-slate-300 rounded px-1.5 py-0.5">
                            <input
                              type="number"
                              min="0"
                              value={count.pieces}
                              onChange={(e) =>
                                updateCount(line.productId, "pieces", parseInt(e.target.value))
                              }
                              className="w-10 text-center font-mono font-semibold text-slate-900 focus:outline-none"
                            />
                            <span className="text-[10px] text-slate-500 uppercase font-semibold">pcs</span>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Variance */}
                    <td className="px-4 py-2.5 text-right">
                      {diff === 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Match
                        </span>
                      ) : diff < 0 ? (
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600">
                            Short {Math.abs(diff)} pcs
                          </span>
                          <span className="text-[10px] text-red-600 block font-mono">
                            -₹{((Math.abs(diff) * line.mrpPaise) / 100).toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-600">
                            Excess +{diff} pcs
                          </span>
                          <span className="text-[10px] text-purple-600 block font-mono">
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

      {/* Notes & Submission */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Reconciliation & Return Notes
          </label>
          <textarea
            disabled={isReconciled}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Unsold stock verified and transferred back to Central Godown shelf."
            rows={2}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {!isReconciled ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <p className="text-xs text-slate-500">
              Confirming reconciliation will post <code className="text-blue-600 font-mono">VAN_RETURN</code> movements into Central Godown and lock billing for this van day.
            </p>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-sm disabled:opacity-50"
            >
              <FileCheck className="w-4 h-4" />
              {isSubmitting ? "Processing Return..." : "Confirm & Reconcile Evening Return"}
            </button>
          </div>
        ) : (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-xs flex items-center justify-between">
            <span>
              ✅ Van day reconciled. Returned stock safely restored to Central Godown.
            </span>
            <span className="text-[11px] font-mono font-medium">
              Reconciled by: {vanDay.reconciledBy || "Godown Staff"}
            </span>
          </div>
        )}
      </div>

      {/* Cash Handover Confirmation & Day Closing Section */}
      {isReconciled && (
        <div className="space-y-4">
          {vanDay.status === "CLOSED" || handover ? (
            <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-5 space-y-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Cash Handover Confirmed — Day Officially Closed
                    </h3>
                    <p className="text-xs text-slate-600">
                      Received by <span className="text-slate-900 font-semibold">{handover?.receivedBy?.name || "Sachin Prakash (Owner)"}</span> • {handover?.confirmedAt ? new Date(handover.confirmedAt).toLocaleDateString("en-IN") : "Today"}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xl font-mono font-bold text-emerald-700">
                    ₹{((handover?.receivedCashPaise ?? financials.totalCashInHandPaise) / 100).toFixed(2)}
                  </div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">
                    Physical Cash Handed Over
                  </span>
                </div>
              </div>

              {/* Handover Details Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-emerald-200 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-medium">Expected Cash</span>
                  <span className="font-mono text-slate-800">
                    ₹{((handover?.expectedCashPaise ?? financials.totalCashInHandPaise) / 100).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-medium">Actual Received</span>
                  <span className="font-mono text-emerald-700 font-bold">
                    ₹{((handover?.receivedCashPaise ?? financials.totalCashInHandPaise) / 100).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-medium">Cash Variance</span>
                  <span className={`font-mono font-semibold ${
                    (handover?.shortagePaise ?? 0) > 0
                      ? "text-rose-600"
                      : (handover?.excessPaise ?? 0) > 0
                      ? "text-purple-600"
                      : "text-emerald-700"
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
                  <span className="text-emerald-700 font-bold uppercase tracking-wider text-[11px]">
                    Closed & Locked
                  </span>
                </div>
              </div>

              {handover?.notes && (
                <p className="text-xs text-slate-700 bg-white/70 p-2.5 rounded-lg border border-emerald-200">
                  📝 {handover.notes}
                </p>
              )}
            </div>
          ) : userRole === "SUPER_ADMIN" || userRole === "ACCOUNTS" ? (
            /* Owner / Accounts Confirmation Panel */
            <div className="bg-white border-2 border-emerald-500/40 rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Coins className="w-4 h-4 text-emerald-600" />
                    Owner Cash Handover Confirmation
                  </h3>
                  <p className="text-xs text-slate-600">
                    Verify physical cash received from {vanDay.salesperson.name} to officially lock and close this van day.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">Expected Handover</span>
                  <span className="font-mono font-bold text-emerald-700 text-base">
                    ₹{(financials.totalCashInHandPaise / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
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
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-sm text-slate-900 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex gap-2 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setReceivedCashRupees(Math.round(financials.totalCashInHandPaise / 100))}
                      className="text-[11px] text-emerald-700 hover:underline font-medium"
                    >
                      Fill Exact: ₹{(financials.totalCashInHandPaise / 100).toFixed(2)}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Handover Remarks
                  </label>
                  <input
                    type="text"
                    value={handoverNotes}
                    onChange={(e) => setHandoverNotes(e.target.value)}
                    placeholder="e.g. Counted in safe room, verified by Sachin Prakash"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Variance & Confirm Button */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
                <div className="text-xs">
                  {Math.round(receivedCashRupees * 100) === financials.totalCashInHandPaise ? (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Exact cash match — zero variance
                    </span>
                  ) : Math.round(receivedCashRupees * 100) < financials.totalCashInHandPaise ? (
                    <span className="text-rose-600 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Cash Shortage: ₹{((financials.totalCashInHandPaise - Math.round(receivedCashRupees * 100)) / 100).toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-purple-600 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      Cash Excess: ₹{((Math.round(receivedCashRupees * 100) - financials.totalCashInHandPaise) / 100).toFixed(2)}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  disabled={isConfirmingHandover}
                  onClick={handleConfirmHandover}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm disabled:opacity-50"
                >
                  <Coins className="w-4 h-4" />
                  {isConfirmingHandover ? "Confirming..." : "Confirm Handover & Close Van Day"}
                </button>
              </div>
            </div>
          ) : (
            /* Godown / Non-Owner Waiting Banner */
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-amber-800 text-sm font-semibold">
                <Coins className="w-4 h-4 text-amber-600" />
                Awaiting Owner Cash Handover Confirmation
              </div>
              <p className="text-xs text-amber-900">
                Unsold stock is reconciled into Central Godown. Handover <strong className="font-mono">₹{(financials.totalCashInHandPaise / 100).toFixed(2)}</strong> in physical cash to Sachin Prakash (Owner) or accounts manager to officially close this van day.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
