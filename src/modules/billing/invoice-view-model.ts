import { InvoiceWithDetails } from "./billing.types";
import { BusinessDetails } from "../settings/settings.types";
import { amountInWords } from "@/lib/number-to-words";

export interface InvoiceViewModelOptions {
  showAgentCode?: boolean;
  showAgentCodeOnline?: boolean;
  showGstBreakup?: boolean;
  isStorefront?: boolean;
  footerThankYou?: string;
  footerDeliveryText?: string;
  footerDeliveryPhone?: string;
}

export interface InvoiceItemViewModel {
  sl: number;
  index: number;
  id: string;
  productId: string;
  name: string;
  shortCode: string;
  hsn: string;
  gstRatePct: number;
  packSize: number;
  packLabel: string;
  isFullCarton: boolean;
  qty: number;
  displayQty: string;
  qtyFormatted: string;
  unit: string;
  mrpRupees: string;
  mrpPaise: number;
  discPct: number;
  rateRupees: string;
  rateFormatted: string;
  ratePaise: number;
  amountRupees: string;
  amountFormatted: string;
  amountPaise: number;
  taxablePaise: number;
  taxPaise: number;
}

export interface InvoiceCustomerRow {
  label: string;
  value: string;
}

export interface InvoiceViewModel {
  // Meta
  invoiceId: string;
  invoiceNumber: string;
  cleanInvoiceNumber: string;
  invoiceNumberClean: string;
  dateFormatted: string;
  timeFormatted: string;
  dateTimeFormatted: string;
  invoiceDate: string;
  invoiceTime: string;
  channel: string;
  locationName: string;

  // Non-cash mode badge (e.g. "CREDIT SALE", "UPI SALE", or null for Cash)
  nonCashBadge: string | null;
  paymentMode: string;
  paymentModeBadge: string;
  isCash: boolean;
  isNonCash: boolean;
  isCredit: boolean;
  paymentStatus: string;
  isPaymentPending: boolean;
  pendingAmountPaise: number;
  pendingAmountFormatted: string;

  // Customer block
  customer: {
    name: string | null;
    phone: string | null;
    mobile: string | null;
    address: string | null;
    gstin: string | null;
    isWalkIn: boolean;
    rows: InvoiceCustomerRow[];
  };

  // Agent (hidden by default per rules)
  agent: {
    code: string | null;
    showOnBill: boolean;
  };
  agentCode: string | null;

  // Items
  items: InvoiceItemViewModel[];

  // Totals
  totals: {
    itemsCount: number;
    totalPieces: number;
    totalPiecesFormatted: string;
    subtotalRupees: string;
    subtotalPaise: number;
    discountRupees: string;
    roundOffRupees: string;
    roundOffPaise: number;
    payableRupees: string;
    payablePaise: number;
    amountInWords: string;
    isGstIncluded: boolean;
    gstText: string;
    cgstRupees: string;
    sgstRupees: string;
    igstRupees: string;
    totalTaxRupees: string;
    totalTaxPaise: number;
  };

  totalPieces: number;
  amountInWords: string;
  payableFormatted: string;
  gstIncluded: boolean;

  // HSN Tax Breakdown (for B2B / A5)
  showGstBreakup: boolean;
  hsnTaxSummary: Array<{
    hsn: string;
    gstRatePct: number;
    taxableRupees: string;
    cgstRupees: string;
    sgstRupees: string;
    igstRupees: string;
    totalTaxRupees: string;
  }>;

  // Footer & Branding
  footerThankYou: string;
  doorDeliveryText: string;
  doorDeliveryPhone: string;

  // Business & Branding
  business: {
    tradeName: string;
    legalName: string;
    address: string;
    phone: string;
    gstin: string;
    fssai: string;
    footerThankYou: string;
    footerDeliveryText: string;
    footerDeliveryPhone: string;
  };
}

