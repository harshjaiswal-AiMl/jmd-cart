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
    invoice.paymentStatus === "PARTIAL" ||
    (invoice.paymentStatus as string) === "UNPAID"
  );
}

/**
 * Restored A5 Demand Bill HTML for Credit bills (matches pre-G12 DemandBillCredit).
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
  @page {
    size: A5 portrait;
    margin: 4mm 5mm;
  }
  * {
    box-sizing: border-box;
    color: #000000 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  html, body {
    margin: 0;
    padding: 0;
    background: #FFFFFF;
    font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
    font-size: 10pt;
  }
  .demand-wrap {
    width: 100%;
    max-width: 138mm;
    margin: 0 auto;
    padding: 2mm;
    border: 1.5px solid #000000;
  }
  .top-header {
    text-align: center;
    padding-bottom: 4px;
  }
  .top-header h1 {
    margin: 0;
    font-size: 16pt;
    font-weight: 900;
  }
  .top-header .brand {
    font-size: 11pt;
    font-weight: 800;
    letter-spacing: 0.04em;
  }
  .top-header .phone {
    font-size: 9.5pt;
    font-weight: 700;
  }
  .box {
    border: 1.5px solid #000000;
  }
  .two-col {
    display: flex;
    border-bottom: 1.5px solid #000000;
    font-size: 9.5pt;
  }
  .two-col > div {
    width: 50%;
    padding: 5px 7px;
  }
  .two-col > div:first-child {
    border-right: 1.5px solid #000000;
  }
  .meta-line {
    display: flex;
    margin-bottom: 2px;
  }
  .meta-k {
    width: 54px;
    font-weight: 800;
    flex-shrink: 0;
  }
  .meta-c {
    width: 10px;
    font-weight: 800;
  }
  table.a5-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 9.5pt;
  }
  table.a5-table th {
    border-bottom: 1.5px solid #000000;
    border-right: 1px solid #000000;
    padding: 4px;
    font-weight: 900;
    background: #F8FAFC;
  }
  table.a5-table th:last-child,
  table.a5-table td:last-child {
    border-right: 0;
  }
  table.a5-table td {
    border-bottom: 1px solid #CBD5E1;
    border-right: 1px solid #000000;
    padding: 3px 4px;
    font-weight: 600;
  }
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
    font-size: 9.5pt;
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .sig-row {
    display: flex;
    border-top: 1.5px solid #000000;
    height: 46px;
    font-size: 9pt;
    font-weight: 700;
  }
  .sig-row > div {
    width: 50%;
    padding: 5px 7px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }
  .sig-row > div:first-child {
    border-right: 1.5px solid #000000;
  }
  .sig-row > div:last-child {
    align-items: flex-end;
  }
  .footer {
    text-align: center;
    padding-top: 5px;
    font-size: 8.5pt;
    font-weight: 800;
    text-transform: uppercase;
  }
  .void-banner {
    text-align: center;
    font-weight: 900;
    font-size: 14pt;
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
        ${vm.customer.gstin ? `<div style="font-size:8.5pt">GSTIN: ${escapeHtml(vm.customer.gstin)}</div>` : ""}
      </div>
      <div>
        <div class="meta-line"><span class="meta-k">Date</span><span class="meta-c">:</span><span>${escapeHtml(vm.invoiceDate)}</span></div>
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
      ${vm.gstIncluded ? `<span style="font-size:8.5pt">GST included</span>` : ""}
    </div>

    <div class="sig-row">
      <div>Receiver's Signature</div>
      <div>Authorised Signatory</div>
    </div>
  </div>

  <div class="footer">
    <div>${escapeHtml(vm.doorDeliveryText || "CALL US FOR FREE DOOR DELIVERY")}${phoneDisplay ? `: ${escapeHtml(phoneDisplay)}` : ""}</div>
    <div style="font-size:7.5pt;margin-top:2px">A UNIT OF JAI MATA DI</div>
  </div>
</div>
</body>
</html>`;
}

/**
 * Restored pre-G12 80mm Credit Thermal Slip with high-contrast #000 typography.
 */
