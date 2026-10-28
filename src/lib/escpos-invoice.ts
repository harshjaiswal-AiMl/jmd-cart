import { EscPosBuilder } from "./escpos";
import { InvoiceWithDetails } from "@/modules/billing/billing.types";
import { BusinessDetails } from "@/modules/settings/settings.types";
import { CollectionReceipt } from "@/modules/party/party.types";
import { formatISTDate, formatISTTime } from "./date";
import { buildInvoiceViewModel, InvoiceViewModelOptions } from "@/modules/billing/invoice-view-model";

export interface EscPosInvoiceOptions extends InvoiceViewModelOptions {
  paperWidth?: 58 | 80; // 58mm (32 chars) or 80mm (48 chars)
}

/**
 * Format an invoice into an ESC/POS byte sequence ready for Bluetooth thermal printing.
 */
export function formatInvoiceForEscPos(
  invoice: InvoiceWithDetails,
  business: BusinessDetails,
  options: EscPosInvoiceOptions = {}
): Uint8Array {
  const width = options.paperWidth === 80 ? 48 : 32;
  const builder = new EscPosBuilder();
  const vm = buildInvoiceViewModel(invoice, business, options);

  // 1. Store Header (no cash header, no cashier name)
  builder.align("center");
  builder.bold(true);
  builder.size("double-height");
  builder.line(vm.business.tradeName || vm.business.legalName || "JMD CART");

  builder.normal();
  builder.align("center");
  if (vm.business.tradeName && vm.business.legalName && vm.business.tradeName !== vm.business.legalName) {
    builder.line(vm.business.legalName);
  }
  if (vm.business.address) {
    builder.line(vm.business.address);
  }
  if (vm.business.phone) {
    builder.line(`Ph: ${vm.business.phone}`);
  }
  if (vm.business.gstin) {
    builder.line(`GSTIN: ${vm.business.gstin}`);
  }
  if (vm.business.fssai) {
    builder.line(`FSSAI: ${vm.business.fssai}`);
  }

  builder.rule("-", width);

  // 2. Receipt Meta
  builder.align("left");
  builder.twoColumn("INVOICE NO:", vm.invoiceNumberClean, width);
  builder.twoColumn("DATE:", `${vm.invoiceDate} ${vm.invoiceTime}`, width);
  builder.twoColumn("CHANNEL:", `${invoice.channel} (${invoice.location?.name || vm.locationName || 'Shop'})`, width);

  if (vm.isNonCash) {
    builder.twoColumn("MODE:", vm.paymentModeBadge, width);
  }
  

  // Customer block (3 rows: Name, Mobile, Address - omitted if empty)
  if (vm.customer.name) {
    builder.twoColumn("CUSTOMER:", vm.customer.name, width);
    if (vm.customer.mobile) {
      builder.twoColumn("PHONE:", vm.customer.mobile, width);
    }
    if (vm.customer.address) {
      builder.line(`ADDR: ${vm.customer.address.slice(0, width - 6)}`);
    }
  } else {
    builder.twoColumn("CUSTOMER:", "Walk-in", width);
  }
  if (vm.agentCode) {
    builder.twoColumn("Agent Code:", vm.agentCode, width);
  }

  builder.rule("-", width);

  // 3. Items List
  for (const item of vm.items) {
    // Line 1: Item Name (bold)
    builder.bold(true);
    builder.line(item.name.slice(0, width));
    builder.bold(false);

    // Line 2: Details: Qty Unit @ Rate = Total
    const unitPriceRs = (item.ratePaise / 100).toFixed(2);
    const qtyDetails = item.isFullCarton
      ? `  ${item.displayQty} ${item.unit} @ Rs.${unitPriceRs}`
      : `  ${item.qty} pcs @ Rs.${unitPriceRs}`;
    builder.twoColumn(qtyDetails, `Rs.${item.amountFormatted}`, width);
  }

  builder.rule("-", width);

  // 4. Totals Breakdown
  builder.twoColumn("Total Items / Qty:", `${vm.items.length} / ${vm.totalPieces} pcs`, width);
  builder.twoColumn("Subtotal:", `Rs.${(invoice.subtotalPaise / 100).toFixed(2)}`, width);

  if (invoice.discountPaise > 0) {
    builder.twoColumn("Discount:", `-Rs.${(invoice.discountPaise / 100).toFixed(2)}`, width);
  }

  const totalTaxPaise = invoice.cgstPaise + invoice.sgstPaise + invoice.igstPaise;
  if (!vm.gstIncluded && totalTaxPaise > 0) {
    builder.twoColumn("GST:", `Rs.${(totalTaxPaise / 100).toFixed(2)}`, width);
  }

  if (invoice.roundOffPaise !== 0) {
    const roundOffSign = invoice.roundOffPaise > 0 ? "+" : "";
    builder.twoColumn(
      "Round-off:",
      `${roundOffSign}Rs.${(invoice.roundOffPaise / 100).toFixed(2)}`,
      width
    );
  }

  builder.rule("=", width);

  // 5. Grand Total (Double Height + Bold)
  builder.bold(true);
  builder.size("double-height");
  builder.twoColumn(`Total Pcs : ${vm.totals.totalPiecesFormatted}`, `Rs.${vm.payableFormatted}`, width);
  builder.normal();
  if (vm.gstIncluded) {
    builder.line("GST included");
  }
  builder.normal();
  builder.rule("=", width);

  // Amount in words
  builder.line(`Rupees: ${vm.amountInWords}`);
  builder.rule("-", width);

  if (vm.isPaymentPending && vm.pendingAmountPaise > 0) {
    builder.bold(true);
    builder.line(`Payment Pending: Rs ${vm.pendingAmountFormatted} due`);
    builder.normal();
    builder.rule("-", width);
  }

  // 6. Payment Information
  const cashPayments = invoice.payments
    .filter((p) => p.mode === "CASH")
    .reduce((acc, p) => acc + p.amountPaise, 0);
  const upiPayments = invoice.payments
    .filter((p) => p.mode === "UPI")
    .reduce((acc, p) => acc + p.amountPaise, 0);

  if (cashPayments > 0) {
    builder.twoColumn("Paid (CASH):", `Rs.${(cashPayments / 100).toFixed(2)}`, width);
  }
  if (upiPayments > 0) {
    builder.twoColumn("Paid (UPI):", `Rs.${(upiPayments / 100).toFixed(2)}`, width);
  }

  const totalPaid = cashPayments + upiPayments;
  const balanceDue = invoice.totalPaise - totalPaid;
  if (balanceDue > 0) {
    builder.bold(true);
    builder.twoColumn("ON CREDIT (Due):", `Rs.${(balanceDue / 100).toFixed(2)}`, width);
    builder.bold(false);
  }

  builder.rule("-", width);

  // 7. Footer
  builder.align("center");
  builder.line(vm.footerThankYou);
  if (vm.doorDeliveryPhone) {
    builder.line(`${vm.doorDeliveryText}: ${vm.doorDeliveryPhone}`);
  }
  builder.line("Computer Generated Invoice");
  builder.line("www.jmdcart.com");

  // Feed 4 lines for tear bar and trigger cut
  builder.feed(4);
  builder.cut();

  return builder.build();
}

