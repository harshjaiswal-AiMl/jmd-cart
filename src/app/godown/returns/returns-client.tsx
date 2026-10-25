"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatISTDate } from "@/lib/date";
import { DebitNoteWithDetails, StockWiseReturnReport } from "@/modules/returns/returns.types";
import {
  ArrowLeft,
  Plus,
  Printer,
  FileText,
  PackageMinus,
  Search,
  Download,
  Filter,
  BarChart3,
  ListOrdered,
} from "lucide-react";

interface Props {
  debitNotes: DebitNoteWithDetails[];
  totalCount: number;
  stockWiseReport: StockWiseReturnReport;
  initialTab?: "notes" | "stock-wise";
}

export function ReturnsClient({
  debitNotes,
  totalCount,
  stockWiseReport,
  initialTab = "notes",
}: Props) {
  const [tab, setTab] = useState<"notes" | "stock-wise">(initialTab);
  const [search, setSearch] = useState("");
  const [reasonFilter, setReasonFilter] = useState("ALL");

  const safeNotes = debitNotes ?? [];
  const safeStockReport = stockWiseReport ?? { rows: [], totalItemsReturned: 0, totalValuationPaise: 0, totalDebitNotesCount: 0 };

  const totalValuePaise = safeNotes.reduce((sum, n) => sum + (n.totalPaise || 0), 0);
  const totalUnits = safeNotes.reduce(
    (sum, n) => sum + (n.items || []).reduce((iSum, item) => iSum + (item.qty || 0), 0),
    0
  );

  // Filter debit notes
  const filteredNotes = safeNotes.filter((note) => {
    if (reasonFilter !== "ALL" && note.reason !== reasonFilter) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchNum = note.number?.toLowerCase().includes(q) ?? false;
      const matchSupp = note.supplier?.name?.toLowerCase().includes(q) ?? false;
      if (!matchNum && !matchSupp) return false;
    }
    return true;
  });

  // Filter stock-wise report rows
  const filteredStockRows = (safeStockReport.rows || []).filter((row) => {
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchName = row.productName?.toLowerCase().includes(q) ?? false;
      const matchCode = row.shortCode?.toLowerCase().includes(q) ?? false;
      const matchComp = row.companyName?.toLowerCase().includes(q) ?? false;
      if (!matchName && !matchCode && !matchComp) return false;
    }
    return true;
  });

  const handleExportStockWiseCSV = () => {
    const headers = [
      "Product Name",
      "Short Code",
      "Company",
      "HSN",
      "Total Qty Returned",
      "Taxable Value (Rs)",
      "Tax (Rs)",
      "Total Valuation (Rs)",
      "Debit Notes Count",
      "Reasons Breakdown",
    ];

    const csvRows = filteredStockRows.map((r) => [
      `"${r.productName.replace(/"/g, '""')}"`,
      r.shortCode,
      `"${r.companyName.replace(/"/g, '""')}"`,
      r.hsn,
      r.totalQtyReturned,
      (r.totalTaxablePaise / 100).toFixed(2),
      (r.totalTaxPaise / 100).toFixed(2),
      (r.totalValuationPaise / 100).toFixed(2),
      r.returnsCount,
      `"${Object.entries(r.reasonsBreakdown)
        .map(([k, v]) => `${k}: ${v}`)
        .join("; ")}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...csvRows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `stock_wise_returns_${stockWiseReport.asOfDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/godown/operations"
              className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Company Returns & Debit Notes
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 pl-8">
            Return damaged, expired, or recall stock to manufacturers and suppliers with formal GST Debit Notes.
          </p>
        </div>

        <div>
          <Link
            href="/godown/returns/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-sm text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Create Return to Company
          </Link>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Total Debit Notes Issued
          </span>
          <span className="text-2xl font-mono font-black text-slate-900 block mt-1">
            {totalCount}
          </span>
          <span className="text-xs text-slate-400 mt-0.5 block">
            Gapless GST sequence: DN/26-27/XXXXXX
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Total Returned Value
          </span>
          <span className="text-2xl font-mono font-bold text-emerald-700 block mt-1">
            ₹{(totalValuePaise / 100).toFixed(2)}
          </span>
          <span className="text-xs text-slate-400 mt-0.5 block">
            Debited from supplier accounts
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Total Units Returned
          </span>
          <span className="text-2xl font-mono font-bold text-blue-700 block mt-1">
            {totalUnits} pcs
          </span>
          <span className="text-xs text-slate-400 mt-0.5 block">
            Deducted via RETURN_TO_COMPANY
          </span>
        </div>
      </div>

      {/* Tab Switcher & Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 px-4 pt-2 gap-2 text-xs font-bold bg-slate-50/50">
          <button
            type="button"
            onClick={() => setTab("notes")}
            className={`px-4 py-3 border-b-2 transition inline-flex items-center gap-1.5 ${
              tab === "notes"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            Debit Notes Register ({debitNotes.length})
          </button>

          <button
            type="button"
            onClick={() => setTab("stock-wise")}
            className={`px-4 py-3 border-b-2 transition inline-flex items-center gap-1.5 ${
              tab === "stock-wise"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Stock-Wise Company Returns ({stockWiseReport.rows.length} products)
          </button>
        </div>

        {/* Filter Strip */}
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder={
                  tab === "notes"
                    ? "Search debit note # or supplier..."
                    : "Search product name, code, brand..."
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg w-64 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {tab === "notes" && (
              <select
                value={reasonFilter}
                onChange={(e) => setReasonFilter(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              >
                <option value="ALL">All Return Reasons</option>
                <option value="DAMAGE">Damaged Goods</option>
                <option value="EXPIRY">Expired / Near Expiry</option>
                <option value="SLOW_MOVING">Slow Moving</option>
                <option value="RATE_DIFFERENCE">Rate Difference</option>
                <option value="RECALL">Batch Recall</option>
                <option value="QUALITY_REJECTION">Quality Rejection</option>
                <option value="OTHER">Other</option>
              </select>
            )}
          </div>

          <div>
            {tab === "stock-wise" && (
              <button
                type="button"
                onClick={handleExportStockWiseCSV}
                className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Export Stock-Wise CSV
              </button>
            )}
          </div>
        </div>

        {/* TAB 1: DEBIT NOTES REGISTER */}
        {tab === "notes" && (
          <div>
            {filteredNotes.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <PackageMinus className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-slate-500 text-xs">No debit notes found matching criteria.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="p-3">Debit Note #</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Supplier (Vendor)</th>
                      <th className="p-3">Reason</th>
                      <th className="p-3 text-right">Items</th>
                      <th className="p-3 text-right">Total Debit (₹)</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredNotes.map((note) => {
                      const itemCount = note.items.reduce((s, i) => s + i.qty, 0);

                      return (
                        <tr key={note.id} className="hover:bg-slate-50/80 transition">
                          <td className="p-3 font-mono font-bold text-blue-700">
                            <Link
                              href={`/godown/returns/${note.id}`}
                              className="hover:underline"
                            >
                              {note.number}
                            </Link>
                          </td>

                          <td className="p-3 font-mono text-slate-600">
                            {formatISTDate(note.createdAt)}
                          </td>

                          <td className="p-3">
                            <div className="font-semibold text-slate-900">
                              {note.supplier.name}
                            </div>
                            {note.supplier.gstin && (
                              <div className="text-[10px] font-mono text-slate-400">
                                GSTIN: {note.supplier.gstin}
                              </div>
                            )}
                          </td>

                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              {note.reason.replace(/_/g, " ")}
                            </span>
                          </td>

                          <td className="p-3 text-right font-mono font-medium text-slate-900">
                            {itemCount} pcs ({note.items.length} products)
                          </td>

                          <td className="p-3 text-right font-mono font-black text-emerald-700 text-sm">
                            ₹{(note.totalPaise / 100).toFixed(2)}
                          </td>

                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <Link
                                href={`/godown/returns/${note.id}`}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                                title="View Details"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </Link>
                              <Link
                                href={`/godown/returns/${note.id}/print`}
                                target="_blank"
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                                title="Print A4 Debit Note"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: STOCK-WISE RETURN TO COMPANY REPORT */}
        {tab === "stock-wise" && (
          <div>
            {filteredStockRows.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <BarChart3 className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-slate-500 text-xs">No stock return records match filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="p-3">Product Name</th>
                      <th className="p-3 text-center">Code / HSN</th>
                      <th className="p-3">Manufacturer</th>
                      <th className="p-3 text-right">Total Returned</th>
                      <th className="p-3 text-right">Taxable (₹)</th>
                      <th className="p-3 text-right">Total Valuation (₹)</th>
                      <th className="p-3">Return Reasons Breakdown</th>
                      <th className="p-3 text-center">Notes Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStockRows.map((row) => (
                      <tr key={row.productId} className="hover:bg-slate-50/80 transition">
                        <td className="p-3 font-semibold text-slate-900">
                          {row.productName}
                        </td>

                        <td className="p-3 text-center font-mono text-slate-600">
                          <div>{row.shortCode}</div>
                          <div className="text-[10px] text-slate-400">HSN: {row.hsn}</div>
                        </td>

                        <td className="p-3 text-slate-600">
                          {row.companyName}
                        </td>

                        <td className="p-3 text-right font-mono font-bold text-slate-900">
                          {row.totalQtyReturned} pcs
                        </td>

                        <td className="p-3 text-right font-mono text-slate-700">
                          ₹{(row.totalTaxablePaise / 100).toFixed(2)}
                        </td>

                        <td className="p-3 text-right font-mono font-black text-emerald-700">
                          ₹{(row.totalValuationPaise / 100).toFixed(2)}
                        </td>

                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(row.reasonsBreakdown).map(([rReason, rQty]) => (
                              <span
                                key={rReason}
                                className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                              >
                                {rReason.replace(/_/g, " ")}: <strong>{rQty}</strong>
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="p-3 text-center font-mono text-slate-600">
                          {row.returnsCount}
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
    </div>
  );
}
