"use client";

import { useState } from "react";
import {
  History,
  Play,
  CheckCircle2,
} from "lucide-react";
import { previewBackfillAction, applyBackfillAction } from "../actions";

interface PreviewData {
  eligibleInvoicesCount: number;
  totalGrossPaise: number;
  estimatedIncentivePaise: number;
  sampleRows: Array<{
    invoiceNumber: string;
    channel: string;
    date: string;
    agentName: string;
    agentCode: string;
    payablePaise: number;
    incentivePaise: number;
  }>;
}

export function IncentiveBackfillClient() {
  const now = new Date();
  const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const [startDateStr, setStartDateStr] = useState(defaultStart);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [applyResult, setApplyResult] = useState<{ createdCount: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const formatRupees = (paise: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(paise / 100);
  };

  const handlePreview = async () => {
    setLoading(true);
    setErrorMsg("");
    setApplyResult(null);
    try {
      const res = await previewBackfillAction(startDateStr);
      setPreview(res.preview);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Preview failed");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (
      !confirm(
        `Are you sure you want to generate incentive entries for invoices starting from ${startDateStr}? This operation is idempotent and safe.`
      )
    ) {
      return;
    }

    setApplying(true);
    setErrorMsg("");
    try {
      const res = await applyBackfillAction(startDateStr);
      setApplyResult(res.result);
      handlePreview();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Backfill application failed");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls Card */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-amber-800" />
          <h2 className="text-base font-bold text-stone-900">Historical Backfill Parameters</h2>
        </div>
        <p className="text-xs text-stone-500">
          Invoices already containing incentive ledger entries will be skipped automatically to maintain append-only ledger integrity.
        </p>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
            {errorMsg}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-end gap-4 max-w-xl">
          <div className="flex-1">
            <label htmlFor="backfill-date" className="block text-xs font-semibold text-stone-700 mb-1">
              Backfill Starting Date
            </label>
            <input
              id="backfill-date"
              type="date"
              value={startDateStr}
              onChange={(e) => setStartDateStr(e.target.value)}
              className="w-full rounded-lg border border-stone-300 p-2 text-xs text-stone-800 bg-stone-50 focus:ring-1 focus:ring-amber-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePreview}
              disabled={loading || applying}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-stone-300 bg-white text-stone-800 text-xs font-semibold hover:bg-stone-50 transition-colors disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5 fill-stone-700 text-stone-700" />
              {loading ? "Scanning..." : "Preview Run"}
            </button>

            {preview && preview.eligibleInvoicesCount > 0 && (
              <button
                onClick={handleApply}
                disabled={applying || loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors shadow-sm disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {applying ? "Applying..." : "Apply Backfill"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Applied Result Banner */}
      {applyResult && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          <div>
            <div className="text-sm font-bold text-emerald-900">Backfill Successfully Applied!</div>
            <div className="text-xs text-emerald-700">
              Created {applyResult.createdCount} new incentive ledger entries. Review them in the Audit Ledger.
            </div>
          </div>
        </div>
      )}

      {/* Preview Output */}
      {preview && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-sm">
              <span className="text-[10px] font-bold text-stone-400 uppercase">Eligible Invoices Without Entries</span>
              <div className="text-xl font-bold text-stone-800 mt-1">{preview.eligibleInvoicesCount}</div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-sm">
              <span className="text-[10px] font-bold text-stone-400 uppercase">Eligible Gross Sales</span>
              <div className="text-xl font-bold text-stone-800 mt-1">{formatRupees(preview.totalGrossPaise)}</div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-sm">
              <span className="text-[10px] font-bold text-stone-400 uppercase">Est. Total Incentive</span>
              <div className="text-xl font-bold text-emerald-700 mt-1">
                {formatRupees(preview.estimatedIncentivePaise)}
              </div>
            </div>
          </div>

          {/* Sample Table */}
          {preview.sampleRows.length > 0 && (
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-stone-200 bg-stone-50">
                <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                  Sample Backfill Invoices Preview
                </h3>
              </div>
              <table className="min-w-full divide-y divide-stone-200 text-sm">
                <thead className="bg-stone-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold text-stone-600 text-xs">Invoice #</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-stone-600 text-xs">Date</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-stone-600 text-xs">Agent</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-stone-600 text-xs">Channel</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-stone-600 text-xs">Payable</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-stone-600 text-xs">Est. Incentive</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {preview.sampleRows.map((row) => (
                    <tr key={row.invoiceNumber} className="hover:bg-stone-50/70">
                      <td className="px-4 py-2.5 font-mono text-xs font-semibold text-stone-900">
                        {row.invoiceNumber}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-stone-600">{row.date}</td>
                      <td className="px-4 py-2.5 text-xs text-stone-800">
                        {row.agentName}{" "}
                        <span className="text-[10px] text-stone-500 font-mono">
                          ({row.agentCode || "No code"})
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-stone-600">{row.channel}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-stone-600">
                        {formatRupees(row.payablePaise)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-xs text-emerald-700">
                        {formatRupees(row.incentivePaise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
