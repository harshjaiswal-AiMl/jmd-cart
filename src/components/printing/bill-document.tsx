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

export interface BillDocumentProps {
  invoice: InvoiceWithDetails;
  business?: BusinessDetails;
  variant?: "thermal" | "a4";
  copyTitle?: string;
  options?: InvoiceViewModelOptions;
}

export function BillDocument({
  invoice,
  business,
  variant = "thermal",
  copyTitle,
  options,
}: BillDocumentProps) {
  const vm = buildInvoiceViewModel(invoice, business, options);
  const modeLabel = resolveBillModeLabel(invoice);
  const isGst = invoice.documentType === "GST";
  const isA4 = variant === "a4";
  const isCancelled = invoice.status === "CANCELLED";
  const shopName = (vm.business.tradeName || vm.business.legalName || "JMD CART").toUpperCase();
  const phoneDisplay = vm.doorDeliveryPhone || vm.business.phone || "7979749009";
  const subtotalPreRoundPaise = invoice.totalPaise - invoice.roundOffPaise;
  const roundAbsFormatted = formatRupeesEN(Math.abs(invoice.roundOffPaise));

  const metaRows: Array<{ label: string; value: string }> = [
    { label: "Date/Time", value: `${vm.invoiceDate} ${vm.invoiceTime}`.trim() },
    { label: "Invoice No.", value: vm.cleanInvoiceNumber },
    { label: "Name", value: vm.customer.name || "Counter Sale" },
  ];
  if (vm.customer.mobile) {
    metaRows.push({ label: "Mobile", value: vm.customer.mobile });
  }
  if (vm.customer.address) {
    metaRows.push({ label: "Address", value: vm.customer.address });
  }
  if (vm.agent.showOnBill && vm.agent.code) {
    metaRows.push({ label: "Agent Code", value: vm.agent.code });
  }
  if (isGst && vm.customer.gstin) {
    metaRows.push({ label: "Party GSTIN", value: vm.customer.gstin });
  }

  const lineItems = invoice.items.map((item, idx) => getBillLineItemDisplay(item, idx));
  const leftGrandNote = isGst
    ? `Total Pcs: ${vm.totals.totalPiecesFormatted}`
    : `${vm.totals.totalTaxPaise > 0 ? `${vm.totals.totalTaxRupees} ` : ""}GST included`;

  return (
    <div
      data-testid="bill-document"
      className={
        isA4
          ? "w-full max-w-[210mm] mx-auto bg-white text-black p-6 shadow-sm border border-black print:border-0 print:shadow-none print:p-8"
          : "w-[74mm] max-w-full mx-auto bg-white text-black px-[3mm] py-[2.5mm] print:w-[74mm] print:m-0"
      }
      style={{
        color: "#000000",
        backgroundColor: "#FFFFFF",
        fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
        fontWeight: 800,
        fontStyle: "normal",
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1.28,
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: ${isA4 ? "A4 portrait" : "80mm auto"};
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
          className="text-center border-2 border-black py-1 mb-1.5 uppercase tracking-widest"
          style={{ fontSize: isA4 ? "18pt" : "20px", fontWeight: 900, color: "#000000" }}
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

      {/* 1. Shop Brand + Payment Mode Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-1.5 mb-0.5">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#000000"
            strokeWidth="2.6"
          >
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          <h1
            className="uppercase tracking-wide m-0"
            style={{
              fontSize: isA4 ? "24pt" : "22px",
              fontWeight: 900,
              color: "#000000",
              lineHeight: 1.15,
            }}
          >
            {shopName}
          </h1>
        </div>

        <div
          className="uppercase tracking-wider"
          style={{ fontSize: isA4 ? "18pt" : "20px", fontWeight: 900, color: "#000000" }}
        >
          {modeLabel}
        </div>

        <div style={{ fontSize: isA4 ? "12pt" : "15px", fontWeight: 800, color: "#000000" }}>
          {phoneDisplay}
        </div>

        {isGst && vm.business.address && (
          <div style={{ fontSize: isA4 ? "10.5pt" : "13px", fontWeight: 700, color: "#000000" }}>
            {vm.business.address}
          </div>
        )}
        {isGst && (vm.business.gstin || vm.business.fssai) && (
          <div style={{ fontSize: isA4 ? "10pt" : "13px", fontWeight: 700, color: "#000000" }}>
            {vm.business.gstin ? `GSTIN: ${vm.business.gstin}` : ""}
            {vm.business.gstin && vm.business.fssai ? " | " : ""}
            {vm.business.fssai ? `FSSAI: ${vm.business.fssai}` : ""}
          </div>
        )}
      </div>

      <hr className="border-0 border-t-2 border-black my-1.5" />

      {/* 2. Aligned Metadata Block */}
      <div
        className="space-y-0.5 mb-1.5"
        style={{ fontSize: isA4 ? "11.5pt" : "14px", fontWeight: 800, color: "#000000" }}
      >
        {metaRows.map((row) => (
          <div key={row.label} className="flex items-baseline leading-snug">
            <span
              className="shrink-0"
              style={{ width: isA4 ? "115px" : "92px", fontWeight: 800, color: "#000000" }}
            >
              {row.label}
            </span>
            <span
              className="shrink-0 text-center"
              style={{ width: "12px", fontWeight: 800, color: "#000000" }}
            >
              :
            </span>
            <span className="flex-1 break-words" style={{ fontWeight: 800, color: "#000000" }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/* 3. Busy-Style 2-Row Table: Header Sl | Product | Price | Amt. */}
      <table className="w-full border-collapse border-y-2 border-black my-1.5">
        <thead>
          <tr className="border-b-2 border-black">
            <th
              className="py-1 px-0.5 text-left"
              style={{ width: "10%", fontSize: isA4 ? "12.5pt" : "14px", fontWeight: 900, color: "#000000" }}
            >
              Sl
            </th>
            <th
              className="py-1 px-0.5 text-left"
              style={{ width: "44%", fontSize: isA4 ? "12.5pt" : "14px", fontWeight: 900, color: "#000000" }}
            >
              Product
            </th>
            <th
              className="py-1 px-0.5 text-right whitespace-nowrap"
              style={{ width: "22%", fontSize: isA4 ? "12.5pt" : "14px", fontWeight: 900, color: "#000000" }}
            >
              Price
            </th>
            <th
              className="py-1 px-0.5 text-right whitespace-nowrap"
              style={{ width: "24%", fontSize: isA4 ? "12.5pt" : "14px", fontWeight: 900, color: "#000000" }}
            >
              Amt.
            </th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item) => (
            <React.Fragment key={item.id}>
              <tr>
                <td
                  className="pt-1.5 pb-0.5 px-0.5 text-left align-top"
                  style={{ fontSize: isA4 ? "13pt" : "15.5px", fontWeight: 800, color: "#000000" }}
                >
                  {item.sl}
                </td>
                <td
                  colSpan={3}
                  className="pt-1.5 pb-0.5 px-0.5 text-left align-top break-words"
                  style={{
                    fontSize: isA4 ? "13pt" : "15.5px",
                    fontWeight: 800,
                    lineHeight: 1.24,
                    color: "#000000",
                  }}
                >
                  {item.fullName}
                </td>
              </tr>
              <tr>
                <td className="pb-1.5 px-0.5" />
                <td
                  className="pb-1.5 pr-0.5 pl-1 text-left whitespace-nowrap"
                  style={{ fontSize: isA4 ? "12pt" : "14.5px", fontWeight: 800, color: "#000000" }}
                >
                  <span
                    className="inline-block"
                    style={{ minWidth: isA4 ? "54px" : "46px" }}
                  >
                    {item.qtyDisplay}
                  </span>
                  <span>{item.unitDisplay}</span>
                </td>
                <td
                  className="pb-1.5 px-0.5 text-right whitespace-nowrap"
                  style={{ fontSize: isA4 ? "12pt" : "14.5px", fontWeight: 800, color: "#000000" }}
                >
                  {item.rateFormatted}
                </td>
                <td
                  className="pb-1.5 px-0.5 text-right whitespace-nowrap"
                  style={{ fontSize: isA4 ? "12pt" : "14.5px", fontWeight: 900, color: "#000000" }}
                >
                  {item.amountFormatted}
                </td>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>

      {/* 4. Totals + Round-Off + Grand Total */}
      <div className="mt-1">
        <div
          className="flex justify-between items-baseline"
          style={{ fontSize: isA4 ? "13pt" : "16px", fontWeight: 800, color: "#000000" }}
        >
          <span>Total</span>
          <span>{formatRupeesEN(subtotalPreRoundPaise)}</span>
        </div>

        {invoice.roundOffPaise !== 0 && (
          <div
            className="flex justify-between items-baseline mt-0.5"
            style={{ fontSize: isA4 ? "11.5pt" : "14px", fontWeight: 800, color: "#000000" }}
          >
            <span>
              {invoice.roundOffPaise > 0 ? "Add : Rounded Off (+" : "Less : Rounded Off (-"}
            </span>
            <span>{roundAbsFormatted})</span>
          </div>
        )}

        <div
          className="flex justify-between items-center gap-2 border-y-[2.5px] border-black py-1.5 my-1.5"
          style={{ color: "#000000" }}
        >
          <div
            className="leading-tight"
            style={{ fontSize: isA4 ? "11pt" : "13px", fontWeight: 800, color: "#000000" }}
          >
            {leftGrandNote}
          </div>
          <div
            className="whitespace-nowrap tracking-tight"
            style={{ fontSize: isA4 ? "22pt" : "26px", fontWeight: 900, color: "#000000" }}
          >
            ₹{formatRupeesEN(invoice.totalPaise)}
          </div>
        </div>
      </div>

      {/* 5. In Words */}
      <div
        className="my-1 leading-snug"
        style={{ fontSize: isA4 ? "10.5pt" : "13px", fontWeight: 800, color: "#000000" }}
      >
        In Words: {vm.amountInWords}
      </div>

      {/* 6. GST HSN Summary when GST invoice */}
      {isGst && (
        <div
          className="border-[1.5px] border-black p-1 my-1.5"
          style={{ fontSize: isA4 ? "10pt" : "12.5px", fontWeight: 800, color: "#000000" }}
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

      {/* 7. Centered Footer */}
      <div
        className="text-center mt-1.5 pt-1.5 border-t-[1.5px] border-black leading-snug"
        style={{ fontSize: isA4 ? "11pt" : "14px", fontWeight: 800, color: "#000000" }}
      >
        <div>THANK YOU! VISIT AGAIN!</div>
        <div>CALL US FOR FREE DOOR DELIVERY</div>
        <div>{phoneDisplay}</div>
        <div
          className="mt-0.5"
          style={{ fontSize: isA4 ? "9.5pt" : "12px", fontWeight: 800, color: "#000000" }}
        >
          A unit of Jai Mata Di
        </div>
      </div>
    </div>
  );
}
