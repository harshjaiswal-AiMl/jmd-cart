"use client";

import React, { useState } from "react";
import { X, History, User, RotateCcw } from "lucide-react";
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

interface RevisionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceNumber: string;
  revisions: RevisionItem[];
  onReverseRevision?: (revisionId: string, revisionNumber: number, target?: "before" | "after") => Promise<void>;
}

export function RevisionHistoryModal({
  isOpen,
  onClose,
  invoiceNumber,
  revisions,
  onReverseRevision,
}: RevisionHistoryModalProps) {
  const [revertingId, setRevertingId] = useState<string | null>(null);
  if (!isOpen) return null;

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
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-2 border-t border-slate-200 font-mono">
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
                    {onReverseRevision && Array.isArray(rev.beforeSnapshot?.items) && rev.beforeSnapshot.items.length > 0 && (
                      <div className="flex items-center gap-1.5 font-sans">
                        <button
                          type="button"
                          disabled={revertingId !== null}
                          onClick={async () => {
                            if (!window.confirm(`Reverse Revision #${rev.revisionNumber} and restore bill to ₹${(rev.beforeSnapshot.invoice.totalPaise / 100).toFixed(2)}?`)) return;
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
