import React from "react";
import { InvoiceWithDetails } from "@/modules/billing/billing.types";
import { BusinessDetails } from "@/modules/settings/settings.types";
import {
  buildInvoiceViewModel,
  InvoiceViewModelOptions,
} from "@/modules/billing/invoice-view-model";

export interface A5InvoiceProps {
  invoice: InvoiceWithDetails;
  business?: BusinessDetails;
  options?: InvoiceViewModelOptions;
}

export function A5Invoice({ invoice, business, options }: A5InvoiceProps) {
  const vm = buildInvoiceViewModel(invoice, business, options);

  // Pagination threshold: ~14 items per page
  const ITEMS_PER_PAGE = 14;
  const totalPages = Math.ceil(vm.items.length / ITEMS_PER_PAGE) || 1;

  const pages = [];
  for (let i = 0; i < totalPages; i++) {
    pages.push(vm.items.slice(i * ITEMS_PER_PAGE, (i + 1) * ITEMS_PER_PAGE));
  }

  return (
    <div className="a5-invoice-root font-sans text-slate-900 bg-white select-text">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A5 portrait;
            margin: 6mm 8mm;
          }
          body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .a5-page {
            page-break-after: always;
            break-after: page;
            min-height: 195mm;
            max-height: 198mm;
            box-shadow: none !important;
            margin: 0 !important;
            border: none !important;
          }
          .a5-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      {pages.map((pageItems, pageIdx) => {
        const isFirstPage = pageIdx === 0;
        const isLastPage = pageIdx === totalPages - 1;

        return (
          <div
            key={pageIdx}
            className="a5-page w-[148mm] max-w-[148mm] min-h-[200mm] mx-auto p-4 bg-white border border-slate-300 shadow-sm print:shadow-none print:border-none print:p-0 flex flex-col justify-between mb-6 print:mb-0"
          >
            <div>
              {/* Header: Logo left; Right side INVOICE title, business details */}
              <div className="flex justify-between items-start pb-2">
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/brand/jmd-cart-logo-color.jpg"
                    alt="JMD Cart"
                    className="h-14 w-auto object-contain"
                  />
                </div>
                <div className="text-right">
                  <h1 className="text-xl font-black tracking-tight text-[#881337] uppercase">
                    INVOICE
                  </h1>
                  <p className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    {vm.business.tradeName}
                  </p>
                  <p className="text-[10px] text-slate-600">
                    {vm.business.legalName}
                  </p>
                  <p className="text-[9.5px] text-slate-600 max-w-[220px]">
                    {vm.business.address}
                  </p>
                  <div className="text-[9px] font-mono text-slate-700 flex justify-end gap-2 mt-0.5">
                    {vm.business.gstin && <span>GSTIN: {vm.business.gstin}</span>}
                    {vm.business.fssai && <span>FSSAI: {vm.business.fssai}</span>}
                  </div>
                </div>
              </div>

              {/* Thin Orange Rule */}
              <div className="h-[2px] bg-[#FC830D] w-full mb-2" />

              {/* Meta Row: Invoice No, Date/Time, and non-cash badge */}
              <div className="flex justify-between items-center text-[10.5px] bg-slate-50 border border-slate-200 px-2 py-1 rounded-md mb-2">
                <div className="flex gap-4">
                  <div>
                    <span className="font-semibold text-slate-600">Invoice No: </span>
                    <span className="font-bold font-mono">{vm.invoiceNumber}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600">Date: </span>
                    <span className="font-medium font-mono">{vm.dateTimeFormatted}</span>
                  </div>
                </div>
                {vm.nonCashBadge && (
                  <span className="text-[9.5px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 px-2 py-0.5 rounded">
                    {vm.nonCashBadge}
                  </span>
                )}
              </div>

              {/* Customer Details Box (first page only) */}
              {isFirstPage && (
                <div className="border border-slate-200 rounded-md p-2 mb-2 bg-[#FFFDF9] text-[10px]">
                  <p className="font-bold text-[#881337] text-[10.5px] uppercase tracking-wider mb-0.5">
                    Customer Details
                  </p>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                    {vm.customer.rows.map((row, idx) => (
                      <div key={idx} className={row.label === "Address" ? "col-span-2" : ""}>
                        <span className="font-semibold text-slate-600">{row.label}: </span>
                        <span className="font-medium text-slate-900">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Item Table: Maroon header, white text */}
              <table className="w-full text-[9.5px] border-collapse mb-2">
                <thead>
                  <tr className="bg-[#881337] text-white text-[9px] uppercase tracking-wider">
                    <th className="py-1 px-1.5 text-center w-6">#</th>
                    <th className="py-1 px-1.5 text-left">Product</th>
                    <th className="py-1 px-1 text-center w-12">Qty/Unit</th>
                    <th className="py-1 px-1 text-right w-11">MRP</th>
                    <th className="py-1 px-1 text-center w-10">Disc%</th>
                    <th className="py-1 px-1 text-right w-12">Rate</th>
                    <th className="py-1 px-1.5 text-right w-14">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {pageItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-1 px-1.5 text-center text-slate-500 font-mono">
                        {item.sl}
                      </td>
                      <td className="py-1 px-1.5 font-semibold text-slate-900 leading-tight">
                        {item.name}
                        {item.hsn && (
                          <span className="text-[8px] text-slate-500 font-normal ml-1">
                            (HSN: {item.hsn})
                          </span>
                        )}
                      </td>
                      <td className="py-1 px-1 text-center font-mono text-slate-800">
                        {item.qtyFormatted} {item.unit}
                      </td>
                      <td className="py-1 px-1 text-right font-mono text-slate-600">
                        {item.mrpRupees}
                      </td>
                      <td className="py-1 px-1 text-center font-mono font-bold text-emerald-700">
                        {item.discPct > 0 ? `${item.discPct}%` : "0%"}
                      </td>
                      <td className="py-1 px-1 text-right font-mono font-medium text-slate-900">
                        {item.rateRupees}
                      </td>
                      <td className="py-1 px-1.5 text-right font-mono font-bold text-slate-900">
                        {item.amountRupees}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* HSN-wise GST Summary (if supported and last page) */}
              {isLastPage && vm.hsnTaxSummary.length > 0 && (
                <div className="mb-2">
                  <p className="text-[8.5px] font-bold text-slate-700 uppercase tracking-wider mb-0.5">
                    GST Tax Breakdown
                  </p>
                  <table className="w-full text-[8.5px] border border-slate-200 border-collapse">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th className="py-0.5 px-1 text-left">HSN</th>
                        <th className="py-0.5 px-1 text-center">Rate</th>
                        <th className="py-0.5 px-1 text-right">Taxable</th>
                        <th className="py-0.5 px-1 text-right">CGST</th>
                        <th className="py-0.5 px-1 text-right">SGST</th>
                        <th className="py-0.5 px-1 text-right">Total Tax</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {vm.hsnTaxSummary.map((h, i) => (
                        <tr key={i}>
                          <td className="py-0.5 px-1 text-left">{h.hsn}</td>
                          <td className="py-0.5 px-1 text-center">{h.gstRatePct}%</td>
                          <td className="py-0.5 px-1 text-right">₹{h.taxableRupees}</td>
                          <td className="py-0.5 px-1 text-right">₹{h.cgstRupees}</td>
                          <td className="py-0.5 px-1 text-right">₹{h.sgstRupees}</td>
                          <td className="py-0.5 px-1 text-right font-semibold">₹{h.totalTaxRupees}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Bottom Section: Totals, Amount in Words & Footer (only on last page) */}
            {isLastPage ? (
              <div className="pt-2 border-t border-slate-200">
                {/* Totals Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-md p-2 space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-slate-600 font-medium">Subtotal ({vm.totals.itemsCount} items / {vm.totals.totalPiecesFormatted} units):</span>
                    <span className="font-mono font-medium">₹{vm.totals.subtotalRupees}</span>
                  </div>
                  {vm.totals.roundOffPaise !== 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Round Off ({vm.totals.roundOffPaise > 0 ? "+" : "-"}):</span>
                      <span className="font-mono">₹{Math.abs(Number(vm.totals.roundOffRupees)).toFixed(2)}</span>
                    </div>
                  )}

                  {/* Highlighted Payable Bar */}
                  <div className="bg-[#881337] text-white p-1.5 rounded flex justify-between items-center font-bold text-xs mt-1">
                    <div className="flex items-baseline gap-2">
                      <span className="tracking-wide">PAYABLE AMOUNT:</span>
                      {vm.totals.isGstIncluded && (
                        <span className="text-[9px] font-normal italic text-slate-200 lowercase">
                          (gst included)
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-sm tracking-wide">
                      ₹{vm.totals.payableRupees}
                    </span>
                  </div>
                </div>

                {/* Amount in words */}
                <div className="text-[10px] text-slate-800 italic pt-1.5 pb-2">
                  <span className="font-bold not-italic">Amount in words: </span>
                  {vm.totals.amountInWords}
                </div>

                {/* Agent Code if enabled */}
                {vm.agent.showOnBill && (
                  <div className="text-[9px] font-mono text-slate-500 pb-1">
                    Agent: {vm.agent.code}
                  </div>
                )}

                {/* Footer */}
                <div className="border-t border-[#FC830D] pt-2 text-center text-[9.5px] text-slate-600 uppercase tracking-wide space-y-0.5">
                  <p className="font-bold text-slate-900">{vm.business.footerThankYou}</p>
                  <p className="font-semibold text-[#881337]">
                    {vm.business.footerDeliveryText}: {vm.business.footerDeliveryPhone}
                  </p>
                  <p className="text-[8px] text-slate-500 normal-case">
                    This is a computer-generated invoice. No signature required.
                  </p>
                  <p className="text-[8.5px] font-bold text-slate-700 tracking-widest pt-0.5">
                    BHAROSA GHAR TAK.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-right text-[9px] text-slate-500 italic pt-2 border-t border-slate-200">
                Continued on next page... (Page {pageIdx + 1} of {totalPages})
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
