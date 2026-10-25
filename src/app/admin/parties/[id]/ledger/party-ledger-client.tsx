"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PartyLedgerStatement } from "@/modules/party/party.types";
import { CollectionModal } from "@/components/van/collection-modal";
import { formatISTDate, formatISTTime } from "@/lib/date";
import {
  ArrowLeft,
  Wallet,
  Printer,
  Calendar,
  Building2,
  Phone,
  FileText,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

interface PartyLedgerClientProps {
  initialStatement: PartyLedgerStatement;
  partyId: string;
}

export function PartyLedgerClient({
  initialStatement,
  partyId,
}: PartyLedgerClientProps) {
  const [statement, setStatement] = useState<PartyLedgerStatement>(initialStatement);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCollecting, setIsCollecting] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);

  const { party, entries, openingBalancePaise, totalDebitPaise, totalCreditPaise, closingBalancePaise } = statement;

  const handleApplyDateFilter = async (e: React.FormEvent) => {
    e.preventDefault();
    setFilterLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.set("startDate", startDate);
      if (endDate) queryParams.set("endDate", endDate);
      window.location.search = queryParams.toString();
    } finally {
      setFilterLoading(false);
    }
  };

  const handleCollectionSuccess = () => {
    // Refresh page to load updated ledger
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/parties"
            className="p-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Link href="/admin/parties" className="hover:underline">
                Parties
              </Link>
              <span>/</span>
              <span>Ledger Statement</span>
            </div>
            <h1 className="text-2xl font-black text-gray-900">{party.name}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-sm transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Statement</span>
          </button>
          <button
            onClick={() => setIsCollecting(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>+ Record Collection</span>
          </button>
        </div>
      </div>

      {/* Party Profile Header Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 divide-y md:divide-y-0 md:divide-x divide-gray-100">
          {/* Col 1: Contact Details */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Party Info
            </span>
            <p className="text-sm font-bold text-gray-900">{party.name}</p>
            {party.phone && (
              <p className="text-xs text-gray-600 flex items-center gap-1">
                <Phone className="w-3 h-3 text-gray-400" />
                <span>{party.phone}</span>
              </p>
            )}
            {party.gstin && (
              <p className="text-xs text-gray-600 font-mono">GSTIN: {party.gstin}</p>
            )}
            {party.address && <p className="text-xs text-gray-500">{party.address}</p>}
          </div>

          {/* Col 2: Credit Terms */}
          <div className="md:pl-4 space-y-1 pt-3 md:pt-0">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Credit Authorization
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                  party.creditEnabled
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {party.creditEnabled ? "Credit Approved" : "Credit Disabled"}
              </span>
              <span className="text-xs text-gray-500 font-medium">{party.type}</span>
            </div>
            <p className="text-xs text-gray-600">
              Limit:{" "}
              <strong className="text-gray-900">
                ₹{(party.creditLimitPaise / 100).toFixed(2)}
              </strong>
            </p>
            {party.creditDays > 0 && (
              <p className="text-xs text-gray-600">
                Terms: <strong>{party.creditDays} days</strong>
              </p>
            )}
          </div>

          {/* Col 3: Outstanding Status */}
          <div className="md:pl-4 space-y-1 pt-3 md:pt-0">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Current Outstanding
            </span>
            <p
              className={`text-2xl font-black ${
                closingBalancePaise > 0
                  ? "text-amber-600"
                  : closingBalancePaise < 0
                  ? "text-blue-600"
                  : "text-emerald-600"
              }`}
            >
              ₹{(closingBalancePaise / 100).toFixed(2)}
              <span className="text-xs ml-1 font-semibold text-gray-500">
                {closingBalancePaise > 0 ? "Dr" : closingBalancePaise < 0 ? "Cr" : ""}
              </span>
            </p>
            <p className="text-[11px] text-gray-500">
              {closingBalancePaise > 0
                ? "Pending payment owed to distributor"
                : "No outstanding balance"}
            </p>
          </div>

          {/* Col 4: Available Credit */}
          <div className="md:pl-4 space-y-1 pt-3 md:pt-0">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Available Credit Line
            </span>
            {party.creditEnabled ? (
              <>
                <p className="text-xl font-black text-gray-900">
                  ₹{Math.max(0, (party.creditLimitPaise - closingBalancePaise) / 100).toFixed(2)}
                </p>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mt-1.5">
                  <div
                    className={`h-full ${
                      closingBalancePaise > party.creditLimitPaise
                        ? "bg-red-500"
                        : "bg-emerald-500"
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        party.creditLimitPaise > 0
                          ? (closingBalancePaise / party.creditLimitPaise) * 100
                          : 0
                      )}%`,
                    }}
                  />
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-500 mt-2">Cash sales only</p>
            )}
          </div>
        </div>
      </div>

      {/* Date Filter & Metrics Strip */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Date Filter Form */}
        <form onSubmit={handleApplyDateFilter} className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span>From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <span>To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={filterLoading}
            className="px-3 py-1.5 text-xs font-semibold bg-gray-800 text-white rounded-md hover:bg-gray-700 transition"
          >
            Filter
          </button>
        </form>

        {/* Statement Totals */}
        <div className="flex items-center gap-6 text-right">
          <div>
            <span className="text-[10px] text-gray-400 uppercase font-bold">Total Debits</span>
            <p className="text-sm font-bold text-gray-900">
              ₹{(totalDebitPaise / 100).toFixed(2)}
            </p>
          </div>
          <div className="pl-6 border-l border-gray-100">
            <span className="text-[10px] text-gray-400 uppercase font-bold">Total Credits</span>
            <p className="text-sm font-bold text-emerald-600">
              ₹{(totalCreditPaise / 100).toFixed(2)}
            </p>
          </div>
          <div className="pl-6 border-l border-gray-100">
            <span className="text-[10px] text-gray-400 uppercase font-bold">Entries</span>
            <p className="text-sm font-bold text-gray-700">{entries.length}</p>
          </div>
        </div>
      </div>

      {/* Ledger Transactions Statement Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Date & Time</th>
                <th className="px-4 py-3">Voucher Type</th>
                <th className="px-4 py-3">Reference / Number</th>
                <th className="px-4 py-3 text-right">Debit (₹)</th>
                <th className="px-4 py-3 text-right">Credit (₹)</th>
                <th className="px-4 py-3 text-right">Balance (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {/* Opening Balance Row */}
              {openingBalancePaise !== 0 && (
                <tr className="bg-gray-50/60 font-semibold text-gray-700">
                  <td className="px-4 py-2.5" colSpan={3}>
                    Opening Balance
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {openingBalancePaise > 0 ? `₹${(openingBalancePaise / 100).toFixed(2)}` : "-"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {openingBalancePaise < 0
                      ? `₹${(Math.abs(openingBalancePaise) / 100).toFixed(2)}`
                      : "-"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold">
                    ₹{(openingBalancePaise / 100).toFixed(2)}
                  </td>
                </tr>
              )}

              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                    No transactions recorded for this party in the selected date range.
                  </td>
                </tr>
              ) : (
                entries.map((row) => {
                  const date = new Date(row.createdAt);
                  const isDebit = row.debitPaise > 0;

                  return (
                    <tr key={row.id} className="hover:bg-gray-50/80 transition">
                      <td className="px-4 py-3 text-gray-600">
                        <span>{formatISTDate(date)}</span>{" "}
                        <span className="text-gray-400">{formatISTTime(date)}</span>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            row.kind === "INVOICE"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : row.kind === "RECEIPT"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : row.kind === "CREDIT_NOTE"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {row.kind}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-mono font-medium text-gray-800">
                        {row.referenceId || row.referenceType || "-"}
                      </td>

                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {row.debitPaise > 0 ? `₹${(row.debitPaise / 100).toFixed(2)}` : "-"}
                      </td>

                      <td className="px-4 py-3 text-right font-medium text-emerald-600">
                        {row.creditPaise > 0 ? `₹${(row.creditPaise / 100).toFixed(2)}` : "-"}
                      </td>

                      <td className="px-4 py-3 text-right font-bold text-gray-900">
                        ₹{(row.runningBalancePaise / 100).toFixed(2)}{" "}
                        <span className="text-[10px] text-gray-400 font-normal">
                          {row.runningBalancePaise > 0 ? "Dr" : row.runningBalancePaise < 0 ? "Cr" : ""}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Closing Balance Footer */}
            <tfoot className="bg-gray-50 border-t-2 border-gray-300 font-bold text-xs text-gray-900">
              <tr>
                <td className="px-4 py-3" colSpan={3}>
                  Closing Balance
                </td>
                <td className="px-4 py-3 text-right">
                  ₹{(totalDebitPaise / 100).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right text-emerald-600">
                  ₹{(totalCreditPaise / 100).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right font-black text-sm">
                  ₹{(closingBalancePaise / 100).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Record Collection Modal */}
      <CollectionModal
        party={{
          id: party.id,
          name: party.name,
          phone: party.phone,
          outstandingPaise: closingBalancePaise,
        }}
        isOpen={isCollecting}
        onClose={() => setIsCollecting(false)}
        onSuccess={handleCollectionSuccess}
      />
    </div>
  );
}
