"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { AgentSalesReport } from "@/modules/billing/agent.service";
import { InvoiceChannel } from "@prisma/client";
import { formatISTDate, formatISTDateTime } from "@/lib/date";
import { getAgentReportAction, reassignAgentAction } from "./actions";

interface AgentSalesClientProps {
  initialReport: AgentSalesReport;
  agents: Array<{ id: string; name: string; role: string; agentCode: string | null }>;
  locations: Array<{ id: string; name: string }>;
  isAdmin: boolean;
}

export function AgentSalesClient({
  initialReport,
  agents,
  locations,
  isAdmin,
}: AgentSalesClientProps) {
  const [report, setReport] = useState<AgentSalesReport>(initialReport);
  const [isPending, startTransition] = useTransition();

  // Filters
  const [startDate, setStartDate] = useState(
    () => new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [agentFilter, setAgentFilter] = useState("ALL");
  const [locationFilter, setLocationFilter] = useState("ALL");
  const [channelFilter, setChannelFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Reassignment Modal State
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [targetInvoice, setTargetInvoice] = useState<{
    id: string;
    number: string;
    agentName: string;
    agentCode: string;
    agentUserId: string | null;
  } | null>(null);
  const [selectedNewAgentId, setSelectedNewAgentId] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [reassignSuccess, setReassignSuccess] = useState<string | null>(null);
  const [isReassigning, setIsReassigning] = useState(false);

  const applyFilters = () => {
    startTransition(async () => {
      try {
        const res = await getAgentReportAction({
          startDate: startDate ? new Date(`${startDate}T00:00:00.000Z`) : undefined,
          endDate: endDate ? new Date(`${endDate}T23:59:59.999Z`) : undefined,
          agentUserId: agentFilter !== "ALL" ? agentFilter : undefined,
          locationId: locationFilter !== "ALL" ? locationFilter : undefined,
          channel: channelFilter !== "ALL" ? (channelFilter as InvoiceChannel) : undefined,
        });
        setReport(res);
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : "Failed to load report");
      }
    });
  };

  const handleReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetInvoice || !selectedNewAgentId || !reassignReason.trim()) return;

    setIsReassigning(true);
    setReassignError(null);

    const res = await reassignAgentAction(
      targetInvoice.id,
      selectedNewAgentId,
      reassignReason.trim()
    );

    setIsReassigning(false);

    if (res.success && "newAgentCode" in res) {
      setReassignSuccess(
        `Invoice ${targetInvoice.number} reassigned to agent (${res.newAgentCode}).`
      );
      setReassignModalOpen(false);
      setReassignReason("");
      setSelectedNewAgentId("");
      applyFilters();
    } else {
      setReassignError("error" in res && res.error ? res.error : "Reassignment failed");
    }
  };

  const exportCsv = () => {
    const headers = [
      "Invoice Number",
      "Date Time (IST)",
      "Channel",
      "Location",
      "Customer Name",
      "Customer Phone",
      "Status",
      "Payable (Rs)",
      "Agent Code",
      "Agent Name",
    ];

    const rows = report.invoices.map((inv) => [
      inv.number,
      formatISTDateTime(inv.createdAt),
      inv.channel,
      inv.locationName,
      inv.customerName || "Walk-in",
      inv.customerPhone || "—",
      inv.status,
      (inv.totalPaise / 100).toFixed(2),
      inv.agentCode,
      inv.agentName,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `agent_sales_report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredInvoices = report.invoices.filter((inv) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      inv.number.toLowerCase().includes(q) ||
      inv.agentName.toLowerCase().includes(q) ||
      inv.agentCode.toLowerCase().includes(q) ||
      (inv.customerName && inv.customerName.toLowerCase().includes(q)) ||
      (inv.customerPhone && inv.customerPhone.includes(q))
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Staff Agent Sales & Incentives Report
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-900 border border-amber-200 uppercase">
              Incentives
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Track turnover performance auto-credited to cashier & van agents with audit-logged reassignment.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-xs transition"
          >
            <span>⬇ Export CSV</span>
          </button>
        </div>
      </div>

      {reassignSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900 flex justify-between items-center">
          <span>{reassignSuccess}</span>
          <button
            onClick={() => setReassignSuccess(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">Agent:</span>
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium bg-white"
            >
              <option value="ALL">All Staff Agents</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} {a.agentCode ? `(${a.agentCode})` : "(No Code)"}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">Channel:</span>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium bg-white"
            >
              <option value="ALL">All Channels</option>
              <option value="SHOP">Shop POS Counter</option>
              <option value="VAN">Van Sales</option>
              <option value="ONLINE">Online Store</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">Location:</span>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium bg-white"
            >
              <option value="ALL">All Locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={applyFilters}
          disabled={isPending}
          className="px-4 py-2 rounded-xl bg-[#075828] hover:bg-emerald-900 text-white font-bold text-xs shadow-xs transition disabled:opacity-50"
        >
          {isPending ? "Filtering..." : "Apply Filters"}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Active Agents
          </span>
          <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
            {report.agents.length}
          </span>
          <p className="text-[11px] text-slate-500 mt-0.5">Staff with billed sales</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Invoices Billed
          </span>
          <span className="text-2xl font-bold font-mono text-blue-700 mt-1 block">
            {report.totalInvoices}
          </span>
          <p className="text-[11px] text-slate-500 mt-0.5">Successful finalized bills</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Cancelled Sales Excluded
          </span>
          <span className="text-2xl font-bold font-mono text-red-600 mt-1 block">
            ₹{(report.totalCancelledPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
          <p className="text-[11px] text-slate-500 mt-0.5">Deducted from incentive pool</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Net Sales Turnover
          </span>
          <span className="text-2xl font-bold font-mono text-emerald-800 mt-1 block">
            ₹{(report.totalNetSalesPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
          <p className="text-[11px] text-slate-500 mt-0.5">Eligible turnover base</p>
        </div>
      </div>

      {/* Agents Summary Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">
            Agent Performance Breakdown
          </h2>
          <span className="text-xs text-slate-500">
            Sorted by Net Sales Turnover
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <th className="py-3 px-3 w-12 text-center">Rank</th>
                <th className="py-3 px-3">Agent Code</th>
                <th className="py-3 px-3">Staff Name</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-3 text-right">Invoices</th>
                <th className="py-3 px-3 text-right">Gross Sales</th>
                <th className="py-3 px-3 text-right">Cancelled</th>
                <th className="py-3 px-3 text-right">Net Sales</th>
                <th className="py-3 px-3 text-right">Incentives / Comm.*</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {report.agents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No sales data found for the selected period and criteria.
                  </td>
                </tr>
              ) : (
                report.agents.map((ag, idx) => (
                  <tr key={ag.agentUserId} className="hover:bg-slate-50/50 transition">
                    <td className="py-2.5 px-3 text-center font-bold text-slate-400">
                      #{idx + 1}
                    </td>
                    <td className="py-2.5 px-3">
                      {ag.agentCode && ag.agentCode !== "—" ? (
                        <span className="font-mono font-bold text-amber-900 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[11px]">
                          {ag.agentCode}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {ag.agentName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 uppercase text-[10px]">
                      {ag.role}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-700">
                      {ag.invoiceCount}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                      ₹{(ag.grossSalesPaise / 100).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-red-600">
                      {ag.cancelledCount > 0 ? `-₹${(ag.cancelledPaise / 100).toFixed(2)} (${ag.cancelledCount})` : "₹0.00"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-800">
                      ₹{(ag.netSalesPaise / 100).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-400 font-mono">
                      ₹{(ag.commissionPaise / 100).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500">
          * Incentive/Commission rules extension point: currently calculates turnover base. Can be linked to tiered SKU bonus schemes.
        </div>
      </div>

      {/* Invoices Drill-down Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Invoice Transaction Drill-Down
            </h2>
            <p className="text-xs text-slate-500">
              Detailed log of invoices attributed to agents with admin reassignment controls.
            </p>
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Search invoice, customer, agent..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <th className="py-3 px-3">Invoice No</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Channel</th>
                <th className="py-3 px-3">Customer</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Payable (₹)</th>
                <th className="py-3 px-3">Agent</th>
                {isAdmin && <th className="py-3 px-3 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No matching invoices found.
                  </td>
                </tr>
              ) : (
                filteredInvoices.slice(0, 100).map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-2.5 px-3">
                      <Link
                        href={`/shop/invoices/${inv.id}`}
                        className="font-mono font-bold text-blue-700 hover:underline"
                      >
                        {inv.number}
                      </Link>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {formatISTDate(inv.createdAt)}
                    </td>
                    <td className="py-2.5 px-3 uppercase text-[10px] text-slate-500">
                      {inv.channel} ({inv.locationName})
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-slate-900 block truncate max-w-[150px]">
                        {inv.customerName || "Walk-in Retail"}
                      </span>
                      {inv.customerPhone && (
                        <span className="text-[10px] text-slate-500 font-mono block">
                          {inv.customerPhone}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          inv.status === "FINAL"
                            ? "bg-emerald-100 text-emerald-800"
                            : inv.status === "CANCELLED"
                            ? "bg-red-100 text-red-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      ₹{(inv.totalPaise / 100).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        {inv.agentCode && inv.agentCode !== "—" && (
                          <span className="font-mono font-bold text-amber-900 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded text-[10px]">
                            {inv.agentCode}
                          </span>
                        )}
                        <span className="text-slate-800 truncate max-w-[120px]">
                          {inv.agentName}
                        </span>
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setTargetInvoice(inv);
                            setSelectedNewAgentId(inv.agentUserId || "");
                            setReassignReason("");
                            setReassignError(null);
                            setReassignModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 transition"
                        >
                          Reassign
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filteredInvoices.length > 100 && (
          <div className="p-3 text-center text-xs text-slate-500 border-t border-slate-200 bg-slate-50">
            Showing first 100 of {filteredInvoices.length} transactions. Export CSV to view complete records.
          </div>
        )}
      </div>

      {/* Admin Reassign Modal */}
      {reassignModalOpen && targetInvoice && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                Reassign Invoice Agent
              </h3>
              <button
                onClick={() => setReassignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-1">
              <p>
                <strong>Invoice:</strong> <span className="font-mono font-bold">{targetInvoice.number}</span>
              </p>
              <p>
                <strong>Current Agent:</strong> {targetInvoice.agentName} ({targetInvoice.agentCode})
              </p>
            </div>

            {reassignError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-900">
                {reassignError}
              </div>
            )}

            <form onSubmit={handleReassign} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Assign To New Agent:
                </label>
                <select
                  value={selectedNewAgentId}
                  onChange={(e) => setSelectedNewAgentId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium"
                >
                  <option value="">Select target agent...</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.agentCode || "No Code"} - {a.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Reason for Reassignment (Audit Logged):
                </label>
                <textarea
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="e.g. Counter handover correction, joint sales shift correction..."
                  required
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReassignModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReassigning}
                  className="px-4 py-2 rounded-xl bg-[#075828] hover:bg-emerald-900 text-white font-bold text-xs disabled:opacity-50"
                >
                  {isReassigning ? "Saving..." : "Confirm Reassignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
