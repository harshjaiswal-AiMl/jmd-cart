"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { InvoiceWithDetails } from "@/modules/billing/billing.types";
import { formatISTDate, formatISTTime } from "@/lib/date";
import { InvoiceStatus, InvoiceChannel } from "@prisma/client";

interface InvoicesClientProps {
  initialInvoices: InvoiceWithDetails[];
}

export function InvoicesClient({ initialInvoices }: InvoicesClientProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [channelFilter, setChannelFilter] = useState<string>("ALL");

  const filteredInvoices = useMemo(() => {
    return initialInvoices.filter((inv) => {
      if (statusFilter !== "ALL" && inv.status !== statusFilter) return false;
      if (channelFilter !== "ALL" && inv.channel !== channelFilter) return false;

      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const numMatch = inv.number.toLowerCase().includes(query);
        const partyMatch = inv.party?.name?.toLowerCase().includes(query) ?? false;
        const phoneMatch = inv.party?.phone?.includes(query) ?? false;
        if (!numMatch && !partyMatch && !phoneMatch) return false;
      }

      return true;
    });
  }, [initialInvoices, search, statusFilter, channelFilter]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Sales Invoices
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Browse, view details, reprint A4 / 80mm thermal receipts, and audit transactions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/shop/pos"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-2 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Open POS Register
          </Link>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px]">
          <input
            type="text"
            placeholder="Search by invoice number, customer name, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value={InvoiceStatus.FINAL}>FINAL</option>
            <option value={InvoiceStatus.CANCELLED}>CANCELLED</option>
          </select>

          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700"
          >
            <option value="ALL">All Channels</option>
            <option value={InvoiceChannel.SHOP}>Shop</option>
            <option value={InvoiceChannel.VAN}>Van</option>
            <option value={InvoiceChannel.ONLINE}>Online</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Invoice #</th>
                <th className="p-3.5">Date & Time</th>
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
                  <tr key={inv.id} className="hover:bg-slate-50 transition">
                    <td className="p-3.5 font-mono font-bold text-slate-900">
                      <Link
                        href={`/shop/invoices/${inv.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {inv.number}
                      </Link>
                    </td>
                    <td className="p-3.5 text-slate-600">
                      {formatISTDate(inv.createdAt)}, {formatISTTime(inv.createdAt)}
                    </td>
                    <td className="p-3.5">
                      {inv.party ? (
                        <div>
                          <span className="font-semibold text-slate-900 block">
                            {inv.party.name}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {inv.party.phone}
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
                    <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                      ₹{(inv.totalPaise / 100).toFixed(2)}
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Link
                          href={`/shop/invoices/${inv.id}`}
                          title="View Details"
                          className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </Link>
                        <Link
                          href={`/shop/invoices/${inv.id}/print?format=a4`}
                          target="_blank"
                          title="Print A4"
                          className="p-1 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                        </Link>
                        <Link
                          href={`/shop/invoices/${inv.id}/print?format=thermal`}
                          target="_blank"
                          title="Print 80mm Thermal"
                          className="p-1 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
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
