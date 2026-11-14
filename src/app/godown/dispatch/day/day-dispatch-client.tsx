"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { formatISTDateTime, formatISTDate } from "@/lib/date";
import { DayDispatchSummary } from "@/modules/dispatch/day-dispatch.service";
import { getDayDispatchDataAction } from "./actions";

interface DayDispatchClientProps {
  initialData: DayDispatchSummary;
}

export function DayDispatchClient({ initialData }: DayDispatchClientProps) {
  const [data, setData] = useState<DayDispatchSummary>(initialData);
  const [selectedDate, setSelectedDate] = useState<string>(initialData.dateStr);
  const [isLiveActive, setIsLiveActive] = useState<boolean>(true);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState<number>(30);
  const [isPending, startTransition] = useTransition();

  // Collapsible sections state
  const [openSections, setOpenSections] = useState({
    orders: true,
    vans: true,
    shop: false,
    counter: false,
    company: false,
    exceptions: true,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const loadData = (date = selectedDate) => {
    startTransition(async () => {
      try {
        const res = await getDayDispatchDataAction(date);
        setData(res);
        setSecondsUntilRefresh(30);
      } catch (err) {
        console.error("Failed to load day dispatch:", err);
      }
    });
  };

  // Date change handler
  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    loadData(newDate);
  };

  // 30-second auto-refresh
  useEffect(() => {
    if (!isLiveActive) return;

    const timer = setInterval(() => {
      setSecondsUntilRefresh((prev) => {
        if (prev <= 1) {
          loadData();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isLiveActive, selectedDate]);

  // Export to CSV
  const exportToCSV = () => {
    if (!data || data.matrix.length === 0) return;

    const headers = [
      "S.N.",
      "Product Name",
      "Short Code",
      "Pack Size",
      "Orders (Pcs)",
      ...data.allVanNames.map((v) => `${v} (Pcs)`),
      "Shop Transfers (Pcs)",
      "Counter Pickups (Pcs)",
      "Company Returns (Pcs)",
      "Total Out (Pcs)",
      "Total Out Formatted",
    ];

    const rows = data.matrix.map((r, i) => [
      i + 1,
      `"${r.productName.replace(/"/g, '""')}"`,
      r.shortCode,
      r.packSize,
      r.ordersPieces,
      ...data.allVanNames.map((v) => r.vansPieces[v] || 0),
      r.shopPieces,
      r.counterPieces,
      r.companyPieces,
      r.totalOutPieces,
      `"${r.totalOutFormatted}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Day_Dispatch_${data.dateStr}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const kpis = data.kpis;
  const integrity = data.integrityCheck;

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-slate-900 pb-16 print:bg-white print:p-0">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-20 shadow-xs print:static print:border-none">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/godown/dispatch"
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition print:hidden"
            >
              ← Dispatch Board
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="px-2 py-0.5 rounded text-[11px] font-black tracking-wider uppercase text-white"
                  style={{ backgroundColor: "#790E11" }}
                >
                  Day Dispatch
                </span>
                <h1 className="text-xl font-bold text-slate-900">
                  Overall Warehouse Day Dispatch
                </h1>
                {/* Live Indicator */}
                <div className="flex items-center gap-1.5 ml-2 print:hidden">
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-full ${
                      isLiveActive ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                    }`}
                  />
                  <span className="text-[11px] font-semibold text-slate-500">
                    {isLiveActive ? `Live (${secondsUntilRefresh}s)` : "Paused"}
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Summary for {formatISTDate(new Date(`${data.dateStr}T12:00:00.000+05:30`))} • Out movements across Online Orders, Vans, Shop, Counter &amp; Company.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 print:hidden">
            {/* Date Picker */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 shadow-2xs">
              <span className="text-xs font-bold text-slate-600">Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="text-xs font-bold bg-transparent text-slate-900 focus:outline-none"
              />
            </div>

            {/* Live Toggle */}
            <button
              onClick={() => setIsLiveActive((prev) => !prev)}
              className={`px-3 py-2 text-xs font-bold rounded-lg border transition shadow-2xs ${
                isLiveActive
                  ? "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
                  : "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
              }`}
            >
              {isLiveActive ? "⏸ Pause Live" : "▶ Resume Live"}
            </button>

            {/* Print & Export */}
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-2xs transition"
            >
              🖨️ Print A4
            </button>
            <button
              onClick={exportToCSV}
              disabled={data.matrix.length === 0}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs transition disabled:opacity-50"
            >
              📊 Export to Excel
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-6 space-y-6">
        {/* Automated Integrity Cross-Check Banner */}
        <div
          className={`rounded-2xl p-4 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs ${
            integrity.matches
              ? "bg-emerald-50/70 border-emerald-300 text-emerald-950"
              : "bg-red-50 border-red-300 text-red-950"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{integrity.matches ? "✅" : "⚠️"}</span>
            <div>
              <div className="font-extrabold text-sm flex items-center gap-2">
                <span>
                  {integrity.matches
                    ? "Dispatch Integrity Cross-Check Passed"
                    : "Stock Ledger Discrepancy Detected"}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                    integrity.matches
                      ? "bg-emerald-200 text-emerald-900"
                      : "bg-red-200 text-red-900"
                  }`}
                >
                  {integrity.matches ? "100% RECONCILED" : "MISMATCH ALERT"}
                </span>
              </div>
              <p className="text-xs mt-0.5 text-slate-700">
                {integrity.matches ? (
                  <>
                    The product-wise Total Out (<strong>{integrity.matrixTotalPieces} pcs</strong>) equals
                    the stock ledger out movements for {selectedDate} with <strong>0 difference</strong>.
                  </>
                ) : (
                  <>
                    Product-wise Total Out ({integrity.matrixTotalPieces} pcs) differs from ledger out movements ({integrity.ledgerTotalPieces} pcs) by{" "}
                    <strong>{integrity.difference > 0 ? `+${integrity.difference}` : integrity.difference} pcs</strong>.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="text-right text-xs font-mono font-bold sm:border-l sm:border-slate-300/60 sm:pl-4">
            <div>Total Out: <span className="text-slate-900 font-extrabold">{integrity.matrixTotalPieces} pcs</span></div>
            <div className="text-[11px] text-slate-600 font-sans">
              Auto-verified with ledger
            </div>
          </div>
        </div>

        {/* 9 KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-3">
          {/* Orders Dispatched */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Dispatched
            </div>
            <div className="text-xl font-black text-slate-900 font-mono mt-1">
              {kpis.ordersDispatched}
            </div>
            <div className="text-[10px] text-slate-500">Orders sent</div>
          </div>

          {/* Delivered */}
          <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-2xs">
            <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
              Delivered
            </div>
            <div className="text-xl font-black text-emerald-700 font-mono mt-1">
              {kpis.delivered}
            </div>
            <div className="text-[10px] text-emerald-600">Complete</div>
          </div>

          {/* Out for Delivery */}
          <div className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-2xs">
            <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
              Out for Del.
            </div>
            <div className="text-xl font-black text-amber-700 font-mono mt-1">
              {kpis.outForDelivery}
            </div>
            <div className="text-[10px] text-amber-600">On the road</div>
          </div>

          {/* Failed */}
          <div className="bg-white p-3.5 rounded-xl border border-rose-200 shadow-2xs">
            <div className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">
              Failed / Canc.
            </div>
            <div className="text-xl font-black text-rose-700 font-mono mt-1">
              {kpis.failed}
            </div>
            <div className="text-[10px] text-rose-600">Requires review</div>
          </div>

          {/* Vans Issued */}
          <div className="bg-white p-3.5 rounded-xl border border-indigo-200 shadow-2xs">
            <div className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider">
              Vans Issued
            </div>
            <div className="text-xl font-black text-indigo-700 font-mono mt-1">
              {kpis.vansIssued}
            </div>
            <div className="text-[10px] text-indigo-600">Load sheets</div>
          </div>

          {/* Shop Transfers */}
          <div className="bg-white p-3.5 rounded-xl border border-blue-200 shadow-2xs">
            <div className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">
              Shop Transfers
            </div>
            <div className="text-xl font-black text-blue-700 font-mono mt-1">
              {kpis.shopTransfers}
            </div>
            <div className="text-[10px] text-blue-600">Counter replenish</div>
          </div>

          {/* Counter Pickups */}
          <div className="bg-white p-3.5 rounded-xl border border-teal-200 shadow-2xs">
            <div className="text-[10px] font-bold text-teal-800 uppercase tracking-wider">
              Counter Pickups
            </div>
            <div className="text-xl font-black text-teal-700 font-mono mt-1">
              {kpis.counterPickups}
            </div>
            <div className="text-[10px] text-teal-600">Direct pickups</div>
          </div>

          {/* Company Returns */}
          <div className="bg-white p-3.5 rounded-xl border border-orange-200 shadow-2xs">
            <div className="text-[10px] font-bold text-orange-800 uppercase tracking-wider">
              Co. Returns
            </div>
            <div className="text-xl font-black text-orange-700 font-mono mt-1">
              {kpis.companyReturns}
            </div>
            <div className="text-[10px] text-orange-600">Debit notes</div>
          </div>

          {/* Total Out */}
          <div
            className="p-3.5 rounded-xl border shadow-2xs text-white"
            style={{ backgroundColor: "#790E11" }}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-200">
              Total Out
            </div>
            <div className="text-xl font-black text-amber-300 font-mono mt-1">
              {kpis.totalOutPieces} <span className="text-[11px] font-sans text-white/80">pcs</span>
            </div>
            <div className="text-[10px] text-amber-100 font-semibold truncate">
              {kpis.totalOutFormatted}
            </div>
          </div>
        </div>

        {/* Product-Wise Destination Matrix */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
            <div>
              <h2 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <span>Product-Wise Destination Matrix</span>
                <span className="px-2 py-0.5 rounded-full text-xs bg-slate-200 text-slate-700 font-medium">
                  {data.matrix.length} product{data.matrix.length === 1 ? "" : "s"}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Breakdown of items dispatched to Orders, Sales Vans, Shop Transfers, Counter Pickups, and Company Returns.
              </p>
            </div>
            {isPending && (
              <span className="text-xs text-slate-500 font-semibold animate-pulse">
                Refreshing data...
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 uppercase font-black tracking-wider text-[11px] sticky top-0">
                  <th className="py-3 px-3 w-12 text-center">#</th>
                  <th className="py-3 px-3">Product Description</th>
                  <th className="py-3 px-3 w-24">Pack Size</th>
                  <th className="py-3 px-3 text-right w-24">Orders</th>
                  {data.allVanNames.map((vanName) => (
                    <th key={vanName} className="py-3 px-3 text-right w-24">
                      {vanName}
                    </th>
                  ))}
                  <th className="py-3 px-3 text-right w-24">Shop</th>
                  <th className="py-3 px-3 text-right w-24">Counter</th>
                  <th className="py-3 px-3 text-right w-24">Company</th>
                  <th className="py-3 px-3 text-right w-36 font-black text-slate-900 bg-amber-50/60">
                    Total Out
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {data.matrix.length === 0 ? (
                  <tr>
                    <td colSpan={8 + data.allVanNames.length} className="py-12 text-center text-slate-500">
                      <div className="text-3xl mb-2">📦</div>
                      <div className="text-sm font-bold text-slate-700">No dispatches recorded for this date</div>
                      <p className="text-xs text-slate-500 mt-1">
                        Select a different date or create orders and van issues from the Dispatch Board.
                      </p>
                    </td>
                  </tr>
                ) : (
                  data.matrix.map((row, idx) => (
                    <tr
                      key={row.productId}
                      className="hover:bg-slate-50/90 transition-colors group"
                    >
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        <div className="font-bold">{row.productName}</div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {row.shortCode}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 text-[11px]">
                        1 {row.packLabel} = {row.packSize} Pcs
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">
                        {row.ordersPieces > 0 ? row.ordersPieces : "—"}
                      </td>
                      {data.allVanNames.map((vanName) => (
                        <td
                          key={vanName}
                          className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700"
                        >
                          {row.vansPieces[vanName] ? row.vansPieces[vanName] : "—"}
                        </td>
                      ))}
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">
                        {row.shopPieces > 0 ? row.shopPieces : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">
                        {row.counterPieces > 0 ? row.counterPieces : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">
                        {row.companyPieces > 0 ? row.companyPieces : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono bg-amber-50/40">
                        <div className="font-extrabold text-slate-900 text-sm">
                          {row.totalOutPieces} pcs
                        </div>
                        <div className="text-[10px] text-slate-600 font-sans font-semibold">
                          = {row.totalOutFormatted}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {data.matrix.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                    <td colSpan={3} className="py-3 px-3 uppercase tracking-wider text-xs">
                      Column Totals
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {data.matrix.reduce((s, r) => s + r.ordersPieces, 0)}
                    </td>
                    {data.allVanNames.map((vanName) => (
                      <td key={vanName} className="py-3 px-3 text-right font-mono">
                        {data.matrix.reduce((s, r) => s + (r.vansPieces[vanName] || 0), 0)}
                      </td>
                    ))}
                    <td className="py-3 px-3 text-right font-mono">
                      {data.matrix.reduce((s, r) => s + r.shopPieces, 0)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {data.matrix.reduce((s, r) => s + r.counterPieces, 0)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {data.matrix.reduce((s, r) => s + r.companyPieces, 0)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-sm text-[#790E11] bg-amber-100/60 font-black">
                      {integrity.matrixTotalPieces} pcs
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Exceptions Panel */}
        <div className="bg-white rounded-2xl border border-rose-200 shadow-xs overflow-hidden">
          <button
            onClick={() => toggleSection("exceptions")}
            className="w-full p-4 border-b border-rose-100 flex items-center justify-between bg-rose-50/50 hover:bg-rose-50/80 transition"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <h2 className="font-bold text-sm text-rose-950">
                Exceptions &amp; Reconciliation Alerts
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-200 text-rose-900">
                {data.exceptions.failedDeliveries.length +
                  data.exceptions.shortPicks.length +
                  data.exceptions.unreconciledVans.length +
                  data.exceptions.pendingOrders.length}{" "}
                items
              </span>
            </div>
            <span className="text-xs text-rose-800 font-bold">
              {openSections.exceptions ? "▲ Hide" : "▼ Show"}
            </span>
          </button>

          {openSections.exceptions && (
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-white">
              {/* Failed Deliveries */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                <div className="text-xs font-bold text-rose-800 flex items-center justify-between">
                  <span>Failed Deliveries</span>
                  <span className="font-mono">{data.exceptions.failedDeliveries.length}</span>
                </div>
                {data.exceptions.failedDeliveries.length === 0 ? (
                  <div className="text-[11px] text-slate-500 mt-2">None. All deliveries cleared.</div>
                ) : (
                  <ul className="mt-2 space-y-1.5 divide-y divide-slate-100">
                    {data.exceptions.failedDeliveries.map((f) => (
                      <li key={f.orderId} className="pt-1.5 text-[11px]">
                        <div className="font-bold text-slate-900">{f.orderNumber} - {f.partyName}</div>
                        <div className="text-slate-500">{f.reason}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Short Picks */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                <div className="text-xs font-bold text-amber-800 flex items-center justify-between">
                  <span>Short Picks / Shortages</span>
                  <span className="font-mono">{data.exceptions.shortPicks.length}</span>
                </div>
                {data.exceptions.shortPicks.length === 0 ? (
                  <div className="text-[11px] text-slate-500 mt-2">No short picks detected.</div>
                ) : (
                  <ul className="mt-2 space-y-1.5 divide-y divide-slate-100">
                    {data.exceptions.shortPicks.map((s, idx) => (
                      <li key={idx} className="pt-1.5 text-[11px]">
                        <div className="font-bold text-slate-900">{s.productName}</div>
                        <div className="text-amber-700 font-semibold">
                          Shortage: {s.shortageQty} pcs ({s.reference})
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Unreconciled Vans */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                <div className="text-xs font-bold text-indigo-800 flex items-center justify-between">
                  <span>Unreconciled Vans</span>
                  <span className="font-mono">{data.exceptions.unreconciledVans.length}</span>
                </div>
                {data.exceptions.unreconciledVans.length === 0 ? (
                  <div className="text-[11px] text-slate-500 mt-2">All vans reconciled.</div>
                ) : (
                  <ul className="mt-2 space-y-1.5 divide-y divide-slate-100">
                    {data.exceptions.unreconciledVans.map((v) => (
                      <li key={v.vanDayId} className="pt-1.5 text-[11px]">
                        <div className="font-bold text-slate-900">{v.vanName} ({v.salespersonName})</div>
                        <div className="text-slate-500">Sheet: {v.issueSheetNo} (Status: Open)</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Pending Orders */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                <div className="text-xs font-bold text-blue-800 flex items-center justify-between">
                  <span>Awaiting Confirmation / Dispatch</span>
                  <span className="font-mono">{data.exceptions.pendingOrders.length}</span>
                </div>
                {data.exceptions.pendingOrders.length === 0 ? (
                  <div className="text-[11px] text-slate-500 mt-2">No pending orders.</div>
                ) : (
                  <ul className="mt-2 space-y-1.5 divide-y divide-slate-100">
                    {data.exceptions.pendingOrders.map((p) => (
                      <li key={p.orderId} className="pt-1.5 text-[11px]">
                        <div className="font-bold text-slate-900">{p.orderNumber} - {p.partyName}</div>
                        <div className="text-blue-700 font-medium">Status: {p.status}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Collapsible Section 1: Online & Manual Orders */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <button
            onClick={() => toggleSection("orders")}
            className="w-full p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 hover:bg-slate-100 transition"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🛒</span>
              <h3 className="font-bold text-sm text-slate-800">
                Online &amp; Manual Delivery Orders
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs bg-slate-200 text-slate-700 font-medium">
                {data.sections.orders.length}
              </span>
            </div>
            <span className="text-xs text-slate-500 font-bold">
              {openSections.orders ? "▲ Hide" : "▼ Show"}
            </span>
          </button>

          {openSections.orders && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px]">
                    <th className="py-2.5 px-3">Order No</th>
                    <th className="py-2.5 px-3">Party Name</th>
                    <th className="py-2.5 px-3">Area</th>
                    <th className="py-2.5 px-3">Slot</th>
                    <th className="py-2.5 px-3 text-right">Items</th>
                    <th className="py-2.5 px-3 text-right">Total Qty (Pcs)</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Van / Delivery Person</th>
                    <th className="py-2.5 px-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {data.sections.orders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-slate-500">
                        No orders recorded on this date.
                      </td>
                    </tr>
                  ) : (
                    data.sections.orders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-700">
                          {o.orderNumber}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {o.partyName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{o.area}</td>
                        <td className="py-2.5 px-3 text-slate-600">{o.slot}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{o.itemCount}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {o.totalQtyPieces}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              o.status === "DELIVERED"
                                ? "bg-emerald-100 text-emerald-800"
                                : o.status === "OUT_FOR_DELIVERY"
                                ? "bg-amber-100 text-amber-800"
                                : o.status === "FAILED" || o.status === "CANCELLED"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {o.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 font-medium">
                          {o.vanOrDeliveryPerson}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                          {formatISTDateTime(o.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Collapsible Section 2: Van Issues */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <button
            onClick={() => toggleSection("vans")}
            className="w-full p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 hover:bg-slate-100 transition"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🚚</span>
              <h3 className="font-bold text-sm text-slate-800">
                Sales Van Issues &amp; Reconciliations
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs bg-slate-200 text-slate-700 font-medium">
                {data.sections.vans.length}
              </span>
            </div>
            <span className="text-xs text-slate-500 font-bold">
              {openSections.vans ? "▲ Hide" : "▼ Show"}
            </span>
          </button>

          {openSections.vans && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px]">
                    <th className="py-2.5 px-3">Issue Sheet No</th>
                    <th className="py-2.5 px-3">Van Name</th>
                    <th className="py-2.5 px-3">Salesperson</th>
                    <th className="py-2.5 px-3 text-right">Items Out (Pcs)</th>
                    <th className="py-2.5 px-3 text-right">Returned (Pcs)</th>
                    <th className="py-2.5 px-3 text-right">Shortage (Pcs)</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {data.sections.vans.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-500">
                        No van load sheets recorded for this date.
                      </td>
                    </tr>
                  ) : (
                    data.sections.vans.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">
                          {v.issueSheetNo}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{v.vanName}</td>
                        <td className="py-2.5 px-3 text-slate-700">{v.salespersonName}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {v.itemsOutPieces}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-700">
                          {v.returnedPieces}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">
                          {v.shortagePieces > 0 ? v.shortagePieces : "—"}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              v.isReconciled
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {v.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Collapsible Section 3: Shop Transfers */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <button
            onClick={() => toggleSection("shop")}
            className="w-full p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 hover:bg-slate-100 transition"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🏬</span>
              <h3 className="font-bold text-sm text-slate-800">
                Retail Shop Replenishment Transfers
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs bg-slate-200 text-slate-700 font-medium">
                {data.sections.shopTransfers.length}
              </span>
            </div>
            <span className="text-xs text-slate-500 font-bold">
              {openSections.shop ? "▲ Hide" : "▼ Show"}
            </span>
          </button>

          {openSections.shop && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px]">
                    <th className="py-2.5 px-3">Request Number</th>
                    <th className="py-2.5 px-3 text-right">Items Count</th>
                    <th className="py-2.5 px-3 text-right">Total Qty (Pcs)</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {data.sections.shopTransfers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500">
                        No shop transfers recorded for this date.
                      </td>
                    </tr>
                  ) : (
                    data.sections.shopTransfers.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-700">
                          {s.requestNumber}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">{s.itemCount}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {s.totalQtyPieces}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                            {s.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                          {formatISTDateTime(s.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Collapsible Section 4: Counter Pickups */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <button
            onClick={() => toggleSection("counter")}
            className="w-full p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 hover:bg-slate-100 transition"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🛍️</span>
              <h3 className="font-bold text-sm text-slate-800">
                Counter Pickups (Fulfilled from Godown)
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs bg-slate-200 text-slate-700 font-medium">
                {data.sections.counterPickups.length}
              </span>
            </div>
            <span className="text-xs text-slate-500 font-bold">
              {openSections.counter ? "▲ Hide" : "▼ Show"}
            </span>
          </button>

          {openSections.counter && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px]">
                    <th className="py-2.5 px-3">Bill Number</th>
                    <th className="py-2.5 px-3">Cashier</th>
                    <th className="py-2.5 px-3 text-right">Items Count</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {data.sections.counterPickups.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500">
                        No counter pickups recorded on this date.
                      </td>
                    </tr>
                  ) : (
                    data.sections.counterPickups.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-teal-700">
                          {c.billNumber}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{c.cashierName}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{c.itemCount}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800">
                            {c.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                          {formatISTDateTime(c.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Collapsible Section 5: Company Returns */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <button
            onClick={() => toggleSection("company")}
            className="w-full p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 hover:bg-slate-100 transition"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🏭</span>
              <h3 className="font-bold text-sm text-slate-800">
                Company Returns &amp; Debit Notes
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs bg-slate-200 text-slate-700 font-medium">
                {data.sections.companyReturns.length}
              </span>
            </div>
            <span className="text-xs text-slate-500 font-bold">
              {openSections.company ? "▲ Hide" : "▼ Show"}
            </span>
          </button>

          {openSections.company && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px]">
                    <th className="py-2.5 px-3">Debit Note No</th>
                    <th className="py-2.5 px-3">Supplier / Company</th>
                    <th className="py-2.5 px-3 text-right">Items Count</th>
                    <th className="py-2.5 px-3 text-right">Total Qty (Pcs)</th>
                    <th className="py-2.5 px-3">Reason</th>
                    <th className="py-2.5 px-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {data.sections.companyReturns.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
                        No company returns recorded on this date.
                      </td>
                    </tr>
                  ) : (
                    data.sections.companyReturns.map((dn) => (
                      <tr key={dn.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-orange-700">
                          {dn.number}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {dn.supplierName}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">{dn.itemCount}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {dn.totalQtyPieces}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{dn.reason}</td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                          {formatISTDateTime(dn.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
