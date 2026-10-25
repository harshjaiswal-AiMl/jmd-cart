import React from "react";
import { InvoiceWithDetails } from "@/modules/billing/billing.types";
import { BusinessDetails } from "@/modules/settings/settings.types";
import { paiseToIndianWords } from "@/lib/number-to-words";

export interface DemandBillCreditProps {
  invoice: InvoiceWithDetails;
  business?: BusinessDetails;
}

function formatDemandDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export function DemandBillCredit({ invoice, business }: DemandBillCreditProps) {
  const phone = business?.phone || "7979749009";

  // Clean invoice number
  const cleanBillNo = invoice.number.replace(/^INV-[0-9]+-0*/, "") || invoice.number;

  let totalQty = 0;
  for (const item of invoice.items) {
    totalQty += item.qty;
  }

  const amountInWords = paiseToIndianWords(invoice.totalPaise);

  return (
    <div className="demand-bill-container bg-white text-black font-sans w-full max-w-[760px] mx-auto p-4 sm:p-6 print:p-2 border border-black print:border-black shadow-md print:shadow-none relative select-text">
      {/* Top Header */}
      <div className="text-center pb-2">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
          Demand Bill
        </h1>
        <p className="text-sm font-bold text-gray-800 mt-0.5 tracking-wider">
          {phone}
        </p>
      </div>

      {/* Main Bordered Bill Box */}
      <div className="border border-black">
        {/* Top Two-Column Header: Party Details vs Date & Bill No */}
        <div className="grid grid-cols-2 border-b border-black text-xs sm:text-sm">
          {/* Party Details Column */}
          <div className="p-2 sm:p-3 border-r border-black space-y-1">
            <p className="font-bold italic text-gray-900">Party Details :</p>
            <p className="font-semibold uppercase text-gray-900">
              {invoice.party?.name || "Cash / Retail Customer"}
            </p>
            {invoice.party?.address && (
              <p className="text-gray-800 leading-snug">{invoice.party.address}</p>
            )}
            {invoice.party?.phone && (
              <p className="font-medium text-gray-800">{invoice.party.phone}</p>
            )}
          </div>

          {/* Date & Bill No Column */}
          <div className="p-2 sm:p-3 space-y-2">
            <div className="flex">
              <span className="w-20 font-bold text-gray-900">Date</span>
              <span className="mr-2 font-bold">:</span>
              <span className="font-medium">{formatDemandDate(invoice.createdAt)}</span>
            </div>
            <div className="flex">
              <span className="w-20 font-bold text-gray-900">Bill No.</span>
              <span className="mr-2 font-bold">:</span>
              <span className="font-bold">{cleanBillNo}</span>
            </div>
          </div>
        </div>

        {/* Table of Goods with DUES Watermark */}
        <div className="relative">
          {/* Authentic DUES Rubber Stamp Watermark */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden z-10">
            <div
              className="border-[5px] border-dashed border-[#7e22ce] text-[#7e22ce] px-6 py-2 rounded-lg font-black tracking-widest text-4xl sm:text-5xl uppercase opacity-80 shadow-inner transform -rotate-12"
              style={{
                fontFamily: "Impact, 'Arial Black', sans-serif",
                letterSpacing: "0.2em",
                textShadow: "0 0 1px rgba(126, 34, 206, 0.4)",
              }}
            >
              DUES
            </div>
          </div>

          <table className="w-full text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="border-b border-black text-center font-bold bg-gray-50/50">
                <th className="border-r border-black py-1.5 px-2 w-12">S.N.</th>
                <th className="border-r border-black py-1.5 px-3 text-left">
                  Discriptions of Goods
                </th>
                <th className="border-r border-black py-1.5 px-2 w-20 text-right">
                  Qty
                </th>
                <th className="border-r border-black py-1.5 px-2 w-16 text-center">
                  Unit
                </th>
                <th className="border-r border-black py-1.5 px-3 w-28 text-right">
                  Rate
                </th>
                <th className="py-1.5 px-3 w-32 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invoice.items.map((item, idx) => {
                const unitPrice = (item.unitPricePaise / 100).toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                });
                const lineTotal = (item.totalPaise / 100).toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                });
                const unit = item.product.packLabel || "Pcs";

                return (
                  <tr key={item.id} className="min-h-[28px]">
                    <td className="border-r border-black py-1.5 px-2 text-center font-medium">
                      {idx + 1}
                    </td>
                    <td className="border-r border-black py-1.5 px-3 text-left font-medium">
                      {item.product.name}
                    </td>
                    <td className="border-r border-black py-1.5 px-2 text-right font-mono">
                      {item.qty.toFixed(2)}
                    </td>
                    <td className="border-r border-black py-1.5 px-2 text-center text-gray-700">
                      {unit}
                    </td>
                    <td className="border-r border-black py-1.5 px-3 text-right font-mono">
                      {unitPrice}
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono font-semibold">
                      {lineTotal}
                    </td>
                  </tr>
                );
              })}

              {/* Pad minimum rows for authentic bill sheet look */}
              {invoice.items.length < 5 &&
                Array.from({ length: 5 - invoice.items.length }).map((_, i) => (
                  <tr key={`pad-${i}`} className="h-7">
                    <td className="border-r border-black">&nbsp;</td>
                    <td className="border-r border-black">&nbsp;</td>
                    <td className="border-r border-black">&nbsp;</td>
                    <td className="border-r border-black">&nbsp;</td>
                    <td className="border-r border-black">&nbsp;</td>
                    <td>&nbsp;</td>
                  </tr>
                ))}

              {/* Total Qty subtotal line under Qty column */}
              <tr className="border-t border-black font-bold">
                <td className="border-r border-black">&nbsp;</td>
                <td className="border-r border-black">&nbsp;</td>
                <td className="border-r border-black py-1 px-2 text-right font-mono font-bold text-sm">
                  {totalQty.toFixed(2)}
                </td>
                <td className="border-r border-black">&nbsp;</td>
                <td className="border-r border-black">&nbsp;</td>
                <td>&nbsp;</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Grand Total Row */}
        <div className="border-t border-black flex justify-end text-xs sm:text-sm font-bold">
          <div className="py-2 px-4 border-r border-black">Grand Total</div>
          <div className="py-2 px-4 w-32 sm:w-36 text-right font-mono text-sm sm:text-base font-black">
            {(invoice.totalPaise / 100).toLocaleString("en-IN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>

        {/* Amount in words */}
        <div className="border-t border-black p-2 sm:p-2.5 text-xs sm:text-sm">
          <span className="font-bold">Rupees : </span>
          <span className="font-semibold italic text-gray-800">{amountInWords}</span>
        </div>

        {/* Signatures section */}
        <div className="grid grid-cols-2 border-t border-black h-20 sm:h-24 text-xs sm:text-sm">
          <div className="p-2 border-r border-black flex flex-col justify-end italic text-gray-800">
            Receiver&apos;s Signature
          </div>
          <div className="p-2 flex flex-col justify-end items-end italic text-gray-800">
            Authorised Signatory
          </div>
        </div>
      </div>

      {/* Bottom Branding: JMD Cart Logo + "A Unit of Jai Mata Di" */}
      <div className="pt-4 pb-1 text-center flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/jmd-cart-logo.png"
          alt="JMD Cart"
          className="h-10 max-h-10 object-contain mx-auto"
        />
        <p className="text-xs font-bold tracking-wider text-gray-800 mt-1 uppercase">
          A Unit of Jai Mata Di
        </p>
      </div>
    </div>
  );
}
