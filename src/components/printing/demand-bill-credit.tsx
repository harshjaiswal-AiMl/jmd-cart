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
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A5 portrait;
            margin: 4mm 5mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            width: 100% !important;
          }
          .demand-bill-container {
            width: 100% !important;
            max-width: 138mm !important;
            margin: 0 auto !important;
            padding: 1mm !important;
            box-shadow: none !important;
            border: 1px solid black !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
          }
          .demand-bill-table {
            width: 100% !important;
            table-layout: fixed !important;
          }
        }
      `}} />
      <div className="demand-bill-container bg-white text-black font-sans w-full max-w-[138mm] mx-auto p-2 sm:p-4 print:p-1 border border-black print:border-black shadow-md print:shadow-none relative select-text box-border">
        {/* Top Header with Compact Logo for A5 */}
        <div className="text-center pb-1 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/jmd-cart-logo-color.jpg"
            alt="JMD Cart"
            className="h-10 w-auto max-w-[110px] object-contain mx-auto mb-0.5"
          />
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-gray-900 leading-tight">
            Demand Bill
          </h1>
          {vm.business.phone && (
            <p className="text-[10px] sm:text-xs font-bold text-gray-800 tracking-wider">
              {vm.business.phone}
            </p>
          )}
        </div>

        {/* Main Bordered Bill Box */}
        <div className="border border-black">
          {/* Top Two-Column Header: Party Details vs Date & Bill No */}
          <div className="grid grid-cols-2 border-b border-black text-[10px] sm:text-xs print:text-[9.5px]">
            {/* Party Details Column */}
            <div className="p-1.5 sm:p-2.5 print:p-1 border-r border-black space-y-0.5">
              <p className="font-bold italic text-gray-900">Party Details :</p>
              <p className="font-semibold uppercase text-gray-900 break-words leading-tight">
                {vm.customer.name || "Cash / Retail Customer"}
              </p>
              {vm.customer.address && (
                <p className="text-gray-800 leading-tight break-words">{vm.customer.address}</p>
              )}
              {vm.customer.mobile && (
                <p className="font-medium text-gray-800">{vm.customer.mobile}</p>
              )}
              {vm.customer.gstin && (
                <p className="font-mono text-[9px] text-gray-800">GSTIN: {vm.customer.gstin}</p>
              )}
            </div>

            {/* Date, Bill No & Meta */}
            <div className="p-1.5 sm:p-2.5 print:p-1 space-y-0.5">
              <div className="flex">
                <span className="w-14 sm:w-16 font-bold text-gray-900 shrink-0">Date</span>
                <span className="mr-1 font-bold">:</span>
                <span className="font-medium">{vm.invoiceDate}</span>
              </div>
              <div className="flex">
                <span className="w-14 sm:w-16 font-bold text-gray-900 shrink-0">Bill No.</span>
                <span className="mr-1 font-bold">:</span>
                <span className="font-bold break-all">{vm.invoiceNumberClean}</span>
              </div>
              {vm.isNonCash && (
                <div className="flex">
                  <span className="w-14 sm:w-16 font-bold text-purple-900 shrink-0">Mode</span>
                  <span className="mr-1 font-bold">:</span>
                  <span className="font-semibold uppercase text-purple-800 bg-purple-50 px-1 py-0.2 rounded border border-purple-200">
                    {vm.paymentModeBadge}
                  </span>
                </div>
              )}
              {vm.agentCode && (
                <div className="flex text-[9px] text-slate-600">
                  <span className="w-14 sm:w-16 font-medium shrink-0">Agent</span>
                  <span className="mr-1">:</span>
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
                className="border-[3px] sm:border-[4px] border-dashed border-[#7e22ce] text-[#7e22ce] px-3 py-1 sm:px-5 sm:py-1.5 rounded-lg font-black tracking-widest text-2xl sm:text-4xl uppercase opacity-60 print:opacity-40 shadow-inner transform -rotate-12"
                style={{
                  fontFamily: "Impact, 'Arial Black', sans-serif",
                  letterSpacing: "0.2em",
                  textShadow: "0 0 1px rgba(126, 34, 206, 0.4)",
                }}
              >
                DUES
              </div>
            </div>

            <table className="demand-bill-table w-full text-[10px] sm:text-xs print:text-[9.5px] border-collapse table-fixed">
              <thead>
                <tr className="border-b border-black text-center font-bold bg-gray-50/50">
                  <th className="border-r border-black py-1 px-1 w-[7%]">S.N.</th>
                  <th className="border-r border-black py-1 px-1.5 text-left w-[43%]">
                    Discriptions of Goods
                  </th>
                  <th className="border-r border-black py-1 px-1 w-[12%] text-right">
                    Qty
                  </th>
                  <th className="border-r border-black py-1 px-1 w-[10%] text-center">
                    Unit
                  </th>
                  <th className="border-r border-black py-1 px-1 w-[13%] text-right">
                    Rate
                  </th>
                  <th className="py-1 px-1 w-[15%] text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {vm.items.map((item) => (
                  <tr key={item.id} className="min-h-[22px]">
                    <td className="border-r border-black py-0.5 px-1 text-center font-medium">
                      {item.index}
                    </td>
                    <td className="border-r border-black py-0.5 px-1.5 text-left font-medium break-words leading-tight">
                      {item.name}
                    </td>
                    <td className="border-r border-black py-0.5 px-1 text-right font-mono">
                      {item.displayQty}
                    </td>
                    <td className="border-r border-black py-0.5 px-1 text-center text-gray-700">
                      {item.unit}
                    </td>
                    <td className="border-r border-black py-0.5 px-1 text-right font-mono">
                      {item.rateFormatted}
                    </td>
                    <td className="py-0.5 px-1 text-right font-mono font-semibold">
                      {item.amountFormatted}
                    </td>
                  </tr>
                ))}

                {/* Pad minimum rows for authentic bill sheet look */}
                {vm.items.length < 5 &&
                  Array.from({ length: 5 - vm.items.length }).map((_, i) => (
                    <tr key={`pad-${i}`} className="h-5">
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
                  <td colSpan={2} className="border-r border-black py-1 px-2 text-right">
                    Total :
                  </td>
                  <td className="border-r border-black py-1 px-1 text-right font-mono">
                    {vm.totalPieces.toFixed(2)}
                  </td>
                  <td className="border-r border-black py-1 px-1 text-center">
                    &nbsp;
                  </td>
                  <td className="border-r border-black py-1 px-1 text-right">
                    &nbsp;
                  </td>
                  <td className="py-1 px-1 text-right font-mono font-bold">
                    <div className="flex items-baseline justify-end gap-1 flex-wrap">
                      {vm.gstIncluded && (
                        <span className="text-[8px] font-normal text-slate-500 lowercase italic">
                          (gst inc.)
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
          <div className="border-t border-black p-1.5 text-[10px] sm:text-xs print:text-[9.5px] flex flex-wrap justify-between items-center gap-1">
            <div>
              <span className="font-bold">Rupees : </span>
              <span className="font-semibold italic text-gray-800 break-words">{vm.amountInWords}</span>
            </div>
            {vm.gstIncluded && (
              <span className="text-[9px] text-gray-600 italic">
                GST included
              </span>
            )}
          </div>

          {/* Signatures section */}
          <div className="grid grid-cols-2 border-t border-black h-14 sm:h-16 text-[10px] sm:text-xs print:text-[9px]">
            <div className="p-1.5 border-r border-black flex flex-col justify-end italic text-gray-800">
              Receiver&apos;s Signature
            </div>
            <div className="p-1.5 flex flex-col justify-end items-end italic text-gray-800">
              Authorised Signatory
            </div>
          </div>
        </div>

        {/* Bottom Footer: Delivery & Help */}
        <div className="pt-1.5 pb-0.5 text-center flex flex-col items-center text-[9px] sm:text-[10px] font-bold text-gray-800 uppercase tracking-wide">
          <p>
            {vm.doorDeliveryText}
            {vm.doorDeliveryPhone ? `: ${vm.doorDeliveryPhone}` : ""}
          </p>
          <p className="text-[8.5px] text-gray-600 mt-0.5">A UNIT OF JAI MATA DI</p>
        </div>
      </div>
    </>
  );
}
