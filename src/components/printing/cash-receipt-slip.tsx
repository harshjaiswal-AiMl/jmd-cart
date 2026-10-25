import React from "react";
import { InvoiceWithDetails } from "@/modules/billing/billing.types";
import { BusinessDetails } from "@/modules/settings/settings.types";

export interface CashReceiptSlipProps {
  invoice: InvoiceWithDetails;
  business?: BusinessDetails;
}

function formatSlipDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}-${month}-${year} / ${hours}:${minutes}`;
}

export function CashReceiptSlip({ invoice, business }: CashReceiptSlipProps) {
  // Determine header payment mode: CASH, UPI, or CASH / UPI
  const hasCash = invoice.payments.some((p) => p.mode === "CASH");
  const hasUpi = invoice.payments.some((p) => p.mode === "UPI");
  let paymentTitle = "CASH";
  if (hasCash && hasUpi) {
    paymentTitle = "CASH / UPI";
  } else if (hasUpi) {
    paymentTitle = "UPI";
  } else if (hasCash) {
    paymentTitle = "CASH";
  } else if (invoice.payments.length > 0) {
    paymentTitle = invoice.payments[0].mode;
  }

  const phone = business?.phone || "7979749009";

  // Item sums
  let totalPieces = 0;
  let itemsSubtotalPaise = 0;

  for (const item of invoice.items) {
    totalPieces += item.qty;
    itemsSubtotalPaise += item.taxablePaise + item.taxPaise;
  }

  // Roundoff calculation
  const roundoffPaise = invoice.totalPaise - itemsSubtotalPaise;
  const roundoffRupees = roundoffPaise / 100;

  // Short invoice number (if format is INV-2026-XXXX, show last digits or clean string)
  const cleanInvoiceNo = invoice.number.replace(/^INV-[0-9]+-0*/, "") || invoice.number;

  return (
    <div className="cash-receipt-container font-mono text-[11px] leading-tight text-black bg-white w-[76mm] max-w-[76mm] mx-auto p-3 print:p-0 print:m-0 border border-slate-300 print:border-none shadow-sm print:shadow-none select-text">
      {/* Header Mode & Phone */}
      <div className="text-center pb-1">
        <h1 className="text-base font-black tracking-wider uppercase">{paymentTitle}</h1>
        <p className="text-xs font-bold mt-0.5 tracking-wide">{phone}</p>
      </div>

      {/* Divider */}
      <div className="border-t border-black my-1" />

      {/* Metadata */}
      <div className="text-[10.5px] leading-snug space-y-0.5">
        <div className="flex">
          <span className="w-28 shrink-0 font-medium">Date/Time</span>
          <span className="mr-1">:</span>
          <span className="font-semibold">{formatSlipDate(invoice.createdAt)}</span>
        </div>
        <div className="flex">
          <span className="w-28 shrink-0 font-medium">Invoice No.</span>
          <span className="mr-1">:</span>
          <span className="font-bold">{cleanInvoiceNo}</span>
        </div>
        <div className="flex">
          <span className="w-28 shrink-0 font-medium">Customer Name</span>
          <span className="mr-1">:</span>
          <span className="font-bold uppercase break-words flex-1">
            {invoice.party?.name || "WALK-IN RETAIL CUSTOMER"}
          </span>
        </div>
        {invoice.party?.address && (
          <div className="flex">
            <span className="w-28 shrink-0 font-medium">Customer Add.</span>
            <span className="mr-1">:</span>
            <span className="uppercase break-words flex-1">{invoice.party.address}</span>
          </div>
        )}
        {invoice.party?.phone && (
          <div className="flex">
            <span className="w-28 shrink-0 font-medium">Cust Mobile No</span>
            <span className="mr-1">:</span>
            <span className="font-semibold">{invoice.party.phone}</span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-black my-1.5" />

      {/* Table Headers */}
      <div className="flex text-[10.5px] font-bold pb-1 border-b border-black">
        <span className="w-7 shrink-0">Sl</span>
        <span className="flex-1">Product</span>
        <span className="w-16 text-right shrink-0">Price</span>
        <span className="w-16 text-right shrink-0">Amt.</span>
      </div>

      {/* Items List */}
      <div className="divide-y divide-gray-100 py-1">
        {invoice.items.map((item, idx) => {
          const unitPrice = (item.unitPricePaise / 100).toFixed(2);
          const lineTotal = ((item.taxablePaise + item.taxPaise) / 100).toFixed(2);
          const unit = item.product.packLabel || "Pcs.";

          return (
            <div key={item.id} className="py-1">
              <div className="flex text-[10.5px] font-medium">
                <span className="w-7 shrink-0 font-semibold">{idx + 1}</span>
                <span className="flex-1 font-semibold leading-tight">{item.product.name}</span>
              </div>
              <div className="flex text-[10px] text-gray-800 pl-7 justify-between items-center mt-0.5">
                <span className="font-mono">
                  {item.qty.toFixed(2)} {unit}
                </span>
                <span className="w-16 text-right font-mono">{unitPrice}</span>
                <span className="w-16 text-right font-mono font-semibold">{lineTotal}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <div className="border-t border-black mt-1 pt-1.5 space-y-1">
        <div className="flex justify-between text-[11px] font-bold">
          <span>Total</span>
          <span className="font-mono">
            {(itemsSubtotalPaise / 100).toLocaleString("en-IN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>

        {roundoffRupees !== 0 && (
          <div className="flex justify-between text-[10px] text-gray-800">
            <span>
              {roundoffRupees > 0 ? "Add : Rounded Off (+" : "Less : Rounded Off (-"}
            </span>
            <span className="font-mono">
              {Math.abs(roundoffRupees).toFixed(2)}
              {roundoffRupees > 0 ? ")" : ")"}
            </span>
          </div>
        )}
      </div>

      {/* Solid Summary Line with Pieces & Grand Total */}
      <div className="border-t-2 border-b-2 border-black my-2 py-1 flex justify-between items-center text-xs font-black">
        <span className="font-mono">{totalPieces.toFixed(2)}</span>
        <span className="font-mono text-sm">
          {(invoice.totalPaise / 100).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      </div>

      {/* Greetings Footer */}
      <div className="text-center font-bold text-[10px] space-y-0.5 pt-1 uppercase tracking-wide">
        <p>THANKS FOR SHOPPING @ JAI MATA DI</p>
        <p className="border-b border-black pb-1">CALL US FOR FREE DOOR DELIVERY</p>
      </div>

      {/* JMD Cart Logo & Subtitle */}
      <div className="pt-3 pb-1 text-center flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/jmd-cart-logo.png"
          alt="JMD Cart"
          className="h-9 max-h-9 object-contain mx-auto filter grayscale contrast-125"
        />
        <p className="text-[10px] font-bold tracking-wider text-black mt-1 uppercase">
          A Unit of Jai Mata Di
        </p>
      </div>
    </div>
  );
}
