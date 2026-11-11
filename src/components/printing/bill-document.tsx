import React from "react";
import { InvoiceWithDetails } from "@/modules/billing/billing.types";
import { BusinessDetails } from "@/modules/settings/settings.types";
import {
  buildInvoiceViewModel,
  InvoiceViewModelOptions,
} from "@/modules/billing/invoice-view-model";
import {
  formatRupeesEN,
  getBillLineItemDisplay,
  resolveBillModeLabel,
} from "@/lib/printing/bill-format";
import { formatDDMMYYYY } from "@/lib/date";

export interface BillDocumentProps {
  invoice: InvoiceWithDetails;
  business?: BusinessDetails;
  variant?: "thermal" | "a4";
  copyTitle?: string;
  options?: InvoiceViewModelOptions;
  paperWidthMm?: number;
  contentWidthMm?: number;
}

export function BillDocument({
  invoice,
  business,
  variant = "thermal",
  copyTitle,
  options,
  paperWidthMm = 80,
  contentWidthMm = 72,
}: BillDocumentProps) {
  const vm = buildInvoiceViewModel(invoice, business, options);
  const modeLabel = resolveBillModeLabel(invoice);
  const isGst = invoice.documentType === "GST";
  const isA4 = variant === "a4";
  const isCancelled = invoice.status === "CANCELLED";
  const phoneDisplay = vm.doorDeliveryPhone || vm.business.phone || "7979749009";
  const subtotalPreRoundPaise = invoice.totalPaise - invoice.roundOffPaise;
  const roundAbsFormatted = formatRupeesEN(Math.abs(invoice.roundOffPaise));

  const nonCreditPaidPaise = (invoice.payments || [])
    .filter((p) => p.mode !== "CREDIT")
    .reduce((sum, p) => sum + p.amountPaise, 0);
  const isCreditBill =
    vm.isCredit ||
    (invoice.payments || []).some((p) => p.mode === "CREDIT") ||
    invoice.paymentStatus === "PENDING" ||
    invoice.paymentStatus === "PARTIAL";
  const amountPendingPaise = isCreditBill
    ? Math.max(0, invoice.totalPaise - nonCreditPaidPaise)
    : 0;

  const dateStr = formatDDMMYYYY(invoice.createdAt);
  const headerRows: Array<{ label: string; value: string }> = [
    { label: "Date", value: dateStr },
    { label: "Bill No", value: vm.cleanInvoiceNumber },
    { label: "Party", value: vm.customer.name || "Counter Sale" },
  ];
  if (vm.customer.mobile) {
    headerRows.push({ label: "Mobile", value: vm.customer.mobile });
  }
  headerRows.push({ label: "Mode", value: modeLabel });
  if (isGst && vm.customer.gstin) {
    headerRows.push({ label: "GSTIN", value: vm.customer.gstin });
  }

  const lineItems = invoice.items.map((item, idx) => getBillLineItemDisplay(item, idx));
  const leftGrandNote = isGst
    ? `Total Pcs: ${vm.totals.totalPiecesFormatted}`
    : `${vm.totals.totalTaxPaise > 0 ? `${vm.totals.totalTaxRupees} ` : ""}GST included`;

  const sz = (thermalPx: string, a4Pt: string) => (isA4 ? a4Pt : thermalPx);

  return (
    <div
      data-testid="bill-document"
      className={
        isA4
          ? "w-full max-w-[210mm] mx-auto bg-white text-black p-6 shadow-sm border border-black print:border-0 print:shadow-none print:p-8"
          : "mx-auto bg-white text-black print:m-0"
      }
      style={{
        width: isA4 ? undefined : `${contentWidthMm}mm`,
        maxWidth: "100%",
        padding: isA4 ? undefined : "2mm 1.5mm",
        color: "#000000",
        backgroundColor: "#FFFFFF",
        fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
        fontSize: sz("12px", "10.5pt"),
        fontWeight: 700,
        fontStyle: "normal",
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1.25,
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: ${isA4 ? "A4 portrait" : `${paperWidthMm}mm auto`};
                margin: 0 !important;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #FFFFFF !important;
                color: #000000 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
          `,
        }}
      />

      {isCancelled && (
        <div
          className="text-center border-2 border-black py-0.5 mb-1.5 uppercase tracking-widest"
          style={{ fontSize: sz("16px", "15pt"), fontWeight: 900, color: "#000000" }}
        >
          CANCELLED
        </div>
      )}

      {isA4 && copyTitle && (
        <div
          className="text-right uppercase mb-1"
          style={{ fontSize: "10pt", fontWeight: 800, color: "#000000" }}
        >
          {copyTitle}
        </div>
      )}

      {/* 1. Centered 480px B&W Floyd-Steinberg Thermal Logo FIRST */}
      <div className="text-center mb-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/jmd-cart-logo-thermal.png"
          alt="JMDCART"
          width={480}
          style={{
            width: isA4 ? "180px" : "54mm",
            maxWidth: "100%",
            height: "auto",
            display: "block",
            margin: "0 auto 4px",
            imageRendering: "pixelated",
          }}
        />
        <div style={{ fontSize: sz("12px", "11pt"), fontWeight: 800, color: "#000000" }}>
          Ph: {phoneDisplay}
        </div>
        {isGst && vm.business.address && (
          <div style={{ fontSize: sz("11px", "10pt"), fontWeight: 700, color: "#000000" }}>
            {vm.business.address}
          </div>
        )}
        {isGst && (vm.business.gstin || vm.business.fssai) && (
          <div style={{ fontSize: sz("11px", "10pt"), fontWeight: 700, color: "#000000" }}>
            {vm.business.gstin ? `GSTIN: ${vm.business.gstin}` : ""}
            {vm.business.gstin && vm.business.fssai ? " | " : ""}
            {vm.business.fssai ? `FSSAI: ${vm.business.fssai}` : ""}
          </div>
        )}
      </div>

      <hr className="border-0 border-t-[1.5px] border-black my-1.5" />

      {/* 2. Header Block (Date, Bill No, Party, Mobile, Mode) */}
      <div
        className="space-y-0.5 mb-1.5"
        style={{ fontSize: sz("12px", "10.5pt"), fontWeight: 800, color: "#000000" }}
      >
        {headerRows.map((row) => (
          <div key={row.label} className="flex items-baseline leading-snug">
            <span
              className="shrink-0"
              style={{ width: isA4 ? "95px" : "62px", fontWeight: 800, color: "#000000" }}
            >
              {row.label}
            </span>
            <span className="shrink-0 text-center" style={{ width: "10px", fontWeight: 800 }}>
              :
            </span>
            <span className="flex-1 break-words" style={{ fontWeight: 800, color: "#000000" }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/* 3. 5-Column Items Table: Sl No | Product | Qty | Rate | Amount */}
      <table
        className="w-full border-collapse border-y-[1.5px] border-black my-1.5"
        style={{ tableLayout: "fixed" }}
      >
        <thead>
          <tr className="border-b-[1.5px] border-black">
            <th
              className="py-1 px-[1.5px] text-left"
              style={{ width: "7%", fontSize: sz("11px", "10pt"), fontWeight: 900, color: "#000000" }}
            >
              Sl No
            </th>
            <th
              className="py-1 px-[1.5px] text-left"
              style={{ width: "32%", fontSize: sz("11px", "10pt"), fontWeight: 900, color: "#000000" }}
            >
              Product
            </th>
            <th
              className="py-1 px-[1.5px] text-right whitespace-nowrap"
              style={{ width: "20%", fontSize: sz("11px", "10pt"), fontWeight: 900, color: "#000000" }}
            >
              Qty
            </th>
            <th
              className="py-1 px-[1.5px] text-right whitespace-nowrap"
              style={{ width: "20%", fontSize: sz("11px", "10pt"), fontWeight: 900, color: "#000000" }}
            >
              Rate
            </th>
            <th
              className="py-1 px-[1.5px] text-right whitespace-nowrap"
              style={{ width: "21%", fontSize: sz("11px", "10pt"), fontWeight: 900, color: "#000000" }}
            >
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item) => (
            <tr key={item.id} className="border-b border-black/30">
              <td
                className="py-1 px-[1.5px] text-left align-top"
                style={{ fontSize: sz("11px", "10pt"), fontWeight: 800, color: "#000000" }}
              >
                {item.sl}
              </td>
              <td
                className="py-1 px-[1.5px] text-left align-top"
                style={{
                  fontSize: sz("11px", "10pt"),
                  fontWeight: 800,
                  lineHeight: 1.25,
                  color: "#000000",
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                }}
              >
                {item.fullName}
              </td>
              <td
                className="py-1 px-[1.5px] text-right align-top whitespace-nowrap"
                style={{ fontSize: sz("11px", "10pt"), fontWeight: 800, color: "#000000" }}
              >
                {item.qtyLabel}
              </td>
              <td
                className="py-1 px-[1.5px] text-right align-top whitespace-nowrap"
                style={{ fontSize: sz("11px", "10pt"), fontWeight: 800, color: "#000000" }}
              >
                {item.rateFormatted}
              </td>
              <td
                className="py-1 px-[1.5px] text-right align-top whitespace-nowrap"
                style={{ fontSize: sz("11px", "10pt"), fontWeight: 900, color: "#000000" }}
              >
                {item.amountFormatted}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 4. Totals + Round-off + Grand Total */}
      <div className="mt-1">
        <div
          className="flex justify-between items-baseline"
          style={{ fontSize: sz("13px", "11.5pt"), fontWeight: 800, color: "#000000" }}
        >
          <span>Total</span>
          <span>₹{formatRupeesEN(subtotalPreRoundPaise)}</span>
        </div>

        {invoice.roundOffPaise !== 0 && (
          <div
            className="flex justify-between items-baseline mt-0.5"
            style={{ fontSize: sz("11px", "10pt"), fontWeight: 800, color: "#000000" }}
          >
            <span>Round-off</span>
            <span>
              {invoice.roundOffPaise > 0 ? `+₹${roundAbsFormatted}` : `-₹${roundAbsFormatted}`}
            </span>
          </div>
        )}

        <div
          className="flex flex-wrap justify-between items-center gap-x-2 gap-y-0.5 border-y-[2px] border-black py-1.5 my-1.5"
          style={{ color: "#000000" }}
        >
          <div
            className="leading-tight"
            style={{ fontSize: sz("11px", "10pt"), fontWeight: 800, color: "#000000" }}
          >
            {leftGrandNote}
          </div>
          <div
            className="whitespace-nowrap"
            style={{ fontSize: sz("17px", "16pt"), fontWeight: 900, color: "#000000" }}
          >
            Grand Total: ₹{formatRupeesEN(invoice.totalPaise)}
          </div>
        </div>

        {/* 5. Credit bills ONLY: one plain bold line below Grand Total (no box, no border, no stamp, no colour) */}
        {isCreditBill && amountPendingPaise > 0 && (
          <div
            data-testid="amount-pending-line"
            style={{
              fontSize: sz("14px", "12pt"),
              fontWeight: 900,
              color: "#000000",
              margin: "3px 0",
            }}
          >
            Amount Pending: ₹{formatRupeesEN(amountPendingPaise)}
          </div>
        )}
      </div>

      {/* GST HSN Summary when GST invoice */}
      {isGst && (
        <div
          className="border border-black p-1 my-1.5"
          style={{ fontSize: sz("11px", "10pt"), fontWeight: 800, color: "#000000" }}
        >
          <div className="mb-1" style={{ fontWeight: 900 }}>
            GST &amp; HSN TAX SUMMARY
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-black">
                <th className="text-left py-0.5">HSN/Rate</th>
                <th className="text-right py-0.5">Taxable</th>
                <th className="text-right py-0.5">CGST</th>
                <th className="text-right py-0.5">SGST</th>
              </tr>
            </thead>
            <tbody>
              {vm.hsnTaxSummary.map((row, rIdx) => (
                <tr key={rIdx} className="border-b border-black">
                  <td className="py-0.5">
                    {row.hsn || "-"} ({row.gstRatePct}%)
                  </td>
                  <td className="text-right py-0.5">{row.taxableRupees}</td>
                  <td className="text-right py-0.5">{row.cgstRupees}</td>
                  <td className="text-right py-0.5">{row.sgstRupees}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 6. Centered Footer */}
      <div
        className="text-center mt-1.5 pt-1.5 border-t border-black leading-snug"
        style={{ fontSize: sz("11px", "10pt"), fontWeight: 800, color: "#000000" }}
      >
        <div>THANK YOU! VISIT AGAIN!</div>
        <div>CALL US FOR FREE DOOR DELIVERY</div>
        <div>{phoneDisplay}</div>
      </div>
    </div>
  );
}
