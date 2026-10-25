"use client";

import React, { useState, useMemo } from "react";
import { CollectionModal } from "@/components/van/collection-modal";
import { BluetoothCollectionPrintButton } from "@/components/van/bluetooth-collection-print-button";
import { formatISTDate, formatISTTime } from "@/lib/date";
import {
  Search,
  Wallet,
  ReceiptText,
  Banknote,
  Smartphone,
  ChevronRight,
  UserCheck,
  Plus,
} from "lucide-react";

export interface SerializedParty {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  type: string;
  creditEnabled: boolean;
  creditLimitPaise: number;
  outstandingPaise: number;
}

export interface SerializedCollection {
  id: string;
  receiptNo: string;
  partyId: string;
  partyName: string;
  partyPhone: string | null;
  amountPaise: number;
  mode: "CASH" | "UPI" | "CARD";
  notes: string | null;
  createdAt: string;
}

interface VanCollectionsClientProps {
  parties: SerializedParty[];
  recentCollections: SerializedCollection[];
  vanLocationId: string | null;
  vanName: string;
}

export function VanCollectionsClient({
  parties: initialParties,
  recentCollections: initialCollections,
  vanLocationId,
  vanName,
}: VanCollectionsClientProps) {
  const [parties, setParties] = useState<SerializedParty[]>(initialParties);
  const [collections, setCollections] = useState<SerializedCollection[]>(
    initialCollections
  );
  const [tab, setTab] = useState<"PARTIES" | "HISTORY">("PARTIES");
  const [search, setSearch] = useState("");
  const [selectedParty, setSelectedParty] = useState<SerializedParty | null>(
    null
  );
  const [modalOpen, setModalOpen] = useState(false);

  // Filter parties
  const filteredParties = useMemo(() => {
    return parties.filter((p) => {
      const q = search.trim().toLowerCase();
      const match =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.phone && p.phone.includes(q)) ||
        (p.address && p.address.toLowerCase().includes(q));
      return match;
    });
  }, [parties, search]);

  // Daily collection sums
  const totalCollectedTodayPaise = useMemo(() => {
    return collections.reduce((acc, c) => acc + c.amountPaise, 0);
  }, [collections]);

  const cashCollectedTodayPaise = useMemo(() => {
    return collections
      .filter((c) => c.mode === "CASH")
      .reduce((acc, c) => acc + c.amountPaise, 0);
  }, [collections]);

  const upiCollectedTodayPaise = useMemo(() => {
    return collections
      .filter((c) => c.mode === "UPI")
      .reduce((acc, c) => acc + c.amountPaise, 0);
  }, [collections]);

  const handleOpenCollect = (party: SerializedParty) => {
    setSelectedParty(party);
    setModalOpen(true);
  };

  const handleCollectionSuccess = () => {
    // When a collection succeeds, we can refresh the current view
    // (Next navigation will revalidate server state)
  };

  return (
    <div className="space-y-4">
      {/* Route Collection Summary Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-md">
        <div>
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            {vanName}
          </span>
          <h2 className="text-lg font-black text-white mt-0.5">Route Collections</h2>
          <p className="text-xs text-slate-400">
            Collect pending credit payments from retailers on route
          </p>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div>
            <p className="text-[11px] text-slate-400">Cash in Van</p>
            <p className="text-sm sm:text-base font-black text-emerald-400">
              ₹{(cashCollectedTodayPaise / 100).toFixed(2)}
            </p>
          </div>
          <div className="pl-4 border-l border-slate-800">
            <p className="text-[11px] text-slate-400">Total Collected</p>
            <p className="text-base sm:text-xl font-black text-white">
              ₹{(totalCollectedTodayPaise / 100).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs: Parties vs Collection History */}
      <div className="flex bg-slate-900/90 border border-slate-800 p-1 rounded-2xl">
        <button
          onClick={() => setTab("PARTIES")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            tab === "PARTIES"
              ? "bg-slate-800 text-white shadow"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>Retailers ({parties.length})</span>
        </button>
        <button
          onClick={() => setTab("HISTORY")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            tab === "HISTORY"
              ? "bg-slate-800 text-white shadow"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <ReceiptText className="w-3.5 h-3.5" />
          <span>Today&apos;s Receipts ({collections.length})</span>
        </button>
      </div>

      {/* Tab 1: Retailers Directory with Instant Collection */}
      {tab === "PARTIES" && (
        <div className="space-y-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search retailer by shop name, phone or locality..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Parties List */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {filteredParties.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-1">
                <p className="text-sm font-bold text-white">No retailers found</p>
                <p className="text-xs text-slate-500">Try adjusting your search query.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {filteredParties.map((p) => {
                  const hasDue = p.outstandingPaise > 0;

                  return (
                    <div
                      key={p.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/40 transition"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">{p.name}</h4>
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                            {p.type}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          {p.phone && `Ph: ${p.phone}`}
                          {p.address && ` • ${p.address}`}
                        </p>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
                        <div className="text-left sm:text-right">
                          <p className="text-[10px] text-slate-400 font-medium">Balance Due</p>
                          <p
                            className={`text-sm sm:text-base font-black ${
                              hasDue ? "text-amber-400" : "text-emerald-400"
                            }`}
                          >
                            ₹{(p.outstandingPaise / 100).toFixed(2)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenCollect(p)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm ${
                            hasDue
                              ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20"
                              : "bg-slate-800 hover:bg-slate-700 text-slate-200"
                          }`}
                        >
                          <Wallet className="w-3.5 h-3.5" />
                          <span>Collect</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Today's Receipts History */}
      {tab === "HISTORY" && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {collections.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-1">
              <ReceiptText className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-bold text-white">No collections recorded today</p>
              <p className="text-xs text-slate-500">
                Payment receipts issued to retailers on route will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {collections.map((c) => {
                const date = new Date(c.createdAt);

                return (
                  <div
                    key={c.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/40 transition"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-emerald-400">
                          {c.receiptNo}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {c.mode}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white">{c.partyName}</h4>
                      <p className="text-xs text-slate-400">
                        {formatISTDate(date)} at {formatISTTime(date)}
                        {c.notes && ` • Note: ${c.notes}`}
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
                      <span className="text-base font-black text-white">
                        ₹{(c.amountPaise / 100).toFixed(2)}
                      </span>

                      {/* Bluetooth Print Slip */}
                      <BluetoothCollectionPrintButton
                        receiptId={c.id}
                        receiptNo={c.receiptNo}
                        variant="compact"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Collect Modal */}
      <CollectionModal
        party={selectedParty}
        vanLocationId={vanLocationId}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleCollectionSuccess}
      />
    </div>
  );
}
