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
            size: auto;
            margin: 2mm 3mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          .demand-bill-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 2mm !important;
            box-shadow: none !important;
            border: 1px solid black !important;
            box-sizing: border-box !important;
          }
          .demand-bill-table {
            width: 100% !important;
            table-layout: fixed !important;
          }
        }
      `}} />
      <div className="demand-bill-container bg-white text-black font-sans w-full max-w-[760px] mx-auto p-3 sm:p-5 print:p-1 border border-black print:border-black shadow-md print:shadow-none relative select-text">
        {/* Top Header with New Logo at TOP */}
        <div className="text-center pb-2 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/jmd-cart-logo-color.jpg"
            alt="JMD Cart"
            className="w-40 sm:w-48 max-w-[190px] h-auto object-contain mx-auto mb-1"
          />
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-gray-900">
            Demand Bill
          </h1>
          {vm.business.phone && (
            <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5 tracking-wider">
              {vm.business.phone}
            </p>
          )}
        </div>

        {/* Main Bordered Bill Box */}
        <div className="border border-black">
          {/* Top Two-Column Header: Party Details vs Date & Bill No */}
          <div className="grid grid-cols-2 border-b border-black text-xs sm:text-sm print:text-[10px]">
            {/* Party Details Column */}
            <div className="p-2 sm:p-3 print:p-1.5 border-r border-black space-y-1 print:space-y-0.5">
              <p className="font-bold italic text-gray-900">Party Details :</p>
              <p className="font-semibold uppercase text-gray-900 break-words">
                {vm.customer.name || "Cash / Retail Customer"}
              </p>
              {vm.customer.address && (
                <p className="text-gray-800 leading-snug break-words">{vm.customer.address}</p>
              )}
              {vm.customer.mobile && (
                <p className="font-medium text-gray-800">{vm.customer.mobile}</p>
              )}
              {vm.customer.gstin && (
                <p className="font-mono text-[10px] sm:text-xs text-gray-800">GSTIN: {vm.customer.gstin}</p>
              )}
            </div>

            {/* Date, Bill No & Meta */}
            <div className="p-2 sm:p-3 print:p-1.5 space-y-1 print:space-y-0.5">
              <div className="flex">
                <span className="w-16 sm:w-20 font-bold text-gray-900 shrink-0">Date</span>
                <span className="mr-1.5 font-bold">:</span>
                <span className="font-medium">{vm.invoiceDate}</span>
              </div>
              <div className="flex">
                <span className="w-16 sm:w-20 font-bold text-gray-900 shrink-0">Bill No.</span>
                <span className="mr-1.5 font-bold">:</span>
                <span className="font-bold break-all">{vm.invoiceNumberClean}</span>
              </div>
              {vm.isNonCash && (
                <div className="flex">
                  <span className="w-16 sm:w-20 font-bold text-purple-900 shrink-0">Mode</span>
                  <span className="mr-1.5 font-bold">:</span>
                  <span className="font-semibold uppercase text-purple-800 bg-purple-50 px-1 py-0.5 rounded border border-purple-200">
                    {vm.paymentModeBadge}
                  </span>
                </div>
              )}
              {vm.agentCode && (
                <div className="flex text-xs print:text-[9px] text-slate-600">
                  <span className="w-16 sm:w-20 font-medium shrink-0">Agent</span>
                  <span className="mr-1.5">:</span>
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
                className="border-[4px] sm:border-[5px] border-dashed border-[#7e22ce] text-[#7e22ce] px-4 py-1.5 sm:px-6 sm:py-2 rounded-lg font-black tracking-widest text-3xl sm:text-5xl uppercase opacity-60 print:opacity-40 shadow-inner transform -rotate-12"
                style={{
                  fontFamily: "Impact, 'Arial Black', sans-serif",
                  letterSpacing: "0.2em",
                  textShadow: "0 0 1px rgba(126, 34, 206, 0.4)",
                }}
              >
                DUES
              </div>
            </div>

            <table className="demand-bill-table w-full text-[11px] sm:text-xs md:text-sm print:text-[10px] border-collapse table-fixed">
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
                  <th className="border-r border-black py-1 px-1.5 w-[14%] text-right">
                    Rate
                  </th>
                  <th className="py-1 px-1.5 w-[14%] text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {vm.items.map((item) => (
                  <tr key={item.id} className="min-h-[24px]">
                    <td className="border-r border-black py-1 px-1 text-center font-medium">
                      {item.index}
                    </td>
                    <td className="border-r border-black py-1 px-1.5 text-left font-medium break-words leading-tight">
                      {item.name}
                    </td>
                    <td className="border-r border-black py-1 px-1 text-right font-mono">
                      {item.displayQty}
                    </td>
                    <td className="border-r border-black py-1 px-1 text-center text-gray-700">
                      {item.unit}
                    </td>
                    <td className="border-r border-black py-1 px-1.5 text-right font-mono whitespace-nowrap">
                      {item.rateFormatted}
                    </td>
                    <td className="py-1 px-1.5 text-right font-mono font-semibold whitespace-nowrap">
                      {item.amountFormatted}
                    </td>
                  </tr>
                ))}

                {/* Pad minimum rows for authentic bill sheet look */}
                {vm.items.length < 5 &&
                  Array.from({ length: 5 - vm.items.length }).map((_, i) => (
                    <tr key={`pad-${i}`} className="h-6">
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
                  <td colSpan={2} className="border-r border-black py-1.5 px-2 text-right">
                    Total :
                  </td>
                  <td className="border-r border-black py-1.5 px-1 text-right font-mono">
                    {vm.totalPieces.toFixed(2)}
                  </td>
                  <td className="border-r border-black py-1.5 px-1 text-center">
                    &nbsp;
                  </td>
                  <td className="border-r border-black py-1.5 px-1.5 text-right">
                    &nbsp;
                  </td>
                  <td className="py-1.5 px-1.5 text-right font-mono text-xs sm:text-base font-bold whitespace-nowrap">
                    <div className="flex items-baseline justify-end gap-1">
                      {vm.gstIncluded && (
                        <span className="text-[9px] font-normal text-slate-500 lowercase italic">
                          (GST inc.)
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
          <div className="border-t border-black p-2 text-xs sm:text-sm print:text-[10px] flex flex-wrap justify-between items-center gap-2">
            <div>
              <span className="font-bold">Rupees : </span>
              <span className="font-semibold italic text-gray-800 break-words">{vm.amountInWords}</span>
            </div>
            {vm.gstIncluded && (
              <span className="text-xs print:text-[9px] text-gray-600 italic">
                GST included
              </span>
            )}
          </div>

          {/* Signatures section */}
          <div className="grid grid-cols-2 border-t border-black h-16 sm:h-20 text-xs sm:text-sm print:text-[10px]">
            <div className="p-2 border-r border-black flex flex-col justify-end italic text-gray-800">
              Receiver&apos;s Signature
            </div>
            <div className="p-2 flex flex-col justify-end items-end italic text-gray-800">
              Authorised Signatory
            </div>
          </div>
        </div>

        {/* Bottom Footer: Delivery & Help */}
        <div className="pt-2 pb-1 text-center flex flex-col items-center text-[10px] sm:text-xs font-bold text-gray-800 uppercase tracking-wide">
          <p>
            {vm.doorDeliveryText}
            {vm.doorDeliveryPhone ? `: ${vm.doorDeliveryPhone}` : ""}
          </p>
          <p className="text-[9px] text-gray-600 mt-0.5">A UNIT OF JAI MATA DI</p>
        </div>
      </div>
    </>
  );
}
