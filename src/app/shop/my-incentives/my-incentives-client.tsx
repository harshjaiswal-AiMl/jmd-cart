"use client";

import { useRouter } from "next/navigation";
import {
  TrendingUp,
  Clock,
  RotateCcw,
  CheckCircle2,
  Calendar,
  Printer,
  BadgeCheck,
} from "lucide-react";
import { MonthlyStatementSummary, IncentiveEntryStatus } from "@/modules/incentive/incentive.types";

export function MyIncentivesClient({
  data,
  currentPeriod,
}: {
  data: MonthlyStatementSummary & { entries: any[] };
  currentPeriod: string;
}) {
  const router = useRouter();

  const formatRupees = (paise: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(paise / 100);
  };

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    router.push(`/shop/my-incentives?period=${e.target.value}`);
  };

  // Generate last 6 months options
  const monthOptions = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    monthOptions.push({ val, label });
  }

  return (
    <div className="space-y-6">
      {/* Agent Header Card */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-100 text-amber-900">
            <BadgeCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Your Agent Code
            </div>
            <div className="text-xl font-mono font-black text-amber-950">
              {data.agentCode || "Not Assigned"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-stone-400" />
            <label htmlFor="period-selector-select" className="sr-only">
              Statement Month
            </label>
            <select
              id="period-selector-select"
              value={currentPeriod}
              onChange={handlePeriodChange}
              className="rounded-lg border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-800 focus:ring-1 focus:ring-amber-600 focus:outline-none"
            >
              {monthOptions.map((opt) => (
                <option key={opt.val} value={opt.val}>
                  {opt.label} ({opt.val})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => window.print()}
            className="p-2 rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50"
            title="Print Summary"
            aria-label="Print Summary"
          >
            <Printer className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Credited */}
        <div className="bg-white rounded-xl p-5 border border-stone-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Credited
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-stone-900">
              {formatRupees(data.totalCreditedPaise)}
            </div>
            <p className="text-[11px] text-emerald-700 mt-1 font-medium">Confirmed sales</p>
          </div>
        </div>

        {/* Deductions */}
        <div className="bg-white rounded-xl p-5 border border-stone-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Reversals / Returns
            </span>
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
              <RotateCcw className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-600">
              -{formatRupees(data.totalReversedPaise)}
            </div>
            <p className="text-[11px] text-stone-500 mt-1 font-medium">Cancelled bills</p>
          </div>
        </div>

        {/* Net Amount */}
        <div className="bg-white rounded-xl p-5 border border-stone-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Net Payable
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-950">
              {formatRupees(data.netPayablePaise)}
            </div>
            <p className="text-[11px] text-stone-500 mt-1 font-medium">After adjustments</p>
          </div>
        </div>

        {/* Payout Status */}
        <div className="bg-white rounded-xl p-5 border border-stone-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Payout Status
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg font-bold text-stone-900">
              {data.status}
            </div>
            <p className="text-[11px] text-stone-500 mt-1 font-medium">
              {data.paidMethod
                ? `${data.paidMethod} ${data.paidReference || ""}`
                : "Awaiting month-end review"}
            </p>
          </div>
        </div>
      </div>

      {/* Recent Entries */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-200 bg-stone-50">
          <h2 className="text-sm font-bold text-stone-900">Recent Commission Sales</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-stone-600 text-xs">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-stone-600 text-xs">Reference</th>
                <th className="px-4 py-3 text-right font-semibold text-stone-600 text-xs">Base Amount</th>
                <th className="px-4 py-3 text-right font-semibold text-stone-600 text-xs">Commission Rate</th>
                <th className="px-4 py-3 text-right font-semibold text-stone-600 text-xs">Earned</th>
                <th className="px-4 py-3 text-center font-semibold text-stone-600 text-xs">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {data.entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-stone-400">
                    No sales recorded for this period yet.
                  </td>
                </tr>
              ) : (
                data.entries.map((e) => (
                  <tr key={e.id} className="hover:bg-stone-50/70">
                    <td className="px-4 py-3 text-xs text-stone-500 whitespace-nowrap">
                      {new Date(e.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </td>

                    <td className="px-4 py-3 text-xs font-mono font-medium text-stone-800">
                      {e.invoice?.number || e.order?.orderNumber || "Adjustment"}
                    </td>

                    <td className="px-4 py-3 text-right text-xs text-stone-700">
                      {e.baseAmountPaise ? formatRupees(e.baseAmountPaise) : "—"}
                    </td>

                    <td className="px-4 py-3 text-right text-xs font-mono text-stone-600">
                      {e.percentBp ? `${(e.percentBp / 100).toFixed(2)}%` : "—"}
                    </td>

                    <td
                      className={`px-4 py-3 text-right font-bold text-xs ${
                        e.amountPaise < 0
                          ? "text-rose-600"
                          : e.status === IncentiveEntryStatus.CREDITED
                          ? "text-emerald-700"
                          : "text-stone-800"
                      }`}
                    >
                      {formatRupees(e.amountPaise)}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          e.status === IncentiveEntryStatus.CREDITED
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : e.status === IncentiveEntryStatus.PENDING
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {e.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