function renderCreditThermalHtml(
  invoice: InvoiceWithDetails,
  vm: InvoiceViewModel
): string {
  const shopName = (vm.business.tradeName || vm.business.legalName || "JMD CART").toUpperCase();
  const phoneDisplay = vm.doorDeliveryPhone || vm.business.phone || "7979749009";
  const roundVal = Math.abs(Number(vm.totals.roundOffRupees));

  const itemsHtml = vm.items
    .map(
      (item) => `<div class="item-block">
        <div class="item-top">
          <span class="sl">${item.sl}</span>
          <span class="name">${escapeHtml(item.name)}</span>
        </div>
        <div class="item-sub">
          <span class="c-qty">${escapeHtml(item.qtyFormatted)} ${escapeHtml(item.unit)}</span>
          <span class="c-mrp">${escapeHtml(item.mrpRupees)}</span>
          <span class="c-disc">${item.discPct > 0 ? `${item.discPct}%` : "0%"}</span>
          <span class="c-rate">${escapeHtml(item.rateRupees)}</span>
          <span class="c-amt">${escapeHtml(item.amountRupees)}</span>
        </div>
      </div>`
    )
    .join("");

  const custRowsHtml = vm.customer.rows
    .map(
      (r) => `<div class="meta-row">
        <span class="meta-k">${escapeHtml(r.label)}</span>
        <span class="meta-c">:</span>
        <span class="meta-v">${escapeHtml(r.value)}</span>
      </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Credit Receipt ${escapeHtml(vm.cleanInvoiceNumber)}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
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
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    width: 74mm;
  }
  .slip {
    width: 74mm;
    max-width: 100%;
    padding: 2.5mm 3mm;
    margin: 0 auto;
  }
  .brand { text-align: center; font-size: 20px; font-weight: 900; margin-bottom: 2px; }
  .mode { text-align: center; font-size: 16px; font-weight: 900; margin-bottom: 2px; }
  .rule { border: 0; border-top: 2px solid #000000; margin: 5px 0; }
  .meta { font-size: 13px; font-weight: 700; line-height: 1.3; }
  .meta-row { display: flex; margin-bottom: 1px; }
  .meta-k { width: 88px; flex-shrink: 0; }
  .meta-c { width: 10px; flex-shrink: 0; text-align: center; }
  .meta-v { flex: 1; font-weight: 800; word-break: break-word; }
  .tbl-hdr { border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 3px 0; margin-top: 5px; font-size: 12px; font-weight: 900; }
  .hdr-top { display: flex; }
  .hdr-sub { display: flex; padding-left: 20px; font-size: 11px; margin-top: 2px; }
  .item-block { padding: 4px 0; border-bottom: 1px solid #000000; }
  .item-top { display: flex; font-size: 13.5px; font-weight: 800; line-height: 1.25; }
  .item-top .sl { width: 20px; flex-shrink: 0; }
  .item-top .name { flex: 1; word-break: break-word; }
  .item-sub { display: flex; padding-left: 20px; font-size: 12.5px; font-weight: 800; margin-top: 2px; align-items: baseline; }
  .c-qty { width: 26%; }
  .c-mrp { width: 18%; text-align: right; }
  .c-disc { width: 14%; text-align: center; }
  .c-rate { width: 20%; text-align: right; }
  .c-amt { width: 22%; text-align: right; font-weight: 900; }
  .tot-row { display: flex; justify-content: space-between; font-size: 14.5px; font-weight: 800; margin-top: 5px; }
  .rnd-row { display: flex; justify-content: space-between; font-size: 12.5px; font-weight: 700; margin-top: 2px; }
  .grand-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 2.5px solid #000;
    border-bottom: 2.5px solid #000;
    padding: 5px 0;
    margin: 6px 0;
    font-weight: 900;
  }
  .grand-left { font-size: 12.5px; }
  .grand-val { font-size: 22px; }
  .words { font-size: 12px; font-weight: 800; padding-bottom: 5px; border-bottom: 1.5px solid #000; }
  .footer { text-align: center; font-size: 13px; font-weight: 800; margin-top: 6px; line-height: 1.35; }
  .void-banner { text-align: center; font-size: 18px; font-weight: 900; border: 2px solid #000; padding: 2px; margin-bottom: 4px; }
</style>
</head>
<body>
<div class="slip">
  ${invoice.status === "CANCELLED" ? `<div class="void-banner">CANCELLED</div>` : ""}
  <div class="brand">${escapeHtml(shopName)}</div>
  <div class="mode">CREDIT</div>
  <hr class="rule" />
  <div class="meta">
    <div class="meta-row"><span class="meta-k">Date/Time</span><span class="meta-c">:</span><span class="meta-v">${escapeHtml(vm.dateTimeFormatted)}</span></div>
    <div class="meta-row"><span class="meta-k">Invoice No.</span><span class="meta-c">:</span><span class="meta-v">${escapeHtml(vm.cleanInvoiceNumber)}</span></div>
    <div class="meta-row"><span class="meta-k">Sale Type</span><span class="meta-c">:</span><span class="meta-v">CREDIT SALE</span></div>
    ${custRowsHtml}
  </div>
  <div class="tbl-hdr">
    <div class="hdr-top"><span style="width:20px">Sl</span><span>Product</span></div>
    <div class="hdr-sub">
      <span class="c-qty">Qty/Unit</span>
      <span class="c-mrp">MRP</span>
      <span class="c-disc">Disc%</span>
      <span class="c-rate">Rate</span>
      <span class="c-amt">Amt.</span>
    </div>
  </div>
  ${itemsHtml}
  <div class="tot-row"><span>Total</span><span>${escapeHtml(vm.totals.subtotalRupees)}</span></div>
  ${
    vm.totals.roundOffPaise !== 0
      ? `<div class="rnd-row"><span>${vm.totals.roundOffPaise > 0 ? "Add : Rounded Off (+" : "Less : Rounded Off (-"}</span><span>${roundVal.toFixed(2)})</span></div>`
      : ""
  }
  <div class="grand-bar">
    <div class="grand-left">${escapeHtml(vm.totals.totalPiecesFormatted)} ${vm.totals.isGstIncluded ? "GST included" : ""}</div>
    <div class="grand-val">₹${escapeHtml(vm.totals.payableRupees)}</div>
  </div>
  <div class="words">In Words: ${escapeHtml(vm.totals.amountInWords)}</div>
  <div class="footer">
    <div>${escapeHtml(vm.business.footerThankYou || "THANK YOU! VISIT AGAIN!")}</div>
    <div>${escapeHtml(vm.business.footerDeliveryText || "CALL US FOR FREE DOOR DELIVERY")}</div>
    <div>${escapeHtml(phoneDisplay)}</div>
  </div>
</div>
</body>
</html>`;
}