/**
 * Format a printer test slip for Bluetooth diagnostics.
 */
export function formatTestPrintEscPos(
  business: BusinessDetails,
  options: EscPosInvoiceOptions = {}
): Uint8Array {
  const width = options.paperWidth === 80 ? 48 : 32;
  const builder = new EscPosBuilder();

  builder.align("center");
  builder.bold(true);
  builder.size("double-height");
  builder.line(business.tradeName || "JMD CART");
  builder.normal();

  builder.align("center");
  builder.bold(true);
  builder.line("PRINTER TEST SLIP");
  builder.bold(false);
  builder.line(`${width === 32 ? "58mm" : "80mm"} Thermal Bluetooth Mode`);
  builder.rule("-", width);

  builder.align("left");
  const now = new Date();
  builder.twoColumn("DATE:", formatISTDate(now), width);
  builder.twoColumn("TIME:", formatISTTime(now), width);
  builder.twoColumn("STATUS:", "ONLINE / CONNECTED", width);
  builder.rule("-", width);

  builder.align("center");
  builder.line("Testing Alignment:");
  builder.align("left");
  builder.line("<-- Left Align");
  builder.align("center");
  builder.line("-- Center Align --");
  builder.align("right");
  builder.line("Right Align -->");

  builder.rule("-", width);
  builder.align("center");
  builder.bold(true);
  builder.line("SUCCESS! READY FOR VAN SALES");
  builder.normal();
  builder.feed(4);
  builder.cut();

  return builder.build();
}

