"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { InvoiceWithDetails } from "@/modules/billing/billing.types";
import { formatDmy, formatDmyHm, toIstDateString, startOfIstDay, endOfIstDay } from "@/lib/datetime";
import { InvoiceStatus, InvoiceChannel } from "@prisma/client";
import {
  Calendar,
  Search,
  Receipt,
  Eye,
  Printer,
  Edit2,
  TrendingUp,
  DollarSign,
  AlertCircle,
} from "lucide-react";

interface InvoicesClientProps {
  initialInvoices: InvoiceWithDetails[];
}

export function InvoicesClient({ initialInvoices }: InvoicesClientProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [channelFilter, setChannelFilter] = useState<string>("ALL");
  const [datePreset, setDatePreset] = useState<"ALL" | "TODAY" | "YESTERDAY" | "THIS_WEEK" | "THIS_MONTH" | "THIS_FY">("ALL");

  const todayStr = useMemo(() => toIstDateString(new Date()), []);

  const filteredInvoices = useMemo(() => {
    const now = new Date();
    const todayStart = startOfIstDay(now).getTime();
    const todayEnd = endOfIstDay(now).getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
    const yesterdayEnd = todayStart - 1;
    const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;
    const monthStart = todayStart - 30 * 24 * 60 * 60 * 1000;

    return initialInvoices.filter((inv) => {
      if (statusFilter !== "ALL" && inv.status !== statusFilter) return false;
      if (channelFilter !== "ALL" && inv.channel !== channelFilter) return false;

      // Date filtering based on business invoiceDate or createdAt
      const invTime = new Date(inv.invoiceDate || inv.createdAt).getTime();
      if (datePreset === "TODAY" && (invTime < todayStart || invTime > todayEnd)) return false;
      if (datePreset === "YESTERDAY" && (invTime < yesterdayStart || invTime > yesterdayEnd)) return false;
      if (datePreset === "THIS_WEEK" && invTime < weekStart) return false;
      if (datePreset === "THIS_MONTH" && invTime < monthStart) return false;

      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const numMatch = inv.number.toLowerCase().includes(query);
        const partyMatch = inv.party?.name?.toLowerCase().includes(query) ?? false;
        const custNameMatch = inv.customerName?.toLowerCase().includes(query) ?? false;
        const phoneMatch =
          (inv.party?.phone?.includes(query) ?? false) ||
          (inv.customerPhone?.includes(query) ?? false);
        if (!numMatch && !partyMatch && !custNameMatch && !phoneMatch) return false;
      }

      return true;
    });
  }, [initialInvoices, search, statusFilter, channelFilter, datePreset]);

  // Aggregate Totals across all filtered invoices (excluding cancelled from money totals)
  const totals = useMemo(() => {
    let count = 0;
    let totalAmountPaise = 0;
    let taxablePaise = 0;
    let taxPaise = 0;
    let discountPaise = 0;
    let paidPaise = 0;
    let cancelledCount = 0;

    let shopCount = 0;
    let vanCount = 0;
    let onlineCount = 0;

    for (const inv of filteredInvoices) {
      if (inv.status === InvoiceStatus.CANCELLED) {
        cancelledCount++;
        continue;
      }

      count++;
      totalAmountPaise += inv.totalPaise;
      taxablePaise += inv.taxablePaise;
      taxPaise += inv.cgstPaise + inv.sgstPaise + inv.igstPaise;
      discountPaise += inv.discountPaise;

      const invoicePaid = inv.payments.reduce((sum, p) => sum + p.amountPaise, 0);
      paidPaise += invoicePaid;

      if (inv.channel === InvoiceChannel.SHOP) shopCount++;
      else if (inv.channel === InvoiceChannel.VAN) vanCount++;
      else if (inv.channel === InvoiceChannel.ONLINE) onlineCount++;
    }

    const pendingPaise = Math.max(0, totalAmountPaise - paidPaise);
    const avgBillPaise = count > 0 ? Math.round(totalAmountPaise / count) : 0;

    return {
      count,
      totalAmountPaise,
      taxablePaise,
      taxPaise,
      discountPaise,
      paidPaise,
      pendingPaise,
      avgBillPaise,
      cancelledCount,
      shopCount,
      vanCount,
      onlineCount,
    };
  }, [filteredInvoices]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-emerald-600" />
            <span>Sales Invoices</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Browse invoices, review aggregate totals, edit details with full revision tracking, or print A4 / thermal receipts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/shop/pos"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-2 transition"
          >
            <span className="text-base font-black">+</span>
            <span>New POS Bill</span>
          </Link>
        </div>
      </div>

      {/* Aggregate Totals Bar (Entire Filtered Result) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white p-5 rounded-2xl shadow-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
              Filtered Total Summary
            </span>
            <span className="text-[11px] font-mono text-white/70">
              ({totals.count} active bills{totals.cancelledCount > 0 ? `, ${totals.cancelledCount} cancelled` : ""})
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-bold">
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/90">
              Shop: {totals.shopCount}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/90">
              Van: {totals.vanCount}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/90">
              Online: {totals.onlineCount}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <div className="text-[10px] uppercase font-bold text-slate-400">Total Billed</div>
            <div className="text-lg font-black font-mono text-emerald-400 mt-0.5">
              ₹{(totals.totalAmountPaise / 100).toFixed(2)}
            </div>
          </div>

          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <div className="text-[10px] uppercase font-bold text-slate-400">Taxable Value</div>
            <div className="text-lg font-black font-mono text-white mt-0.5">
              ₹{(totals.taxablePaise / 100).toFixed(2)}
            </div>
          </div>

          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <div className="text-[10px] uppercase font-bold text-slate-400">GST Collected</div>
            <div className="text-lg font-black font-mono text-blue-300 mt-0.5">
              ₹{(totals.taxPaise / 100).toFixed(2)}
            </div>
          </div>

          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <div className="text-[10px] uppercase font-bold text-slate-400">Discount Given</div>
            <div className="text-lg font-black font-mono text-amber-300 mt-0.5">
              ₹{(totals.discountPaise / 100).toFixed(2)}
            </div>
          </div>

          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <div className="text-[10px] uppercase font-bold text-slate-400">Cash/UPI Paid</div>
            <div className="text-lg font-black font-mono text-emerald-300 mt-0.5">
              ₹{(totals.paidPaise / 100).toFixed(2)}
            </div>
          </div>

          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <div className="text-[10px] uppercase font-bold text-slate-400">Pending / Credit</div>
            <div className="text-lg font-black font-mono text-rose-300 mt-0.5">
              ₹{(totals.pendingPaise / 100).toFixed(2)}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-white/60 pt-1">
          <span>Average Bill Value: <strong className="text-white font-mono">₹{(totals.avgBillPaise / 100).toFixed(2)}</strong></span>
          {totals.cancelledCount > 0 && (
            <span className="text-rose-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{totals.cancelledCount} cancelled bill(s) excluded from money totals</span>
            </span>
          )}
        </div>
      </div>

      {/* Filter bar with Date Presets */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex-1 min-w-[260px]">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search invoice number, customer name, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold"
            >
              <option value="ALL">All Statuses</option>
              <option value={InvoiceStatus.FINAL}>FINAL</option>
              <option value={InvoiceStatus.CANCELLED}>CANCELLED</option>
            </select>

            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold"
            >
              <option value="ALL">All Channels</option>
              <option value={InvoiceChannel.SHOP}>Shop</option>
              <option value={InvoiceChannel.VAN}>Van</option>
              <option value={InvoiceChannel.ONLINE}>Online</option>
            </select>
          </div>
        </div>

        {/* Date Presets Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-400 font-bold mr-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>Range:</span>
          </span>
          {(
            [
              { key: "ALL", label: "All Time" },
              { key: "TODAY", label: "Today" },
              { key: "YESTERDAY", label: "Yesterday" },
              { key: "THIS_WEEK", label: "This Week" },
              { key: "THIS_MONTH", label: "This Month" },
            ] as const
          ).map((p) => (
            <button
              key={p.key}
              onClick={() => setDatePreset(p.key)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                datePreset === p.key
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Invoice #</th>
                <th className="p-3.5">Business Date</th>
                <th className="p-3.5">Customer / Party</th>
                <th className="p-3.5">Channel</th>
                <th className="p-3.5 text-center">Buyer Tag</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-right">Amount (₹)</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No invoices match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                    <td className="p-3.5 font-mono font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/shop/invoices/${inv.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {inv.number}
                        </Link>
                        {inv.isRevised && (
                          <span className="px-1.5 py-0.2 rounded font-black text-[9px] uppercase bg-purple-100 text-purple-900 border border-purple-300">
                            Rev {inv.version}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-600 font-mono">
                      {formatDmy(inv.invoiceDate || inv.createdAt)}
                    </td>
                    <td className="p-3.5">
                      {inv.party ? (
                        <div>
                          <span className="font-semibold text-slate-900 block">
                            {inv.party.name}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {inv.party.phone}
                          </span>
                        </div>
                      ) : inv.customerName ? (
                        <div>
                          <span className="font-semibold text-slate-900 block">
                            {inv.customerName}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {inv.customerPhone || "Walk-in Retail"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">
                          Walk-in Retail Customer
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 font-semibold text-slate-700">
                      {inv.channel}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-slate-100 text-slate-700">
                        {inv.buyerType || "CUSTOMER"}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
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
                    <td className="p-3.5 text-right font-mono font-black text-slate-900">
                      ₹{(inv.totalPaise / 100).toFixed(2)}
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Link
                          href={`/shop/invoices/${inv.id}`}
                          title="View Details"
                          className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        {inv.status !== "CANCELLED" && (
                          <Link
                            href={`/shop/invoices/${inv.id}/edit`}
                            title="Edit Invoice"
                            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Link>
                        )}
                        <Link
                          href={`/shop/invoices/${inv.id}/print?format=a4`}
                          target="_blank"
                          title="Print A4"
                          className="p-1 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                        >
                          <Printer className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
