"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { InvoiceWithDetails } from "@/modules/billing/billing.types";
import { BusinessDetails } from "@/modules/settings/settings.types";
import { A4Invoice } from "@/components/printing/a4-invoice";
import { ThermalReceipt } from "@/components/printing/thermal-receipt";
import { Printer, ArrowLeft, Download } from "lucide-react";

interface BuyerInvoiceViewerProps {
  orderId: string;
  orderNumber: string;
  invoice: InvoiceWithDetails;
  business: BusinessDetails;
  initialFormat?: "a4" | "thermal";
  autoPrint?: boolean;
}

export function BuyerInvoiceViewer({
  orderId,
  orderNumber,
  invoice,
  business,
  initialFormat = "a4",
  autoPrint = false,
}: BuyerInvoiceViewerProps) {
  const [format, setFormat] = useState<"a4" | "thermal">(initialFormat);
  const [copyTitle, setCopyTitle] = useState("Original for Recipient");

  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 print:p-0 print:bg-white font-sans">
      {/* Top Controls Toolbar (Hidden during browser printing) */}
      <div className="no-print max-w-4xl mx-auto mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/store/orders/${orderId}`}
            className="text-xs font-semibold text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 transition flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Tracking</span>
          </Link>
          <span className="text-sm font-bold text-slate-900">
            Order: <span className="font-mono text-blue-600">#{orderNumber}</span> • Tax Invoice:{" "}
            <span className="font-mono font-bold text-emerald-700">{invoice.number}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Format Switcher */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-300 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFormat("a4")}
              className={`px-3 py-1 rounded-md transition ${
                format === "a4"
                  ? "bg-white text-slate-900 shadow-sm font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              A4 Invoice
            </button>
            <button
              type="button"
              onClick={() => setFormat("thermal")}
              className={`px-3 py-1 rounded-md transition ${
                format === "thermal"
                  ? "bg-white text-slate-900 shadow-sm font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              80mm Thermal
            </button>
          </div>

          {/* Copy Title for A4 */}
          {format === "a4" && (
            <select
              value={copyTitle}
              onChange={(e) => setCopyTitle(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 font-medium"
            >
              <option value="Original for Recipient">Original for Recipient</option>
              <option value="Customer Duplicate Copy">Customer Duplicate Copy</option>
            </select>
          )}

          {/* Print / Save PDF Button */}
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>

      {/* Printable Paper Canvas */}
      <div className="flex justify-center">
        {format === "a4" ? (
          <div className="bg-white shadow-lg print:shadow-none w-full max-w-[210mm] border border-slate-200 print:border-none p-6">
            <A4Invoice
              invoice={invoice}
              business={business}
              copyTitle={copyTitle}
            />
          </div>
        ) : (
          <div className="bg-white shadow-lg print:shadow-none w-full max-w-[80mm] border border-slate-200 print:border-none p-2">
            <ThermalReceipt invoice={invoice} business={business} />
          </div>
        )}
      </div>
    </div>
  );
}
