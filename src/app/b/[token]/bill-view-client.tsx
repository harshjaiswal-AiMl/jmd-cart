"useinit";
"use client";

import React, { useRef } from "react";
import { CustomerInvoiceViewModel } from "@/modules/messaging/bill-token.service";

interface BillViewClientProps {
  bill: CustomerInvoiceViewModel;
}

export function BillViewClient({ bill }: BillViewClientProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const formatPaise = (paise: number) => {
    return (paise / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const isGst = bill.documentType === "TAX_INVOICE" || (bill.partyGstin && bill.partyGstin.length > 5);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-3 sm:p-6 print:p-0 print:bg-white flex flex-col items-center">
      {/* Top Header / Actions Bar (Hidden when printing) */}
      <div className="w-full max-w-2xl flex items-center justify-between bg-white px-4 py-3 rounded-lg shadow-sm mb-4 print:hidden border border-slate-200">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
            JMD
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-900 leading-tight">JMD Cart Customer Bill</h1>
            <p className="text-xs text-slate-500 font-mono">{bill.invoiceNumber}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold shadow flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Bill Card */}
      <div
        ref={printRef}
        className="w-full max-w-2xl bg-white rounded-xl shadow-md border border-slate-200 p-5 sm:p-8 print:shadow-none print:border-none print:p-0"
      >
        {/* Business Header */}
        <div className="text-center border-b border-slate-200 pb-4 mb-4">
          <h2 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
            {bill.businessDetails.name || "JMD Cart"}
          </h2>
          <p className="text-xs text-slate-600 font-medium">{bill.businessDetails.legalName}</p>
          <p className="text-xs text-slate-500 mt-0.5">{bill.businessDetails.address}</p>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-slate-600 mt-1.5 font-mono">
            {bill.businessDetails.gstin && <span>GSTIN: <strong>{bill.businessDetails.gstin}</strong></span>}
            {bill.businessDetails.fssai && <span>FSSAI: <strong>{bill.businessDetails.fssai}</strong></span>}
            {bill.businessDetails.phone && <span>Helpline: <strong>{bill.businessDetails.phone}</strong></span>}
          </div>
          <div className="inline-block mt-2 px-3 py-0.5 bg-slate-100 rounded-full text-xs font-semibold text-slate-700 tracking-wider uppercase">
            {isGst ? "Tax Invoice (GST)" : "Retail Cash Memo / Bill of Supply"}
          </div>
        </div>

        {/* Invoice & Customer Meta Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs border-b border-slate-200 pb-4 mb-4">
          <div className="space-y-1">
            <div>
              <span className="text-slate-400">Bill No: </span>
              <strong className="font-mono text-slate-900 text-sm">{bill.invoiceNumber}</strong>
            </div>
            <div>
              <span className="text-slate-400">Date: </span>
              <span className="text-slate-700">
                {new Date(bill.invoiceDate).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Status: </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                  bill.paymentStatus === "PAID"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {bill.paymentStatus}
              </span>
            </div>
          </div>

          <div className="text-right space-y-1">
            <div>
              <span className="text-slate-400">Billed To: </span>
              <strong className="text-slate-900">{bill.customerName}</strong>
            </div>
            {bill.customerPhone && (
              <div>
                <span className="text-slate-400">Mobile: </span>
                <span className="text-slate-700 font-mono">{bill.customerPhone}</span>
              </div>
            )}
            {bill.partyGstin && (
              <div>
                <span className="text-slate-400">GSTIN: </span>
                <span className="font-mono text-slate-900 font-medium">{bill.partyGstin}</span>
              </div>
            )}
            {bill.customerAddress && (
              <div className="text-slate-500 text-[11px] truncate max-w-xs ml-auto">
                {bill.customerAddress}
              </div>
            )}
          </div>
        </div>

        {/* Items Table */}
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 bg-slate-50 print:bg-transparent">
                <th className="py-2 px-1 text-center w-8">#</th>
                <th className="py-2 px-2">Item Description</th>
                <th className="py-2 px-2 text-right">Qty</th>
                <th className="py-2 px-2 text-right">MRP</th>
                <th className="py-2 px-2 text-right">Rate</th>
                <th className="py-2 px-2 text-right font-semibold text-slate-700">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bill.items.map((item, idx) => (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-1 text-center text-slate-400 font-mono">{idx + 1}</td>
                  <td className="py-2.5 px-2">
                    <div className="font-medium text-slate-800">{item.productName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {item.shortCode && <span>[{item.shortCode}] </span>}
                      {item.hsn && <span>HSN: {item.hsn} • </span>}
                      <span>GST: {item.gstRate}%</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-slate-700">
                    {item.qty} {item.unit || "PCS"}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-slate-500">
                    ₹{formatPaise(item.mrpPaise)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-slate-700">
                    ₹{formatPaise(item.ratePaise)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono font-semibold text-slate-900">
                    ₹{formatPaise(item.amountPaise)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Breakdown */}
        <div className="border-t border-slate-200 pt-3 flex flex-col items-end text-xs space-y-1">
          <div className="w-64 flex justify-between text-slate-600">
            <span>Subtotal:</span>
            <span className="font-mono">₹{formatPaise(bill.subtotalPaise)}</span>
          </div>

          {bill.discountPaise > 0 && (
            <div className="w-64 flex justify-between text-emerald-600 font-medium">
              <span>Savings / Discount:</span>
              <span className="font-mono">- ₹{formatPaise(bill.discountPaise)}</span>
            </div>
          )}

          {isGst && (
            <>
              <div className="w-64 flex justify-between text-slate-500 text-[11px]">
                <span>Taxable Value:</span>
                <span className="font-mono">₹{formatPaise(bill.taxablePaise)}</span>
              </div>
              {bill.cgstPaise > 0 && (
                <div className="w-64 flex justify-between text-slate-500 text-[11px]">
                  <span>CGST:</span>
                  <span className="font-mono">₹{formatPaise(bill.cgstPaise)}</span>
                </div>
              )}
              {bill.sgstPaise > 0 && (
                <div className="w-64 flex justify-between text-slate-500 text-[11px]">
                  <span>SGST:</span>
                  <span className="font-mono">₹{formatPaise(bill.sgstPaise)}</span>
                </div>
              )}
            </>
          )}

          {bill.roundOffPaise !== 0 && (
            <div className="w-64 flex justify-between text-slate-400 text-[11px]">
              <span>Round Off:</span>
              <span className="font-mono">
                {bill.roundOffPaise > 0 ? "+" : ""}
                ₹{formatPaise(bill.roundOffPaise)}
              </span>
            </div>
          )}

          <div className="w-64 border-t-2 border-slate-800 pt-2 mt-1 flex justify-between text-sm font-bold text-slate-900">
            <span>Grand Total:</span>
            <span className="font-mono text-base text-emerald-700">₹{formatPaise(bill.totalPaise)}</span>
          </div>
        </div>

        {/* Payments Tendered */}
        {bill.payments && bill.payments.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-200 text-xs">
            <span className="font-semibold text-slate-700">Payments Recorded:</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {bill.payments.map((p, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50 border border-slate-200 px-2.5 py-1 rounded text-slate-700 flex items-center gap-1.5"
                >
                  <span className="font-medium">{p.mode}:</span>
                  <span className="font-mono font-semibold">₹{formatPaise(p.amountPaise)}</span>
                  {p.reference && <span className="text-[10px] text-slate-400 font-mono">({p.reference})</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Note */}
        <div className="text-center border-t border-slate-200 mt-6 pt-4 text-[11px] text-slate-500 space-y-1">
          <p className="font-medium text-slate-700">Bharosa Ghar Tak • Thank you for shopping with JMD Cart!</p>
          <p className="text-[10px] text-slate-400">
            This is a computer-generated tax document. For inquiries or support, contact {bill.businessDetails.phone || "us"}.
          </p>
        </div>
      </div>
    </div>
  );
}
