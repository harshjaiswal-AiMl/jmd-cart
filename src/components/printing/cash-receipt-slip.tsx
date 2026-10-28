import React from "react";
import { InvoiceWithDetails } from "@/modules/billing/billing.types";
import { BusinessDetails } from "@/modules/settings/settings.types";
import { buildInvoiceViewModel, InvoiceViewModelOptions } from "@/modules/billing/invoice-view-model";

export interface CashReceiptSlipProps {
  invoice: InvoiceWithDetails;
  business?: BusinessDetails;
  options?: InvoiceViewModelOptions;
}

export function CashReceiptSlip({ invoice, business, options }: CashReceiptSlipProps) {
  const vm = buildInvoiceViewModel(invoice, business, options);

  return (
    <div className="cash-receipt-container font-mono text-[11px] leading-tight text-black bg-white w-[76mm] max-w-[76mm] mx-auto p-3 print:p-0 print:m-0 border border-slate-300 print:border-none shadow-sm print:shadow-none select-text">
      {/* 1. Header: Logo only (No payment-mode CASH heading, No owner mobile) */}
      <div className="text-center pb-1 flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/jmd-cart-logo-color.jpg"
          alt="JMD Cart"
          className="w-32 max-w-[130px] max-h-12 h-auto object-contain mx-auto mb-1 print:contrast-125"
        />
      </div>

      {/* Divider */}
      <div className="border-t border-black my-1" />

      {/* 2. Meta block: Date/Time and Invoice No. stay. No Cashier row. Non-cash badge if credit/upi */}
      <div className="text-[10.5px] leading-snug space-y-0.5">
        <div className="flex">
          <span className="w-24 shrink-0 font-medium">Date/Time</span>
          <span className="mr-1">:</span>
          <span className="font-semibold">{vm.dateTimeFormatted}</span>
        </div>
        <div className="flex">
          <span className="w-24 shrink-0 font-medium">Invoice No.</span>
          <span className="mr-1">:</span>
          <span className="font-bold">{vm.cleanInvoiceNumber}</span>
        </div>
        {vm.nonCashBadge && (
          <div className="flex">
            <span className="w-24 shrink-0 font-medium">Sale Type</span>
            <span className="mr-1">:</span>
            <span className="font-black text-xs uppercase tracking-wide bg-slate-100 px-1 rounded">
              {vm.nonCashBadge}
            </span>
          </div>
        )}

        {/* 3. Customer block: Name, Mobile, Address (wraps to several lines). Omit empty rows. Clean Walk-in. */}
        {vm.customer.rows.map((row, rIdx) => (
          <div key={rIdx} className="flex">
            <span className="w-24 shrink-0 font-medium">{row.label}</span>
            <span className="mr-1">:</span>
            <span className="font-bold break-words flex-1 leading-tight">{row.value}</span>
          </div>
        ))}
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
        {vm.items.map((item) => (
          <div key={item.id} className="py-1">
            <div className="flex text-[10.5px] font-medium">
              <span className="w-6 shrink-0 font-semibold">{item.sl}</span>
              <span className="flex-1 font-semibold leading-tight">{item.name}</span>
            </div>
            <div className="flex justify-between pl-6 text-[10px] items-center mt-0.5">
              <span className="w-16 font-mono text-gray-800">
                {item.qtyFormatted} {item.unit}
              </span>
              <span className="w-14 text-right font-mono text-gray-700">
                {item.mrpRupees}
              </span>
              <span className="w-12 text-center font-mono font-medium text-emerald-800">
                {item.discPct > 0 ? `${item.discPct}%` : "0%"}
              </span>
              <span className="w-14 text-right font-mono font-bold">
                {item.rateRupees}
              </span>
              <span className="w-16 text-right font-mono font-black text-black">
                {item.amountRupees}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Subtotal & Roundoff */}
      <div className="border-t border-black mt-1 pt-1.5 space-y-1">
        <div className="flex justify-between text-[11px] font-bold">
          <span>Total</span>
          <span className="font-mono">{vm.totals.subtotalRupees}</span>
        </div>

        {vm.totals.roundOffPaise !== 0 && (
          <div className="flex justify-between text-[10px] text-gray-800">
            <span>
              {vm.totals.roundOffPaise > 0 ? "Add : Rounded Off (+" : "Less : Rounded Off (-"}
            </span>
            <span className="font-mono">
              {Math.abs(Number(vm.totals.roundOffRupees)).toFixed(2)}
              {")"}
            </span>
          </div>
        )}
      </div>

      {/* 4. Grand Total with GST included on the side, Total Quantity on left */}
      <div className="border-t-2 border-b-2 border-black my-2 py-1 flex justify-between items-center text-xs font-black">
        <div className="flex items-baseline gap-2">
          <span className="font-mono">{vm.totals.totalPiecesFormatted}</span>
          {vm.totals.isGstIncluded && (
            <span className="text-[9.5px] font-normal italic text-gray-700 tracking-tight">
              GST included
            </span>
          )}
        </div>
        <span className="font-mono text-sm">{vm.totals.payableRupees}</span>
      </div>

      {/* 4. Amount in Words below Grand Total */}
      <div className="text-[10px] font-medium italic text-gray-900 pb-1.5 border-b border-dashed border-gray-400">
        <span className="font-bold not-italic">In Words: </span>
        {vm.totals.amountInWords}
      </div>

      {/* Payment Pending notice if unpaid */}
      {vm.isPaymentPending && vm.pendingAmountPaise > 0 && (
        <div className="text-[10.5px] font-black text-center text-red-600 py-1 border-b border-dashed border-gray-400">
          Payment Pending: ₹{vm.pendingAmountFormatted} due
        </div>
      )}

      {/* Agent Code if setting is enabled */}
      {vm.agent.showOnBill && (
        <div className="text-[9px] font-mono text-gray-600 text-center py-0.5">
          Agent: {vm.agent.code}
        </div>
      )}

      {/* 6. Footer: Dynamic thank you & door delivery lines with phone from settings */}
      <div className="text-center font-bold text-[10px] space-y-0.5 pt-1 uppercase tracking-wide">
        <p>{vm.business.footerThankYou}</p>
        <p className="mt-0.5">{vm.business.footerDeliveryText}</p>
        <p className="text-xs font-black tracking-widest pb-1">
          {vm.business.footerDeliveryPhone}
        </p>
      </div>
    </div>
  );
}
