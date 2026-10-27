"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  CreditCard,
  Printer,
  Calendar,
  FileCheck2,
} from "lucide-react";
import { IncentivePayoutStatus } from "@prisma/client";
import { approvePayoutAction, markPayoutPaidAction } from "../actions";

interface StatementItem {
  agentUserId: string;
  agentName: string;
  agentCode: string;
  agentRole: string;
  agentPhone: string;
  period: string;
  totalGrossPaise?: number;
  totalCreditedPaise: number;
  totalPendingPaise: number;
  totalReversedPaise: number;
  totalAdjustmentsPaise: number;
  netPayablePaise: number;
  status: IncentivePayoutStatus;
  isLocked: boolean;
  payoutId?: string | null;
  paidAt?: Date | null;
  paidMethod?: string | null;
  paidReference?: string | null;
}

export function IncentiveStatementsClient({
  currentPeriod,
  statements,
}: {
  currentPeriod: string;
  statements: StatementItem[];
}) {
  const router = useRouter();
  const [selectedStatement, setSelectedStatement] = useState<StatementItem | null>(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState("BANK_TRANSFER");
  const [paymentRef, setPaymentRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const formatRupees = (paise: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(paise / 100);
  };

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    router.push(`/admin/incentives/statements?period=${e.target.value}`);
  };

  const handleApprove = async (agentUserId: string) => {
    if (!confirm(`Lock and approve the statement for ${currentPeriod}? Further sales adjustments will be prevented.`)) {
      return;
    }
    setSubmitting(true);
    try {
      await approvePayoutAction(agentUserId, currentPeriod);
      router.refresh();
    } catch (err: unknown) {
      alert((err as Error).message || "Approval failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenPayModal = (stmt: StatementItem) => {
    setSelectedStatement(stmt);
    setIsPayModalOpen(true);
    setPaymentRef("");
    setErrorMsg("");
  };

  const handleMarkPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStatement) return;

    setSubmitting(true);
    setErrorMsg("");
    try {
      await markPayoutPaidAction({
        agentUserId: selectedStatement.agentUserId,
        period: selectedStatement.period,
        method: paymentMode,
        reference: paymentRef.trim() || undefined,
      });
      setIsPayModalOpen(false);
      router.refresh();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Disbursement failed");
    } finally {
      setSubmitting(false);
    }
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

  // Summary totals
  const totalCredited = statements.reduce((sum, s) => sum + s.totalCreditedPaise, 0);
  const totalReversals = statements.reduce((sum, s) => sum + s.totalReversedPaise, 0);
  const totalNet = statements.reduce((sum, s) => sum + s.netPayablePaise, 0);

  return (
    <div className="space-y-6">
      {/* Period Selector & Aggregates */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-amber-800" />
          <div>
            <label htmlFor="period-dropdown-select" className="text-xs font-semibold text-stone-500 uppercase block">
              Statement Period
            </label>
            <select
              id="period-dropdown-select"
              value={currentPeriod}
              onChange={handlePeriodChange}
              className="mt-0.5 rounded-lg border border-stone-300 bg-stone-50 px-3 py-1.5 text-sm font-semibold text-stone-800 focus:ring-1 focus:ring-amber-600 focus:outline-none"
            >
              {monthOptions.map((opt) => (
                <option key={opt.val} value={opt.val}>
                  {opt.label} ({opt.val})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-6 text-right">
          <div>
            <span className="text-[10px] uppercase font-bold text-stone-400">Total Credited</span>
            <div className="text-sm font-bold text-stone-700">{formatRupees(totalCredited)}</div>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-stone-400">Deductions</span>
            <div className="text-sm font-bold text-rose-600">-{formatRupees(totalReversals)}</div>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-stone-400">Total Net Payable</span>
            <div className="text-lg font-black text-amber-900">{formatRupees(totalNet)}</div>
          </div>
        </div>
      </div>

      {/* Statements Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-stone-600 text-xs">Staff Agent</th>
                <th className="px-4 py-3 text-left font-semibold text-stone-600 text-xs">Role</th>
                <th className="px-4 py-3 text-right font-semibold text-stone-600 text-xs">Credited</th>
                <th className="px-4 py-3 text-right font-semibold text-stone-600 text-xs">Reversals</th>
                <th className="px-4 py-3 text-right font-semibold text-stone-600 text-xs">Adjustments</th>
                <th className="px-4 py-3 text-right font-semibold text-stone-600 text-xs">Net Amount</th>
                <th className="px-4 py-3 text-center font-semibold text-stone-600 text-xs">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-stone-600 text-xs">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {statements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-xs text-stone-400">
                    No active staff members found.
                  </td>
                </tr>
              ) : (
                statements.map((s) => (
                  <tr key={s.agentUserId} className="hover:bg-stone-50/70">
                    <td className="px-4 py-3 font-medium text-stone-900 text-xs">
                      <div>{s.agentName}</div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
                        {s.agentCode || "No Agent Code"}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-xs text-stone-600">{s.agentRole}</td>

                    <td className="px-4 py-3 text-right font-medium text-stone-800 text-xs">
                      {formatRupees(s.totalCreditedPaise)}
                    </td>

                    <td className="px-4 py-3 text-right text-xs text-rose-600">
                      {s.totalReversedPaise > 0 ? `-${formatRupees(s.totalReversedPaise)}` : "—"}
                    </td>

                    <td className="px-4 py-3 text-right text-xs text-blue-600">
                      {s.totalAdjustmentsPaise !== 0 ? formatRupees(s.totalAdjustmentsPaise) : "—"}
                    </td>

                    <td className="px-4 py-3 text-right font-bold text-stone-900 text-sm">
                      {formatRupees(s.netPayablePaise)}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          s.status === IncentivePayoutStatus.PAID
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : s.status === IncentivePayoutStatus.APPROVED
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {s.status}
                      </span>
                      {s.paidMethod && (
                        <div className="text-[10px] text-stone-400 mt-0.5 font-mono">
                          {s.paidMethod} {s.paidReference ? `• ${s.paidReference}` : ""}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {s.status === IncentivePayoutStatus.DRAFT && (
                          <button
                            onClick={() => handleApprove(s.agentUserId)}
                            disabled={submitting || s.netPayablePaise <= 0}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-stone-900 text-white text-[11px] font-semibold hover:bg-stone-800 transition-colors disabled:opacity-40"
                          >
                            <FileCheck2 className="h-3 w-3" />
                            Approve
                          </button>
                        )}

                        {s.status === IncentivePayoutStatus.APPROVED && (
                          <button
                            onClick={() => handleOpenPayModal(s)}
                            disabled={submitting}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-700 text-white text-[11px] font-semibold hover:bg-emerald-800 transition-colors"
                          >
                            <CreditCard className="h-3 w-3" />
                            Mark Paid
                          </button>
                        )}

                        {s.status === IncentivePayoutStatus.PAID && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                            <CheckCircle className="h-3.5 w-3.5" />
                            Paid
                          </span>
                        )}

                        <button
                          onClick={() => window.print()}
                          className="p-1 text-stone-400 hover:text-stone-700 rounded hover:bg-stone-100"
                          title="Print Statement"
                          aria-label="Print Statement"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mark Paid Modal */}
      {isPayModalOpen && selectedStatement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-900">Record Payout Disbursement</h3>
              <button
                onClick={() => setIsPayModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
              <div className="text-xs text-stone-500">Agent:</div>
              <div className="text-sm font-bold text-stone-800">
                {selectedStatement.agentName} ({selectedStatement.agentCode || "No Code"})
              </div>
              <div className="mt-2 text-xs text-stone-500">Net Payable Amount:</div>
              <div className="text-xl font-black text-emerald-700">
                {formatRupees(selectedStatement.netPayablePaise)}
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleMarkPaid} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Disbursement Mode
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 p-2 text-xs text-stone-800 focus:ring-1 focus:ring-amber-600"
                >
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT / IMPS / RTGS)</option>
                  <option value="UPI">UPI Payment</option>
                  <option value="CASH">Cash in Hand</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Reference / UTR / Cheque Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR123456789 or Cash voucher #42"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 p-2 text-xs text-stone-800 focus:ring-1 focus:ring-amber-600"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors shadow-sm disabled:opacity-50"
                >
                  {submitting ? "Confirming..." : "Confirm Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
