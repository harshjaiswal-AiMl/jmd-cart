"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Download,
  PlusCircle,
  Search,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import {
  IncentiveEntryType,
  IncentiveEntryStatus,
  InvoiceChannel,
} from "@prisma/client";
import { recordAdjustmentAction } from "../actions";

interface EntryWithRelations {
  id: string;
  type: IncentiveEntryType;
  status: IncentiveEntryStatus;
  baseAmountPaise: number;
  percentBp: number;
  amountPaise: number;
  ruleId: string | null;
  triggerEvent: string;
  note: string | null;
  createdAt: Date;
  agentUser: { id: string; name: string; agentCode: string | null };
  invoice: {
    id: string;
    number: string;
    totalPaise: number;
    customerPhone: string | null;
    customerName: string | null;
    channel: InvoiceChannel;
  } | null;
  order: { id: string; orderNumber: string } | null;
}

interface AgentOption {
  id: string;
  name: string;
  agentCode: string | null;
}

export function IncentiveLedgerClient({
  entries,
  agents,
  currentFilters,
  isSuperAdmin,
}: {
  entries: EntryWithRelations[];
  agents: AgentOption[];
  currentFilters: {
    agentId: string;
    status: string;
    type: string;
    q: string;
  };
  isSuperAdmin: boolean;
}) {
  const router = useRouter();
  const [isAdjModalOpen, setIsAdjModalOpen] = useState(false);
  const [adjAgentId, setAdjAgentId] = useState(agents[0]?.id || "");
  const [adjRupees, setAdjRupees] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [adjSubmitting, setAdjSubmitting] = useState(false);
  const [adjError, setAdjError] = useState("");

  const formatRupees = (paise: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(paise / 100);
  };

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(window.location.search);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/admin/incentives/ledger?${params.toString()}`);
  };

  const handleExportCsv = () => {
    if (entries.length === 0) {
      alert("No entries to export");
      return;
    }
    const headers = [
      "Date",
      "Type",
      "Status",
      "Agent Name",
      "Agent Code",
      "Channel",
      "Reference",
      "Base Amount (INR)",
      "Rate (%)",
      "Incentive (INR)",
      "Notes",
    ];

    const rows = entries.map((e) => [
      new Date(e.createdAt).toISOString(),
      e.type,
      e.status,
      `"${e.agentUser.name.replace(/"/g, '""')}"`,
      e.agentUser.agentCode || "",
      e.invoice?.channel || "",
      e.invoice?.number || e.order?.orderNumber || "",
      (e.baseAmountPaise / 100).toFixed(2),
      (e.percentBp / 100).toFixed(2),
      (e.amountPaise / 100).toFixed(2),
      `"${(e.note || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `incentive_ledger_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRecordAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjSubmitting(true);
    setAdjError("");

    try {
      const rupees = parseFloat(adjRupees);
      if (isNaN(rupees) || rupees === 0) {
        throw new Error("Please enter a non-zero adjustment amount");
      }
      if (!adjReason || adjReason.trim().length < 5) {
        throw new Error("Reason must be at least 5 characters explaining this adjustment");
      }

      const amountPaise = Math.round(rupees * 100);
      await recordAdjustmentAction({
        agentUserId: adjAgentId,
        amountPaise,
        reason: adjReason.trim(),
      });

      setIsAdjModalOpen(false);
      setAdjRupees("");
      setAdjReason("");
    } catch (err: unknown) {
      setAdjError((err as Error).message || "Adjustment failed");
    } finally {
      setAdjSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
            <input
              type="text"
              placeholder="Search invoice #, agent, or note..."
              defaultValue={currentFilters.q}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleFilterChange("q", (e.target as HTMLInputElement).value);
                }
              }}
              className="w-full rounded-lg border border-stone-300 pl-9 pr-3 py-1.5 text-xs text-stone-800 placeholder-stone-400 focus:ring-1 focus:ring-amber-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-stone-700 text-xs font-semibold hover:bg-stone-50 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>

            {isSuperAdmin && (
              <button
                onClick={() => setIsAdjModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-800 text-white text-xs font-semibold hover:bg-amber-900 transition-colors shadow-sm"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                Manual Adjustment
              </button>
            )}
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-stone-100">
          <div>
            <label htmlFor="agent-select" className="block text-[11px] font-semibold text-stone-500 uppercase mb-1">
              Agent
            </label>
            <select
              id="agent-select"
              value={currentFilters.agentId}
              onChange={(e) => handleFilterChange("agentId", e.target.value)}
              className="w-full rounded-lg border border-stone-300 p-1.5 text-xs text-stone-800 bg-stone-50"
            >
              <option value="">All Staff / Agents</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.agentCode || "No code"})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="status-select" className="block text-[11px] font-semibold text-stone-500 uppercase mb-1">
              Status
            </label>
            <select
              id="status-select"
              value={currentFilters.status}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              className="w-full rounded-lg border border-stone-300 p-1.5 text-xs text-stone-800 bg-stone-50"
            >
              <option value="">All Statuses</option>
              <option value={IncentiveEntryStatus.PENDING}>PENDING</option>
              <option value={IncentiveEntryStatus.CREDITED}>CREDITED</option>
              <option value={IncentiveEntryStatus.REVERSED}>REVERSED</option>
              <option value={IncentiveEntryStatus.PAID}>PAID</option>
            </select>
          </div>

          <div>
            <label htmlFor="type-select" className="block text-[11px] font-semibold text-stone-500 uppercase mb-1">
              Entry Type
            </label>
            <select
              id="type-select"
              value={currentFilters.type}
              onChange={(e) => handleFilterChange("type", e.target.value)}
              className="w-full rounded-lg border border-stone-300 p-1.5 text-xs text-stone-800 bg-stone-50"
            >
              <option value="">All Types</option>
              <option value={IncentiveEntryType.ACCRUAL}>ACCRUAL</option>
              <option value={IncentiveEntryType.ADJUSTMENT}>ADJUSTMENT</option>
              <option value={IncentiveEntryType.REVERSAL}>REVERSAL</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-stone-600 text-xs">Date / Time</th>
                <th className="px-4 py-3 text-left font-semibold text-stone-600 text-xs">Type</th>
                <th className="px-4 py-3 text-left font-semibold text-stone-600 text-xs">Agent</th>
                <th className="px-4 py-3 text-left font-semibold text-stone-600 text-xs">Reference</th>
                <th className="px-4 py-3 text-left font-semibold text-stone-600 text-xs">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-stone-600 text-xs">Base Amount</th>
                <th className="px-4 py-3 text-right font-semibold text-stone-600 text-xs">Rate</th>
                <th className="px-4 py-3 text-right font-semibold text-stone-600 text-xs">Incentive</th>
                <th className="px-4 py-3 text-left font-semibold text-stone-600 text-xs">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-xs text-stone-400">
                    No matching ledger entries found.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const isNegative = entry.amountPaise < 0;
                  return (
                    <tr key={entry.id} className="hover:bg-stone-50/70">
                      <td className="px-4 py-3 text-xs text-stone-500 whitespace-nowrap">
                        {new Date(entry.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                        })}{" "}
                        <span className="text-[10px] text-stone-400">
                          {new Date(entry.createdAt).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                            entry.type === IncentiveEntryType.ACCRUAL
                              ? "bg-stone-100 text-stone-700"
                              : entry.type === IncentiveEntryType.REVERSAL
                              ? "bg-rose-100 text-rose-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {entry.type}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-medium text-stone-900 text-xs">
                        <div>{entry.agentUser.name}</div>
                        <span className="text-[10px] font-mono text-stone-500">
                          {entry.agentUser.agentCode || "—"}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-xs">
                        {entry.invoice ? (
                          <Link
                            href={`/shop/invoices?q=${entry.invoice.number}`}
                            className="font-mono text-amber-900 hover:underline flex items-center gap-1"
                          >
                            <span>{entry.invoice.number}</span>
                            <ExternalLink className="h-3 w-3 text-stone-400" />
                          </Link>
                        ) : entry.order ? (
                          <span className="font-mono text-stone-600">
                            {entry.order.orderNumber}
                          </span>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                        <div className="text-[10px] text-stone-400">
                          {entry.invoice?.channel || "Counter"}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            entry.status === IncentiveEntryStatus.CREDITED
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : entry.status === IncentiveEntryStatus.PENDING
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : entry.status === IncentiveEntryStatus.PAID
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {entry.status}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right text-xs text-stone-700">
                        {entry.baseAmountPaise ? formatRupees(entry.baseAmountPaise) : "—"}
                      </td>

                      <td className="px-4 py-3 text-right text-xs font-mono text-stone-600">
                        {entry.percentBp ? `${(entry.percentBp / 100).toFixed(2)}%` : "—"}
                      </td>

                      <td
                        className={`px-4 py-3 text-right font-bold text-sm ${
                          isNegative
                            ? "text-rose-600"
                            : entry.status === IncentiveEntryStatus.CREDITED
                            ? "text-emerald-700"
                            : "text-stone-900"
                        }`}
                      >
                        {formatRupees(entry.amountPaise)}
                      </td>

                      <td className="px-4 py-3 text-xs text-stone-500 max-w-xs truncate">
                        {entry.note || entry.triggerEvent || "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Adjustment Modal */}
      {isAdjModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-800" />
                <h3 className="text-base font-bold text-stone-900">Manual Ledger Adjustment</h3>
              </div>
              <button
                onClick={() => setIsAdjModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-stone-500">
              Record a credit (positive) or clawback (negative) manual adjustment with an immutable audit log reason.
            </p>

            {adjError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                {adjError}
              </div>
            )}

            <form onSubmit={handleRecordAdjustment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Agent
                </label>
                <select
                  required
                  value={adjAgentId}
                  onChange={(e) => setAdjAgentId(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 p-2 text-xs text-stone-800 focus:ring-1 focus:ring-amber-600"
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.agentCode || "No code"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Adjustment Amount (₹) — Use minus sign for penalty/clawback
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 250.00 or -100.00"
                  value={adjRupees}
                  onChange={(e) => setAdjRupees(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 p-2 text-xs text-stone-800 focus:ring-1 focus:ring-amber-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Mandatory Audit Reason
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Festival performance bonus or reconciliation clawback"
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 p-2 text-xs text-stone-800 focus:ring-1 focus:ring-amber-600"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAdjModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjSubmitting}
                  className="px-4 py-2 rounded-lg bg-amber-800 text-white text-xs font-semibold hover:bg-amber-900 transition-colors shadow-sm disabled:opacity-50"
                >
                  {adjSubmitting ? "Recording..." : "Record Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
