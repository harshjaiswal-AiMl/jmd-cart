import { EscPosBuilder } from "./escpos";
import { InvoiceWithDetails } from "@/modules/billing/billing.types";
import { BusinessDetails } from "@/modules/settings/settings.types";
import { formatISTDate, formatISTTime } from "./date";

export interface EscPosInvoiceOptions {
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

  // 1. Store Header
  builder.align("center");
  builder.bold(true);
  builder.size("double-height");
  builder.line(business.tradeName || business.legalName || "JMD CART");

  builder.normal();
  builder.align("center");
  if (business.tradeName && business.legalName && business.tradeName !== business.legalName) {
    builder.line(business.legalName);
  }
  if (business.address) {
    builder.line(business.address);
  }
  if (business.phone) {
    builder.line(`Ph: ${business.phone}`);
  }
  if (business.gstin) {
    builder.line(`GSTIN: ${business.gstin}`);
  }
  if (business.fssai) {
    builder.line(`FSSAI: ${business.fssai}`);
  }

  builder.rule("-", width);

  // 2. Receipt Meta
  builder.align("left");
  builder.twoColumn("INVOICE NO:", invoice.number, width);
  builder.twoColumn(
    "DATE:",
    `${formatISTDate(invoice.createdAt)} ${formatISTTime(invoice.createdAt)}`,
    width
  );
  builder.twoColumn("CHANNEL:", `VAN SALES (${invoice.location.name})`, width);

  if (invoice.party) {
    builder.twoColumn("CUSTOMER:", invoice.party.name, width);
    if (invoice.party.phone) {
      builder.twoColumn("PHONE:", invoice.party.phone, width);
    }
  } else {
    builder.twoColumn("CUSTOMER:", "Retail Cash Customer", width);
  }

  builder.rule("-", width);

  // 3. Items List
  let totalQty = 0;
  for (const item of invoice.items) {
    totalQty += item.qty;
    const itemTotalPaise = item.taxablePaise + item.taxPaise;
    const itemTotalRs = (itemTotalPaise / 100).toFixed(2);
    const unitPriceRs = (item.unitPricePaise / 100).toFixed(2);

    // Line 1: Item Name (bold)
    builder.bold(true);
    builder.line(item.product.name.slice(0, width));
    builder.bold(false);

    // Line 2: Details: Qty x Rate = Total
    const qtyDetails = `  ${item.qty} pcs @ Rs.${unitPriceRs}`;
    builder.twoColumn(qtyDetails, `Rs.${itemTotalRs}`, width);
  }

  builder.rule("-", width);

  // 4. Totals Breakdown
  builder.twoColumn("Total Items / Qty:", `${invoice.items.length} / ${totalQty} pcs`, width);
  builder.twoColumn("Subtotal:", `Rs.${(invoice.subtotalPaise / 100).toFixed(2)}`, width);

  if (invoice.discountPaise > 0) {
    builder.twoColumn("Discount:", `-Rs.${(invoice.discountPaise / 100).toFixed(2)}`, width);
  }

  const totalTaxPaise = invoice.cgstPaise + invoice.sgstPaise + invoice.igstPaise;
  builder.twoColumn("GST (Included):", `Rs.${(totalTaxPaise / 100).toFixed(2)}`, width);

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
  builder.twoColumn("TOTAL:", `Rs.${(invoice.totalPaise / 100).toFixed(2)}`, width);
  builder.normal();
  builder.rule("=", width);

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
  builder.line("Thank You! Visit Again!");
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
