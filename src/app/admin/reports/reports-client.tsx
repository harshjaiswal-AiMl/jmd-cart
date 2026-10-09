"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DailySalesReport,
  DayEndCashReport,
  StockValuationReport,
  LowStockReport,
} from "@/modules/reports/reports.types";
import { formatISTDate, formatISTDateTime } from "@/lib/date";

interface ReportsClientProps {
  initialTab: "sales" | "cash" | "stock" | "lowstock";
  selectedDate: string;
  salesData: DailySalesReport;
  cashData: DayEndCashReport;
  stockData: StockValuationReport;
  lowStockData: LowStockReport;
  locationsList: { id: string; name: string }[];
}

export function ReportsClient({
  initialTab,
  selectedDate,
  salesData,
  cashData,
  stockData,
  lowStockData,
  locationsList,
}: ReportsClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<"sales" | "cash" | "stock" | "lowstock">(
    initialTab
  );
  const [filterDate, setFilterDate] = useState(selectedDate);
  const [stockSearch, setStockSearch] = useState("");
  const [stockCompanyFilter, setStockCompanyFilter] = useState("ALL");

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

  const handleTabSwitch = (newTab: "sales" | "cash" | "stock" | "lowstock") => {
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

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Business Reports & Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time stock valuation, low stock alerts, daily sales receipts, and day-end cash register.
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
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-4 pt-2 gap-2 text-xs font-bold">
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
    </div>
  );
}
