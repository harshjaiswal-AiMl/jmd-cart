"use client";

import React, { useState, useMemo } from "react";
import { X, History, User, RotateCcw, GitBranch, Search, Check } from "lucide-react";
import { formatDmy } from "@/lib/datetime";

interface RevisionItem {
  id: string;
  revisionNumber: number;
  reason: string;
  createdAt: string | Date;
  editor?: {
    id: string;
    name: string | null;
    role: string;
  } | null;
  beforeSnapshot?: any;
  afterSnapshot?: any;
}

interface PartyOption {
  id: string;
  name: string;
  type?: string;
  phone?: string | null;
}

interface RevisionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceNumber: string;
  revisions: RevisionItem[];
  onReverseRevision?: (revisionId: string, revisionNumber: number, target?: "before" | "after") => Promise<void>;
  parties?: PartyOption[];
  locationId?: string;
  onSplitRevision?: (
    revisionId: string,
    targetPartyId: string | null,
    targetCustomerName: string | undefined
  ) => Promise<{ success: boolean; newInvoiceId?: string; newInvoiceNumber?: string; error?: string }>;
}

export function RevisionHistoryModal({
  isOpen,
  onClose,
  invoiceNumber,
  revisions,
  onReverseRevision,
  parties = [],
  locationId,
  onSplitRevision,
}: RevisionHistoryModalProps) {
  const [revertingId, setRevertingId] = useState<string | null>(null);

  // Split state
  const [splitRevisionId, setSplitRevisionId] = useState<string | null>(null);
  const [splitSearch, setSplitSearch] = useState("");
  const [splitPartyId, setSplitPartyId] = useState<string | null>(null);
  const [splitPartyName, setSplitPartyName] = useState<string>("");
  const [isSplitting, setIsSplitting] = useState(false);
  const [splitError, setSplitError] = useState<string | null>(null);
  const [splitSuccess, setSplitSuccess] = useState<{ number: string; id: string } | null>(null);

  const filteredParties = useMemo(() => {
    if (!splitSearch.trim()) return parties.slice(0, 15);
    const q = splitSearch.toLowerCase();
    return parties.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.phone ?? "").includes(q)
    ).slice(0, 15);
  }, [parties, splitSearch]);

  if (!isOpen) return null;

  const openSplit = (revId: string) => {
    setSplitRevisionId(revId);
    setSplitSearch("");
    setSplitPartyId(null);
    setSplitPartyName("");
    setSplitError(null);
    setSplitSuccess(null);
  };
  const closeSplit = () => setSplitRevisionId(null);

  const handleSplitConfirm = async () => {
    if (!splitRevisionId || !onSplitRevision) return;
    setIsSplitting(true);
    setSplitError(null);
    try {
      const res = await onSplitRevision(
        splitRevisionId,
        splitPartyId,
        splitPartyId ? undefined : (splitPartyName.trim() || undefined)
      );
      if (!res.success) {
        setSplitError(res.error || "Failed to split");
      } else {
        setSplitSuccess({ number: res.newInvoiceNumber!, id: res.newInvoiceId! });
      }
    } finally {
      setIsSplitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden font-sans">
        {/* Header */}
        <div className="bg-[#0f172a] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-purple-400" />
            <h3 className="font-bold text-sm tracking-tight">
              Revision History &mdash; {invoiceNumber}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-5 overflow-y-auto space-y-4">
          {revisions.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No previous revisions recorded for this invoice yet.
            </div>
          ) : (
            revisions.map((rev) => (
              <div
                key={rev.id}
                className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold bg-purple-100 text-purple-900 px-2 py-0.5 rounded text-[11px]">
                    Revision #{rev.revisionNumber}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {formatDmy(rev.createdAt)}
                  </span>
                </div>

                <div className="text-slate-800 font-semibold flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Edited by: {rev.editor?.name || "Staff"} ({rev.editor?.role || "Staff"})
                  </span>
                </div>

                <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                  <span className="font-bold text-slate-600 block text-[10px] uppercase">
                    Reason:
                  </span>
                  <p className="text-slate-800 font-medium mt-0.5">{rev.reason}</p>
                </div>

                {rev.beforeSnapshot?.invoice && rev.afterSnapshot?.invoice && (
                  <div className="flex flex-col gap-2 text-[11px] pt-2 border-t border-slate-200 font-mono">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-4">
                        <div>
                          <span className="text-slate-500">Before Total:</span>{" "}
                          <strong>
                            ₹{(rev.beforeSnapshot.invoice.totalPaise / 100).toFixed(2)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500">After Total:</span>{" "}
                          <strong className="text-purple-700">
                            ₹{(rev.afterSnapshot.invoice.totalPaise / 100).toFixed(2)}
                          </strong>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 font-sans flex-wrap">
                        {/* Reverse button */}
                        {onReverseRevision &&
                          Array.isArray(rev.beforeSnapshot?.items) &&
                          rev.beforeSnapshot.items.length > 0 && (
                            <button
                              type="button"
                              disabled={revertingId !== null || isSplitting}
                              onClick={async () => {
                                if (
                                  !window.confirm(
                                    `Reverse Revision #${rev.revisionNumber} and restore bill to ₹${(rev.beforeSnapshot.invoice.totalPaise / 100).toFixed(2)}?`
                                  )
                                )
                                  return;
                                setRevertingId(rev.id + ":before");
                                try {
                                  await onReverseRevision(rev.id, rev.revisionNumber, "before");
                                } finally {
                                  setRevertingId(null);
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-[11px] font-bold transition shadow-2xs cursor-pointer"
                              data-testid={`reverse-revision-${rev.revisionNumber}`}
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>
                                {revertingId === rev.id + ":before"
                                  ? "Reversing..."
                                  : `Reverse (Restore ₹${(rev.beforeSnapshot.invoice.totalPaise / 100).toFixed(2)})`}
                              </span>
                            </button>
                          )}

                        {/* Split → New Bill button */}
                        {onSplitRevision &&
                          Array.isArray(rev.beforeSnapshot?.items) &&
                          rev.beforeSnapshot.items.length > 0 && (
                            <button
                              type="button"
                              disabled={revertingId !== null || isSplitting}
                              onClick={() => openSplit(rev.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[11px] font-bold transition shadow-2xs cursor-pointer"
                              data-testid={`split-revision-${rev.revisionNumber}`}
                            >
                              <GitBranch className="w-3 h-3" />
                              <span>Split → New Bill</span>
                            </button>
                          )}
                      </div>
                    </div>

                    {/* Split inline panel */}
                    {splitRevisionId === rev.id && (
                      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2 font-sans">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-blue-800 text-[11px] flex items-center gap-1">
                            <GitBranch className="w-3.5 h-3.5" />
                            Split Revision #{rev.revisionNumber} → New Invoice
                          </span>
                          <button
                            type="button"
                            onClick={closeSplit}
                            className="text-blue-400 hover:text-blue-700"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {splitSuccess ? (
                          <div className="p-2.5 bg-green-50 border border-green-200 rounded-lg text-center space-y-2">
                            <div className="flex items-center justify-center gap-1 text-green-700 font-bold text-xs">
                              <Check className="w-4 h-4" />
                              New invoice created: <span className="font-mono">{splitSuccess.number}</span>
                            </div>
                            <div className="flex items-center justify-center gap-2">
                              <a
                                href={`/shop/pos?edit=${splitSuccess.id}`}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold"
                              >
                                Open in POS
                              </a>
                              <a
                                href={`/shop/invoices/${splitSuccess.id}/print`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[11px] font-bold"
                              >
                                Print
                              </a>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-[10px] text-blue-700">
                              Select a party for the new invoice (or leave blank for walk-in):
                            </p>

                            {/* Party search */}
                            <div className="relative">
                              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                              <input
                                type="text"
                                value={splitSearch}
                                onChange={(e) => {
                                  setSplitSearch(e.target.value);
                                  setSplitPartyId(null);
                                  setSplitPartyName(e.target.value);
                                }}
                                placeholder="Search party name / phone…"
                                className="w-full pl-7 pr-3 py-1.5 border border-blue-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                              />
                            </div>

                            {splitSearch.trim() && filteredParties.length > 0 && !splitPartyId && (
                              <div className="bg-white border border-slate-200 rounded-lg max-h-32 overflow-y-auto divide-y divide-slate-100">
                                {filteredParties.map((p) => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => {
                                      setSplitPartyId(p.id);
                                      setSplitPartyName(p.name);
                                      setSplitSearch(p.name);
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 flex items-center justify-between gap-2"
                                  >
                                    <span className="font-medium text-slate-800">{p.name}</span>
                                    {p.phone && (
                                      <span className="text-slate-400 font-mono text-[10px]">{p.phone}</span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}

                            {splitPartyId && (
                              <div className="text-[11px] text-blue-700 font-medium flex items-center gap-1">
                                <Check className="w-3 h-3 text-green-600" />
                                Party: <span className="font-bold">{splitPartyName}</span>
                              </div>
                            )}

                            {splitError && (
                              <p className="text-[11px] text-red-600 font-medium">{splitError}</p>
                            )}

                            <div className="flex items-center gap-2 justify-end">
                              <button
                                type="button"
                                onClick={closeSplit}
                                className="px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={isSplitting}
                                onClick={handleSplitConfirm}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[11px] font-bold rounded-lg transition"
                              >
                                <GitBranch className="w-3 h-3" />
                                {isSplitting ? "Creating…" : "Create New Invoice"}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl transition"
          >
            Close [Esc]
          </button>
        </div>
      </div>
    </div>
  );
}
