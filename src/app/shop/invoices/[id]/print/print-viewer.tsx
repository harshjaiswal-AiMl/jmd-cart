"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { InvoiceWithDetails } from "@/modules/billing/billing.types";
import { BusinessDetails } from "@/modules/settings/settings.types";
import { A4Invoice } from "@/components/printing/a4-invoice";
import { ThermalReceipt } from "@/components/printing/thermal-receipt";
import { CashReceiptSlip } from "@/components/printing/cash-receipt-slip";
import { DemandBillCredit } from "@/components/printing/demand-bill-credit";

export type PrintFormat = "cash_receipt" | "demand_bill" | "a4" | "thermal";

interface PrintViewerProps {
  invoice: InvoiceWithDetails;
  business: BusinessDetails;
  initialFormat?: PrintFormat;
  autoPrint?: boolean;
}

export function PrintViewer({
  invoice,
  business,
  initialFormat = "cash_receipt",
  autoPrint = false,
}: PrintViewerProps) {
  const [format, setFormat] = useState<PrintFormat>(initialFormat);
  const [copyTitle, setCopyTitle] = useState("Original for Recipient");

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
            href="/shop/invoices"
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 transition"
          >
            ← Invoices
          </Link>
          <Link
            href="/shop/pos"
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition"
          >
            + New Sale (POS)
          </Link>
          <span className="text-sm font-bold text-slate-800 ml-2">
            Invoice: <span className="font-mono">{invoice.number}</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Format Switcher */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-300 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFormat("cash_receipt")}
              className={`px-3 py-1.5 rounded-md transition flex items-center gap-1 ${
                format === "cash_receipt"
                  ? "bg-white text-emerald-800 shadow-sm font-bold border border-emerald-500/30"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Image 1 Cash & UPI Bill (Without GST)"
            >
              <span>💵 Cash / UPI</span>
            </button>
            <button
              type="button"
              onClick={() => setFormat("demand_bill")}
              className={`px-3 py-1.5 rounded-md transition flex items-center gap-1 ${
                format === "demand_bill"
                  ? "bg-white text-purple-800 shadow-sm font-bold border border-purple-500/30"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Image 2 Demand Bill with DUES Stamp (Without GST)"
            >
              <span>📋 Demand Bill (DUES)</span>
            </button>
            <button
              type="button"
              onClick={() => setFormat("a4")}
              className={`px-3 py-1.5 rounded-md transition ${
                format === "a4"
                  ? "bg-white text-slate-900 shadow-sm font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              GST A4
            </button>
            <button
              type="button"
              onClick={() => setFormat("thermal")}
              className={`px-3 py-1.5 rounded-md transition ${
                format === "thermal"
                  ? "bg-white text-slate-900 shadow-sm font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              GST Thermal
            </button>
          </div>

          {/* Copy Title for A4 */}
          {format === "a4" && (
            <select
              value={copyTitle}
              onChange={(e) => setCopyTitle(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white text-slate-700"
            >
              <option value="Original for Recipient">Original for Recipient</option>
              <option value="Duplicate for Transporter">Duplicate for Transporter</option>
              <option value="Triplicate for Supplier">Triplicate for Supplier</option>
            </select>
          )}

          {/* Print Button */}
          <button
            type="button"
            onClick={() => window.print()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 transition"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            Print (Ctrl+P)
          </button>
        </div>
      </div>

      {/* Render Selected Document */}
      <div className="flex justify-center print:block">
        {format === "cash_receipt" && (
          <CashReceiptSlip invoice={invoice} business={business} />
        )}
        {format === "demand_bill" && (
          <DemandBillCredit invoice={invoice} business={business} />
        )}
        {format === "a4" && (
          <A4Invoice
            invoice={invoice}
            business={business}
            copyTitle={copyTitle}
          />
        )}
        {format === "thermal" && (
          <ThermalReceipt invoice={invoice} business={business} />
        )}
      </div>
    </div>
  );
}
