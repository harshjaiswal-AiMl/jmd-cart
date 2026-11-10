import React from "react";
import { InvoiceWithDetails } from "@/modules/billing/billing.types";
import { BusinessDetails } from "@/modules/settings/settings.types";
import {
  buildInvoiceViewModel,
  InvoiceViewModelOptions,
} from "@/modules/billing/invoice-view-model";
import { BillDocument } from "./bill-document";

export interface CashReceiptSlipProps {
  invoice: InvoiceWithDetails;
  business?: BusinessDetails;
  options?: InvoiceViewModelOptions;
}

export function CashReceiptSlip({ invoice, business, options }: CashReceiptSlipProps) {
  const isCredit =
    (invoice.payments || []).some((p) => p.mode === "CREDIT") ||
    invoice.paymentStatus === "PARTIAL" ||
    (invoice.paymentStatus as string) === "UNPAID";

  // Cash & UPI: new 3-inch high-contrast Image 1 (Sl | Product | Price | Amt.) + Image 2 design
  if (!isCredit) {
    return (
      <BillDocument
        invoice={invoice}
        business={business}
        variant="thermal"
        options={options}
      />
    );
  }

  // Credit Thermal (80mm): restored pre-G12 layout with crisp dark #000 text
  const vm = buildInvoiceViewModel(invoice, business, options);

  return (
    <div
      className="cash-receipt-container font-sans text-[12px] leading-tight text-black bg-white w-[76mm] max-w-[76mm] mx-auto p-3 print:p-0 print:m-0 border border-slate-300 print:border-none shadow-sm print:shadow-none select-text"
      style={{
        color: "#000000",
        fontWeight: 700,
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page { size: 80mm auto; margin: 0 !important; }
              html, body { background: #fff !important; color: #000 !important; }
            }
          `,
        }}
      />
      <div className="text-center pb-1 flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/jmd-cart-logo-color.jpg"
          alt="JMD Cart"
          className="w-32 max-w-[130px] max-h-12 h-auto object-contain mx-auto mb-1 contrast-150 grayscale"
        />
      </div>

      <div className="border-t-2 border-black my-1" />

      <div className="text-[11.5px] leading-snug space-y-0.5 font-bold">
        <div className="flex">
          <span className="w-24 shrink-0">Date/Time</span>
          <span className="mr-1">:</span>
          <span>{vm.dateTimeFormatted}</span>
        </div>
        <div className="flex">
          <span className="w-24 shrink-0">Invoice No.</span>
          <span className="mr-1">:</span>
          <span className="font-black">{vm.cleanInvoiceNumber}</span>
        </div>
        {vm.nonCashBadge && (
          <div className="flex">
            <span className="w-24 shrink-0">Sale Type</span>
            <span className="mr-1">:</span>
            <span className="font-black uppercase tracking-wide">{vm.nonCashBadge}</span>
          </div>
        )}

        {vm.customer.rows.map((row, rIdx) => (
          <div key={rIdx} className="flex">
            <span className="w-24 shrink-0">{row.label}</span>
            <span className="mr-1">:</span>
            <span className="font-extrabold break-words flex-1 leading-tight">{row.value}</span>
          </div>
        ))}
      </div>

      <div className="border-t-2 border-black my-1.5" />

      <div className="border-b-2 border-black pb-1 text-[11px] font-black">
        <div className="flex">
          <span className="w-6 shrink-0">Sl</span>
          <span className="flex-1">Product</span>
        </div>
        <div className="flex justify-between pl-6 text-[10px] mt-0.5 font-extrabold">
          <span className="w-16">Qty/Unit</span>
          <span className="w-14 text-right">MRP</span>
          <span className="w-10 text-center">Disc%</span>
          <span className="w-14 text-right">Rate</span>
          <span className="w-16 text-right">Amt.</span>
        </div>
      </div>

      <div className="divide-y divide-black/20 py-1">
        {vm.items.map((item) => (
          <div key={item.id} className="py-1">
            <div className="flex text-[12px] font-extrabold">
              <span className="w-6 shrink-0">{item.sl}</span>
              <span className="flex-1 leading-tight">{item.name}</span>
            </div>
            <div className="flex justify-between pl-6 text-[11px] items-center mt-0.5 font-bold">
              <span className="w-16">
                {item.qtyFormatted} {item.unit}
              </span>
              <span className="w-14 text-right">{item.mrpRupees}</span>
              <span className="w-10 text-center">
                {item.discPct > 0 ? `${item.discPct}%` : "0%"}
              </span>
              <span className="w-14 text-right font-extrabold">{item.rateRupees}</span>
              <span className="w-16 text-right font-black">{item.amountRupees}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t-2 border-black mt-1 pt-1.5 space-y-1">
        <div className="flex justify-between text-[13px] font-extrabold">
          <span>Total</span>
          <span>{vm.totals.subtotalRupees}</span>
        </div>

        {vm.totals.roundOffPaise !== 0 && (
          <div className="flex justify-between text-[11.5px] font-bold">
            <span>
              {vm.totals.roundOffPaise > 0 ? "Add : Rounded Off (+" : "Less : Rounded Off (-"}
            </span>
            <span>
              {Math.abs(Number(vm.totals.roundOffRupees)).toFixed(2)}
              {")"}
            </span>
          </div>
        )}
      </div>

      <div className="border-t-2 border-b-2 border-black my-2 py-1 flex justify-between items-center text-sm font-black">
        <div className="flex items-baseline gap-2 text-xs">
          <span>{vm.totals.totalPiecesFormatted}</span>
          {vm.totals.isGstIncluded && <span>GST included</span>}
        </div>
        <span className="text-lg font-black">{vm.totals.payableRupees}</span>
      </div>

      <div className="text-[11px] font-bold pb-1.5 border-b border-black">
        <span>In Words: </span>
        {vm.totals.amountInWords}
      </div>

      {vm.isPaymentPending && vm.pendingAmountPaise > 0 && (
        <div className="text-[11.5px] font-black text-center py-1 border-b border-black">
          Payment Pending: ₹{vm.pendingAmountFormatted}
        </div>
      )}

      <div className="text-center font-extrabold text-[11px] space-y-0.5 pt-1.5 uppercase tracking-wide">
        <p>{vm.business.footerThankYou}</p>
        <p className="mt-0.5">{vm.business.footerDeliveryText}</p>
        <p className="text-xs font-black tracking-widest pb-1">
          {vm.business.footerDeliveryPhone}
        </p>
      </div>
    </div>
  );
}
