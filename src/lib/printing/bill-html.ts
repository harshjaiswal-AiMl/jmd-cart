import { InvoiceWithDetails } from "@/modules/billing/billing.types";
import { BusinessDetails } from "@/modules/settings/settings.types";
import {
  buildInvoiceViewModel,
  InvoiceViewModel,
} from "@/modules/billing/invoice-view-model";
import {
  formatRupeesEN,
  getBillLineItemDisplay,
  resolveBillModeLabel,
} from "./bill-format";
import { formatDDMMYYYY } from "@/lib/date";

function escapeHtml(text: string): string {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isCreditInvoice(invoice: InvoiceWithDetails): boolean {
  return (
    (invoice.payments || []).some((p) => p.mode === "CREDIT") ||
    invoice.paymentStatus === "PENDING" ||
    invoice.paymentStatus === "PARTIAL" ||
    (invoice.paymentStatus as string) === "UNPAID"
  );
}

/**
 * A5 Demand Bill HTML for Credit bills when format="a4".
 */
function renderCreditDemandA5Html(
  invoice: InvoiceWithDetails,
  vm: InvoiceViewModel
): string {
  const phoneDisplay = vm.doorDeliveryPhone || vm.business.phone || "7979749009";
  const padRowsCount = Math.max(0, 5 - vm.items.length);

  const itemRowsHtml = vm.items
    .map(
      (item) => `<tr>
        <td class="col-sn">${item.index}</td>
        <td class="col-desc">${escapeHtml(item.name)}</td>
        <td class="col-qty">${escapeHtml(item.displayQty)}</td>
        <td class="col-unit">${escapeHtml(item.unit)}</td>
        <td class="col-rate">${escapeHtml(item.rateFormatted)}</td>
        <td class="col-amt">${escapeHtml(item.amountFormatted)}</td>
      </tr>`
    )
    .join("");

  const padRowsHtml = Array.from({ length: padRowsCount })
    .map(
      () => `<tr class="pad-row">
        <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Demand Bill ${escapeHtml(vm.invoiceNumberClean)}</title>
<style>
  @page { size: A5 portrait; margin: 6mm; }
  * {
    box-sizing: border-box;
    color: #000000 !important;
    font-style: normal !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  html, body {
    margin: 0;
    padding: 0;
    background: #FFFFFF;
    font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
    font-size: 10pt;
    font-variant-numeric: tabular-nums;
  }
  .demand-wrap {
    width: 100%;
    max-width: 148mm;
    margin: 0 auto;
    padding: 4mm;
  }
  .top-header { text-align: center; margin-bottom: 6px; }
  .top-header .brand { font-size: 16pt; font-weight: 900; text-transform: uppercase; }
  .top-header h1 { font-size: 14pt; font-weight: 900; margin: 2px 0; text-transform: uppercase; }
  .top-header .phone { font-size: 10.5pt; font-weight: 800; }
  .box { border: 1.5px solid #000000; }
  .two-col {
    display: flex;
    justify-content: space-between;
    padding: 6px 8px;
    border-bottom: 1.5px solid #000000;
    font-size: 10pt;
    gap: 12px;
  }
  .meta-line { display: flex; margin-bottom: 2px; }
  .meta-k { width: 64px; font-weight: 800; }
  .meta-c { width: 10px; text-align: center; }
  .a5-table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  .a5-table th, .a5-table td {
    border-bottom: 1px solid #000000;
    border-right: 1px solid #000000;
    padding: 4px 5px;
  }
  .a5-table th:last-child, .a5-table td:last-child { border-right: 0; }
  .col-sn { width: 7%; text-align: center; }
  .col-desc { width: 43%; text-align: left; word-break: break-word; }
  .col-qty { width: 12%; text-align: right; }
  .col-unit { width: 10%; text-align: center; }
  .col-rate { width: 13%; text-align: right; }
  .col-amt { width: 15%; text-align: right; font-weight: 800 !important; }
  .pad-row td { height: 18px; }
  tfoot td {
    border-top: 1.5px solid #000000 !important;
    border-bottom: 0 !important;
    font-weight: 900 !important;
    padding: 5px 4px;
  }
  .words-bar {
    border-top: 1.5px solid #000000;
    padding: 5px 7px;
    font-size: 10pt;
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .sig-row {
    display: flex;
    border-top: 1.5px solid #000000;
    height: 46px;
    font-size: 10pt;
    font-weight: 700;
  }
  .sig-row > div {
    width: 50%;
    padding: 5px 7px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }
  .sig-row > div:first-child { border-right: 1.5px solid #000000; }
  .sig-row > div:last-child { align-items: flex-end; }
  .footer {
    text-align: center;
    padding-top: 5px;
    font-size: 10pt;
    font-weight: 800;
    text-transform: uppercase;
  }
  .void-banner {
    text-align: center;
    font-weight: 900;
    font-size: 15pt;
    border: 2px solid #000;
    margin-bottom: 4px;
    padding: 2px;
  }
</style>
</head>
<body>
<div class="demand-wrap">
  ${invoice.status === "CANCELLED" ? `<div class="void-banner">CANCELLED</div>` : ""}
  <div class="top-header">
    <div class="brand">${escapeHtml(vm.business.tradeName || "JMD CART")}</div>
    <h1>Demand Bill</h1>
    ${phoneDisplay ? `<div class="phone">${escapeHtml(phoneDisplay)}</div>` : ""}
  </div>

  <div class="box">
    <div class="two-col">
      <div>
        <div style="font-weight:900;margin-bottom:2px">Party Details :</div>
        <div style="font-weight:900;text-transform:uppercase">${escapeHtml(vm.customer.name || "Customer")}</div>
        ${vm.customer.address ? `<div>${escapeHtml(vm.customer.address)}</div>` : ""}
        ${vm.customer.mobile ? `<div style="font-weight:700">${escapeHtml(vm.customer.mobile)}</div>` : ""}
        ${vm.customer.gstin ? `<div style="font-size:10pt">GSTIN: ${escapeHtml(vm.customer.gstin)}</div>` : ""}
      </div>
      <div>
        <div class="meta-line"><span class="meta-k">Date</span><span class="meta-c">:</span><span>${escapeHtml(formatDDMMYYYY(invoice.createdAt))}</span></div>
        <div class="meta-line"><span class="meta-k">Bill No.</span><span class="meta-c">:</span><span style="font-weight:900">${escapeHtml(vm.invoiceNumberClean)}</span></div>
        <div class="meta-line"><span class="meta-k">Mode</span><span class="meta-c">:</span><span style="font-weight:900">${escapeHtml(vm.paymentModeBadge || "CREDIT")}</span></div>
        ${vm.agentCode ? `<div class="meta-line"><span class="meta-k">Agent</span><span class="meta-c">:</span><span>${escapeHtml(vm.agentCode)}</span></div>` : ""}
      </div>
    </div>

    <table class="a5-table">
      <thead>
        <tr>
          <th class="col-sn">S.N.</th>
          <th class="col-desc">Descriptions of Goods</th>
          <th class="col-qty">Qty</th>
          <th class="col-unit">Unit</th>
          <th class="col-rate">Rate</th>
          <th class="col-amt">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemRowsHtml}
        ${padRowsHtml}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="text-align:right">Total :</td>
          <td style="text-align:right">${escapeHtml(vm.totalPieces.toFixed(2))}</td>
          <td></td>
          <td></td>
          <td style="text-align:right">${escapeHtml(vm.payableFormatted)}</td>
        </tr>
      </tfoot>
    </table>

    <div class="words-bar">
      <div><strong>Rupees :</strong> ${escapeHtml(vm.amountInWords)}</div>
      ${vm.gstIncluded ? `<span style="font-size:10pt">GST included</span>` : ""}
    </div>

    <div class="sig-row">
      <div>Receiver's Signature</div>
      <div>Authorised Signatory</div>
    </div>
  </div>

  <div class="footer">
    <div>${escapeHtml(vm.doorDeliveryText || "CALL US FOR FREE DOOR DELIVERY")}${phoneDisplay ? `: ${escapeHtml(phoneDisplay)}` : ""}</div>
    <div style="font-size:10pt;margin-top:2px">A UNIT OF JAI MATA DI</div>
  </div>
</div>
</body>
</html>`;
}

/**
 * Generates printable standalone HTML matching R4 3-inch thermal bill (80mm roll / 72mm printable,
 * 480px dithered B&W logo first, 5 columns Sl No | Product | Qty | Rate | Amount, 11-17px type,
 * plain bold "Amount Pending: ₹X" on Credit bills only) and normalized A4 (10-16pt).
 */
export function renderDirectPrintHtml(
  invoice: InvoiceWithDetails,
  business: BusinessDetails,
  format: "thermal" | "a4" = "thermal",
  options?: { paperWidthMm?: number; contentWidthMm?: number }
): string {
  const vm = buildInvoiceViewModel(invoice, business);
  const creditBill = isCreditInvoice(invoice);

  if (creditBill && format === "a4") {
    return renderCreditDemandA5Html(invoice, vm);
  }

  const modeLabel = resolveBillModeLabel(invoice);
  const isGst = invoice.documentType === "GST";
  const isA4 = format === "a4";
  const paperWidthMm = options?.paperWidthMm ?? 80;
  const contentWidthMm = options?.contentWidthMm ?? 72;
  const phoneDisplay = vm.doorDeliveryPhone || vm.business.phone || "7979749009";
  const subtotalPreRoundPaise = invoice.totalPaise - invoice.roundOffPaise;
  const roundAbsFormatted = formatRupeesEN(Math.abs(invoice.roundOffPaise));

  const nonCreditPaidPaise = (invoice.payments || [])
    .filter((p) => p.mode !== "CREDIT")
    .reduce((sum, p) => sum + p.amountPaise, 0);
  const amountPendingPaise = creditBill
    ? Math.max(0, invoice.totalPaise - nonCreditPaidPaise)
    : 0;

  const dateStr = formatDDMMYYYY(invoice.createdAt);
  const metaRows: Array<{ label: string; value: string }> = [
    { label: "Date", value: dateStr },
    { label: "Bill No", value: vm.cleanInvoiceNumber },
    { label: "Party", value: vm.customer.name || "Counter Sale" },
  ];
  if (vm.customer.mobile) {
    metaRows.push({ label: "Mobile", value: vm.customer.mobile });
  }
  metaRows.push({ label: "Mode", value: modeLabel });
  if (isGst && vm.customer.gstin) {
    metaRows.push({ label: "GSTIN", value: vm.customer.gstin });
  }

  const metaHtml = metaRows
    .map(
      (r) => `<div class="meta-row">
        <span class="meta-label">${escapeHtml(r.label)}</span>
        <span class="meta-colon">:</span>
        <span class="meta-val">${escapeHtml(r.value)}</span>
      </div>`
    )
    .join("");

  const itemsHtml = invoice.items
    .map((item, idx) => {
      const disp = getBillLineItemDisplay(item, idx);
      return `<tr class="item-row">
        <td class="col-sl">${disp.sl}</td>
        <td class="col-prod">${escapeHtml(disp.fullName)}</td>
        <td class="col-qty">${escapeHtml(disp.qtyLabel)}</td>
        <td class="col-rate">${escapeHtml(disp.rateFormatted)}</td>
        <td class="col-amt">${escapeHtml(disp.amountFormatted)}</td>
      </tr>`;
    })
    .join("");

  const hsnRowsHtml = isGst
    ? vm.hsnTaxSummary
        .map(
          (row) =>
            `<tr>
              <td>${escapeHtml(row.hsn || "-")} (${row.gstRatePct}%)</td>
              <td style="text-align:right">${escapeHtml(row.taxableRupees)}</td>
              <td style="text-align:right">${escapeHtml(row.cgstRupees)}</td>
              <td style="text-align:right">${escapeHtml(row.sgstRupees)}</td>
            </tr>`
        )
        .join("")
    : "";

  const leftGrandNote = isGst
    ? `Total Pcs: ${escapeHtml(vm.totals.totalPiecesFormatted)}`
    : "GST included";

  const sz = (thermalPx: string, a4Pt: string) => (isA4 ? a4Pt : thermalPx);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Invoice ${escapeHtml(vm.cleanInvoiceNumber)}</title>
<style>
  @page {
    ${isA4 ? "size: A4 portrait;" : `size: ${paperWidthMm}mm auto;`}
    margin: ${isA4 ? "0" : "1mm 3mm"};
  }
  * {
    box-sizing: border-box;
    color: #000000 !important;
    font-style: normal !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  html, body {
    margin: 0;
    padding: 0;
    background: #FFFFFF;
    color: #000000;
    font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
    font-size: ${sz("8.5px", "10.5pt")};
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1.22;
    width: 100%;
  }
  .bill-sheet {
    width: ${isA4 ? "100%" : `${Math.min(contentWidthMm, 66)}mm`};
    max-width: 100%;
    padding: ${isA4 ? "10mm" : "1.5mm 3mm"};
    margin: 0 auto;
    background: #FFFFFF;
  }
  .logo-wrap {
    text-align: center;
    margin-bottom: 3px;
  }
  .brand-logo {
    width: ${isA4 ? "180px" : "28mm"};
    max-width: 100%;
    height: auto;
    display: block;
    margin: 0 auto 2px;
    image-rendering: pixelated;
  }
  .header-sub {
    font-size: ${sz("8px", "10pt")};
    font-weight: 700;
    text-align: center;
    margin-top: 2px;
  }
  .void-banner {
    font-size: ${sz("11px", "15pt")};
    font-weight: 900;
    text-align: center;
    border: 2px solid #000000;
    padding: 2px 0;
    margin-bottom: 3px;
    letter-spacing: 0.08em;
  }
  .rule-heavy {
    border: 0;
    border-top: 1px solid #000000;
    margin: 3px 0;
  }
  .meta-block {
    font-size: ${sz("8.5px", "10.5pt")};
    font-weight: 700;
    margin: 3px 0 4px;
  }
  .meta-row {
    display: flex;
    align-items: baseline;
    line-height: 1.24;
    margin-bottom: 1px;
  }
  .meta-label {
    width: ${isA4 ? "95px" : "46px"};
    flex-shrink: 0;
    font-weight: 800;
  }
  .meta-colon {
    width: 8px;
    flex-shrink: 0;
    text-align: center;
    font-weight: 800;
  }
  .meta-val {
    flex: 1;
    word-break: break-word;
    font-weight: 800;
  }
  table.bill-table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    border-top: 1.5px solid #000000;
    border-bottom: 1.5px solid #000000;
    margin: 3px 0;
  }
  table.bill-table thead th {
    font-size: ${sz("8px", "10pt")};
    font-weight: 900;
    border-bottom: 1px solid #000000;
    padding: 2.5px 1.5px;
    text-align: left;
  }
  table.bill-table th.col-qty,
  table.bill-table th.col-rate,
  table.bill-table th.col-amt {
    text-align: right;
  }
  table.bill-table tbody td {
    font-size: ${sz("8px", "10pt")};
    font-weight: 700;
    padding: 2px 1.5px;
    vertical-align: top;
    border-bottom: 1px solid #000000;
  }
  .col-sl { width: 9%; text-align: left; }
  .col-prod { width: 33%; text-align: left; word-break: break-word; overflow-wrap: anywhere; line-height: 1.2; }
  .col-qty { width: 19%; text-align: right; white-space: nowrap; }
  .col-rate { width: 19%; text-align: right; white-space: nowrap; }
  .col-amt { width: 20%; text-align: right; white-space: nowrap; font-weight: 800; }
  .totals-wrap { margin-top: 3px; }
  .totals-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: ${sz("9.5px", "11.5pt")};
    font-weight: 800;
    margin: 1.5px 0;
  }
  .roundoff-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: ${sz("8px", "10pt")};
    font-weight: 700;
    margin: 1.5px 0 2px;
  }
  .grand-total-bar {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 2px 6px;
    border-top: 1.5px solid #000000;
    border-bottom: 1.5px solid #000000;
    padding: 3px 0;
    margin: 3px 0;
  }
  .grand-left {
    font-size: ${sz("8px", "10pt")};
    font-weight: 800;
    line-height: 1.2;
  }
  .grand-amount {
    font-size: ${sz("11px", "16pt")};
    font-weight: 900;
    white-space: nowrap;
  }
  .amount-pending-line {
    font-size: ${sz("9.5px", "12pt")};
    font-weight: 900;
    color: #000000;
    margin: 2px 0;
  }
  .hsn-box {
    border: 1px solid #000000;
    padding: 3px;
    margin: 4px 0;
    font-size: ${sz("8px", "10pt")};
    font-weight: 700;
  }
  .hsn-box table { width: 100%; border-collapse: collapse; }
  .hsn-box th, .hsn-box td {
    padding: 1.5px 2px;
    border-bottom: 1px solid #000000;
    text-align: left;
  }
  .footer {
    text-align: center;
    border-top: 1px solid #000000;
    padding-top: 3px;
    margin-top: 4px;
    font-size: ${sz("8px", "10pt")};
    font-weight: 800;
    line-height: 1.32;
  }
</style>
</head>
<body>
<div class="bill-sheet" data-testid="bill-document">
  ${invoice.status === "CANCELLED" ? `<div class="void-banner">CANCELLED</div>` : ""}

  <div class="logo-wrap">
    <img src="/brand/jmd-cart-logo-thermal.png" alt="JMDCART" width="480" class="brand-logo" />
    ${
      isGst && vm.business.address
        ? `<div class="header-sub">${escapeHtml(vm.business.address)}</div>`
        : ""
    }
    ${
      isGst && (vm.business.gstin || vm.business.fssai)
        ? `<div class="header-sub">${vm.business.gstin ? `GSTIN: ${escapeHtml(vm.business.gstin)}` : ""}${
            vm.business.gstin && vm.business.fssai ? " | " : ""
          }${vm.business.fssai ? `FSSAI: ${escapeHtml(vm.business.fssai)}` : ""}</div>`
        : ""
    }
  </div>

  <hr class="rule-heavy" />

  <div class="meta-block">
    ${metaHtml}
  </div>

  <table class="bill-table">
    <thead>
      <tr>
        <th class="col-sl">Sl No</th>
        <th class="col-prod">Product</th>
        <th class="col-qty">Qty</th>
        <th class="col-rate">Rate</th>
        <th class="col-amt">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="totals-wrap">
    <div class="totals-row">
      <span>Total</span>
      <span>₹${escapeHtml(formatRupeesEN(subtotalPreRoundPaise))}</span>
    </div>
    ${
      invoice.roundOffPaise !== 0
        ? `<div class="roundoff-row">
            <span>Round-off</span>
            <span>${invoice.roundOffPaise > 0 ? `+₹${escapeHtml(roundAbsFormatted)}` : `-₹${escapeHtml(roundAbsFormatted)}`}</span>
          </div>`
        : ""
    }
  </div>

  <div class="grand-total-bar">
    <div class="grand-left">${leftGrandNote}</div>
    <div class="grand-amount">Grand Total: ₹${escapeHtml(formatRupeesEN(invoice.totalPaise))}</div>
  </div>

  ${
    creditBill && amountPendingPaise > 0
      ? `<div class="amount-pending-line">Amount Pending: ₹${escapeHtml(formatRupeesEN(amountPendingPaise))}</div>`
      : ""
  }

  ${
    isGst
      ? `<div class="hsn-box">
          <div style="margin-bottom:3px;font-weight:900">GST &amp; HSN TAX SUMMARY</div>
          <table>
            <thead><tr><th>HSN/Rate</th><th style="text-align:right">Taxable</th><th style="text-align:right">CGST</th><th style="text-align:right">SGST</th></tr></thead>
            <tbody>${hsnRowsHtml}</tbody>
          </table>
        </div>`
      : ""
  }

  <div class="footer">
    <div>THANK YOU! VISIT AGAIN!</div>
    <div>CALL US FOR FREE DOOR DELIVERY</div>
    <div>${escapeHtml(phoneDisplay)}</div>
  </div>
</div>
</body>
</html>`;
}
