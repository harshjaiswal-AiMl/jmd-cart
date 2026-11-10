"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { InvoiceWithDetails } from "@/modules/billing/billing.types";
import { BusinessDetails } from "@/modules/settings/settings.types";
import { A4Invoice } from "@/components/printing/a4-invoice";
import { A5Invoice } from "@/components/printing/a5-invoice";
import { ThermalReceipt } from "@/components/printing/thermal-receipt";
import { CashReceiptSlip } from "@/components/printing/cash-receipt-slip";
import { DemandBillCredit } from "@/components/printing/demand-bill-credit";
import { ChevronDown } from "lucide-react";

export type PrintFormat = "cash_receipt" | "demand_bill" | "a4" | "thermal" | "a5";

export interface PrintViewerProps {
  invoice: InvoiceWithDetails;
  business: BusinessDetails;
  initialFormat?: PrintFormat;
  autoPrint?: boolean;
  isAdmin?: boolean;
  isGstBill?: boolean;
  isCredit?: boolean;
}

export function PrintViewer({
  invoice,
  business,
  initialFormat = "cash_receipt",
  autoPrint = false,
  isAdmin = false,
  isGstBill = false,
  isCredit = false,
}: PrintViewerProps) {
  const router = useRouter();
  const [format, setFormat] = useState<PrintFormat>(initialFormat);
  const [copyTitle, setCopyTitle] = useState("Original for Recipient");
  const [otherFormatsOpen, setOtherFormatsOpen] = useState(false);

  // Esc key: Return directly to New Sale (POS)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        router.replace("/shop/pos");
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [router]);

  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => {
        if (typeof document !== "undefined" && document.fonts?.ready) {
          document.fonts.ready.then(() => window.print());
        } else {
          window.print();
        }
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 print:p-0 print:bg-white">
      {/* Top Controls Toolbar (Hidden on Print) */}
      <div className="no-print max-w-4xl mx-auto mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4 font-sans">
        <div className="flex items-center gap-3">
          <Link
            href="/shop/invoices"
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 transition"
          >
            ← Invoices
          </Link>
          <Link
            href="/shop/pos"
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition flex items-center gap-1.5"
          >
            <span>+ New Sale (POS)</span>
            <kbd className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px] font-mono font-bold">Esc</kbd>
          </Link>
          <span className="text-sm font-bold text-slate-800 ml-2">
            Invoice: <span className="font-mono text-blue-900">{invoice.number}</span>
            {isGstBill && (
              <span className="ml-2 text-[10px] font-black uppercase px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded border border-purple-300">
                GST Tax Invoice
              </span>
            )}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Format Switcher based on Prompt #17 rules */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-300 text-xs font-semibold">
            {isGstBill ? (
              // GST Bill formats: only GST A4 and GST Thermal
              <>
                <button
                  type="button"
                  onClick={() => setFormat("a4")}
                  className={`px-3 py-1.5 rounded-md transition flex items-center gap-1 ${
                    format === "a4"
                      ? "bg-white text-purple-900 shadow-sm font-bold border border-purple-400"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="GST A4 Tax Invoice"
                >
                  <span>📄 GST A4</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormat("thermal")}
                  className={`px-3 py-1.5 rounded-md transition flex items-center gap-1 ${
                    format === "thermal"
                      ? "bg-white text-purple-900 shadow-sm font-bold border border-purple-400"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="GST Thermal Receipt"
                >
                  <span>🧾 GST Thermal</span>
                </button>
              </>
            ) : isCredit ? (
              // Credit Retail sale: both Demand Bill and Thermal (80mm)
              <>
                <button
                  type="button"
                  onClick={() => setFormat("demand_bill")}
                  className={`px-3 py-1.5 rounded-md transition flex items-center gap-1 ${
                    format === "demand_bill"
                      ? "bg-white text-purple-900 shadow-sm font-bold border border-purple-400"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Thermal Bill format (80mm)"
                >
                  <span>📋 Demand Bill</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormat("cash_receipt")}
                  className={`px-3 py-1.5 rounded-md transition flex items-center gap-1 ${
                    format === "cash_receipt"
                      ? "bg-white text-emerald-800 shadow-sm font-bold border border-emerald-500/30"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Compact 80mm Thermal Receipt Slip"
                >
                  <span>🧾 Thermal (80mm)</span>
                </button>
              </>
            ) : (
              // Cash / UPI Retail sale:
              <>
                <button
                  type="button"
                  onClick={() => setFormat("cash_receipt")}
                  className={`px-3 py-1.5 rounded-md transition flex items-center gap-1 ${
                    format === "cash_receipt"
                      ? "bg-white text-emerald-800 shadow-sm font-bold border border-emerald-500/30"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Thermal Cash & UPI Slip (80mm)"
                >
                  <span>💵 Thermal (80mm)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormat("demand_bill")}
                  className={`px-3 py-1.5 rounded-md transition flex items-center gap-1 ${
                    format === "demand_bill"
                      ? "bg-white text-purple-900 shadow-sm font-bold border border-purple-400"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Demand Bill format"
                >
                  <span>📋 Demand Bill</span>
                </button>
              </>
            )}
          </div>

          {/* Admin-only "Other formats" menu (Prompt #17 Part E) */}
          {isAdmin && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setOtherFormatsOpen((prev) => !prev)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 flex items-center gap-1 shadow-2xs"
                title="Admin format overrides"
              >
                <span>Other Formats</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>

              {otherFormatsOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1 text-xs divide-y divide-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setFormat("cash_receipt");
                      setOtherFormatsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between ${
                      format === "cash_receipt" ? "font-bold text-emerald-700 bg-emerald-50" : "text-slate-700"
                    }`}
                  >
                    <span>💵 Thermal (80mm)</span>
                    {format === "cash_receipt" && <span>✓</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormat("demand_bill");
                      setOtherFormatsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between ${
                      format === "demand_bill" ? "font-bold text-purple-700 bg-purple-50" : "text-slate-700"
                    }`}
                  >
                    <span>📋 Demand Bill (Credit)</span>
                    {format === "demand_bill" && <span>✓</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormat("a5");
                      setOtherFormatsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between ${
                      format === "a5" ? "font-bold text-rose-700 bg-rose-50" : "text-slate-700"
                    }`}
                  >
                    <span>📄 A5 Invoice</span>
                    {format === "a5" && <span>✓</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormat("a4");
                      setOtherFormatsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between ${
                      format === "a4" ? "font-bold text-blue-700 bg-blue-50" : "text-slate-700"
                    }`}
                  >
                    <span>📄 GST A4 Tax Invoice</span>
                    {format === "a4" && <span>✓</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormat("thermal");
                      setOtherFormatsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between ${
                      format === "thermal" ? "font-bold text-purple-700 bg-purple-50" : "text-slate-700"
                    }`}
                  >
                    <span>🧾 GST Thermal Receipt</span>
                    {format === "thermal" && <span>✓</span>}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Copy Title for A4 */}
          {format === "a4" && (
            <select
              value={copyTitle}
              onChange={(e) => setCopyTitle(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white text-slate-700"
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
            className="bg-[#12355B] hover:bg-[#0E2843] text-white font-bold text-xs px-4 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 transition active:scale-95"
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
            Print / PDF (Ctrl+P)
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
        {format === "a5" && (
          <A5Invoice invoice={invoice} business={business} />
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
