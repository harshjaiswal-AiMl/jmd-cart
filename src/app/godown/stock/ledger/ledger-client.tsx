"use client";

import React, { useState, useEffect, useTransition, useRef } from "react";
import Link from "next/link";
import { formatISTDateTime } from "@/lib/date";
import { ProductLedgerReport, ProductLedgerRow } from "@/modules/stock/stock-ledger.service";
import { getProductLedgerReportAction, searchLedgerProductsAction } from "./actions";
import { MovementType } from "@prisma/client";

interface LocationItem {
  id: string;
  name: string;
  type: string;
}

interface ProductItem {
  id: string;
  name: string;
  shortCode: string;
  packSize: number;
  packLabel: string | null;
  mrpPaise: number | null;
  company?: { name: string } | null;
}

interface LedgerClientProps {
  initialReport: ProductLedgerReport | null;
  locations: LocationItem[];
  initialProducts: ProductItem[];
}

export function LedgerClient({
  initialReport,
  locations,
  initialProducts,
}: LedgerClientProps) {
  const [report, setReport] = useState<ProductLedgerReport | null>(initialReport);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(
    initialReport ? initialReport.product : initialProducts[0] || null
  );

  // Filters state
  const defaultGodownLoc = locations.find((l) => l.type === "GODOWN")?.id || "ALL";
  const [locationId, setLocationId] = useState<string>(
    initialReport ? initialReport.location.id : defaultGodownLoc
  );
  const [datePreset, setDatePreset] = useState<string>("ALL");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [selectedTypes, setSelectedTypes] = useState<MovementType[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState<number>(1);

  // Product autocomplete state
  const [productQuery, setProductQuery] = useState<string>("");
  const [productResults, setProductResults] = useState<ProductItem[]>(initialProducts);
  const [isSearchingProduct, setIsSearchingProduct] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [dropdownIndex, setDropdownIndex] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  // Preset Date range helper
  const computeDateRange = (preset: string) => {
    const now = new Date();
    if (preset === "TODAY") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { start, end };
    } else if (preset === "7D") {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start, end: now };
    } else if (preset === "30D") {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { start, end: now };
    } else if (preset === "FY") {
      // Indian Financial Year: April 1 to March 31
      const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const start = new Date(currentYear, 3, 1, 0, 0, 0);
      const end = new Date(currentYear + 1, 2, 31, 23, 59, 59);
      return { start, end };
    } else if (preset === "CUSTOM") {
      const start = customStartDate ? new Date(`${customStartDate}T00:00:00`) : undefined;
      const end = customEndDate ? new Date(`${customEndDate}T23:59:59`) : undefined;
      return { start, end };
    }
    return { start: undefined, end: undefined };
  };

  // Fetch report
  const loadReport = (targetPage = page) => {
    if (!selectedProduct) return;

    startTransition(async () => {
      try {
        const { start, end } = computeDateRange(datePreset);
        const res = await getProductLedgerReportAction({
          productId: selectedProduct.id,
          locationId: locationId || undefined,
          startDate: start,
          endDate: end,
          types: selectedTypes.length > 0 ? selectedTypes : undefined,
          search: searchQuery || undefined,
          page: targetPage,
          limit: 100,
        });
        setReport(res);
        setPage(targetPage);
      } catch (err: any) {
        console.error("Failed to load product ledger:", err);
      }
    });
  };

  // Refetch when filters or product change
  useEffect(() => {
    if (selectedProduct) {
      loadReport(1);
    }
  }, [selectedProduct, locationId, datePreset, customStartDate, customEndDate, selectedTypes]);

  // Search products debounced
  useEffect(() => {
    const handler = setTimeout(async () => {
      if (!showProductDropdown) return;
      setIsSearchingProduct(true);
      try {
        const res = await searchLedgerProductsAction(productQuery);
        setProductResults(res as ProductItem[]);
        setDropdownIndex(0);
      } catch (err) {
        console.error("Product search failed:", err);
      } finally {
        setIsSearchingProduct(false);
      }
    }, 250);

    return () => clearTimeout(handler);
  }, [productQuery, showProductDropdown]);

  // Product dropdown keyboard navigation
  const handleProductKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showProductDropdown) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setShowProductDropdown(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setDropdownIndex((prev) => (prev + 1) % Math.max(1, productResults.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setDropdownIndex((prev) => (prev - 1 + productResults.length) % Math.max(1, productResults.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (productResults[dropdownIndex]) {
        selectProduct(productResults[dropdownIndex]);
      }
    } else if (e.key === "Escape") {
      setShowProductDropdown(false);
    }
  };

  const selectProduct = (prod: ProductItem) => {
    setSelectedProduct(prod);
    setProductQuery("");
    setShowProductDropdown(false);
  };

  // Toggle movement type filter
  const toggleMovementType = (t: MovementType) => {
    setSelectedTypes((prev) =>
      prev.includes(t) ? prev.filter((item) => item !== t) : [...prev, t]
    );
  };

  // Export to CSV
  const exportToCSV = () => {
    if (!report || report.rows.length === 0) return;

    const headers = [
      "S.N.",
      "Date & Time (IST)",
      "Type",
      "Reference Type",
      "Reference ID",
      "Party / Destination",
      "In Qty (Pcs)",
      "Out Qty (Pcs)",
      "Running Balance (Pcs)",
      "Cartons",
      "Loose",
      "Staff",
      "Reason",
    ];

    const rows = report.rows.map((r, i) => [
      i + 1,
      formatISTDateTime(r.createdAt),
      r.typeLabel,
      r.referenceType || "",
      r.referenceId || "",
      `"${r.partyOrDestination.replace(/"/g, '""')}"`,
      r.inQty,
      r.outQty,
      r.runningBalance,
      r.balanceCartons,
      r.balanceLoose,
      `"${(r.userName || "").replace(/"/g, '""')}"`,
      `"${(r.reason || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Product_Ledger_${report.product.shortCode}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const summary = report?.summary;
  const packSize = report?.product.packSize || selectedProduct?.packSize || 1;
  const packLabel = report?.product.packLabel || selectedProduct?.packLabel || "Carton";

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-slate-900 pb-12 print:bg-white print:p-0">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 shadow-xs sticky top-0 z-20 print:static print:border-none">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/godown/stock"
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition print:hidden"
            >
              ← Stock Overview
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="px-2 py-0.5 rounded text-[11px] font-black tracking-wider uppercase text-white"
                  style={{ backgroundColor: "#790E11" }}
                >
                  Product Ledger
                </span>
                <h1 className="text-xl font-bold text-slate-900">
                  {selectedProduct?.name || "Select a Product"}
                </h1>
                {selectedProduct && (
                  <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-300">
                    {selectedProduct.shortCode}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Full chronological running balance, movement audit trail, In/Out breakdown &amp; live stock reconciliation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-xs transition"
            >
              🖨️ Print A4
            </button>
            <button
              onClick={exportToCSV}
              disabled={!report || report.rows.length === 0}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs transition disabled:opacity-50"
            >
              📊 Export to Excel
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-6 space-y-6">
        {/* Controls Bar: Product Selector, Location Tabs, Date Presets */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5 print:hidden">
          {/* Row 1: Product Search & Location Tabs */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            {/* Product Search Box */}
            <div className="lg:col-span-5 relative">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Select Product (Search Name / Code / Brand)
              </label>
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={selectedProduct ? `${selectedProduct.name} (${selectedProduct.shortCode})` : "Type product name or short code..."}
                  value={productQuery}
                  onChange={(e) => {
                    setProductQuery(e.target.value);
                    setShowProductDropdown(true);
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                  onKeyDown={handleProductKeyDown}
                  className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#790E11] focus:border-transparent transition font-medium"
                />
                <span className="absolute left-3 top-2.5 text-slate-400 text-sm">🔍</span>
                {productQuery && (
                  <button
                    onClick={() => {
                      setProductQuery("");
                      setShowProductDropdown(false);
                    }}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Suggestions Dropdown */}
              {showProductDropdown && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl max-h-72 overflow-y-auto z-30 divide-y divide-slate-100">
                  {isSearchingProduct ? (
                    <div className="p-3 text-center text-xs text-slate-500">Searching products...</div>
                  ) : productResults.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-500">No matching products found</div>
                  ) : (
                    productResults.map((p, idx) => (
                      <div
                        key={p.id}
                        onClick={() => selectProduct(p)}
                        className={`p-3 text-xs cursor-pointer flex items-center justify-between transition ${
                          idx === dropdownIndex ? "bg-amber-50 text-slate-900 font-semibold" : "hover:bg-slate-50"
                        }`}
                      >
                        <div>
                          <div className="font-bold text-slate-900">{p.name}</div>
                          <div className="text-[11px] text-slate-500">
                            {p.company?.name ? `${p.company.name} • ` : ""}1 {p.packLabel || "Carton"} = {p.packSize} Pcs
                          </div>
                        </div>
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                          {p.shortCode}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Location Tabs */}
            <div className="lg:col-span-7">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Location Scoping
              </label>
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  onClick={() => setLocationId("ALL")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    locationId === "ALL"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All Locations (Total Company)
                </button>
                {locations.map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() => setLocationId(loc.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      locationId === loc.id
                        ? "bg-[#790E11] text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {loc.name} ({loc.type})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Date Presets & Search */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100">
            {/* Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-600 mr-1">Date Range:</span>
              {[
                { label: "All Time", val: "ALL" },
                { label: "Today", val: "TODAY" },
                { label: "7 Days", val: "7D" },
                { label: "30 Days", val: "30D" },
                { label: "This FY", val: "FY" },
                { label: "Custom", val: "CUSTOM" },
              ].map((preset) => (
                <button
                  key={preset.val}
                  onClick={() => setDatePreset(preset.val)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition ${
                    datePreset === preset.val
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  }`}
                >
                  {preset.label}
                </button>
              ))}

              {datePreset === "CUSTOM" && (
                <div className="flex items-center gap-2 ml-2">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="text-xs py-1 px-2 border border-slate-300 rounded-lg bg-white"
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="text-xs py-1 px-2 border border-slate-300 rounded-lg bg-white"
                  />
                </div>
              )}
            </div>

            {/* Reference Search */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search ref ID, reason..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") loadReport(1);
                }}
                className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#790E11]"
              />
              <button
                onClick={() => loadReport(1)}
                className="px-3 py-1.5 text-xs font-bold bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition"
              >
                Search
              </button>
            </div>
          </div>

          {/* Row 3: Movement Type Filter Chips */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
              Filter Movement Types:
            </span>
            {[
              { type: MovementType.PURCHASE_RECEIPT, label: "Purchase GRN" },
              { type: MovementType.TRANSFER, label: "Transfer" },
              { type: MovementType.CARTON_BREAK, label: "Carton Break" },
              { type: MovementType.VAN_ISSUE, label: "Van Issue" },
              { type: MovementType.VAN_RETURN, label: "Van Return" },
              { type: MovementType.SALE, label: "Sale / Dispatch" },
              { type: MovementType.RETURN_TO_COMPANY, label: "Return to Co." },
              { type: MovementType.DAMAGE, label: "Damage" },
              { type: MovementType.ADJUSTMENT, label: "Adjustment" },
            ].map(({ type, label }) => {
              const active = selectedTypes.includes(type);
              return (
                <button
                  key={type}
                  onClick={() => toggleMovementType(type)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition ${
                    active
                      ? "bg-[#790E11] text-white border-[#790E11]"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {active ? `✓ ${label}` : label}
                </button>
              );
            })}
            {selectedTypes.length > 0 && (
              <button
                onClick={() => setSelectedTypes([])}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-800 ml-2"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Live Stock Reconciliation Check Banner */}
        {summary && (
          <div
            className={`rounded-2xl p-4 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs ${
              summary.matchesCurrentStock
                ? "bg-emerald-50/70 border-emerald-300 text-emerald-950"
                : "bg-red-50 border-red-300 text-red-950"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {summary.matchesCurrentStock ? "✅" : "⚠️"}
              </span>
              <div>
                <div className="font-extrabold text-sm flex items-center gap-2">
                  <span>
                    {summary.matchesCurrentStock
                      ? "Matches Current Stock"
                      : "Stock Discrepancy Detected"}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                      summary.matchesCurrentStock
                        ? "bg-emerald-200 text-emerald-900"
                        : "bg-red-200 text-red-900"
                    }`}
                  >
                    {summary.matchesCurrentStock ? "AUDIT PASS" : "DIFFERENCE ALERT"}
                  </span>
                </div>
                <p className="text-xs mt-0.5 text-slate-700">
                  {summary.matchesCurrentStock ? (
                    <>
                      Ledger closing balance (<strong>{summary.closingBalance} pcs</strong>) matches live inventory balance in{" "}
                      <strong>{report.location.name}</strong>.
                    </>
                  ) : (
                    <>
                      Ledger closing balance (<strong>{summary.closingBalance} pcs</strong>) differs from live inventory balance (
                      <strong>{summary.currentStock} pcs</strong>) by{" "}
                      <strong className="text-red-700 underline font-black">
                        {summary.difference > 0 ? `+${summary.difference}` : summary.difference} pcs
                      </strong>{" "}
                      ({Math.floor(Math.abs(summary.difference) / packSize)} {packLabel} +{" "}
                      {Math.abs(summary.difference) % packSize} pcs).
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="text-right text-xs font-mono font-bold sm:border-l sm:border-slate-300/60 sm:pl-4">
              <div>Live Stock: <span className="text-slate-900 font-extrabold">{summary.currentStock} pcs</span></div>
              <div className="text-[11px] text-slate-600">
                {summary.currentStockCartons} {packLabel} + {summary.currentStockLoose} loose
              </div>
            </div>
          </div>
        )}

        {/* 4 KPI Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Opening Balance */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Opening Balance
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 font-mono">
                  {summary.openingBalance}
                </span>
                <span className="text-xs text-slate-500 font-medium">pcs</span>
              </div>
              <div className="text-xs font-semibold text-slate-600 mt-1">
                = {summary.openingCartons} {packLabel} + {summary.openingLoose} loose
              </div>
            </div>

            {/* Total In */}
            <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs">
              <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center justify-between">
                <span>Total In (+)</span>
                <span className="text-emerald-600">📥</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-700 font-mono">
                  +{summary.totalIn}
                </span>
                <span className="text-xs text-emerald-600 font-medium">pcs</span>
              </div>
              <div className="text-xs font-semibold text-emerald-800 mt-1">
                = {summary.totalInCartons} {packLabel} + {summary.totalInLoose} loose
              </div>
            </div>

            {/* Total Out */}
            <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-xs">
              <div className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center justify-between">
                <span>Total Out (-)</span>
                <span className="text-rose-600">📤</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-rose-700 font-mono">
                  -{summary.totalOut}
                </span>
                <span className="text-xs text-rose-600 font-medium">pcs</span>
              </div>
              <div className="text-xs font-semibold text-rose-800 mt-1">
                = {summary.totalOutCartons} {packLabel} + {summary.totalOutLoose} loose
              </div>
            </div>

            {/* Closing Balance */}
            <div
              className="p-4 rounded-xl border shadow-xs text-white"
              style={{ backgroundColor: "#790E11" }}
            >
              <div className="text-xs font-bold uppercase tracking-wider text-amber-200">
                Closing Balance
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono text-amber-300">
                  {summary.closingBalance}
                </span>
                <span className="text-xs text-white/80 font-medium">pcs</span>
              </div>
              <div className="text-xs font-semibold text-white/90 mt-1">
                = {summary.closingCartons} {packLabel} + {summary.closingLoose} loose
              </div>
            </div>
          </div>
        )}

        {/* Ledger Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
            <div className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <span>Chronological Movement Ledger</span>
              {report && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-slate-200 text-slate-700 font-medium">
                  {report.totalRows} movement{report.totalRows === 1 ? "" : "s"}
                </span>
              )}
            </div>
            {isPending && (
              <span className="text-xs text-slate-500 font-semibold animate-pulse">
                Updating ledger data...
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 uppercase font-black tracking-wider text-[11px] sticky top-0">
                  <th className="py-3 px-3 text-center w-12">#</th>
                  <th className="py-3 px-3 w-36">Date &amp; Time (IST)</th>
                  <th className="py-3 px-3 w-32">Movement Type</th>
                  <th className="py-3 px-3 w-32">Reference</th>
                  <th className="py-3 px-3">Party / Destination</th>
                  <th className="py-3 px-3 text-right text-emerald-800 w-24">In (+)</th>
                  <th className="py-3 px-3 text-right text-rose-800 w-24">Out (-)</th>
                  <th className="py-3 px-3 text-right w-44">Running Balance</th>
                  <th className="py-3 px-3 w-28">User</th>
                  <th className="py-3 px-3">Reason / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {!report || report.rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-500">
                      <div className="text-3xl mb-2">📜</div>
                      <div className="text-sm font-bold text-slate-700">No stock movements found</div>
                      <p className="text-xs text-slate-500 mt-1">
                        Try adjusting the date range, location, or movement type filters.
                      </p>
                    </td>
                  </tr>
                ) : (
                  report.rows.map((row, idx) => {
                    const rowNumber = (report.page - 1) * report.limit + idx + 1;
                    return (
                      <tr
                        key={row.id}
                        className="hover:bg-slate-50/90 transition-colors group"
                      >
                        <td className="py-3 px-3 text-center text-slate-400 font-mono">
                          {rowNumber}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                          {formatISTDateTime(row.createdAt)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${row.typeBadgeClass}`}
                          >
                            {row.typeLabel}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px]">
                          {row.referenceUrl ? (
                            <Link
                              href={row.referenceUrl}
                              className="text-blue-600 hover:text-blue-800 underline font-semibold"
                            >
                              {row.referenceId || row.referenceType}
                            </Link>
                          ) : (
                            <span className="text-slate-600">
                              {row.referenceId || row.referenceType || "—"}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-800">
                          {row.partyOrDestination}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 text-sm">
                          {row.inQty > 0 ? `+${row.inQty}` : "—"}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-rose-700 text-sm">
                          {row.outQty > 0 ? `-${row.outQty}` : "—"}
                        </td>
                        <td className="py-3 px-3 text-right font-mono">
                          <div className="font-extrabold text-slate-900 text-sm">
                            {row.runningBalance} pcs
                          </div>
                          <div className="text-[10px] text-slate-500 font-sans">
                            = {row.balanceCartons} {packLabel} + {row.balanceLoose}
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-slate-600 text-[11px]">
                          {row.userName}
                        </td>
                        <td className="py-3 px-3 text-slate-500 text-[11px] max-w-xs truncate">
                          {row.reason || "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {report && report.totalPages > 1 && (
            <div className="p-4 border-t border-slate-200 bg-slate-50/60 flex items-center justify-between text-xs print:hidden">
              <span className="text-slate-600">
                Showing page <strong>{report.page}</strong> of <strong>{report.totalPages}</strong> (
                {report.totalRows} total entries)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => loadReport(report.page - 1)}
                  disabled={report.page <= 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  ← Previous
                </button>
                <button
                  onClick={() => loadReport(report.page + 1)}
                  disabled={report.page >= report.totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
