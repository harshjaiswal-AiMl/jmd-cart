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
  const cashierName = invoice.creator?.name || "Counter Cashier";

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

  // Clean invoice number
  const cleanInvoiceNo = invoice.number.replace(/^INV-[0-9]+-0*/, "") || invoice.number;

  return (
    <div className="cash-receipt-container font-mono text-[11px] leading-tight text-black bg-white w-[76mm] max-w-[76mm] mx-auto p-3 print:p-0 print:m-0 border border-slate-300 print:border-none shadow-sm print:shadow-none select-text">
      {/* Top Header with Image 2 Logo at TOP */}
      <div className="text-center pb-1 flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/jmd-cart-logo-color.jpg"
          alt="JMD Cart"
          className="w-44 max-w-[190px] h-auto object-contain mx-auto mb-1 print:contrast-125"
        />
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
          <span className="w-28 shrink-0 font-medium">Cashier</span>
          <span className="mr-1">:</span>
          <span className="font-bold uppercase break-words flex-1">{cashierName}</span>
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
      <div className="border-b border-black pb-1 text-[10px] font-bold">
        <div className="flex">
          <span className="w-6 shrink-0">Sl</span>
          <span className="flex-1">Product</span>
        </div>
        <div className="flex justify-between pl-6 text-[9.5px] text-gray-900 mt-0.5 font-bold">
          <span className="w-16">Qty/Unit</span>
          <span className="w-14 text-right">MRP</span>
          <span className="w-12 text-center">Disc%</span>
          <span className="w-14 text-right">Rate</span>
          <span className="w-16 text-right">Amt.</span>
        </div>
      </div>

      {/* Items List */}
      <div className="divide-y divide-gray-100 py-1">
        {invoice.items.map((item, idx) => {
          // Unit detection:
          // If customer bought a full carton (qty >= packSize and cleanly divisible):
          const isFullCarton =
            item.product.packSize > 1 &&
            item.qty >= item.product.packSize &&
            item.qty % item.product.packSize === 0;

          const displayQty = isFullCarton
            ? (item.qty / item.product.packSize).toFixed(2)
            : item.qty.toFixed(2);
          const displayUnit = isFullCarton
            ? (item.product.packLabel || "Carton")
            : "Pcs";

          const unitPricePaise = isFullCarton
            ? item.unitPricePaise * item.product.packSize
            : item.unitPricePaise;
          const mrpPaise = isFullCarton
            ? (item.mrpPaise || 0) * item.product.packSize
            : (item.mrpPaise || 0);

          const unitPrice = (unitPricePaise / 100).toFixed(2);
          const lineTotal = ((item.taxablePaise + item.taxPaise) / 100).toFixed(2);

          // Discount % calculation:
          let discPercent = 0;
          if (mrpPaise > 0 && mrpPaise > unitPricePaise) {
            discPercent = Math.round(((mrpPaise - unitPricePaise) / mrpPaise) * 100);
          } else if (item.discountBp > 0) {
            discPercent = Math.round(item.discountBp / 100);
          }

          return (
            <div key={item.id} className="py-1">
              <div className="flex text-[10.5px] font-medium">
                <span className="w-6 shrink-0 font-semibold">{idx + 1}</span>
                <span className="flex-1 font-semibold leading-tight">{item.product.name}</span>
              </div>
              <div className="flex justify-between pl-6 text-[10px] items-center mt-0.5">
                <span className="w-16 font-mono text-gray-800">
                  {displayQty} {displayUnit}
                </span>
                <span className="w-14 text-right font-mono text-gray-700">
                  {mrpPaise > 0 ? (mrpPaise / 100).toFixed(2) : "-"}
                </span>
                <span className="w-12 text-center font-mono font-medium text-emerald-800">
                  {discPercent > 0 ? `${discPercent}%` : "0%"}
                </span>
                <span className="w-14 text-right font-mono font-bold">
                  {unitPrice}
                </span>
                <span className="w-16 text-right font-mono font-black text-black">
                  {lineTotal}
                </span>
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
              {")"}
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

      {/* User requirement: Total Bill Amount ke niche: ALL GST INCLUDED */}
      <div className="text-center my-1.5">
        <p className="text-[10px] font-black tracking-widest uppercase">
          ALL GST INCLUDED
        </p>
      </div>

      {/* Greetings Footer with phone number directly under CALL US FOR FREE DOOR DELIVERY */}
      <div className="text-center font-bold text-[10px] space-y-0.5 pt-1 uppercase tracking-wide border-t border-dashed border-gray-400">
        <p>THANKS FOR SHOPPING @ JAI MATA DI</p>
        <p className="mt-0.5">CALL US FOR FREE DOOR DELIVERY</p>
        <p className="text-xs font-black tracking-widest pb-1">7979749009</p>
      </div>
    </div>
  );
}