export function renderDirectPrintHtml(
  invoice: InvoiceWithDetails,
  business: BusinessDetails,
  format: "thermal" | "a4" = "thermal"
): string {
  const vm = buildInvoiceViewModel(invoice, business);
  const creditBill = isCreditInvoice(invoice);

  // Credit Bills: preserve exact pre-G12 A5 Demand Bill (when format="a4") & Credit Thermal (when format="thermal")
  if (creditBill && format === "a4") {
    return renderCreditDemandA5Html(invoice, vm);
  }
  if (creditBill && format === "thermal") {
    return renderCreditThermalHtml(invoice, vm);
  }

  const modeLabel = resolveBillModeLabel(invoice);
  const isGst = invoice.documentType === "GST";
  const isA4 = format === "a4";
  const shopName = (vm.business.tradeName || vm.business.legalName || "JMD CART").toUpperCase();
  const phoneDisplay = vm.doorDeliveryPhone || vm.business.phone || "7979749009";
  const subtotalPreRoundPaise = invoice.totalPaise - invoice.roundOffPaise;
  const roundAbsFormatted = formatRupeesEN(Math.abs(invoice.roundOffPaise));

  // Build aligned metadata rows matching Image 2
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

  const metaHtml = metaRows
    .map(
      (r) => `<div class="meta-row">
        <span class="meta-label">${escapeHtml(r.label)}</span>
        <span class="meta-colon">:</span>
        <span class="meta-val">${escapeHtml(r.value)}</span>
      </div>`
    )
    .join("");

  // Cash & UPI: Image 1 header (Sl | Product | Price | Amt.) with 2 clean high-contrast rows per item
  const itemsHtml = invoice.items
    .map((item, idx) => {
      const disp = getBillLineItemDisplay(item, idx);
      return `<tr class="item-row-top">
        <td class="col-sl">${disp.sl}</td>
        <td class="col-prod-full" colspan="3">${escapeHtml(disp.fullName)}</td>
      </tr>
      <tr class="item-row-sub">
        <td class="col-sl"></td>
        <td class="col-qty-unit"><span class="qty-num">${escapeHtml(disp.qtyDisplay)}</span><span class="qty-unit">${escapeHtml(disp.unitDisplay)}</span></td>
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
    : `${vm.totals.totalTaxPaise > 0 ? `${escapeHtml(vm.totals.totalTaxRupees)} ` : ""}GST included`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Invoice ${escapeHtml(vm.cleanInvoiceNumber)}</title>
<style>
  @page {
    ${isA4 ? "size: A4 portrait;" : "size: 80mm auto;"}
    margin: 0;
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
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    line-height: 1.28;
    width: ${isA4 ? "100%" : "74mm"};
  }
  .bill-sheet {
    width: ${isA4 ? "100%" : "74mm"};
    max-width: 100%;
    padding: ${isA4 ? "10mm" : "2.5mm 3mm"};
    margin: 0 auto;
    background: #FFFFFF;
  }
  .shop-brand {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-bottom: 2px;
  }
  .shop-name {
    font-size: ${isA4 ? "24pt" : "22px"};
    font-weight: 900;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin: 0;
  }
  .mode-heading {
    font-size: ${isA4 ? "18pt" : "20px"};
    font-weight: 900;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 1px 0 2px;
  }
  .header-phone {
    font-size: ${isA4 ? "12pt" : "15px"};
    font-weight: 800;
    text-align: center;
    margin-top: 1px;
  }
  .header-sub {
    font-size: ${isA4 ? "10.5pt" : "13px"};
    font-weight: 700;
    text-align: center;
    margin-top: 2px;
  }
  .void-banner {
    font-size: ${isA4 ? "18pt" : "20px"};
    font-weight: 900;
    text-align: center;
    border: 2.5px solid #000000;
    padding: 3px 0;
    margin-bottom: 5px;
    letter-spacing: 0.08em;
  }
  .rule-heavy {
    border: 0;
    border-top: 2px solid #000000;
    margin: 5px 0;
  }
  .meta-block {
    font-size: ${isA4 ? "11.5pt" : "14px"};
    font-weight: 800;
    margin: 4px 0 6px;
  }
  .meta-row {
    display: flex;
    align-items: baseline;
    line-height: 1.32;
    margin-bottom: 1.5px;
  }
  .meta-label {
    width: ${isA4 ? "115px" : "92px"};
    flex-shrink: 0;
    font-weight: 800;
  }
  .meta-colon {
    width: 12px;
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
    border-collapse: collapse;
    border-top: 2px solid #000000;
    border-bottom: 2px solid #000000;
    margin: 5px 0;
  }
  table.bill-table thead th {
    font-size: ${isA4 ? "12.5pt" : "14px"};
    font-weight: 900;
    border-bottom: 2px solid #000000;
    padding: 4px 2px;
    text-align: left;
  }
  .col-sl {
    width: 10%;
    text-align: left;
    vertical-align: top;
  }
  .col-prod {
    width: 44%;
    text-align: left;
  }
  .col-rate {
    width: 22%;
    text-align: right;
    white-space: nowrap;
  }
  .col-amt {
    width: 24%;
    text-align: right;
    white-space: nowrap;
  }
  table.bill-table th.col-rate,
  table.bill-table th.col-amt {
    text-align: right;
  }
  .item-row-top td {
    font-size: ${isA4 ? "13pt" : "15.5px"};
    font-weight: 800;
    padding: 5px 2px 1px;
    vertical-align: top;
  }
  .col-prod-full {
    word-break: break-word;
    line-height: 1.24;
  }
  .item-row-sub td {
    font-size: ${isA4 ? "12pt" : "14.5px"};
    font-weight: 800;
    padding: 1px 2px 5px;
    vertical-align: baseline;
  }
  .col-qty-unit {
    padding-left: 4px;
    white-space: nowrap;
  }
  .qty-num {
    display: inline-block;
    min-width: ${isA4 ? "54px" : "46px"};
    font-weight: 800;
  }
  .qty-unit {
    display: inline-block;
    font-weight: 800;
  }
  .item-row-sub .col-amt {
    font-weight: 900;
  }
  .totals-wrap {
    margin-top: 4px;
  }
  .totals-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: ${isA4 ? "13pt" : "16px"};
    font-weight: 800;
    margin: 2px 0;
  }
  .roundoff-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: ${isA4 ? "11.5pt" : "14px"};
    font-weight: 800;
    margin: 2px 0 4px;
  }
  .grand-total-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    border-top: 2.5px solid #000000;
    border-bottom: 2.5px solid #000000;
    padding: 6px 0;
    margin: 5px 0;
  }
  .grand-left {
    font-size: ${isA4 ? "11pt" : "13px"};
    font-weight: 800;
    line-height: 1.25;
  }
  .grand-amount {
    font-size: ${isA4 ? "22pt" : "26px"};
    font-weight: 900;
    white-space: nowrap;
    letter-spacing: -0.01em;
  }
  .in-words {
    font-size: ${isA4 ? "10.5pt" : "13px"};
    font-weight: 800;
    margin: 4px 0 6px;
    line-height: 1.3;
  }
  .hsn-box {
    border: 1.5px solid #000000;
    padding: 4px;
    margin: 6px 0;
    font-size: ${isA4 ? "10pt" : "12.5px"};
    font-weight: 800;
  }
  .hsn-box table {
    width: 100%;
    border-collapse: collapse;
  }
  .hsn-box th, .hsn-box td {
    padding: 2px 3px;
    border-bottom: 1px solid #000000;
    text-align: left;
  }
  .footer {
    text-align: center;
    border-top: 1.5px solid #000000;
    padding-top: 6px;
    margin-top: 6px;
    font-size: ${isA4 ? "11pt" : "14px"};
    font-weight: 800;
    line-height: 1.35;
  }
  .footer-sub {
    font-size: ${isA4 ? "9.5pt" : "12px"};
    font-weight: 800;
    margin-top: 3px;
  }
</style>
</head>
<body>
<div class="bill-sheet">
  ${invoice.status === "CANCELLED" ? `<div class="void-banner">CANCELLED</div>` : ""}

  <div class="shop-brand">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2.6">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
    <h1 class="shop-name">${escapeHtml(shopName)}</h1>
  </div>

  <div class="mode-heading">${escapeHtml(modeLabel)}</div>
  <div class="header-phone">${escapeHtml(phoneDisplay)}</div>
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

  <hr class="rule-heavy" />

  <div class="meta-block">
    ${metaHtml}
  </div>

  <table class="bill-table">
    <thead>
      <tr>
        <th class="col-sl">Sl</th>
        <th class="col-prod">Product</th>
        <th class="col-rate">Price</th>
        <th class="col-amt">Amt.</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="totals-wrap">
    <div class="totals-row">
      <span>Total</span>
      <span>${escapeHtml(formatRupeesEN(subtotalPreRoundPaise))}</span>
    </div>
    ${
      invoice.roundOffPaise !== 0
        ? `<div class="roundoff-row">
            <span>${invoice.roundOffPaise > 0 ? "Add : Rounded Off (+" : "Less : Rounded Off (-"}</span>
            <span>${escapeHtml(roundAbsFormatted)})</span>
          </div>`
        : ""
    }
  </div>

  <div class="grand-total-bar">
    <div class="grand-left">${leftGrandNote}</div>
    <div class="grand-amount">₹${escapeHtml(formatRupeesEN(invoice.totalPaise))}</div>
  </div>

  <div class="in-words">In Words: ${escapeHtml(vm.amountInWords)}</div>

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
    <div class="footer-sub">A unit of Jai Mata Di</div>
  </div>
</div>
</body>
</html>`;
}
