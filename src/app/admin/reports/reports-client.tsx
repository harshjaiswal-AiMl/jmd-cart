"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DailySalesReport,
  DayEndCashReport,
  StockValuationReport,
  LowStockReport,
  PartyAgeingReport,
  PartyAgeingRow,
  Gstr1Report,
  DayBookReport,
} from "@/modules/reports/reports.types";
import { exportTallyVouchersAction } from "./tally-actions";
import { formatISTDate, formatISTDateTime } from "@/lib/date";
import {
  Download,
  AlertTriangle,
  Search,
  Users,
  CreditCard,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  FileSpreadsheet,
  BookOpen,
} from "lucide-react";

interface ReportsClientProps {
  initialTab: "sales" | "cash" | "stock" | "lowstock" | "ageing" | "gst" | "daybook" | "tally";
  selectedDate: string;
  salesData: DailySalesReport;
  cashData: DayEndCashReport;
  stockData: StockValuationReport;
  lowStockData: LowStockReport;
  ageingData: PartyAgeingReport;
  gstr1Data: Gstr1Report;
  dayBookData: DayBookReport;
  locationsList: { id: string; name: string }[];
}

export function ReportsClient({
  initialTab,
  selectedDate,
  salesData,
  cashData,
  stockData,
  lowStockData,
  ageingData,
  gstr1Data,
  dayBookData,
  locationsList,
}: ReportsClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<"sales" | "cash" | "stock" | "lowstock" | "ageing" | "gst" | "daybook" | "tally">(
    initialTab
  );
  const [filterDate, setFilterDate] = useState(selectedDate);
  const [stockSearch, setStockSearch] = useState("");
  const [stockCompanyFilter, setStockCompanyFilter] = useState("ALL");

  // Ageing filters
  const [ageingSearch, setAgeingSearch] = useState("");
  const [ageingTypeFilter, setAgeingTypeFilter] = useState("ALL");
  const [ageingOverdueOnly, setAgeingOverdueOnly] = useState(false);
  const [ageingOverLimitOnly, setAgeingOverLimitOnly] = useState(false);

  // Tally export states
  const [tallyFormat, setTallyFormat] = useState<"XML" | "CSV">("XML");
  const [tallyStartDate, setTallyStartDate] = useState(selectedDate);
  const [tallyEndDate, setTallyEndDate] = useState(selectedDate);
  const [tallyVoucherType, setTallyVoucherType] = useState<"ALL" | "SALES" | "RECEIPT">("ALL");
  const [tallyExporting, setTallyExporting] = useState(false);
  const [tallyExportError, setTallyExportError] = useState("");
  const [tallyExportSuccess, setTallyExportSuccess] = useState<string | null>(null);

  // Denomination counts state for Day-End Cash reconciliation
  const [denominations, setDenominations] = useState<{ [key: number]: number }>({
    500: 0,
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
  });

  const handleDateChange = (newDate: string) => {
    setFilterDate(newDate);
    router.push(`/admin/reports?tab=${tab}&date=${newDate}`);
  };

  const handleTabSwitch = (
    newTab: "sales" | "cash" | "stock" | "lowstock" | "ageing" | "gst" | "daybook" | "tally"
  ) => {
    setTab(newTab);
    router.push(`/admin/reports?tab=${newTab}&date=${filterDate}`);
  };

  // Calculate counted cash total
  const countedCashPaise = Object.entries(denominations).reduce(
    (sum, [note, count]) => sum + Number(note) * 100 * (count || 0),
    0
  );
  const cashVariancePaise = countedCashPaise - cashData.totalCashPaise;

  // Filter stock valuation
  const uniqueCompanies = Array.from(
    new Set(stockData.items.map((i) => i.companyName))
  ).sort();

  const filteredStockItems = stockData.items.filter((item) => {
    if (
      stockCompanyFilter !== "ALL" &&
      item.companyName !== stockCompanyFilter
    ) {
      return false;
    }
    if (stockSearch.trim()) {
      const q = stockSearch.toLowerCase().trim();
      const matchName = item.name.toLowerCase().includes(q);
      const matchCode = item.shortCode.toLowerCase().includes(q);
      if (!matchName && !matchCode) return false;
    }
    return true;
  });

  const filteredAgeingRows = ageingData.rows.filter((row) => {
    if (ageingTypeFilter !== "ALL" && row.type !== ageingTypeFilter) {
      return false;
    }
    if (ageingOverdueOnly && !row.isOverdue) {
      return false;
    }
    if (ageingOverLimitOnly && !row.isOverLimit) {
      return false;
    }
    if (ageingSearch.trim()) {
      const q = ageingSearch.toLowerCase().trim();
      const matchName = row.name.toLowerCase().includes(q);
      const matchPhone = (row.phone || "").toLowerCase().includes(q);
      if (!matchName && !matchPhone) return false;
    }
    return true;
  });

  const handleExportAgeingCSV = () => {
    const headers = [
      "Party Name",
      "Type",
      "Phone",
      "Credit Limit (Rs)",
      "Credit Days",
      "Total Outstanding (Rs)",
      "0-15 Days (Rs)",
      "16-30 Days (Rs)",
      "31-60 Days (Rs)",
      "60+ Days (Rs)",
      "Oldest Bill Date",
      "Overdue Days",
      "Risk Status",
    ];

    const csvRows = filteredAgeingRows.map((r) => [
      `"${r.name.replace(/"/g, '""')}"`,
      r.type,
      `"${r.phone || ""}"`,
      (r.creditLimitPaise / 100).toFixed(2),
      r.creditDays,
      (r.totalOutstandingPaise / 100).toFixed(2),
      (r.bucket0_15Paise / 100).toFixed(2),
      (r.bucket16_30Paise / 100).toFixed(2),
      (r.bucket31_60Paise / 100).toFixed(2),
      (r.bucket60PlusPaise / 100).toFixed(2),
      r.oldestEntryDate ? new Date(r.oldestEntryDate).toISOString().slice(0, 10) : "",
      r.overdueDays,
      r.isOverLimit && r.isOverdue
        ? "OVER_LIMIT & OVERDUE"
        : r.isOverLimit
        ? "OVER_LIMIT"
        : r.isOverdue
        ? "OVERDUE"
        : "NORMAL",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...csvRows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `party_ageing_report_${ageingData.asOfDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Business Reports & Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time stock valuation, low stock alerts, daily sales receipts, day-end cash register, and receivables ageing.
          </p>
        </div>

        {/* Global Date Filter for date-based reports */}
        {(tab === "sales" || tab === "cash") && (
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-300">
            <span className="text-xs font-semibold text-slate-700 pl-2">
              Business Date:
            </span>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap border-b border-slate-200 bg-white rounded-t-xl px-4 pt-2 gap-2 text-xs font-bold">
        <button
          type="button"
          onClick={() => handleTabSwitch("sales")}
          className={`px-4 py-3 border-b-2 transition ${
            tab === "sales"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Daily Sales Summary
        </button>

        <button
          type="button"
          onClick={() => handleTabSwitch("cash")}
          className={`px-4 py-3 border-b-2 transition ${
            tab === "cash"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Day-End Cash Register
        </button>

        <button
          type="button"
          onClick={() => handleTabSwitch("stock")}
          className={`px-4 py-3 border-b-2 transition ${
            tab === "stock"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Stock Inventory & Valuation
        </button>

        <button
          type="button"
          onClick={() => handleTabSwitch("lowstock")}
          className={`px-4 py-3 border-b-2 transition relative ${
            tab === "lowstock"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Low Stock Alerts
          {lowStockData.totalLowStockCount > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-red-100 text-red-700 border border-red-300">
              {lowStockData.totalLowStockCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabSwitch("ageing")}
          className={`px-4 py-3 border-b-2 transition relative ${
            tab === "ageing"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Receivables & Ageing
          {ageingData.summary.overdueCount > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 border border-amber-300">
              {ageingData.summary.overdueCount} Overdue
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabSwitch("gst")}
          className={`px-4 py-3 border-b-2 transition relative flex items-center gap-1.5 ${
            tab === "gst"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>GSTR-1 (Outward GST)</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabSwitch("daybook")}
          className={`px-4 py-3 border-b-2 transition relative flex items-center gap-1.5 ${
            tab === "daybook"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Day Book (Registers)</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabSwitch("tally")}
          className={`px-4 py-3 border-b-2 transition relative flex items-center gap-1.5 ${
            tab === "tally"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Tally Export</span>
        </button>
      </div>

      {/* TAB 1: DAILY SALES SUMMARY */}
      {tab === "sales" && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 block uppercase">
                Finalized Invoices
              </span>
              <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
                {salesData.invoiceCount}
              </span>
              <span className="text-[10px] text-slate-400">
                {salesData.cancelledCount} cancelled
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 block uppercase">
                Total Units Sold
              </span>
              <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
                {salesData.totalUnitsSold}
              </span>
              <span className="text-[10px] text-slate-400">across all lines</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 block uppercase">
                Taxable Value
              </span>
              <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
                ₹{(salesData.taxablePaise / 100).toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400">before taxes</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 block uppercase">
                GST Collected
              </span>
              <span className="text-2xl font-bold font-mono text-emerald-700 mt-1 block">
                ₹
                {(
                  (salesData.cgstPaise +
                    salesData.sgstPaise +
                    salesData.igstPaise) /
                  100
                ).toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400">
                CGST + SGST + IGST
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm bg-gradient-to-br from-white to-emerald-50/50">
              <span className="text-[11px] font-bold text-emerald-800 block uppercase">
                Net Sales Total
              </span>
              <span className="text-2xl font-extrabold font-mono text-emerald-900 mt-1 block">
                ₹{(salesData.netSalesPaise / 100).toFixed(2)}
              </span>
              <span className="text-[10px] text-emerald-700">
                Inclusive of round-off
              </span>
            </div>
          </div>

          {/* Payment tender breakdown & Tax summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tender Breakdown */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-800">
                Collections by Payment Mode
              </h3>
              {salesData.paymentsByMode.length === 0 ? (
                <p className="text-xs text-slate-400 py-4">
                  No payment records for this date.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {salesData.paymentsByMode.map((p) => (
                    <div
                      key={p.mode}
                      className="py-2.5 flex justify-between items-center text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">{p.mode}</span>
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          {p.count} bills
                        </span>
                      </div>
                      <span className="font-mono font-bold text-slate-900">
                        ₹{(p.amountPaise / 100).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* GST Tax Breakdown */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-800">
                GST Tax Slab Collections
              </h3>
              {salesData.taxSummary.length === 0 ? (
                <p className="text-xs text-slate-400 py-4">
                  No tax transactions recorded for this date.
                </p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 font-bold border-b border-slate-200 text-left">
                      <th className="pb-2">Rate</th>
                      <th className="pb-2 text-right">Taxable (₹)</th>
                      <th className="pb-2 text-right">Tax (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {salesData.taxSummary.map((t) => (
                      <tr key={t.gstRateBp} className="py-2">
                        <td className="py-2 font-semibold text-slate-800">
                          GST {(t.gstRateBp / 100).toFixed(0)}%
                        </td>
                        <td className="py-2 text-right font-mono text-slate-700">
                          ₹{(t.taxablePaise / 100).toFixed(2)}
                        </td>
                        <td className="py-2 text-right font-mono font-bold text-slate-900">
                          ₹{(t.taxPaise / 100).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Top Selling Products */}
          {salesData.topProducts.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50">
                <h3 className="text-sm font-bold text-slate-800">
                  Top Selling Products Today
                </h3>
              </div>
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-8 text-center">#</th>
                    <th className="p-3">Product Name</th>
                    <th className="p-3 text-center">Code</th>
                    <th className="p-3 text-right">Quantity Sold</th>
                    <th className="p-3 text-right">Revenue (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {salesData.topProducts.map((p, idx) => (
                    <tr key={p.productId} className="hover:bg-slate-50">
                      <td className="p-3 text-center text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-semibold text-slate-900">{p.name}</td>
                      <td className="p-3 text-center font-mono text-slate-600">
                        {p.shortCode}
                      </td>
                      <td className="p-3 text-right font-bold text-slate-900">
                        {p.qty}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        ₹{(p.totalPaise / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Invoices List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800">
                Invoices Ledger ({salesData.invoices.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Invoice #</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Channel</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Amount (₹)</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {salesData.invoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">
                        No invoices found for this date.
                      </td>
                    </tr>
                  ) : (
                    salesData.invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold">
                          <Link
                            href={`/shop/invoices/${inv.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {inv.number}
                          </Link>
                        </td>
                        <td className="p-3 font-medium text-slate-800">
                          {inv.customerName}
                        </td>
                        <td className="p-3 text-slate-600">{inv.channel}</td>
                        <td className="p-3 text-center">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              inv.status === "FINAL"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">
                          ₹{(inv.totalPaise / 100).toFixed(2)}
                        </td>
                        <td className="p-3 text-center">
                          <Link
                            href={`/shop/invoices/${inv.id}/print?format=thermal`}
                            target="_blank"
                            className="text-xs font-semibold text-emerald-700 hover:underline mr-3"
                          >
                            Receipt
                          </Link>
                          <Link
                            href={`/shop/invoices/${inv.id}/print?format=a4`}
                            target="_blank"
                            className="text-xs font-semibold text-blue-700 hover:underline"
                          >
                            A4
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DAY-END CASH REGISTER */}
      {tab === "cash" && (
        <div className="space-y-6">
          {/* Top Cash KPI Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Total System Recorded Cash
              </span>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="text-3xl font-extrabold font-mono text-emerald-800">
                  ₹{(cashData.totalCashPaise / 100).toFixed(2)}
                </span>
                <span className="text-xs text-slate-500">
                  across {cashData.transactionsCount} cash sales
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Live Cash Drawer Denomination Calculator */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Physical Cash Denomination Counter
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter physical note counts to verify cash in drawer against system sales.
                </p>
              </div>

              <div className="space-y-2.5">
                {[500, 200, 100, 50, 20, 10].map((note) => {
                  const count = denominations[note] || 0;
                  const lineTotal = note * count;
                  return (
                    <div
                      key={note}
                      className="flex items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs"
                    >
                      <span className="font-bold text-slate-800 w-16">
                        ₹{note} x
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={count || ""}
                        placeholder="0"
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          setDenominations((prev) => ({ ...prev, [note]: val }));
                        }}
                        className="w-24 text-right font-mono font-bold p-1.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <span className="font-mono font-bold text-slate-900 w-24 text-right">
                        = ₹{lineTotal.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Reconciliation Comparison Card */}
              <div className="border-t border-slate-200 pt-4 mt-2 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600 font-semibold">
                    Physical Count Total:
                  </span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    ₹{(countedCashPaise / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600 font-semibold">
                    Expected System Total:
                  </span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    ₹{(cashData.totalCashPaise / 100).toFixed(2)}
                  </span>
                </div>

                <div
                  className={`p-3 rounded-xl border text-xs font-bold flex justify-between items-center ${
                    cashVariancePaise === 0
                      ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                      : cashVariancePaise > 0
                      ? "bg-amber-50 border-amber-300 text-amber-800"
                      : "bg-red-50 border-red-300 text-red-800"
                  }`}
                >
                  <span>Drawer Variance:</span>
                  <span className="font-mono text-sm">
                    {cashVariancePaise === 0
                      ? "Balanced (₹0.00)"
                      : cashVariancePaise > 0
                      ? `+₹${(cashVariancePaise / 100).toFixed(2)} (Excess)`
                      : `-₹${(Math.abs(cashVariancePaise) / 100).toFixed(2)} (Shortage)`}
                  </span>
                </div>
              </div>
            </div>

            {/* Cash Transactions List */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50">
                <h3 className="text-sm font-bold text-slate-800">
                  Cash Collections Ledger ({cashData.transactions.length})
                </h3>
              </div>
              <div className="overflow-y-auto max-h-[460px] divide-y divide-slate-100 flex-1">
                {cashData.transactions.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-400">
                    No cash sales on this date.
                  </p>
                ) : (
                  cashData.transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-3.5 flex justify-between items-center text-xs hover:bg-slate-50 transition"
                    >
                      <div>
                        <span className="font-bold font-mono text-slate-900 block">
                          {tx.invoiceNumber}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {formatISTDateTime(tx.createdAt)} • {tx.cashierName}
                        </span>
                      </div>
                      <span className="font-bold font-mono text-emerald-800 text-sm">
                        ₹{(tx.amountPaise / 100).toFixed(2)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: STOCK VALUATION */}
      {tab === "stock" && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 block uppercase">
                Active Catalog Items
              </span>
              <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
                {stockData.totalProducts}
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 block uppercase">
                Total Pieces in Stock
              </span>
              <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
                {stockData.totalUnits.toLocaleString("en-IN")}
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 block uppercase">
                Total Cartons
              </span>
              <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
                {stockData.totalCartons.toLocaleString("en-IN")}
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm bg-gradient-to-br from-white to-blue-50/50">
              <span className="text-[11px] font-bold text-blue-800 block uppercase">
                Total Stock Valuation
              </span>
              <span className="text-2xl font-extrabold font-mono text-blue-900 mt-1 block">
                ₹{(stockData.totalValuationPaise / 100).toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[240px]">
              <input
                type="text"
                placeholder="Search inventory by product name or short code..."
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
                className="w-full text-xs px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <select
              value={stockCompanyFilter}
              onChange={(e) => setStockCompanyFilter(e.target.value)}
              className="text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700"
            >
              <option value="ALL">All Companies / Brands</option>
              {uniqueCompanies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Product Name</th>
                    <th className="p-3">Company</th>
                    <th className="p-3 text-center">Pack</th>
                    {stockData.locationsList.map((loc) => (
                      <th key={loc.id} className="p-3 text-right">
                        {loc.name}
                      </th>
                    ))}
                    <th className="p-3 text-right">Total Pcs</th>
                    <th className="p-3 text-right">Carton Conv.</th>
                    <th className="p-3 text-right">Valuation (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStockItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6 + stockData.locationsList.length}
                        className="p-6 text-center text-slate-400"
                      >
                        No products match the filter.
                      </td>
                    </tr>
                  ) : (
                    filteredStockItems.map((item) => (
                      <tr key={item.productId} className="hover:bg-slate-50">
                        <td className="p-3">
                          <Link
                            href={`/godown/stock/${item.productId}`}
                            className="font-bold text-slate-900 hover:text-blue-600 block"
                          >
                            {item.name}
                          </Link>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {item.shortCode}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600 font-medium">
                          {item.companyName}
                        </td>
                        <td className="p-3 text-center text-slate-600">
                          {item.packSize} / {item.packLabel}
                        </td>
                        {stockData.locationsList.map((loc) => (
                          <td
                            key={loc.id}
                            className="p-3 text-right font-mono text-slate-700"
                          >
                            {item.locations[loc.id] || 0}
                          </td>
                        ))}
                        <td className="p-3 text-right font-bold font-mono text-slate-900">
                          {item.totalQty}
                        </td>
                        <td className="p-3 text-right text-slate-600">
                          {item.cartonCount} ctn + {item.looseCount} pcs
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">
                          ₹{(item.valuationPaise / 100).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: LOW STOCK ALERTS */}
      {tab === "lowstock" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-red-50 border border-red-200 p-5 rounded-2xl">
              <span className="text-xs font-bold text-red-700 uppercase tracking-wider block">
                Products at or below reorder level
              </span>
              <span className="text-3xl font-extrabold text-red-900 mt-1 block">
                {lowStockData.totalLowStockCount}
              </span>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl">
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block">
                Total Deficit Units to Refill
              </span>
              <span className="text-3xl font-extrabold text-amber-900 mt-1 block">
                {lowStockData.totalDeficitUnits.toLocaleString("en-IN")} pcs
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800">
                Low Stock Inventory Items
              </h3>
              <Link
                href="/godown/purchases/new"
                className="text-xs font-bold text-emerald-700 hover:underline"
              >
                + New Purchase GRN
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Product Name</th>
                    <th className="p-3">Company</th>
                    <th className="p-3 text-center">Code</th>
                    <th className="p-3 text-right">Current Stock</th>
                    <th className="p-3 text-right">Reorder Level</th>
                    <th className="p-3 text-right text-red-700">Deficit</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lowStockData.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-emerald-700">
                        All products are currently above their minimum reorder thresholds!
                      </td>
                    </tr>
                  ) : (
                    lowStockData.items.map((item) => (
                      <tr key={item.productId} className="hover:bg-slate-50">
                        <td className="p-3 font-semibold text-slate-900">
                          {item.name}
                        </td>
                        <td className="p-3 text-slate-600">{item.companyName}</td>
                        <td className="p-3 text-center font-mono text-slate-500">
                          {item.shortCode}
                        </td>
                        <td className="p-3 text-right font-bold text-slate-900 font-mono">
                          {item.currentStock}
                        </td>
                        <td className="p-3 text-right text-slate-600 font-mono">
                          {item.reorderLevel}
                        </td>
                        <td className="p-3 text-right font-extrabold text-red-600 font-mono">
                          -{item.deficit} pcs
                        </td>
                        <td className="p-3 text-center">
                          <Link
                            href="/godown/purchases/new"
                            className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2.5 py-1 rounded-lg font-bold text-[11px] transition"
                          >
                            Order Stock
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: RECEIVABLES & AGEING REPORT */}
      {tab === "ageing" && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 block uppercase">
                Total Receivables
              </span>
              <span className="text-xl font-mono font-black text-slate-900 block mt-1">
                ₹{(ageingData.summary.totalReceivablesPaise / 100).toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Across {ageingData.summary.partiesWithOutstanding} debtor accounts
              </span>
            </div>

            <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 shadow-sm">
              <span className="text-[11px] font-bold text-emerald-800 block uppercase">
                0–15 Days (Current)
              </span>
              <span className="text-xl font-mono font-bold text-emerald-700 block mt-1">
                ₹{(ageingData.summary.totalBucket0_15Paise / 100).toFixed(2)}
              </span>
              <span className="text-[10px] text-emerald-600 mt-1 block">
                Standard payment cycle
              </span>
            </div>

            <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200 shadow-sm">
              <span className="text-[11px] font-bold text-amber-800 block uppercase">
                16–30 Days (Due)
              </span>
              <span className="text-xl font-mono font-bold text-amber-700 block mt-1">
                ₹{(ageingData.summary.totalBucket16_30Paise / 100).toFixed(2)}
              </span>
              <span className="text-[10px] text-amber-600 mt-1 block">
                Follow-up suggested
              </span>
            </div>

            <div className="bg-orange-50/60 p-4 rounded-xl border border-orange-200 shadow-sm">
              <span className="text-[11px] font-bold text-orange-800 block uppercase">
                31–60 Days (Overdue)
              </span>
              <span className="text-xl font-mono font-bold text-orange-700 block mt-1">
                ₹{(ageingData.summary.totalBucket31_60Paise / 100).toFixed(2)}
              </span>
              <span className="text-[10px] text-orange-600 mt-1 block">
                Credit pause advised
              </span>
            </div>

            <div className="bg-rose-50/60 p-4 rounded-xl border border-rose-200 shadow-sm">
              <span className="text-[11px] font-bold text-rose-800 block uppercase">
                60+ Days (Critical)
              </span>
              <span className="text-xl font-mono font-bold text-rose-700 block mt-1">
                ₹{(ageingData.summary.totalBucket60PlusPaise / 100).toFixed(2)}
              </span>
              <span className="text-[10px] text-rose-600 mt-1 block">
                Action required
              </span>
            </div>

            <div className="bg-purple-50/60 p-4 rounded-xl border border-purple-200 shadow-sm">
              <span className="text-[11px] font-bold text-purple-800 block uppercase">
                Over-Limit Breaches
              </span>
              <span className="text-xl font-mono font-bold text-purple-700 block mt-1">
                {ageingData.summary.overLimitCount} Parties
              </span>
              <span className="text-[10px] text-purple-600 mt-1 block">
                +₹{(ageingData.summary.overLimitTotalPaise / 100).toFixed(2)} over limit
              </span>
            </div>
          </div>

          {/* Filters & Export Strip */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search party by name or phone..."
                  value={ageingSearch}
                  onChange={(e) => setAgeingSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg w-64 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <select
                value={ageingTypeFilter}
                onChange={(e) => setAgeingTypeFilter(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
              >
                <option value="ALL">All Party Types</option>
                <option value="RETAILER">Retailers</option>
                <option value="WHOLESALER">Wholesalers</option>
                <option value="CUSTOMER">General Customers</option>
                <option value="SUPPLIER">Suppliers</option>
              </select>

              <button
                type="button"
                onClick={() => setAgeingOverdueOnly((prev) => !prev)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition ${
                  ageingOverdueOnly
                    ? "bg-amber-100 border-amber-300 text-amber-800"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                ⚠️ Overdue Only ({ageingData.summary.overdueCount})
              </button>

              <button
                type="button"
                onClick={() => setAgeingOverLimitOnly((prev) => !prev)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition ${
                  ageingOverLimitOnly
                    ? "bg-purple-100 border-purple-300 text-purple-800"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                🚫 Over Limit Only ({ageingData.summary.overLimitCount})
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 font-medium">
                Showing {filteredAgeingRows.length} of {ageingData.rows.length} parties
              </span>

              <button
                type="button"
                onClick={handleExportAgeingCSV}
                className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>
          </div>

          {/* Ageing Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="p-3">Party Name</th>
                    <th className="p-3">Credit Terms</th>
                    <th className="p-3 text-right">Total Outstanding</th>
                    <th className="p-3 text-right">0–15 Days</th>
                    <th className="p-3 text-right">16–30 Days</th>
                    <th className="p-3 text-right">31–60 Days</th>
                    <th className="p-3 text-right">60+ Days</th>
                    <th className="p-3">Oldest Age / Risk</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAgeingRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        No debtor accounts found matching your selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredAgeingRows.map((row) => (
                      <tr key={row.partyId} className="hover:bg-slate-50/80 transition">
                        <td className="p-3 font-semibold text-slate-900">
                          <div>{row.name}</div>
                          <div className="text-[11px] font-normal text-slate-400 flex items-center gap-2 mt-0.5">
                            {row.phone && <span>📞 {row.phone}</span>}
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">
                              {row.type}
                            </span>
                          </div>
                        </td>

                        <td className="p-3 text-slate-600">
                          {row.creditEnabled ? (
                            <div>
                              <span className="font-mono font-medium text-slate-800">
                                Limit: ₹{(row.creditLimitPaise / 100).toFixed(0)}
                              </span>
                              <div className="text-[10px] text-slate-400">
                                {row.creditDays > 0 ? `${row.creditDays} days term` : "Immediate due"}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              Cash Only
                            </span>
                          )}
                        </td>

                        <td className="p-3 text-right font-bold font-mono text-slate-900 text-sm">
                          {row.totalOutstandingPaise > 0 ? (
                            `₹${(row.totalOutstandingPaise / 100).toFixed(2)}`
                          ) : row.advancePaise > 0 ? (
                            <span className="text-purple-600 text-xs">
                              (Advance ₹{(row.advancePaise / 100).toFixed(2)})
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal text-xs">₹0.00</span>
                          )}
                        </td>

                        <td className="p-3 text-right font-mono text-slate-700">
                          {row.bucket0_15Paise > 0 ? (
                            `₹${(row.bucket0_15Paise / 100).toFixed(2)}`
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        <td className="p-3 text-right font-mono text-amber-700 font-medium">
                          {row.bucket16_30Paise > 0 ? (
                            `₹${(row.bucket16_30Paise / 100).toFixed(2)}`
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        <td className="p-3 text-right font-mono text-orange-700 font-medium">
                          {row.bucket31_60Paise > 0 ? (
                            `₹${(row.bucket31_60Paise / 100).toFixed(2)}`
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        <td className="p-3 text-right font-mono font-bold text-rose-700">
                          {row.bucket60PlusPaise > 0 ? (
                            `₹${(row.bucket60PlusPaise / 100).toFixed(2)}`
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        <td className="p-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {row.isOverLimit && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                Over Limit (+₹{(row.limitExceededByPaise / 100).toFixed(0)})
                              </span>
                            )}
                            {row.isOverdue && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                Overdue ({row.overdueDays}d)
                              </span>
                            )}
                            {!row.isOverLimit && !row.isOverdue && row.totalOutstandingPaise > 0 && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Current ({row.maxAgeDays}d old)
                              </span>
                            )}
                            {row.totalOutstandingPaise <= 0 && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
                                {row.advancePaise > 0 ? "Advance" : "Settled"}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="p-3 text-center">
                          <Link
                            href={`/admin/parties/${row.partyId}/ledger`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition"
                          >
                            <span>Ledger</span>
                            <ArrowUpRight className="w-3 h-3 text-slate-400" />
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: GSTR-1 OUTWARD SUPPLIES */}
      {tab === "gst" && (
        <div className="space-y-6">
          {/* Header & Export Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900">GSTR-1 Outward Supplies Report</h2>
                <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold uppercase">
                  GST Filing
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Table 4A (B2B registered supplies), Table 7 (B2CS consumer walk-in sales), and Table 12 (HSN summary) for period {gstr1Data.periodMonth}.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const headers = ["Invoice No", "Date", "Party Name", "GSTIN", "POS", "Taxable Value (Rs)", "CGST (Rs)", "SGST (Rs)", "Total Value (Rs)"];
                  const rows = gstr1Data.b2bInvoices.map((inv) => [
                    inv.invoiceNumber,
                    inv.invoiceDate,
                    `"${inv.partyName}"`,
                    inv.partyGstin,
                    inv.placeOfSupply,
                    (inv.taxablePaise / 100).toFixed(2),
                    (inv.cgstPaise / 100).toFixed(2),
                    (inv.sgstPaise / 100).toFixed(2),
                    (inv.invoiceValuePaise / 100).toFixed(2),
                  ]);
                  const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
                  const link = document.createElement("a");
                  link.setAttribute("href", encodeURI(csv));
                  link.setAttribute("download", `gstr1_b2b_${gstr1Data.periodMonth}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export B2B CSV</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const headers = ["HSN Code", "Description", "UQC", "Total Qty", "Taxable Value (Rs)", "Rate (%)", "CGST (Rs)", "SGST (Rs)", "Total Tax (Rs)"];
                  const rows = gstr1Data.hsnSummary.map((h) => [
                    h.hsn,
                    `"${h.description || ''}"`,
                    h.uqc,
                    h.totalQty,
                    (h.totalTaxablePaise / 100).toFixed(2),
                    (h.gstRateBp / 100).toFixed(1),
                    (h.cgstPaise / 100).toFixed(2),
                    (h.sgstPaise / 100).toFixed(2),
                    (h.totalTaxPaise / 100).toFixed(2),
                  ]);
                  const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
                  const link = document.createElement("a");
                  link.setAttribute("href", encodeURI(csv));
                  link.setAttribute("download", `gstr1_hsn_${gstr1Data.periodMonth}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export HSN CSV</span>
              </button>
            </div>
          </div>

          {/* GSTR-1 Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Total Taxable Value</span>
              <div className="text-xl font-black text-slate-900">
                ₹{(gstr1Data.totalTaxablePaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400">{gstr1Data.totalInvoicesCount} invoices in {gstr1Data.periodMonth}</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Central Tax (CGST)</span>
              <div className="text-xl font-black text-emerald-700">
                ₹{(gstr1Data.totalCgstPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400">Bihar Intra-State</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase">State Tax (SGST)</span>
              <div className="text-xl font-black text-teal-700">
                ₹{(gstr1Data.totalSgstPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400">Bihar Intra-State</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Total Invoice Value</span>
              <div className="text-xl font-black text-blue-700">
                ₹{(gstr1Data.totalInvoiceValuePaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400">Total Tax: ₹{(gstr1Data.totalTaxPaise / 100).toFixed(0)}</p>
            </div>
          </div>

          {/* Rate-Wise Distribution */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Tax Rate-Wise Turnover Breakdown</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {gstr1Data.rateBreakdown.map((r) => (
                <div key={r.gstRateBp} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-xs font-bold text-slate-700 block">{(r.gstRateBp / 100).toFixed(0)}% Slab</span>
                  <div className="text-sm font-black text-slate-900">₹{(r.taxablePaise / 100).toFixed(0)}</div>
                  <div className="text-[10px] text-slate-500">Tax: ₹{(r.totalTaxPaise / 100).toFixed(0)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Table 4A: B2B Invoices */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-3 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Table 4A: B2B Invoices (Registered Parties)</h3>
                <p className="text-xs text-slate-500">Supplies made to buyers holding verified GSTIN</p>
              </div>
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                {gstr1Data.b2bInvoices.length} Bills
              </span>
            </div>

            {gstr1Data.b2bInvoices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-y border-slate-200 text-slate-700 font-bold">
                      <th className="p-2.5">Invoice #</th>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Party Name</th>
                      <th className="p-2.5">GSTIN</th>
                      <th className="p-2.5">POS</th>
                      <th className="p-2.5 text-right">Taxable (₹)</th>
                      <th className="p-2.5 text-right">CGST (₹)</th>
                      <th className="p-2.5 text-right">SGST (₹)</th>
                      <th className="p-2.5 text-right">Invoice Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {gstr1Data.b2bInvoices.map((inv) => (
                      <tr key={inv.invoiceNumber} className="hover:bg-slate-50/80">
                        <td className="p-2.5 font-mono font-bold text-blue-600">{inv.invoiceNumber}</td>
                        <td className="p-2.5 text-slate-600">{inv.invoiceDate}</td>
                        <td className="p-2.5 font-bold text-slate-900">{inv.partyName}</td>
                        <td className="p-2.5 font-mono text-[11px] text-slate-700">{inv.partyGstin}</td>
                        <td className="p-2.5 text-slate-600">{inv.placeOfSupply}</td>
                        <td className="p-2.5 text-right font-mono">₹{(inv.taxablePaise / 100).toFixed(2)}</td>
                        <td className="p-2.5 text-right font-mono text-emerald-700">₹{(inv.cgstPaise / 100).toFixed(2)}</td>
                        <td className="p-2.5 text-right font-mono text-teal-700">₹{(inv.sgstPaise / 100).toFixed(2)}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900">₹{(inv.invoiceValuePaise / 100).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No B2B invoices recorded in this period. Unregistered sales are grouped in Table 7 (B2CS).
              </div>
            )}
          </div>

          {/* Table 12: HSN Summary */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-3 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Table 12: HSN-Wise Summary of Outward Supplies</h3>
                <p className="text-xs text-slate-500">Summary across 4-8 digit HSN codes</p>
              </div>
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                {gstr1Data.hsnSummary.length} HSN Codes
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200 text-slate-700 font-bold">
                    <th className="p-2.5">HSN Code</th>
                    <th className="p-2.5">Product Description</th>
                    <th className="p-2.5">UQC</th>
                    <th className="p-2.5 text-right">Qty</th>
                    <th className="p-2.5 text-right">Taxable Value (₹)</th>
                    <th className="p-2.5 text-right">Rate</th>
                    <th className="p-2.5 text-right">CGST (₹)</th>
                    <th className="p-2.5 text-right">SGST (₹)</th>
                    <th className="p-2.5 text-right">Total Tax (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {gstr1Data.hsnSummary.map((h) => (
                    <tr key={`${h.hsn}_${h.gstRateBp}`} className="hover:bg-slate-50/80">
                      <td className="p-2.5 font-mono font-bold text-purple-700">{h.hsn}</td>
                      <td className="p-2.5 text-slate-900">{h.description}</td>
                      <td className="p-2.5 text-slate-600">{h.uqc}</td>
                      <td className="p-2.5 text-right font-bold">{h.totalQty}</td>
                      <td className="p-2.5 text-right font-mono">₹{(h.totalTaxablePaise / 100).toFixed(2)}</td>
                      <td className="p-2.5 text-right font-semibold">{(h.gstRateBp / 100).toFixed(0)}%</td>
                      <td className="p-2.5 text-right font-mono text-emerald-700">₹{(h.cgstPaise / 100).toFixed(2)}</td>
                      <td className="p-2.5 text-right font-mono text-teal-700">₹{(h.sgstPaise / 100).toFixed(2)}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900">₹{(h.totalTaxPaise / 100).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: DAY BOOK (DAILY FINANCIAL REGISTER) */}
      {tab === "daybook" && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900">Day Book Register</h2>
                <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold uppercase">
                  Daily Accounting
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Chronological ledger of all financial vouchers for {dayBookData.date}: Sales, Purchases, Receipts, and Debit Notes.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-300">
                <span className="text-xs font-semibold text-slate-700 pl-2">Date:</span>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  const headers = ["Voucher No", "Type", "Time", "Party Name", "Particulars", "Debit (Rs)", "Credit (Rs)"];
                  const rows = dayBookData.entries.map((e) => [
                    e.voucherNo,
                    e.voucherType,
                    new Date(e.date).toLocaleTimeString("en-IN"),
                    `"${e.partyName}"`,
                    `"${e.particulars}"`,
                    (e.debitPaise / 100).toFixed(2),
                    (e.creditPaise / 100).toFixed(2),
                  ]);
                  const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
                  const link = document.createElement("a");
                  link.setAttribute("href", encodeURI(csv));
                  link.setAttribute("download", `day_book_${dayBookData.date}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Day Book CSV</span>
              </button>
            </div>
          </div>

          {/* Totals Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Total Debit Inflow</span>
              <div className="text-xl font-black text-emerald-700">
                ₹{(dayBookData.totalDebitPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400">Sales & Cash/UPI Collections</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Total Credit Outflow</span>
              <div className="text-xl font-black text-rose-700">
                ₹{(dayBookData.totalCreditPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400">Supplier Purchases & Outflows</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Total Vouchers Logged</span>
              <div className="text-xl font-black text-slate-900">{dayBookData.entriesCount}</div>
              <p className="text-[11px] text-slate-400">Transactions on {dayBookData.date}</p>
            </div>
          </div>

          {/* Vouchers Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Voucher Journal ({dayBookData.entriesCount} Entries)</h3>
              <span className="text-xs text-slate-500">Sorted chronologically</span>
            </div>

            {dayBookData.entries.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                      <th className="p-3">Time</th>
                      <th className="p-3">Voucher #</th>
                      <th className="p-3">Voucher Type</th>
                      <th className="p-3">Party Name</th>
                      <th className="p-3">Particulars / Narration</th>
                      <th className="p-3 text-right">Debit (₹)</th>
                      <th className="p-3 text-right">Credit (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {dayBookData.entries.map((e) => {
                      const typeBadge =
                        e.voucherType === "SALES"
                          ? "bg-emerald-100 text-emerald-800"
                          : e.voucherType === "PURCHASE"
                          ? "bg-rose-100 text-rose-800"
                          : e.voucherType === "RECEIPT"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-purple-100 text-purple-800";
                      return (
                        <tr key={e.id} className="hover:bg-slate-50/80">
                          <td className="p-3 text-slate-500 whitespace-nowrap">
                            {new Date(e.date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-900">{e.voucherNo}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${typeBadge}`}>
                              {e.voucherType}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-slate-900">{e.partyName}</td>
                          <td className="p-3 text-slate-600">{e.particulars}</td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-700">
                            {e.debitPaise > 0 ? `₹${(e.debitPaise / 100).toFixed(2)}` : "-"}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-rose-700">
                            {e.creditPaise > 0 ? `₹${(e.creditPaise / 100).toFixed(2)}` : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                No financial transactions recorded on {dayBookData.date}.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 8: TALLY XML & CSV EXPORT */}
      {tab === "tally" && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900">Tally XML & CSV Voucher Export</h2>
                <span className="text-[10px] px-2 py-0.5 bg-orange-100 text-orange-800 rounded font-bold uppercase">
                  TallyPrime / ERP 9
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Export finalized sales vouchers with full GST breakdown, inventory allocations, and collection receipts into standard Tally format.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-700 font-semibold rounded-lg">
                Format: {tallyFormat}
              </span>
            </div>
          </div>

          {/* Export Configuration Form */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
              Configure Export Parameters
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Export Format */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Export Format
                </label>
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTallyFormat("XML")}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl border transition ${
                      tallyFormat === "XML"
                        ? "bg-blue-600 border-blue-600 text-white shadow-xs"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Tally XML (Prime/ERP)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTallyFormat("CSV")}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl border transition ${
                      tallyFormat === "CSV"
                        ? "bg-blue-600 border-blue-600 text-white shadow-xs"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Universal CSV
                  </button>
                </div>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Start Date
                </label>
                <input
                  type="date"
                  value={tallyStartDate}
                  onChange={(e) => setTallyStartDate(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  End Date
                </label>
                <input
                  type="date"
                  value={tallyEndDate}
                  onChange={(e) => setTallyEndDate(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Voucher Types */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Vouchers Included
                </label>
                <select
                  value={tallyVoucherType}
                  onChange={(e) => setTallyVoucherType(e.target.value as "ALL" | "SALES" | "RECEIPT")}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">All (Sales + Receipts)</option>
                  <option value="SALES">Sales Invoices Only</option>
                  <option value="RECEIPT">Payment Receipts Only</option>
                </select>
              </div>
            </div>

            {tallyExportError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-semibold">
                {tallyExportError}
              </div>
            )}

            {tallyExportSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold">
                {tallyExportSuccess}
              </div>
            )}

            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Generated file can be directly imported into Tally via: <span className="font-mono font-bold text-slate-700">Import Data &gt; Vouchers</span>.
              </p>

              <button
                type="button"
                disabled={tallyExporting}
                onClick={async () => {
                  setTallyExporting(true);
                  setTallyExportError("");
                  setTallyExportSuccess(null);

                  try {
                    const voucherTypes = tallyVoucherType === "ALL" ? ["SALES" as const, "RECEIPT" as const] : [tallyVoucherType as "SALES" | "RECEIPT"];
                    const res = await exportTallyVouchersAction({
                      format: tallyFormat,
                      startDate: tallyStartDate,
                      endDate: tallyEndDate,
                      voucherTypes,
                    });

                    if (!res.success || !res.result) {
                      setTallyExportError(res.error || "Failed to generate export");
                      return;
                    }

                    const blob = new Blob([res.result.content], { type: res.result.mimeType });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = res.result.filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);

                    setTallyExportSuccess(
                      `Successfully exported ${res.result.summary.salesCount} sales invoices and ${res.result.summary.receiptsCount} receipts!`
                    );
                  } catch (err) {
                    setTallyExportError(err instanceof Error ? err.message : "Export failed");
                  } finally {
                    setTallyExporting(false);
                  }
                }}
                className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-2 disabled:opacity-50"
              >
                {tallyExporting ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>Generating Tally Payload...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download Tally {tallyFormat} File</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Import Instruction Card */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-3">
            <h4 className="font-bold text-sm text-slate-900">How to Import into TallyPrime / Tally ERP 9:</h4>
            <ol className="list-decimal pl-5 space-y-1.5 leading-relaxed text-slate-600">
              <li>Open your company in <strong>TallyPrime</strong> or <strong>Tally ERP 9</strong>.</li>
              <li>Ensure stock item masters and party debtor ledgers exist (or use <Link href="/admin/parties/import" className="text-blue-600 font-bold hover:underline">Party Import</Link>).</li>
              <li>Press <strong>Alt + O</strong> (Import) &gt; select <strong>Transactions</strong> (Vouchers).</li>
              <li>Enter the full path of the downloaded XML file (e.g. <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-300">C:\Users\admin\Downloads\tally_vouchers_*.xml</code>).</li>
              <li>Press Enter to import. Check <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-300">Tally.imp</code> log file in your Tally installation directory for verification.</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
