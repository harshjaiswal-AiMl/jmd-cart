"use client";

import React, { useState } from "react";
import Link from "next/link";
import { InvoiceWithDetails } from "@/modules/billing/billing.types";
import { formatISTDate, formatISTDateTime } from "@/lib/date";
import { cancelInvoiceAction } from "../actions";

interface InvoiceDetailClientProps {
  invoice: InvoiceWithDetails;
  canCancel: boolean;
}

export function InvoiceDetailClient({
  invoice,
  canCancel,
}: InvoiceDetailClientProps) {
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setCancelling(true);

    try {
      const res = await cancelInvoiceAction(invoice.id, cancelReason);
      if (!res.success) {
        setErrorMsg(res.error || "Failed to cancel invoice");
      } else {
        setShowCancelModal(false);
        window.location.reload();
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Cancellation failed");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/shop/invoices"
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 transition"
          >
            ← Back to Invoices
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-mono text-slate-900">
                {invoice.number}
              </h1>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                  invoice.status === "FINAL"
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : invoice.status === "CANCELLED"
                    ? "bg-red-100 text-red-800 border border-red-300"
                    : "bg-slate-100 text-slate-700 border border-slate-300"
                }`}
              >
                {invoice.status}
              </span>
              {invoice.isRevised && (
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase bg-purple-100 text-purple-900 border border-purple-300">
                  Revised (Rev {invoice.version})
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Created on {formatISTDateTime(invoice.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {invoice.status !== "CANCELLED" && (
            <Link
              href={`/shop/invoices/${invoice.id}/edit`}
              className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg shadow-sm flex items-center gap-1.5 transition"
            >
              ✏️ Edit Invoice
            </Link>
          )}
          <Link
            href={`/shop/invoices/${invoice.id}/print?format=cash_receipt`}
            target="_blank"
            className="text-xs font-bold bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-300 px-3.5 py-2 rounded-lg shadow-sm flex items-center gap-1.5 transition"
          >
            💵 Cash / UPI Bill
          </Link>

          <Link
            href={`/shop/invoices/${invoice.id}/print?format=a5`}
            target="_blank"
            className="text-xs font-bold bg-white text-rose-800 hover:bg-rose-50 border border-rose-300 px-3.5 py-2 rounded-lg shadow-sm flex items-center gap-1.5 transition"
          >
            📄 A5 Invoice
          </Link>

          <Link
            href={`/shop/invoices/${invoice.id}/print?format=demand_bill`}
            target="_blank"
            className="text-xs font-bold bg-white text-purple-700 hover:bg-purple-50 border border-purple-300 px-3.5 py-2 rounded-lg shadow-sm flex items-center gap-1.5 transition"
          >
            📋 Demand Bill (DUES)
          </Link>

          <Link
            href={`/shop/invoices/${invoice.id}/print?format=a4`}
            target="_blank"
            className="text-xs font-bold bg-white text-slate-800 hover:bg-slate-50 border border-slate-300 px-3.5 py-2 rounded-lg shadow-sm flex items-center gap-1.5 transition"
          >
            <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print A4 Invoice
          </Link>

          {canCancel && invoice.status === "FINAL" && (
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-3.5 py-2 rounded-lg shadow-sm transition"
            >
              Cancel Invoice
            </button>
          )}
        </div>
      </div>

      {/* Credit Note Banner if cancelled */}
      {invoice.status === "CANCELLED" && invoice.creditNotes && invoice.creditNotes.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-900">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">Cancelled under Credit Note:</span>
            <span className="font-mono font-bold text-red-700">
              {invoice.creditNotes[0].number}
            </span>
          </div>
          <p className="text-xs text-red-700 mt-1">
            <strong>Reason:</strong> {invoice.creditNotes[0].reason}
          </p>
          <p className="text-xs text-red-600 mt-0.5">
            Stock counter-movements (SALE_CANCEL) have been automatically posted back to{" "}
            {invoice.location?.name || "inventory"}.
          </p>
        </div>
      )}

      {/* Grid of metadata */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Customer / Party */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
            Customer / Party
          </span>
          {invoice.customerName || invoice.customerPhone || invoice.customerAddress ? (
            <div className="space-y-1 text-xs">
              <p className="font-bold text-slate-900 text-sm">
                {invoice.customerName || invoice.party?.name || "Walk-in Customer"}
              </p>
              {invoice.customerPhone && (
                <p className="text-slate-600">Phone: {invoice.customerPhone}</p>
              )}
              {invoice.customerAddress && (
                <p className="text-slate-500">Address: {invoice.customerAddress}</p>
              )}
              {invoice.party?.gstin && (
                <p className="text-slate-600">GSTIN: {invoice.party.gstin}</p>
              )}
            </div>
          ) : invoice.party ? (
            <div className="space-y-1 text-xs">
              <p className="font-bold text-slate-900 text-sm">{invoice.party.name}</p>
              <p className="text-slate-600">Phone: {invoice.party.phone}</p>
              <p className="text-slate-600">
                GSTIN: {invoice.party.gstin || "Unregistered"}
              </p>
              <p className="text-slate-500">{invoice.party.address || "Saharsa"}</p>
            </div>
          ) : (
            <div className="text-xs text-slate-600">
              <p className="font-bold text-slate-900 text-sm">Walk-in Retail Customer</p>
              <p className="text-slate-500 mt-1">Cash / Counter Sale (B2C)</p>
            </div>
          )}
        </div>

        {/* Location & Channel */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
            Sale & Dispatch
          </span>
          <div className="space-y-1 text-xs text-slate-700">
            <p>
              <strong className="text-slate-900">Location:</strong>{" "}
              {invoice.location?.name || "Shop"}
            </p>
            <p>
              <strong className="text-slate-900">Channel:</strong> {invoice.channel}
            </p>
            <p>
              <strong className="text-slate-900">Buyer Tag:</strong>{" "}
              <span className="uppercase font-semibold">{invoice.buyerType || "CUSTOMER"}</span>
            </p>
            <p>
              <strong className="text-slate-900">Billed By:</strong>{" "}
              {invoice.creator?.name || "Staff"}
            </p>
            {(invoice.agentCodeSnapshot || invoice.agentUser?.agentCode) && (
              <p>
                <strong className="text-slate-900">Agent:</strong>{" "}
                <span className="font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.5 rounded text-[11px]">
                  {invoice.agentCodeSnapshot || invoice.agentUser?.agentCode}
                </span>{" "}
                <span className="text-slate-500 text-[11px]">
                  ({invoice.agentUser?.name || invoice.creator?.name})
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Payment Summary */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
              Payment Status
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                  invoice.paymentStatus === "PAID"
                    ? "bg-emerald-100 text-emerald-800"
                    : invoice.paymentStatus === "PARTIAL"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {invoice.paymentStatus}
              </span>
            </div>
            <div className="mt-2 text-xs space-y-0.5 text-slate-600">
              {invoice.payments?.map((p) => (
                <div key={p.id} className="flex justify-between">
                  <span>{p.mode}:</span>
                  <span className="font-mono font-semibold">
                    ₹{(p.amountPaise / 100).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between items-baseline">
            <span className="text-xs font-bold text-slate-700">Grand Total:</span>
            <span className="text-lg font-bold font-mono text-slate-900">
              ₹{(invoice.totalPaise / 100).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="text-sm font-bold text-slate-800">
            Invoice Items ({invoice.items.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3 w-8 text-center">#</th>
                <th className="p-3">Product Name</th>
                <th className="p-3 text-center">HSN</th>
                <th className="p-3 text-right">Qty</th>
                <th className="p-3 text-right">MRP</th>
                <th className="p-3 text-right">Rate</th>
                <th className="p-3 text-right">Discount</th>
                <th className="p-3 text-right">Taxable</th>
                <th className="p-3 text-center">GST %</th>
                <th className="p-3 text-right">Tax (₹)</th>
                <th className="p-3 text-right">Line Total (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoice.items.map((item, idx) => {
                const lineTotal = item.taxablePaise + item.taxPaise;
                return (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="p-3 text-center text-slate-400">{idx + 1}</td>
                    <td className="p-3">
                      <span className="font-bold text-slate-900 block">
                        {item.product.name}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        [{item.product.shortCode}] {item.product.packLabel}
                      </span>
                    </td>
                    <td className="p-3 text-center font-mono text-slate-600">
                      {item.hsn}
                    </td>
                    <td className="p-3 text-right font-bold text-slate-900">
                      {item.qty}
                    </td>
                    <td className="p-3 text-right font-mono text-slate-600">
                      ₹{(item.mrpPaise / 100).toFixed(2)}
                    </td>
                    <td className="p-3 text-right font-mono text-slate-800">
                      ₹{(item.unitPricePaise / 100).toFixed(2)}
                    </td>
                    <td className="p-3 text-right text-slate-600">
                      {item.discountBp > 0 ? `${(item.discountBp / 100).toFixed(1)}%` : "-"}
                    </td>
                    <td className="p-3 text-right font-mono text-slate-800">
                      ₹{(item.taxablePaise / 100).toFixed(2)}
                    </td>
                    <td className="p-3 text-center text-slate-600">
                      {(item.gstRateBp / 100).toFixed(0)}%
                    </td>
                    <td className="p-3 text-right font-mono text-slate-800">
                      ₹{(item.taxPaise / 100).toFixed(2)}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      ₹{(lineTotal / 100).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cancellation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-red-600">
              Cancel Invoice {invoice.number}
            </h3>
            <p className="text-xs text-slate-600">
              Cancelling a finalized invoice will issue an official Credit Note,
              restore product stock back to {invoice.location?.name || "inventory"},
              and reverse party balance. This action cannot be undone.
            </p>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCancel} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Cancellation *
                </label>
                <textarea
                  required
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Customer returned items / Wrong billing details"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={cancelling || cancelReason.trim().length < 5}
                  className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition disabled:opacity-50"
                >
                  {cancelling ? "Processing..." : "Confirm Cancellation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
