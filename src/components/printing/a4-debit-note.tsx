import React from "react";
import { DebitNoteWithDetails } from "@/modules/returns/returns.types";
import { BusinessDetails } from "@/modules/settings/settings.types";
import { formatISTDate, formatISTTime } from "@/lib/date";
import { paiseToIndianWords } from "@/lib/number-to-words";

export interface A4DebitNoteProps {
  debitNote: DebitNoteWithDetails;
  business: BusinessDetails;
  copyTitle?: string;
}

export function A4DebitNote({
  debitNote,
  business,
  copyTitle = "Original for Supplier",
}: A4DebitNoteProps) {
  // Group taxes by GST rate
  const taxSummaryMap = new Map<
    number,
    {
      gstRateBp: number;
      taxablePaise: number;
      taxPaise: number;
      cgstPaise: number;
      sgstPaise: number;
    }
  >();

  let totalPieces = 0;

  for (const item of debitNote.items) {
    totalPieces += item.qty;
    const rate = item.gstRateBp;
    const existing = taxSummaryMap.get(rate) || {
      gstRateBp: rate,
      taxablePaise: 0,
      taxPaise: 0,
      cgstPaise: 0,
      sgstPaise: 0,
    };

    existing.taxablePaise += item.taxablePaise;
    existing.taxPaise += item.taxPaise;

    const halfTax = Math.round(item.taxPaise / 2);
    existing.cgstPaise += halfTax;
    existing.sgstPaise += item.taxPaise - halfTax;

    taxSummaryMap.set(rate, existing);
  }

  const taxSummaries = Array.from(taxSummaryMap.values()).sort(
    (a, b) => a.gstRateBp - b.gstRateBp
  );

  const amountInWords = paiseToIndianWords(debitNote.totalPaise);

  return (
    <div className="a4-debit-note-container bg-white text-slate-900 font-sans p-6 max-w-[210mm] mx-auto text-xs leading-normal border border-slate-300 print:border-none print:p-0">
      {/* Top Banner / Copy Type */}
      <div className="flex justify-between items-center border-b border-slate-300 pb-2 mb-3">
        <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
          Debit Note (Under Section 34 of CGST Act / Purchase Return)
        </span>
        <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
          {copyTitle}
        </span>
      </div>

      {/* Header: Distributor Details & Debit Note Info */}
      <div className="grid grid-cols-2 gap-4 border-b border-slate-300 pb-4 mb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {business.legalName}
          </h1>
          <p className="text-slate-600 font-medium">{business.tradeName}</p>
          <p className="text-slate-600 mt-1 whitespace-pre-line text-[11px]">
            {business.address}
          </p>
          <div className="mt-2 space-y-0.5 text-[11px] font-mono">
            <div>
              <span className="text-slate-500 font-sans">GSTIN:</span>{" "}
              <strong className="text-slate-900">{business.gstin}</strong>
            </div>
            {business.fssai && (
              <div>
                <span className="text-slate-500 font-sans">FSSAI Lic:</span>{" "}
                <span className="text-slate-700">{business.fssai}</span>
              </div>
            )}
            <div>
              <span className="text-slate-500 font-sans">Phone:</span>{" "}
              <span className="text-slate-700">{business.phone}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
          <div className="text-sm font-bold text-slate-900 mb-2 border-b border-slate-200 pb-1 flex justify-between items-center">
            <span>DEBIT NOTE</span>
            <span className="font-mono text-emerald-700">{debitNote.number}</span>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            <span className="text-slate-500">Date:</span>
            <span className="font-mono text-slate-800 font-medium">
              {formatISTDate(debitNote.createdAt)}
            </span>

            <span className="text-slate-500">Time:</span>
            <span className="font-mono text-slate-800">
              {formatISTTime(debitNote.createdAt)}
            </span>

            <span className="text-slate-500">Return Reason:</span>
            <span className="font-semibold text-rose-700">
              {debitNote.reason.replace(/_/g, " ")}
            </span>

            <span className="text-slate-500">Dispatch Location:</span>
            <span className="text-slate-800 font-medium">
              {debitNote.location.name}
            </span>

            <span className="text-slate-500">Financial Year:</span>
            <span className="font-mono text-slate-800">20{debitNote.fy}</span>
          </div>
        </div>
      </div>

      {/* Supplier (Vendor) Details */}
      <div className="border border-slate-300 rounded-lg p-3 mb-4 bg-slate-50/50">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
          To Supplier (Debit To):
        </span>
        <div className="flex justify-between items-start">
          <div>
            <div className="font-bold text-sm text-slate-900">
              {debitNote.supplier.name}
            </div>
            {debitNote.supplier.address && (
              <div className="text-slate-600 text-[11px] mt-0.5 whitespace-pre-line">
                {debitNote.supplier.address}
              </div>
            )}
            {debitNote.supplier.phone && (
              <div className="text-slate-600 text-[11px] mt-0.5">
                Phone: {debitNote.supplier.phone}
              </div>
            )}
          </div>

          <div className="text-right text-[11px] font-mono">
            {debitNote.supplier.gstin ? (
              <div>
                <span className="text-slate-500 font-sans">Supplier GSTIN:</span>{" "}
                <strong className="text-slate-900">{debitNote.supplier.gstin}</strong>
              </div>
            ) : (
              <span className="text-slate-500 italic">Unregistered Vendor</span>
            )}
            {debitNote.supplier.tallyRef && (
              <div className="text-slate-500 text-[10px] mt-0.5">
                Ref: {debitNote.supplier.tallyRef}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full border-collapse border border-slate-300 mb-4 text-[11px]">
        <thead>
          <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
            <th className="border border-slate-300 p-1.5 text-center w-8">#</th>
            <th className="border border-slate-300 p-1.5 text-left">Product Description</th>
            <th className="border border-slate-300 p-1.5 text-center w-16">HSN</th>
            <th className="border border-slate-300 p-1.5 text-center w-16">Batch</th>
            <th className="border border-slate-300 p-1.5 text-right w-12">Qty</th>
            <th className="border border-slate-300 p-1.5 text-right w-16">Rate (₹)</th>
            <th className="border border-slate-300 p-1.5 text-right w-16">Taxable (₹)</th>
            <th className="border border-slate-300 p-1.5 text-center w-12">GST</th>
            <th className="border border-slate-300 p-1.5 text-right w-14">Tax (₹)</th>
            <th className="border border-slate-300 p-1.5 text-right w-16">Total (₹)</th>
          </tr>
        </thead>
        <tbody>
          {debitNote.items.map((item, index) => {
            const packSize = Math.max(1, item.product.packSize);
            const ctns = Math.floor(item.qty / packSize);
            const loose = item.qty % packSize;

            return (
              <tr key={item.id} className="border-b border-slate-200">
                <td className="border border-slate-300 p-1.5 text-center text-slate-500">
                  {index + 1}
                </td>
                <td className="border border-slate-300 p-1.5">
                  <div className="font-semibold text-slate-900">
                    {item.product.name}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
                    <span>Code: {item.product.shortCode}</span>
                    {packSize > 1 && (
                      <span>({ctns} ctn + {loose} pcs)</span>
                    )}
                    {item.reason && (
                      <span className="text-rose-600 font-medium font-sans">
                        [{item.reason}]
                      </span>
                    )}
                  </div>
                </td>
                <td className="border border-slate-300 p-1.5 text-center font-mono">
                  {item.product.hsn}
                </td>
                <td className="border border-slate-300 p-1.5 text-center font-mono text-slate-600">
                  {item.batchNo || "-"}
                </td>
                <td className="border border-slate-300 p-1.5 text-right font-mono font-bold">
                  {item.qty}
                </td>
                <td className="border border-slate-300 p-1.5 text-right font-mono">
                  {(item.unitPricePaise / 100).toFixed(2)}
                </td>
                <td className="border border-slate-300 p-1.5 text-right font-mono">
                  {(item.taxablePaise / 100).toFixed(2)}
                </td>
                <td className="border border-slate-300 p-1.5 text-center font-mono">
                  {(item.gstRateBp / 100).toFixed(0)}%
                </td>
                <td className="border border-slate-300 p-1.5 text-right font-mono">
                  {(item.taxPaise / 100).toFixed(2)}
                </td>
                <td className="border border-slate-300 p-1.5 text-right font-mono font-bold">
                  {(item.totalPaise / 100).toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Calculation & Summary Footer */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Left: GST Tax Slab Summary */}
        <div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Tax Slab Breakdown (Intra-State Bihar):
          </span>
          <table className="w-full border-collapse border border-slate-300 text-[10px] text-center">
            <thead className="bg-slate-50 font-semibold text-slate-600">
              <tr>
                <th className="border border-slate-300 p-1">Rate</th>
                <th className="border border-slate-300 p-1 text-right">Taxable (₹)</th>
                <th className="border border-slate-300 p-1 text-right">CGST (₹)</th>
                <th className="border border-slate-300 p-1 text-right">SGST (₹)</th>
                <th className="border border-slate-300 p-1 text-right">Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              {taxSummaries.map((summary) => (
                <tr key={summary.gstRateBp}>
                  <td className="border border-slate-300 p-1 font-mono">
                    {(summary.gstRateBp / 100).toFixed(0)}%
                  </td>
                  <td className="border border-slate-300 p-1 text-right font-mono">
                    {(summary.taxablePaise / 100).toFixed(2)}
                  </td>
                  <td className="border border-slate-300 p-1 text-right font-mono">
                    {(summary.cgstPaise / 100).toFixed(2)}
                  </td>
                  <td className="border border-slate-300 p-1 text-right font-mono">
                    {(summary.sgstPaise / 100).toFixed(2)}
                  </td>
                  <td className="border border-slate-300 p-1 text-right font-mono font-semibold">
                    {(summary.taxPaise / 100).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {debitNote.notes && (
            <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600">
              <span className="font-semibold text-slate-700">Remarks:</span> {debitNote.notes}
            </div>
          )}
        </div>

        {/* Right: Totals Box */}
        <div className="border border-slate-300 rounded-lg p-3 bg-slate-50/50 space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Total Units Returned:</span>
            <span className="font-mono font-bold text-slate-900">{totalPieces} pcs</span>
          </div>

          <div className="flex justify-between text-slate-600">
            <span>Subtotal (Taxable):</span>
            <span className="font-mono">₹{(debitNote.subtotalPaise / 100).toFixed(2)}</span>
          </div>

          <div className="flex justify-between text-slate-600">
            <span>Total GST Tax:</span>
            <span className="font-mono">₹{(debitNote.taxPaise / 100).toFixed(2)}</span>
          </div>

          {debitNote.roundOffPaise !== 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Round Off:</span>
              <span className="font-mono">
                {debitNote.roundOffPaise > 0 ? "+" : ""}
                {(debitNote.roundOffPaise / 100).toFixed(2)}
              </span>
            </div>
          )}

          <div className="border-t border-slate-300 pt-2 flex justify-between font-bold text-sm text-slate-900">
            <span>Total Debit Amount:</span>
            <span className="font-mono text-emerald-800 text-base">
              ₹{(debitNote.totalPaise / 100).toFixed(2)}
            </span>
          </div>

          <div className="text-[10px] text-slate-500 pt-1">
            Amount in words: <strong className="text-slate-700 font-sans">{amountInWords}</strong>
          </div>
        </div>
      </div>

      {/* Dual Signatures Block */}
      <div className="grid grid-cols-2 gap-8 border-t border-slate-300 pt-8 mt-6">
        <div>
          <div className="h-10"></div>
          <div className="border-t border-slate-400 text-center text-[10px] text-slate-600 pt-1">
            Supplier Acknowledgment / Verified By
          </div>
        </div>

        <div className="text-right">
          <div className="h-10 text-[11px] font-semibold text-slate-700">
            For {business.legalName}
          </div>
          <div className="border-t border-slate-400 text-center text-[10px] text-slate-600 pt-1">
            Authorized Signatory / Warehouse Manager
          </div>
        </div>
      </div>
    </div>
  );
}
