"use client";

import React, { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import {
  ItemStockStatementReport,
  ItemStockStatementRow,
  ItemStockStatementFilters,
} from "@/modules/reports/item-stock-statement.service";
import { formatDmy, toIstDateString } from "@/lib/datetime";
import {
  Package,
  Calendar,
  Search,
  Download,
  Filter,
  ArrowUpDown,
  TrendingDown,
  TrendingUp,
  Boxes,
  Truck,
  Store,
  ArrowLeft,
} from "lucide-react";

interface ItemStatementClientProps {
  initialReport: ItemStockStatementReport;
  companies: { id: string; name: string }[];
  categories: { id: string; name: string }[];
}

export function ItemStatementClient({
  initialReport,
  companies,
  categories,
}: ItemStatementClientProps) {
  const [report, setReport] = useState<ItemStockStatementReport>(initialReport);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toIstDateString(d);
  });
  const [endDate, setEndDate] = useState(() => toIstDateString(new Date()));

  const [companyId, setCompanyId] = useState<string>("ALL");
  const [categoryId, setCategoryId] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [onlyWithMovement, setOnlyWithMovement] = useState(false);
  const [displayUnit, setDisplayUnit] = useState<"PCS" | "CARTONS">("PCS");
  const [selectedWeightChip, setSelectedWeightChip] = useState<string>("ALL");

  const [isPending, startTransition] = useTransition();

  // Local filtering across the fetched dataset
  const filteredRows = useMemo(() => {
    return report.rows.filter((row) => {
      if (companyId !== "ALL" && row.companyName !== companyId) return false;
      if (categoryId !== "ALL" && row.categoryName !== categoryId) return false;
      if (onlyWithMovement && row.totalSoldQty === 0 && row.purchasedQty === 0 && row.transfersInQty === 0) {
        return false;
      }

      if (selectedWeightChip !== "ALL") {
        if (selectedWeightChip === "50g" && !row.weightDisplay.includes("50")) return false;
        if (selectedWeightChip === "100g" && !row.weightDisplay.includes("100")) return false;
        if (selectedWeightChip === "250g" && !row.weightDisplay.includes("250")) return false;
        if (selectedWeightChip === "500g" && !row.weightDisplay.includes("500")) return false;
        if (selectedWeightChip === "1kg" && !row.weightDisplay.toLowerCase().includes("kg") && !row.weightDisplay.includes("1000")) return false;
      }

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const nameMatch = row.productName.toLowerCase().includes(q);
        const codeMatch = row.shortCode.toLowerCase().includes(q);
        const companyMatch = row.companyName.toLowerCase().includes(q);
        if (!nameMatch && !codeMatch && !companyMatch) return false;
      }

      return true;
    });
  }, [report.rows, companyId, categoryId, search, onlyWithMovement, selectedWeightChip]);

  // Aggregate totals of filtered rows
  const totals = useMemo(() => {
    return {
      itemsCount: filteredRows.length,
      opening: filteredRows.reduce((s, r) => s + r.openingQty, 0),
      purchased: filteredRows.reduce((s, r) => s + r.purchasedQty, 0),
      soldShop: filteredRows.reduce((s, r) => s + r.soldShopQty, 0),
      soldVan: filteredRows.reduce((s, r) => s + r.soldVanQty, 0),
      soldOnline: filteredRows.reduce((s, r) => s + r.soldOnlineQty, 0),
      totalSold: filteredRows.reduce((s, r) => s + r.totalSoldQty, 0),
      soldValue: filteredRows.reduce((s, r) => s + r.soldValuePaise, 0),
      closing: filteredRows.reduce((s, r) => s + r.closingQty, 0),
      stockValueMrp: filteredRows.reduce((s, r) => s + r.closingQty * r.mrpPaise, 0),
    };
  }, [filteredRows]);

  // CSV Export
  const handleExportCsv = () => {
    const headers = [
      "Product Name",
      "Short Code",
      "Company",
      "Category",
      "Weight",
      "Pack Size",
      "MRP (Rs)",
      "Opening Qty",
      "Purchased Qty",
      "Sold Shop",
      "Sold Van",
      "Sold Online",
      "Total Sold",
      "Transfers In",
      "Transfers Out",
      "Closing Qty",
      "Godown Stock",
      "Shop Stock",
      "Van Stock",
    ];

    const rows = filteredRows.map((r) => [
      `"${r.productName.replace(/"/g, '""')}"`,
      r.shortCode,
      `"${r.companyName}"`,
      `"${r.categoryName}"`,
      `"${r.weightDisplay}"`,
      r.packSize,
      (r.mrpPaise / 100).toFixed(2),
      r.openingQty,
      r.purchasedQty,
      r.soldShopQty,
      r.soldVanQty,
      r.soldOnlineQty,
      r.totalSoldQty,
      r.transfersInQty,
      r.transfersOutQty,
      r.closingQty,
      r.godownStockQty,
      r.shopStockQty,
      r.vanStockQty,
    ]);

    // Totals row
    rows.push([
      `"TOTAL (${totals.itemsCount} items)"`,
      "",
      "",
      "",
      "",
      "",
      "",
      totals.opening,
      totals.purchased,
      totals.soldShop,
      totals.soldVan,
      totals.soldOnline,
      totals.totalSold,
      "",
      "",
      totals.closing,
      "",
      "",
      "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `item_stock_statement_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 select-none font-sans">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/reports"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            title="Back to Reports Hub"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Boxes className="w-7 h-7 text-blue-600" />
              <span>Item Stock Statement</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Opening, Purchases, Sales (Shop / Van / Online), Transfers, and Closing Stock per item with verified{" "}
              <strong className="text-slate-700">Opening + In − Out = Closing</strong> invariant.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Unit Toggle */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setDisplayUnit("PCS")}
              className={`px-3 py-1 rounded-lg transition ${
                displayUnit === "PCS" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
              }`}
            >
              Pieces
            </button>
            <button
              onClick={() => setDisplayUnit("CARTONS")}
              className={`px-3 py-1 rounded-lg transition ${
                displayUnit === "CARTONS" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
              }`}
            >
              Cartons + Loose
            </button>
          </div>

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Total Opening Stock
          </div>
          <div className="text-xl font-black font-mono text-slate-900 mt-1">
            {totals.opening.toLocaleString()} pcs
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Purchased (In)</span>
          </div>
          <div className="text-xl font-black font-mono text-blue-700 mt-1">
            +{totals.purchased.toLocaleString()} pcs
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
            <TrendingDown className="w-3.5 h-3.5" />
            <span>Total Sold (Out)</span>
          </div>
          <div className="text-xl font-black font-mono text-emerald-800 mt-1">
            -{totals.totalSold.toLocaleString()} pcs
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
            Shop: {totals.soldShop} • Van: {totals.soldVan} • Online: {totals.soldOnline}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">
            Closing Balance
          </div>
          <div className="text-xl font-black font-mono text-purple-900 mt-1">
            {totals.closing.toLocaleString()} pcs
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm col-span-2 sm:col-span-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Stock Value (MRP)
          </div>
          <div className="text-xl font-black font-mono text-slate-900 mt-1">
            ₹{(totals.stockValueMrp / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex-1 min-w-[260px]">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by product name, short code, brand..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 font-semibold"
            >
              <option value="ALL">All Brands / Companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 font-semibold"
            >
              <option value="ALL">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer px-2">
              <input
                type="checkbox"
                checked={onlyWithMovement}
                onChange={(e) => setOnlyWithMovement(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Only with movement</span>
            </label>
          </div>
        </div>

        {/* Weight Quick Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-400 font-bold mr-1">Weight:</span>
          {["ALL", "50g", "100g", "250g", "500g", "1kg"].map((chip) => (
            <button
              key={chip}
              onClick={() => setSelectedWeightChip(chip)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                selectedWeightChip === chip
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {chip === "ALL" ? "All Weights" : chip}
            </button>
          ))}
        </div>
      </div>

      {/* Statement Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">Product Name & SKU</th>
                <th className="p-3">Brand</th>
                <th className="p-3 text-center">Weight</th>
                <th className="p-3 text-right">MRP (₹)</th>
                <th className="p-3 text-right bg-slate-100/60">Opening</th>
                <th className="p-3 text-right bg-blue-50/60 text-blue-900">Purchased</th>
                <th className="p-3 text-right bg-emerald-50/60 text-emerald-900">Sold (Shop)</th>
                <th className="p-3 text-right bg-emerald-50/60 text-emerald-900">Sold (Van)</th>
                <th className="p-3 text-right bg-emerald-50/60 text-emerald-900 font-black">Total Sold</th>
                <th className="p-3 text-right bg-purple-50/80 text-purple-950 font-black">Closing Stock</th>
                <th className="p-3 text-center">Locations (G / S / V)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400">
                    No items match the selected statement filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const closingFormatted =
                    displayUnit === "CARTONS"
                      ? `${r.closingCartons} ctn + ${r.closingLoose} pcs`
                      : `${r.closingQty} pcs`;

                  return (
                    <tr key={r.productId} className="hover:bg-slate-50/80 transition">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{r.productName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {r.shortCode} {r.packSize > 1 && `• ${r.packSize} pcs/${r.packLabel}`}
                        </div>
                      </td>
                      <td className="p-3 font-semibold text-slate-700">{r.companyName}</td>
                      <td className="p-3 text-center font-mono text-slate-600">
                        {r.weightDisplay || "-"}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-800">
                        ₹{(r.mrpPaise / 100).toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-700 bg-slate-50/30">
                        {r.openingQty}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-blue-700 bg-blue-50/30">
                        {r.purchasedQty > 0 ? `+${r.purchasedQty}` : "-"}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-700 bg-emerald-50/30">
                        {r.soldShopQty > 0 ? r.soldShopQty : "-"}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-700 bg-emerald-50/30">
                        {r.soldVanQty > 0 ? r.soldVanQty : "-"}
                      </td>
                      <td className="p-3 text-right font-mono font-black text-emerald-800 bg-emerald-50/40">
                        {r.totalSoldQty > 0 ? `-${r.totalSoldQty}` : "-"}
                      </td>
                      <td className="p-3 text-right font-mono font-black text-purple-950 bg-purple-50/50">
                        {closingFormatted}
                      </td>
                      <td className="p-3 text-center font-mono text-[11px] text-slate-500">
                        <span title="Godown Stock">{r.godownStockQty}</span> /{" "}
                        <span title="Shop Stock" className="text-emerald-700 font-bold">{r.shopStockQty}</span> /{" "}
                        <span title="Van Stock" className="text-blue-700 font-bold">{r.vanStockQty}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredRows.length > 0 && (
              <tfoot className="bg-slate-100 font-black border-t-2 border-slate-300 text-slate-900">
                <tr>
                  <td colSpan={4} className="p-3 uppercase tracking-wider text-xs">
                    Total ({totals.itemsCount} Products)
                  </td>
                  <td className="p-3 text-right font-mono">{totals.opening}</td>
                  <td className="p-3 text-right font-mono text-blue-800">+{totals.purchased}</td>
                  <td className="p-3 text-right font-mono">{totals.soldShop}</td>
                  <td className="p-3 text-right font-mono">{totals.soldVan}</td>
                  <td className="p-3 text-right font-mono text-emerald-800">-{totals.totalSold}</td>
                  <td className="p-3 text-right font-mono text-purple-950">{totals.closing} pcs</td>
                  <td className="p-3 text-center">-</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