/**
 * Format a route collection receipt into an ESC/POS byte sequence.
 */
export function formatCollectionReceiptForEscPos(
  receipt: CollectionReceipt,
  business: BusinessDetails,
  options: EscPosInvoiceOptions = {}
): Uint8Array {
  const width = options.paperWidth === 80 ? 48 : 32;
  const builder = new EscPosBuilder();

  // 1. Header
  builder.align("center");
  builder.bold(true);
  builder.size("double-height");
  builder.line(business.tradeName || business.legalName || "JMD CART");
  builder.normal();

  builder.align("center");
  if (business.address) builder.line(business.address);
  if (business.phone) builder.line(`Ph: ${business.phone}`);
  if (business.gstin) builder.line(`GSTIN: ${business.gstin}`);

  builder.bold(true);
  builder.line("PAYMENT RECEIPT");
  builder.bold(false);
  builder.rule("-", width);

  // 2. Receipt Meta
  builder.align("left");
  builder.twoColumn("RECEIPT NO:", receipt.receiptNo, width);
  builder.twoColumn(
    "DATE:",
    `${formatISTDate(receipt.createdAt)} ${formatISTTime(receipt.createdAt)}`,
    width
  );
  if (receipt.vanName) {
    builder.twoColumn("ROUTE / VAN:", receipt.vanName, width);
  }
  if (receipt.collectedByName) {
    builder.twoColumn("COLLECTED BY:", receipt.collectedByName, width);
  }
  builder.rule("-", width);

  // 3. Party details
  builder.twoColumn("CUSTOMER:", receipt.partyName, width);
  if (receipt.partyPhone) {
    builder.twoColumn("PHONE:", receipt.partyPhone, width);
  }
  builder.rule("-", width);

  // 4. Financial Details
  if (receipt.previousOutstandingPaise > 0) {
    builder.twoColumn(
      "Old Outstanding:",
      `Rs.${(receipt.previousOutstandingPaise / 100).toFixed(2)}`,
      width
    );
  }

  builder.bold(true);
  builder.size("double-height");
  builder.twoColumn(
    "AMOUNT PAID:",
    `Rs.${(receipt.amountPaise / 100).toFixed(2)}`,
    width
  );
  builder.normal();

  builder.twoColumn("Payment Mode:", receipt.mode, width);
  if (receipt.notes) {
    builder.twoColumn("Notes / Ref:", receipt.notes, width);
  }

  builder.rule("=", width);
  builder.bold(true);
  builder.twoColumn(
    "Balance Remaining:",
    `Rs.${(receipt.currentOutstandingPaise / 100).toFixed(2)}`,
    width
  );
  builder.normal();
  builder.rule("=", width);

  // 5. Footer
  builder.align("center");
  builder.line("Thank You For Your Payment!");
  builder.line("Computer Generated Voucher");

  builder.feed(4);
  builder.cut();

  return builder.build();
}
