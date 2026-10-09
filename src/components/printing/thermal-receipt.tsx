import React from "react";
import { InvoiceWithDetails } from "@/modules/billing/billing.types";
import { BusinessDetails } from "@/modules/settings/settings.types";
import { formatISTDate, formatISTTime } from "@/lib/date";

export interface ThermalReceiptProps {
  invoice: InvoiceWithDetails;
  business: BusinessDetails;
}

export function ThermalReceipt({ invoice, business }: ThermalReceiptProps) {
  // Tax rate breakdown
  const taxSummaryMap = new Map<
    number,
    { taxablePaise: number; taxPaise: number }
  >();

  let totalPieces = 0;

  for (const item of invoice.items) {
    totalPieces += item.qty;
    const rate = item.gstRateBp;
    const current = taxSummaryMap.get(rate) || {
      taxablePaise: 0,
      taxPaise: 0,
    };
    current.taxablePaise += item.taxablePaise;
    current.taxPaise += item.taxPaise;
    taxSummaryMap.set(rate, current);
  }

  const taxSummaries = Array.from(taxSummaryMap.entries())
    .map(([rateBp, values]) => ({
      ratePct: (rateBp / 100).toFixed(0),
      ...values,
    }))
    .sort((a, b) => Number(a.ratePct) - Number(b.ratePct));

  return (
    <div className="thermal-receipt-container font-mono text-[11px] leading-tight text-black bg-white w-[72mm] max-w-[72mm] mx-auto p-2 print:p-0 print:m-0 border border-slate-300 print:border-none">
      {/* Store Header */}
      <div className="text-center">
        <h1 className="text-sm font-bold uppercase tracking-wider">
          {business.tradeName || business.legalName}
        </h1>
        {business.tradeName && business.tradeName !== business.legalName && (
          <p className="text-[10px]">{business.legalName}</p>
        )}
        <p className="text-[10px] mt-0.5">{business.address}</p>
        <p className="text-[10px]">Ph: {business.phone}</p>
        <div className="text-[9px] mt-1 space-y-0.5">
          {business.gstin && <p>GSTIN: {business.gstin}</p>}
          {business.fssai && <p>FSSAI: {business.fssai}</p>}
        </div>
      </div>

      {/* Dashed line */}
      <div className="my-1.5 border-t border-dashed border-black" />

      {/* Receipt Meta */}
      <div className="text-[10px] space-y-0.5">
        <div className="flex justify-between font-bold">
          <span>INVOICE:</span>
          <span>{invoice.number}</span>
        </div>
        <div className="flex justify-between">
          <span>DATE:</span>
          <span>
            {formatISTDate(invoice.createdAt)} {formatISTTime(invoice.createdAt)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>CHANNEL:</span>
          <span>
            {invoice.channel} ({invoice.location?.name || "Shop"})
          </span>
        </div>
        <div className="flex justify-between">
          <span>CASHIER:</span>
          <span>{invoice.creator?.name || "Staff"}</span>
        </div>
        {invoice.party && (
          <div className="pt-1 border-t border-dotted border-gray-400 mt-1">
            <div className="flex justify-between font-semibold">
              <span>CUSTOMER:</span>
              <span className="truncate max-w-[120px]">{invoice.party.name}</span>
            </div>
            {invoice.party.phone && (
              <div className="flex justify-between">
                <span>PHONE:</span>
                <span>{invoice.party.phone}</span>
              </div>
            )}
            {invoice.party.gstin && (
              <div className="flex justify-between">
                <span>GSTIN:</span>
                <span>{invoice.party.gstin}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dashed line */}
      <div className="my-1.5 border-t border-dashed border-black" />

      {/* Item Header */}
      <div className="flex justify-between text-[10px] font-bold pb-0.5 border-b border-black">
        <span className="w-1/2 text-left">ITEM</span>
        <span className="w-1/4 text-center">QTY</span>
        <span className="w-1/4 text-right">AMT (₹)</span>
      </div>

      {/* Items List */}
      <div className="py-1 space-y-1.5 text-[10px]">
        {invoice.items.map((item) => {
          const lineTotal = item.taxablePaise + item.taxPaise;
          return (
            <div key={item.id} className="space-y-0.5">
              <div className="font-semibold truncate">
                {item.product.name}
              </div>
              <div className="flex justify-between text-gray-800 text-[9px] pl-1">
                <span>
                  {item.hsn} | GST {(item.gstRateBp / 100).toFixed(0)}%
                </span>
                <span>
                  {item.qty} x ₹{(item.unitPricePaise / 100).toFixed(2)}
                </span>
                <span className="font-bold font-mono">
                  ₹{(lineTotal / 100).toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dashed line */}
      <div className="my-1.5 border-t border-dashed border-black" />

      {/* Totals Summary */}
      <div className="text-[10px] space-y-1">
        <div className="flex justify-between">
          <span>Subtotal (MRP):</span>
          <span className="font-mono">₹{(invoice.subtotalPaise / 100).toFixed(2)}</span>
        </div>
        {invoice.discountPaise > 0 && (
          <div className="flex justify-between text-gray-800">
            <span>Discount:</span>
            <span className="font-mono">-₹{(invoice.discountPaise / 100).toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Taxable Value:</span>
          <span className="font-mono">₹{(invoice.taxablePaise / 100).toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>CGST (Intra-state):</span>
          <span className="font-mono">₹{(invoice.cgstPaise / 100).toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>SGST (Intra-state):</span>
          <span className="font-mono">₹{(invoice.sgstPaise / 100).toFixed(2)}</span>
        </div>
        {invoice.igstPaise > 0 && (
          <div className="flex justify-between">
            <span>IGST:</span>
            <span className="font-mono">₹{(invoice.igstPaise / 100).toFixed(2)}</span>
          </div>
        )}
        {invoice.roundOffPaise !== 0 && (
          <div className="flex justify-between">
            <span>Round Off:</span>
            <span className="font-mono">
              {invoice.roundOffPaise > 0 ? "+" : ""}
              ₹{(invoice.roundOffPaise / 100).toFixed(2)}
            </span>
          </div>
        )}

        {/* Double border for Grand Total */}
        <div className="my-1 border-t-2 border-b-2 border-black py-1 flex justify-between items-baseline font-bold">
          <span className="text-xs">NET TOTAL:</span>
          <span className="text-sm font-mono">
            ₹{(invoice.totalPaise / 100).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Payment tender info */}
      <div className="text-[9px] py-1 space-y-0.5">
        <span className="font-bold block">PAID VIA:</span>
        {invoice.payments && invoice.payments.length > 0 ? (
          invoice.payments.map((p) => (
            <div key={p.id} className="flex justify-between">
              <span>{p.mode}</span>
              <span className="font-mono">₹{(p.amountPaise / 100).toFixed(2)}</span>
            </div>
          ))
        ) : (
          <div className="flex justify-between">
            <span>Cash</span>
            <span className="font-mono">₹{(invoice.totalPaise / 100).toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Tax Slab Summary on 80mm */}
      <div className="border-t border-dotted border-gray-400 pt-1 mt-1 text-[8px] space-y-0.5">
        <div className="flex justify-between font-bold">
          <span>GST RATE</span>
          <span>TAXABLE</span>
          <span>TAX</span>
        </div>
        {taxSummaries.map((s) => (
          <div key={s.ratePct} className="flex justify-between">
            <span>GST {s.ratePct}%</span>
            <span>₹{(s.taxablePaise / 100).toFixed(2)}</span>
            <span>₹{(s.taxPaise / 100).toFixed(2)}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="my-2 border-t border-dashed border-black pt-2 text-center text-[9px] space-y-0.5">
        <p>Total Items: {invoice.items.length} | Total Units: {totalPieces}</p>
        <p className="font-bold uppercase mt-1">Thank you! Visit Again</p>
        <p className="text-[8px] text-gray-600">
          * Subject to Saharsa Jurisdiction *
        </p>
        <p className="text-[8px] text-gray-500">
          Computer Generated Tax Invoice
        </p>
      </div>
    </div>
  );
}
