"use client";

import React, { useState, useMemo } from "react";
import { BluetoothPrintButton } from "@/components/van/bluetooth-print-button";
import { Search, ReceiptText, Banknote, CreditCard, Smartphone } from "lucide-react";
import { formatDDMMYYYY } from "@/lib/date";
import { tHi } from "@/lib/i18n/messages/hi";
import { searchParties } from "@/lib/search/party-search";

export interface SerializedVanInvoice {
  id: string;
  number: string;
  status: string;
  paymentStatus: string;
  totalPaise: number;
  createdAt: string;
  party: {
    id: string;
    name: string;
    nameHi?: string | null;
    phone: string | null;
  } | null;
}

interface VanBillsClientProps {
  invoices: SerializedVanInvoice[];
  vanName: string;
}

export function VanBillsClient({ invoices, vanName }: VanBillsClientProps) {
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"ALL" | "CASH" | "CREDIT">("ALL");

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Search matching
      const query = search.trim().toLowerCase();
      const matchSearch =
        !query ||
        inv.number.toLowerCase().includes(query) ||
        (inv.party
          ? searchParties(search, [{ id: inv.party.id, name: inv.party.name, nameHi: inv.party.nameHi, phone: inv.party.phone }], 1).length > 0
          : false);

      if (!matchSearch) return false;

      // Filter Mode
      if (filterMode === "CASH") {
        return inv.paymentStatus === "PAID";
      }
      if (filterMode === "CREDIT") {
        return inv.paymentStatus === "PARTIAL" || inv.paymentStatus === "PENDING";
      }
      return true;
    });
  }, [invoices, search, filterMode]);

  // Aggregate stats
  const totalSalesPaise = invoices.reduce((acc, inv) => acc + inv.totalPaise, 0);

  return (
    <div className="space-y-4">
      {/* Route Sales Metric Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-md">
        <div>
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            {vanName}
          </span>
          <h2 className="text-lg font-black text-white mt-0.5">{tHi("todaysRouteBillsHeading")}</h2>
          <p className="text-xs text-slate-400">
            {tHi("billsIssuedCount", { count: invoices.length })}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400 font-medium">{tHi("totalBilledLabel")}</p>
          <p className="text-xl sm:text-2xl font-black text-white">
            ₹{(totalSalesPaise / 100).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={tHi("searchBillsPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          {/* Type Chips */}
          <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start">
            <button
              onClick={() => setFilterMode("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filterMode === "ALL"
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tHi("filterAll", { count: invoices.length })}
            </button>
            <button
              onClick={() => setFilterMode("CASH")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                filterMode === "CASH"
                  ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Banknote className="w-3 h-3" />
              {tHi("filterCash")}
            </button>
            <button
              onClick={() => setFilterMode("CREDIT")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                filterMode === "CREDIT"
                  ? "bg-amber-600/30 text-amber-300 border border-amber-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <CreditCard className="w-3 h-3" />
              {tHi("filterCredit")}
            </button>
          </div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {filteredInvoices.length === 0 ? (
          <div className="p-10 text-center text-slate-400 space-y-2">
            <ReceiptText className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p className="text-base font-bold text-white">{tHi("noBillsFoundTitle")}</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {search || filterMode !== "ALL"
                ? tHi("noBillsFoundDesc")
                : tHi("noBillsYetDesc")}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filteredInvoices.map((inv) => {
              const isCredit = inv.paymentStatus !== "PAID";
              const createdDate = new Date(inv.createdAt);

              return (
                <div
                  key={inv.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/40 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        {inv.number}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          isCredit
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        }`}
                      >
                        {isCredit ? tHi("statusCreditBadge") : tHi("statusPaidBadge")}
                      </span>
                    </div>

                    <p className="text-base font-bold text-white">
                      {inv.party ? (inv.party.nameHi || inv.party.name) : tHi("walkInCustomer")}
                    </p>

                    <p className="text-xs text-slate-400">
                      {formatDDMMYYYY(createdDate)}
                      {inv.party?.phone && ` • ${inv.party.phone}`}
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
                    <div className="text-left sm:text-right">
                      <span className="text-base font-black text-white">
                        ₹{(inv.totalPaise / 100).toFixed(2)}
                      </span>
                    </div>

                    {/* Bluetooth 1-Tap Print Button */}
                    <BluetoothPrintButton
                      invoiceId={inv.id}
                      invoiceNumber={inv.number}
                      variant="compact"
                      showBrowserFallback={true}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
