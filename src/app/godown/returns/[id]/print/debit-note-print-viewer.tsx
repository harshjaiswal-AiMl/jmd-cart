"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { DebitNoteWithDetails } from "@/modules/returns/returns.types";
import { BusinessDetails } from "@/modules/settings/settings.types";
import { A4DebitNote } from "@/components/printing/a4-debit-note";
import { Printer, ArrowLeft } from "lucide-react";

interface Props {
  debitNote: DebitNoteWithDetails;
  business: BusinessDetails;
  autoPrint?: boolean;
}

export function DebitNotePrintViewer({
  debitNote,
  business,
  autoPrint = false,
}: Props) {
  const [copyTitle, setCopyTitle] = useState("Original for Supplier");

  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 print:p-0 print:bg-white">
      {/* Top Controls Toolbar (Hidden on Print) */}
      <div className="no-print max-w-4xl mx-auto mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/godown/returns/${debitNote.id}`}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 transition inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Return Details
          </Link>
          <span className="text-sm font-bold text-slate-800 ml-2">
            Debit Note: <span className="font-mono text-emerald-700">{debitNote.number}</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Copy Title Selector */}
          <select
            value={copyTitle}
            onChange={(e) => setCopyTitle(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none"
          >
            <option value="Original for Supplier">Original for Supplier</option>
            <option value="Duplicate for Transporter">Duplicate for Transporter</option>
            <option value="Office Copy (Accounts)">Office Copy (Accounts)</option>
            <option value="Godown Audit Copy">Godown Audit Copy</option>
          </select>

          {/* Print Button */}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
        </div>
      </div>

      {/* Printable Area */}
      <div className="max-w-[210mm] mx-auto shadow-lg print:shadow-none bg-white">
        <A4DebitNote
          debitNote={debitNote}
          business={business}
          copyTitle={copyTitle}
        />
      </div>
    </div>
  );
}
