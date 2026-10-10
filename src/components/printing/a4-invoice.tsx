import React from "react";
import { InvoiceWithDetails } from "@/modules/billing/billing.types";
import { BusinessDetails } from "@/modules/settings/settings.types";
import { formatISTDate, formatISTTime } from "@/lib/date";
import { paiseToIndianWords } from "@/lib/number-to-words";

export interface A4InvoiceProps {
  invoice: InvoiceWithDetails;
  business: BusinessDetails;
  copyTitle?: string; // e.g. "Original for Recipient" or "Office Copy"
}

export function A4Invoice({
  invoice,
  business,
  copyTitle = "Original for Recipient",
}: A4InvoiceProps) {
  // Group taxes by GST rate
  const taxSummaryMap = new Map<
    number,
    {
      gstRateBp: number;
      taxablePaise: number;
      taxPaise: number;
      cgstPaise: number;
      sgstPaise: number;
      igstPaise: number;
    }
  >();

  let totalPieces = 0;

  for (const item of invoice.items) {
    totalPieces += item.qty;
    const rate = item.gstRateBp;
    const existing = taxSummaryMap.get(rate) || {
      gstRateBp: rate,
      taxablePaise: 0,
      taxPaise: 0,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
    };

    existing.taxablePaise += item.taxablePaise;
    existing.taxPaise += item.taxPaise;

    if (invoice.igstPaise > 0) {
      existing.igstPaise += item.taxPaise;
    } else {
      const halfTax = Math.round(item.taxPaise / 2);
      existing.cgstPaise += halfTax;
      existing.sgstPaise += item.taxPaise - halfTax;
    }

    taxSummaryMap.set(rate, existing);
  }

  const taxSummaries = Array.from(taxSummaryMap.values()).sort(
    (a, b) => a.gstRateBp - b.gstRateBp
  );

  const amountInWords = paiseToIndianWords(invoice.totalPaise);

  return (
    <div className="a4-invoice-container bg-white text-slate-900 font-sans p-6 max-w-[210mm] mx-auto text-xs leading-normal border border-slate-300 print:border-none print:p-0">
      {/* Top Banner / Copy Type */}
      <div className="flex justify-between items-center border-b border-slate-300 pb-2 mb-3">
        <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
          Tax Invoice (Under Section 31 of CGST Act)
        </span>
        <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
          {copyTitle}
        </span>
      </div>

      {/* E-Invoice IRN & QR Banner (when generated) */}
      {invoice.irn && (
        <div className="mb-3 p-2 bg-emerald-50 border border-emerald-300 rounded flex justify-between items-center text-[10px]">
          <div className="space-y-0.5">
            <span className="font-bold text-emerald-800 uppercase tracking-wide block">
              Govt. E-Invoice Portal (IRN Generated)
            </span>
            <div className="font-mono text-emerald-950 break-all select-all">
              <strong>IRN:</strong> {invoice.irn}
            </div>
          </div>
          {invoice.qr && (
            <div className="ml-4 shrink-0 text-center">
              <div className="w-12 h-12 bg-white border border-emerald-400 rounded flex items-center justify-center p-0.5 shadow-xs">
                <span className="font-mono text-[8px] text-emerald-800 font-bold leading-tight">
                  NIC QR
                </span>
              </div>
              <span className="text-[8px] text-emerald-700 block mt-0.5">Signed QR</span>
            </div>
          )}
        </div>
      )}

      {/* Header: Company & Invoice Info */}
      <div className="grid grid-cols-2 gap-4 border-b border-slate-300 pb-4 mb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {business.legalName}
          </h1>
          {business.tradeName && business.tradeName !== business.legalName && (
            <p className="text-xs font-semibold text-slate-700">
              ({business.tradeName})
            </p>
          )}
          <p className="text-slate-600 mt-1">{business.address}</p>
          <div className="grid grid-cols-2 gap-x-2 mt-1.5 text-[11px] text-slate-700">
            <p>
              <strong className="text-slate-900">GSTIN:</strong> {business.gstin || "N/A"}
            </p>
            <p>
              <strong className="text-slate-900">State:</strong> Bihar (Code: 10)
            </p>
            <p>
              <strong className="text-slate-900">FSSAI:</strong> {business.fssai || "N/A"}
            </p>
            <p>
              <strong className="text-slate-900">Phone:</strong> {business.phone}
            </p>
          </div>
        </div>

        <div className="bg-slate-50 p-3 rounded border border-slate-200 flex flex-col justify-between">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-slate-500 block">Invoice Number</span>
              <span className="font-bold text-sm text-slate-900 font-mono">
                {invoice.number}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Date & Time</span>
              <span className="font-semibold text-slate-900">
                {formatISTDate(invoice.createdAt)}, {formatISTTime(invoice.createdAt)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Place of Supply</span>
              <span className="font-semibold text-slate-900">Bihar (10)</span>
            </div>
            <div>
              <span className="text-slate-500 block">Channel / Counter</span>
              <span className="font-semibold text-slate-900">
                {invoice.channel} ({invoice.location?.name || "Shop"})
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Status</span>
              <span
                className={`font-bold ${
                  invoice.status === "FINAL"
                    ? "text-emerald-700"
                    : invoice.status === "CANCELLED"
                    ? "text-red-700"
                    : "text-slate-700"
                }`}
              >
                {invoice.status}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Buyer Classification</span>
              <span className="font-semibold text-slate-900 uppercase">
                {invoice.buyerType || "RETAIL"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bill To / Consignee */}
      <div className="border border-slate-200 rounded p-2.5 mb-3 bg-slate-50">
        <span className="font-bold text-slate-700 block uppercase text-[10px] tracking-wider mb-1">
          Billed To / Buyer Details
        </span>
        {invoice.party ? (
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <p className="font-bold text-slate-900 text-xs">
                {invoice.party.name}
              </p>
              <p className="text-slate-600">{invoice.party.address || "Saharsa, Bihar"}</p>
            </div>
            <div>
              <p>
                <strong className="text-slate-700">Phone:</strong> {invoice.party.phone}
              </p>
              <p>
                <strong className="text-slate-700">GSTIN:</strong>{" "}
                {invoice.party.gstin || "Unregistered Consumer"}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-slate-700">
            <span className="font-semibold text-slate-900">
              Walk-in Retail Customer (Cash / Counter Sale)
            </span>
            <span className="ml-3 text-slate-500">Unregistered Consumer</span>
          </div>
        )}
      </div>

      {/* Item Table */}
      <table className="w-full border-collapse border border-slate-300 text-[10px] mb-3">
        <thead>
          <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
            <th className="border-r border-slate-300 p-1.5 w-7 text-center">#</th>
            <th className="border-r border-slate-300 p-1.5 text-left">Description of Goods</th>
            <th className="border-r border-slate-300 p-1.5 w-16 text-center">HSN</th>
            <th className="border-r border-slate-300 p-1.5 w-12 text-right">Qty</th>
            <th className="border-r border-slate-300 p-1.5 w-14 text-right">MRP</th>
            <th className="border-r border-slate-300 p-1.5 w-14 text-right">Rate</th>
            <th className="border-r border-slate-300 p-1.5 w-14 text-right">Disc %</th>
            <th className="border-r border-slate-300 p-1.5 w-16 text-right">Taxable</th>
            <th className="border-r border-slate-300 p-1.5 w-12 text-center">GST %</th>
            <th className="border-r border-slate-300 p-1.5 w-14 text-right">Tax (₹)</th>
            <th className="p-1.5 w-16 text-right">Total (₹)</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, index) => {
            const lineTotalPaise = item.taxablePaise + item.taxPaise;
            return (
              <tr
                key={item.id}
                className={`border-b border-slate-200 ${
                  index % 2 === 1 ? "bg-slate-50/50" : ""
                }`}
              >
                <td className="border-r border-slate-200 p-1.5 text-center text-slate-500">
                  {index + 1}
                </td>
                <td className="border-r border-slate-200 p-1.5">
                  <span className="font-semibold text-slate-900 block">
                    {item.product.name}
                  </span>
                  <span className="text-slate-500 text-[9px] font-mono">
                    [{item.product.shortCode}] {item.product.packLabel}
                  </span>
                </td>
                <td className="border-r border-slate-200 p-1.5 text-center font-mono text-slate-700">
                  {item.hsn}
                </td>
                <td className="border-r border-slate-200 p-1.5 text-right font-semibold text-slate-900">
                  {item.qty}
                </td>
                <td className="border-r border-slate-200 p-1.5 text-right text-slate-600">
                  ₹{(item.mrpPaise / 100).toFixed(2)}
                </td>
                <td className="border-r border-slate-200 p-1.5 text-right text-slate-800">
                  ₹{(item.unitPricePaise / 100).toFixed(2)}
                </td>
                <td className="border-r border-slate-200 p-1.5 text-right text-slate-600">
                  {item.discountBp > 0 ? `${(item.discountBp / 100).toFixed(1)}%` : "-"}
                </td>
                <td className="border-r border-slate-200 p-1.5 text-right font-mono text-slate-800">
                  ₹{(item.taxablePaise / 100).toFixed(2)}
                </td>
                <td className="border-r border-slate-200 p-1.5 text-center text-slate-700">
                  {(item.gstRateBp / 100).toFixed(0)}%
                </td>
                <td className="border-r border-slate-200 p-1.5 text-right font-mono text-slate-800">
                  ₹{(item.taxPaise / 100).toFixed(2)}
                </td>
                <td className="p-1.5 text-right font-bold font-mono text-slate-900">
                  ₹{(lineTotalPaise / 100).toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 font-bold border-t border-slate-300">
            <td colSpan={3} className="border-r border-slate-300 p-1.5 text-right">
              Total ({invoice.items.length} items, {totalPieces} pcs)
            </td>
            <td className="border-r border-slate-300 p-1.5 text-right">
              {totalPieces}
            </td>
            <td colSpan={3} className="border-r border-slate-300 p-1.5 text-right">
              ₹{(invoice.subtotalPaise / 100).toFixed(2)}
            </td>
            <td className="border-r border-slate-300 p-1.5 text-right font-mono">
              ₹{(invoice.taxablePaise / 100).toFixed(2)}
            </td>
            <td className="border-r border-slate-300 p-1.5"></td>
            <td className="border-r border-slate-300 p-1.5 text-right font-mono">
              ₹{((invoice.cgstPaise + invoice.sgstPaise + invoice.igstPaise) / 100).toFixed(2)}
            </td>
            <td className="p-1.5 text-right font-mono text-sm">
              ₹{((invoice.subtotalPaise - invoice.discountPaise) / 100).toFixed(2)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Tax Summary Table & Totals Block */}
      <div className="grid grid-cols-12 gap-3 mb-3 print-page-break-avoid">
        {/* Tax Summary Breakdown */}
        <div className="col-span-7 border border-slate-300 rounded p-2">
          <span className="font-bold text-slate-800 block text-[10px] uppercase mb-1.5">
            GST Tax Computation Summary
          </span>
          <table className="w-full border-collapse border border-slate-200 text-[9px]">
            <thead>
              <tr className="bg-slate-100 font-bold text-slate-700">
                <th className="border border-slate-200 p-1 text-left">Rate</th>
                <th className="border border-slate-200 p-1 text-right">Taxable (₹)</th>
                <th className="border border-slate-200 p-1 text-right">CGST (₹)</th>
                <th className="border border-slate-200 p-1 text-right">SGST (₹)</th>
                <th className="border border-slate-200 p-1 text-right">Total Tax (₹)</th>
              </tr>
            </thead>
            <tbody>
              {taxSummaries.map((tax) => {
                const ratePct = tax.gstRateBp / 100;
                return (
                  <tr key={tax.gstRateBp} className="border-b border-slate-100">
                    <td className="border border-slate-200 p-1 font-semibold">
                      GST {ratePct}%
                    </td>
                    <td className="border border-slate-200 p-1 text-right font-mono">
                      ₹{(tax.taxablePaise / 100).toFixed(2)}
                    </td>
                    <td className="border border-slate-200 p-1 text-right font-mono">
                      ₹{(tax.cgstPaise / 100).toFixed(2)}
                    </td>
                    <td className="border border-slate-200 p-1 text-right font-mono">
                      ₹{(tax.sgstPaise / 100).toFixed(2)}
                    </td>
                    <td className="border border-slate-200 p-1 text-right font-mono font-bold">
                      ₹{(tax.taxPaise / 100).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-bold">
                <td className="border border-slate-200 p-1">Total</td>
                <td className="border border-slate-200 p-1 text-right font-mono">
                  ₹{(invoice.taxablePaise / 100).toFixed(2)}
                </td>
                <td className="border border-slate-200 p-1 text-right font-mono">
                  ₹{(invoice.cgstPaise / 100).toFixed(2)}
                </td>
                <td className="border border-slate-200 p-1 text-right font-mono">
                  ₹{(invoice.sgstPaise / 100).toFixed(2)}
                </td>
                <td className="border border-slate-200 p-1 text-right font-mono">
                  ₹{((invoice.cgstPaise + invoice.sgstPaise + invoice.igstPaise) / 100).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Payments Info */}
          <div className="mt-2 text-[10px] bg-slate-50 p-1.5 rounded border border-slate-200">
            <span className="font-bold text-slate-700 block mb-1">
              Payment Breakdown:
            </span>
            {invoice.payments && invoice.payments.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {invoice.payments.map((p) => (
                  <span key={p.id} className="text-slate-800">
                    <strong className="text-slate-900">{p.mode}:</strong> ₹
                    {(p.amountPaise / 100).toFixed(2)}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-slate-500">No payment records</span>
            )}
          </div>
        </div>

        {/* Grand Total Box */}
        <div className="col-span-5 border border-slate-300 rounded p-2.5 flex flex-col justify-between bg-slate-50">
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between text-slate-600">
              <span>Gross MRP Subtotal:</span>
              <span className="font-mono">₹{(invoice.subtotalPaise / 100).toFixed(2)}</span>
            </div>
            {invoice.discountPaise > 0 && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Total Discount Applied:</span>
                <span className="font-mono">-₹{(invoice.discountPaise / 100).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>Taxable Value:</span>
              <span className="font-mono">₹{(invoice.taxablePaise / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>CGST:</span>
              <span className="font-mono">₹{(invoice.cgstPaise / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>SGST:</span>
              <span className="font-mono">₹{(invoice.sgstPaise / 100).toFixed(2)}</span>
            </div>
            {invoice.igstPaise > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>IGST:</span>
                <span className="font-mono">₹{(invoice.igstPaise / 100).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-500 text-[10px]">
              <span>Round Off:</span>
              <span className="font-mono">
                {invoice.roundOffPaise >= 0 ? "+" : ""}
                ₹{(invoice.roundOffPaise / 100).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="border-t border-slate-300 pt-1.5 mt-2 flex justify-between items-baseline">
            <span className="text-xs font-bold text-slate-900 uppercase">
              Grand Total:
            </span>
            <span className="text-base font-extrabold text-slate-900 font-mono">
              ₹{(invoice.totalPaise / 100).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Amount in words */}
      <div className="border border-slate-300 rounded p-2 mb-3 bg-slate-50 text-[11px] print-page-break-avoid">
        <span className="font-bold text-slate-700">Amount Chargeable (in words): </span>
        <span className="font-semibold text-slate-900 italic">{amountInWords}</span>
      </div>

      {/* Bank & Remittance details */}
      {business.bankDetails && (
        <div className="border border-slate-200 rounded p-2 mb-3 text-[10px] grid grid-cols-2 gap-2 bg-white print-page-break-avoid">
          <div>
            <span className="font-bold text-slate-700 block uppercase mb-0.5">
              Bank Remittance Details
            </span>
            <p>
              Bank: <strong>{business.bankDetails.bankName || "SBI"}</strong> | A/C:{" "}
              <strong className="font-mono">{business.bankDetails.accountNumber}</strong>
            </p>
            <p>
              IFSC: <strong className="font-mono">{business.bankDetails.ifsc}</strong> | Branch:{" "}
              {business.bankDetails.branch}
            </p>
          </div>
          <div>
            {business.upiId && (
              <p>
                UPI ID for Instant QR Transfer:{" "}
                <strong className="font-mono">{business.upiId}</strong>
              </p>
            )}
            <p className="text-slate-500 text-[9px] mt-0.5">
              Please quote invoice number during NEFT/RTGS/UPI transfers.
            </p>
          </div>
        </div>
      )}

      {/* Footer / Terms & Signatures */}
      <div className="grid grid-cols-2 gap-4 border-t border-slate-300 pt-3 text-[10px] print-page-break-avoid">
        <div>
          <span className="font-bold text-slate-800 block uppercase mb-1">
            Terms & Conditions
          </span>
          <ol className="list-decimal list-inside space-y-0.5 text-slate-600 text-[9px]">
            <li>Goods once sold will not be accepted back or exchanged after delivery.</li>
            <li>Interest @ 18% p.a. will be charged if payment is not cleared on due date.</li>
            <li>Subject to Saharsa (Bihar) Jurisdiction only.</li>
            <li>This is a computer-generated tax invoice signed electronically.</li>
          </ol>
        </div>

        <div className="flex flex-col justify-between items-end text-right">
          <div>
            <span className="text-[10px] font-bold text-slate-800 block">
              For {business.legalName}
            </span>
            <span className="text-slate-500 text-[9px]">
              Billed by: {invoice.creator?.name || "Counter Cashier"}
            </span>
          </div>

          <div className="pt-8">
            <div className="border-t border-slate-400 w-36 inline-block"></div>
            <span className="block text-[9px] text-slate-600 font-semibold mt-0.5">
              Authorized Signatory
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