function formatDateIST(date: Date | string | null | undefined): {
  date: string;
  time: string;
  full: string;
} {
  if (!date) return { date: "-", time: "-", full: "-" };
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return { date: "-", time: "-", full: "-" };

  // IST is UTC+5:30
  const utcMs = d.getTime() + d.getTimezoneOffset() * 60000;
  const istDate = new Date(utcMs + 5.5 * 3600000);

  const day = String(istDate.getDate()).padStart(2, "0");
  const month = String(istDate.getMonth() + 1).padStart(2, "0");
  const year = istDate.getFullYear();

  let hours = istDate.getHours();
  const minutes = String(istDate.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const hoursStr = String(hours).padStart(2, "0");

  const dateStr = `${day}-${month}-${year}`;
  const timeStr = `${hoursStr}:${minutes} ${ampm}`;
  return {
    date: dateStr,
    time: timeStr,
    full: `${dateStr} ${timeStr}`,
  };
}

/**
 * Builds the canonical InvoiceViewModel.
 * Single source of truth driving:
 * - Thermal Slip (80mm & 58mm)
 * - New A5 Invoice
 * - ESC/POS Bluetooth Printer
 * - Screen reprint & view
 */
export function buildInvoiceViewModel(
  invoice: InvoiceWithDetails,
  business?: Partial<BusinessDetails> | null,
  options: InvoiceViewModelOptions = {}
): InvoiceViewModel {
  const dates = formatDateIST(invoice.createdAt);

  // Clean invoice number: e.g. "INV-2026-000123" -> "123" or original if standard
  const cleanInvoiceNumber =
    invoice.number.replace(/^INV-[0-9]+-0*/, "") || invoice.number;

  // Determine non-cash mode
  const payments = invoice.payments || [];
  const creditPayment = payments.find((p) => p.mode === "CREDIT");
  const isCredit =
    !!creditPayment ||
    invoice.paymentStatus === "PARTIAL" ||
    (invoice.paymentStatus as string) === "UNPAID";

  const isCash =
    !isCredit &&
    (payments.length === 0 ||
      payments.every((p) => p.mode === "CASH" || p.mode === "CARD"));

  let nonCashBadge: string | null = null;
  let paymentMode = "CASH";

  if (isCredit) {
    nonCashBadge = "CREDIT SALE";
    paymentMode = "CREDIT";
  } else if (payments.some((p) => p.mode === "UPI")) {
    nonCashBadge = "UPI SALE";
    paymentMode = "UPI";
  } else if (payments.some((p) => p.mode === "CARD")) {
    nonCashBadge = "CARD SALE";
    paymentMode = "CARD";
  }

  // Customer block rows (3 rows: Name, Mobile, Address - omit empty)
  // Uses snapshots from invoice first, falls back to linked Party record
  const custName =
    invoice.customerName || invoice.party?.name || null;
  const custPhone =
    invoice.customerPhone || invoice.party?.phone || null;
  const custAddress =
    invoice.customerAddress || invoice.party?.address || null;
  const custGstin = invoice.party?.gstin || null;

  // Agent code snapshot resolution (Prompt #12: default on for staff, hidden for storefront)
  const rawAgentCode =
    invoice.agentCodeSnapshot || invoice.agentUser?.agentCode || null;
  const isOnline = options.isStorefront === true;
  const showAgent = isOnline ? (options.showAgentCodeOnline ?? false) : (options.showAgentCode ?? true);
  const effectiveAgentCode = showAgent && rawAgentCode ? rawAgentCode : null;

  const customerRows: InvoiceCustomerRow[] = [];
  if (custName) {
    customerRows.push({ label: "Name", value: custName });
  }
  if (custPhone) {
    customerRows.push({ label: "Mobile", value: custPhone });
  }
  if (custAddress) {
    customerRows.push({ label: "Address", value: custAddress });
  }
  if (effectiveAgentCode) {
    customerRows.push({ label: "Agent Code", value: effectiveAgentCode });
  }
  if (customerRows.length === 0) {
    customerRows.push({ label: "Customer", value: "Walk-in" });
  }

  // Items processing
  let totalPieces = 0;
  let subtotalCalculatedPaise = 0;
  let totalTaxPaise = 0;
  const hsnMap = new Map<
    string,
    {
      hsn: string;
      gstRatePct: number;
      taxablePaise: number;
      cgstPaise: number;
      sgstPaise: number;
      igstPaise: number;
      taxPaise: number;
    }
  >();

  const items: InvoiceItemViewModel[] = invoice.items.map((item, idx) => {
    const packSize = item.product?.packSize || 1;
    const isFullCarton =
      packSize > 1 && item.qty >= packSize && item.qty % packSize === 0;

    const displayQty = isFullCarton ? item.qty / packSize : item.qty;
    const displayUnit = isFullCarton
      ? item.product?.packLabel || "Carton"
      : "Pcs";

    totalPieces += item.qty;

    const mrpPaise = isFullCarton
      ? (item.mrpPaise || 0) * packSize
      : item.mrpPaise || 0;
    const ratePaise = isFullCarton
      ? item.unitPricePaise * packSize
      : item.unitPricePaise;
    const lineAmt = item.taxablePaise + item.taxPaise;

    subtotalCalculatedPaise += lineAmt;
    totalTaxPaise += item.taxPaise;

    // Disc %
    let discPct = 0;
    if (mrpPaise > 0 && ratePaise < mrpPaise) {
      discPct = Math.round(((mrpPaise - ratePaise) / mrpPaise) * 100);
    } else if (item.discountBp > 0) {
      discPct = Math.round(item.discountBp / 100);
    }

    // Accumulate HSN breakdown
    const rawHsn = item.hsn?.trim() || "";
    const isPlaceholderHsn = !rawHsn || ["0", "00", "0000", "000000"].includes(rawHsn);
    const hsnCode = isPlaceholderHsn ? "" : rawHsn;
    const gstRatePct = item.gstRateBp / 100;
    const existingHsn = hsnMap.get(hsnCode) || {
      hsn: hsnCode,
      gstRatePct,
      taxablePaise: 0,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
      taxPaise: 0,
    };
    existingHsn.taxablePaise += item.taxablePaise;
    existingHsn.taxPaise += item.taxPaise;
    if (invoice.igstPaise > 0) {
      existingHsn.igstPaise += item.taxPaise;
    } else {
      existingHsn.cgstPaise += Math.round(item.taxPaise / 2);
      existingHsn.sgstPaise += item.taxPaise - Math.round(item.taxPaise / 2);
    }
    hsnMap.set(hsnCode, existingHsn);

    return {
      sl: idx + 1,
      index: idx + 1,
      id: item.id,
      productId: item.productId,
      name: item.product?.name || "Item",
      shortCode: item.product?.shortCode || "",
      hsn: hsnCode,
      gstRatePct: item.gstRateBp / 100,
      packSize,
      packLabel: item.product?.packLabel || "Carton",
      isFullCarton,
      qty: displayQty,
      displayQty: displayQty.toFixed(2),
      qtyFormatted: displayQty.toFixed(2),
      unit: displayUnit,
      mrpRupees: mrpPaise > 0 ? (mrpPaise / 100).toFixed(2) : "-",
      mrpPaise,
      discPct,
      rateRupees: (ratePaise / 100).toFixed(2),
      rateFormatted: (ratePaise / 100).toFixed(2),
      ratePaise,
      amountRupees: (lineAmt / 100).toFixed(2),
      amountFormatted: (lineAmt / 100).toFixed(2),
      amountPaise: lineAmt,
      taxablePaise: item.taxablePaise,
      taxPaise: item.taxPaise,
    };
  });

  // Check GST inclusion:
  // In retail POS / Van FMCG, prices are MRP-derived (tax-inclusive)
  const isGstIncluded =
    invoice.taxablePaise > 0 &&
    (invoice.taxablePaise + totalTaxPaise === invoice.subtotalPaise ||
      invoice.taxablePaise + totalTaxPaise === invoice.totalPaise - (invoice.roundOffPaise || 0) ||
      invoice.taxablePaise + totalTaxPaise === invoice.subtotalPaise - (invoice.discountPaise || 0));

  const roundoffPaise = invoice.totalPaise - subtotalCalculatedPaise;
  const roundOffRupees = (roundoffPaise / 100).toFixed(2);

  const hsnTaxSummary = Array.from(hsnMap.values()).map((h) => ({
    hsn: h.hsn,
    gstRatePct: h.gstRatePct,
    taxableRupees: (h.taxablePaise / 100).toFixed(2),
    cgstRupees: (h.cgstPaise / 100).toFixed(2),
    sgstRupees: (h.sgstPaise / 100).toFixed(2),
    igstRupees: (h.igstPaise / 100).toFixed(2),
    totalTaxRupees: (h.taxPaise / 100).toFixed(2),
  }));

  const deliveryPhone =
    options.footerDeliveryPhone || business?.phone || "7979749009";
  const thankYouText = options.footerThankYou || "Thank You! Visit Again!";
  const deliveryText =
    options.footerDeliveryText || "CALL US FOR FREE DOOR DELIVERY";

  const payableRupeesFormatted = (invoice.totalPaise / 100).toLocaleString(
    "en-IN",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
  const wordsAmount = amountInWords(invoice.totalPaise);

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.number,
    cleanInvoiceNumber,
    invoiceNumberClean: cleanInvoiceNumber,
    dateFormatted: dates.date,
    timeFormatted: dates.time,
    dateTimeFormatted: dates.full,
    invoiceDate: dates.date,
    invoiceTime: dates.time,
    channel: invoice.channel,
    locationName: invoice.location?.name || "Shop",

    nonCashBadge,
    paymentMode,
    paymentModeBadge: nonCashBadge || paymentMode,
    isCash,
    isNonCash: !isCash,
    isCredit,
    paymentStatus: invoice.paymentStatus || (invoice.totalPaise > payments.reduce((s, p) => s + p.amountPaise, 0) ? "PENDING" : "PAID"),
    isPaymentPending: (invoice.paymentStatus === "PENDING" || invoice.paymentStatus === "PARTIAL" || (invoice.paymentStatus as any) === "UNPAID") && (invoice.totalPaise - payments.reduce((s, p) => s + p.amountPaise, 0) > 0),
    pendingAmountPaise: Math.max(0, invoice.totalPaise - payments.reduce((s, p) => s + p.amountPaise, 0)),
    pendingAmountFormatted: (Math.max(0, invoice.totalPaise - payments.reduce((s, p) => s + p.amountPaise, 0)) / 100).toFixed(2),

    customer: {
      name: custName,
      phone: custPhone,
      mobile: custPhone,
      address: custAddress,
      gstin: custGstin,
      isWalkIn:
        customerRows.length === 1 && customerRows[0].value === "Walk-in",
      rows: customerRows,
    },

    agent: {
      code: effectiveAgentCode,
      showOnBill: !!effectiveAgentCode,
    },
    agentCode: effectiveAgentCode,

    items,

    totals: {
      itemsCount: items.length,
      totalPieces,
      totalPiecesFormatted: totalPieces.toFixed(2),
      subtotalRupees: (subtotalCalculatedPaise / 100).toFixed(2),
      subtotalPaise: subtotalCalculatedPaise,
      discountRupees: (invoice.discountPaise / 100).toFixed(2),
      roundOffRupees,
      roundOffPaise: roundoffPaise,
      payableRupees: payableRupeesFormatted,
      payablePaise: invoice.totalPaise,
      amountInWords: wordsAmount,
      isGstIncluded,
      gstText: isGstIncluded ? "GST included" : "GST extra",
      cgstRupees: (invoice.cgstPaise / 100).toFixed(2),
      sgstRupees: (invoice.sgstPaise / 100).toFixed(2),
      igstRupees: (invoice.igstPaise / 100).toFixed(2),
      totalTaxRupees: (totalTaxPaise / 100).toFixed(2),
      totalTaxPaise,
    },

    totalPieces,
    amountInWords: wordsAmount,
    payableFormatted: payableRupeesFormatted,
    gstIncluded: isGstIncluded,

    showGstBreakup: options.showGstBreakup ?? false,
    hsnTaxSummary,

    footerThankYou: thankYouText,
    doorDeliveryText: deliveryText,
    doorDeliveryPhone: deliveryPhone,

    business: {
      tradeName: business?.tradeName || "JMD CART",
      legalName: business?.legalName || "JAI MATA DI ENTERPRISES",
      address: business?.address || "",
      phone: business?.phone || "7979749009",
      gstin: business?.gstin || "",
      fssai: business?.fssai || "",
      footerThankYou: thankYouText,
      footerDeliveryText: deliveryText,
      footerDeliveryPhone: deliveryPhone,
    },
  };
}
