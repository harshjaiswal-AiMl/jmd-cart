"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Calculator,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  Banknote,
  Smartphone,
  ChevronRight,
  Filter,
} from "lucide-react";
import { receiveInvoicePaymentAction } from "./actions";

interface PendingInvoice {
  id: string;
  number: string;
  channel: string;
  partyId?: string | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  totalPaise: number;
  totalPaidPaise: number;
  pendingPaise: number;
  createdAt: string;
}

interface Props {
  pendingInvoices: PendingInvoice[];
}

export function AccountsClient({ pendingInvoices }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<string>("ALL");
  const [collectingInvoice, setCollectingInvoice] = useState<PendingInvoice | null>(null);
  const [collectAmountRupees, setCollectAmountRupees] = useState("");
  const [collectMode, setCollectMode] = useState<"CASH" | "UPI">("CASH");
  const [collectRef, setCollectRef] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const filtered = useMemo(() => {
    return pendingInvoices.filter((inv) => {
      const matchSearch =
        !searchTerm.trim() ||
        inv.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.customerPhone.includes(searchTerm);

      const matchChannel = selectedChannel === "ALL" || inv.channel === selectedChannel;
      return matchSearch && matchChannel;
    });
  }, [pendingInvoices, searchTerm, selectedChannel]);

  const totalOutstandingPaise = useMemo(() => {
    return pendingInvoices.reduce((s, i) => s + i.pendingPaise, 0);
  }, [pendingInvoices]);

  const openCollectModal = (inv: PendingInvoice) => {
    setCollectingInvoice(inv);
    setCollectAmountRupees((inv.pendingPaise / 100).toFixed(2));
    setCollectMode("CASH");
    setCollectRef("");
    setStatusMessage(null);
  };

  const handleCollectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectingInvoice) return;

    const amountPaise = Math.round(parseFloat(collectAmountRupees || "0") * 100);
    if (amountPaise <= 0 || amountPaise > collectingInvoice.pendingPaise) {
      alert("Please enter a valid payment amount up to pending balance.");
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await receiveInvoicePaymentAction({
        invoiceId: collectingInvoice.id,
        amountPaise,
        mode: collectMode,
        reference: collectRef.trim() || undefined,
      });

      if (!res.success) {
        throw new Error(res.error || "Failed to receive payment");
      }

      setStatusMessage({
        type: "success",
        text: `Received ₹${(amountPaise / 100).toFixed(2)} on #${collectingInvoice.number}. Voucher: ${res.receiptNo}`,
      });
      setCollectingInvoice(null);
    } catch (err: any) {
      alert(err.message || "Failed to record payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Hero Header */}
      <div className="bg-[#12355B] text-white p-5 rounded-3xl shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">Financial Hub</div>
            <h2 className="text-2xl font-black mt-0.5">JMD Accounts</h2>
          </div>
          <Link
            href="/admin/crud/receipts"
            className="px-4 py-2 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
          >
            <FileText className="w-4 h-4" />
            <span>Receipts</span>
          </Link>
        </div>

        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
          <span className="text-white/70">Total Pending Bills ({pendingInvoices.length}):</span>
          <span className="font-mono font-black text-amber-300 text-base">
            ₹{(totalOutstandingPaise / 100).toFixed(2)}
          </span>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs ${
            statusMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button type="button" onClick={() => setStatusMessage(null)}>✕</button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by customer name, phone, or invoice #..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#12355B]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] font-bold">
          {["ALL", "SHOP", "VAN", "ONLINE"].map((ch) => (
            <button
              key={ch}
              type="button"
              onClick={() => setSelectedChannel(ch)}
              className={`px-3 py-1 rounded-full border transition-colors ${
                selectedChannel === ch
                  ? "bg-[#12355B] text-white border-[#12355B]"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {ch === "ALL" ? "All Channels" : ch}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices List */}
      <div className="space-y-2.5">
        {filtered.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-400">
            No pending invoices found matching criteria.
          </div>
        ) : (
          filtered.map((inv) => (
            <div
              key={inv.id}
              className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between gap-3 hover:border-slate-300 transition-colors"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-xs text-[#12355B]">{inv.number}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-slate-100 text-slate-600">
                    {inv.channel}
                  </span>
                </div>
                <div className="font-bold text-xs text-slate-900 truncate mt-0.5">
                  {inv.customerName}
                </div>
                {inv.customerPhone && (
                  <div className="text-[10px] text-slate-500 font-mono">📱 {inv.customerPhone}</div>
                )}
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {new Date(inv.createdAt).toLocaleDateString("en-IN")}
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <div className="text-right">
                  <div className="font-mono font-black text-sm text-amber-700">
                    ₹{(inv.pendingPaise / 100).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    of ₹{(inv.totalPaise / 100).toFixed(2)}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openCollectModal(inv)}
                  className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
                >
                  Collect
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Collect Modal */}
      {collectingInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-black text-sm text-slate-900">Receive Payment</h3>
                <p className="text-[11px] text-slate-500 font-mono">Bill #{collectingInvoice.number}</p>
              </div>
              <button
                type="button"
                onClick={() => setCollectingInvoice(null)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCollectSubmit} className="space-y-3">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="font-bold text-slate-800">{collectingInvoice.customerName}</div>
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Pending Amount:</span>
                  <span className="font-mono font-bold text-amber-700">
                    ₹{(collectingInvoice.pendingPaise / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700">Amount to Settle (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={collectAmountRupees}
                  onChange={(e) => setCollectAmountRupees(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl font-mono font-bold text-sm"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700">Payment Mode</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setCollectMode("CASH")}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 ${
                      collectMode === "CASH"
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-slate-50 text-slate-700"
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" /> Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollectMode("UPI")}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 ${
                      collectMode === "UPI"
                        ? "bg-sky-600 text-white border-sky-600"
                        : "bg-slate-50 text-slate-700"
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" /> UPI
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700">Reference / UTR (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. UTR12345678"
                  value={collectRef}
                  onChange={(e) => setCollectRef(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-xs"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setCollectingInvoice(null)}
                  className="flex-1 py-2 text-xs font-bold bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 text-xs font-bold bg-[#12355B] text-white rounded-xl disabled:opacity-40"
                >
                  {isSubmitting ? "Processing..." : "Confirm & Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
