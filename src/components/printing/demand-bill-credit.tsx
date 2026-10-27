import React from "react";
import { InvoiceWithDetails } from "@/modules/billing/billing.types";
import { BusinessDetails } from "@/modules/settings/settings.types";
import { buildInvoiceViewModel } from "@/modules/billing/invoice-view-model";

export interface DemandBillCreditProps {
  invoice: InvoiceWithDetails;
  business?: BusinessDetails;
}

export function DemandBillCredit({ invoice, business }: DemandBillCreditProps) {
  const vm = buildInvoiceViewModel(invoice, business);

  return (
    <div className="demand-bill-container bg-white text-black font-sans w-full max-w-[760px] mx-auto p-4 sm:p-6 print:p-2 border border-black print:border-black shadow-md print:shadow-none relative select-text">
      {/* Top Header with New Logo at TOP */}
      <div className="text-center pb-2 flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/jmd-cart-logo-color.jpg"
          alt="JMD Cart"
          className="w-48 max-w-[200px] h-auto object-contain mx-auto mb-1.5"
        />
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
          Demand Bill
        </h1>
        {vm.business.phone && (
          <p className="text-sm font-bold text-gray-800 mt-0.5 tracking-wider">
            {vm.business.phone}
          </p>
        )}
      </div>

      {/* Main Bordered Bill Box */}
      <div className="border border-black">
        {/* Top Two-Column Header: Party Details vs Date & Bill No */}
        <div className="grid grid-cols-2 border-b border-black text-xs sm:text-sm">
          {/* Party Details Column */}
          <div className="p-2 sm:p-3 border-r border-black space-y-1">
            <p className="font-bold italic text-gray-900">Party Details :</p>
            <p className="font-semibold uppercase text-gray-900">
              {vm.customer.name || "Cash / Retail Customer"}
            </p>
            {vm.customer.address && (
              <p className="text-gray-800 leading-snug break-words">{vm.customer.address}</p>
            )}
            {vm.customer.mobile && (
              <p className="font-medium text-gray-800">{vm.customer.mobile}</p>
            )}
            {vm.customer.gstin && (
              <p className="font-mono text-xs text-gray-800">GSTIN: {vm.customer.gstin}</p>
            )}
          </div>

          {/* Date, Bill No & Meta */}
          <div className="p-2 sm:p-3 space-y-1.5">
            <div className="flex">
              <span className="w-20 font-bold text-gray-900">Date</span>
              <span className="mr-2 font-bold">:</span>
              <span className="font-medium">{vm.invoiceDate}</span>
            </div>
            <div className="flex">
              <span className="w-20 font-bold text-gray-900">Bill No.</span>
              <span className="mr-2 font-bold">:</span>
              <span className="font-bold">{vm.invoiceNumberClean}</span>
            </div>
            {vm.isNonCash && (
              <div className="flex">
                <span className="w-20 font-bold text-purple-900">Mode</span>
                <span className="mr-2 font-bold">:</span>
                <span className="font-semibold uppercase text-purple-800 bg-purple-50 px-1 py-0.5 rounded border border-purple-200">
                  {vm.paymentModeBadge}
                </span>
              </div>
            )}
            {vm.agentCode && (
              <div className="flex text-xs text-slate-600">
                <span className="w-20 font-medium">Agent</span>
                <span className="mr-2">:</span>
                <span className="font-mono">{vm.agentCode}</span>
              </div>
            )}
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
              {vm.items.map((item) => (
                <tr key={item.id} className="min-h-[28px]">
                  <td className="border-r border-black py-1.5 px-2 text-center font-medium">
                    {item.index}
                  </td>
                  <td className="border-r border-black py-1.5 px-3 text-left font-medium">
                    {item.name}
                  </td>
                  <td className="border-r border-black py-1.5 px-2 text-right font-mono">
                    {item.displayQty}
                  </td>
                  <td className="border-r border-black py-1.5 px-2 text-center text-gray-700">
                    {item.unit}
                  </td>
                  <td className="border-r border-black py-1.5 px-3 text-right font-mono">
                    {item.rateFormatted}
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono font-semibold">
                    {item.amountFormatted}
                  </td>
                </tr>
              ))}

              {/* Pad minimum rows for authentic bill sheet look */}
              {vm.items.length < 5 &&
                Array.from({ length: 5 - vm.items.length }).map((_, i) => (
                  <tr key={`pad-${i}`} className="h-7">
                    <td className="border-r border-black">&nbsp;</td>
                    <td className="border-r border-black">&nbsp;</td>
                    <td className="border-r border-black">&nbsp;</td>
                    <td className="border-r border-black">&nbsp;</td>
                    <td className="border-r border-black">&nbsp;</td>
                    <td>&nbsp;</td>
                  </tr>
                ))}
            </tbody>
            <tfoot>
              {/* Total row */}
              <tr className="border-t border-black font-bold">
                <td colSpan={2} className="border-r border-black py-2 px-3 text-right">
                  Total :
                </td>
                <td className="border-r border-black py-2 px-2 text-right font-mono">
                  {vm.totalPieces.toFixed(2)}
                </td>
                <td className="border-r border-black py-2 px-2 text-center">
                  &nbsp;
                </td>
                <td className="border-r border-black py-2 px-3 text-right">
                  &nbsp;
                </td>
                <td className="py-2 px-3 text-right font-mono text-base">
                  <div className="flex items-baseline justify-end gap-1.5">
                    {vm.gstIncluded && (
                      <span className="text-[10px] font-normal text-slate-500 lowercase italic">
                        (GST included)
                      </span>
                    )}
                    <span>{vm.payableFormatted}</span>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Amount in words & GST line */}
        <div className="border-t border-black p-2 sm:p-2.5 text-xs sm:text-sm flex flex-wrap justify-between items-center gap-2">
          <div>
            <span className="font-bold">Rupees : </span>
            <span className="font-semibold italic text-gray-800">{vm.amountInWords}</span>
          </div>
          {vm.gstIncluded && (
            <span className="text-xs text-gray-600 italic">
              GST included
            </span>
          )}
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

      {/* Bottom Footer: Delivery & Help */}
      <div className="pt-3 pb-1 text-center flex flex-col items-center text-xs font-bold text-gray-800 uppercase tracking-wide">
        <p>
          {vm.doorDeliveryText}
          {vm.doorDeliveryPhone ? `: ${vm.doorDeliveryPhone}` : ""}
        </p>
        <p className="text-[10px] text-gray-600 mt-0.5">A UNIT OF JAI MATA DI</p>
      </div>
    </div>
  );
}
