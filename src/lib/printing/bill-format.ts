import { InvoiceWithDetails } from "@/modules/billing/billing.types";
import { normalizeUnitCode } from "@/modules/catalog/units";

export interface BillLineItemDisplay {
  id: string;
  sl: number;
  fullName: string;
  qtyDisplay: string;
  unitDisplay: string;
  qtyLabel: string;
  ratePaise: number;
  rateFormatted: string;
  amountPaise: number;
  amountFormatted: string;
}

export function formatRupeesEN(paise: number): string {
  return (paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function resolveBillModeLabel(invoice: InvoiceWithDetails): string {
  const payments = invoice.payments || [];
  const modes = payments.map((p) => p.mode);
  const hasCash = modes.includes("CASH");
  const hasUpi = modes.includes("UPI");
  const hasCard = modes.includes("CARD");
  const hasCredit = modes.includes("CREDIT");

  const nonCreditPaid = payments
    .filter((p) => p.mode !== "CREDIT")
    .reduce((s, p) => s + p.amountPaise, 0);
  const remaining = Math.max(0, invoice.totalPaise - nonCreditPaid);

  if (hasCash && hasUpi) {
    if (remaining > 500 && Boolean(invoice.partyId)) {
      return "SPLIT";
    }
    return "SPLIT (CASH + UPI)";
  }
  if (
    hasCredit ||
    (!hasCash && !hasUpi && !hasCard && (invoice.paymentStatus === "PENDING" || (invoice.paymentStatus as string) === "UNPAID"))
  ) {
    return "CREDIT";
  }
  if (hasUpi) {
    if (remaining > 500 && Boolean(invoice.partyId)) {
      return "SPLIT (UPI + CREDIT)";
    }
    return "UPI";
  }
  if (hasCard) {
    if (remaining > 500 && Boolean(invoice.partyId)) {
      return "SPLIT (CARD + CREDIT)";
    }
    return "CARD";
  }
  if (hasCash) {
    if (remaining > 500 && Boolean(invoice.partyId)) {
      return "SPLIT (CASH + CREDIT)";
    }
    return "CASH";
  }
  return "CASH";
}

function normalizeUnitDisplay(rawUnit: string, packLabel?: string | null): string {
  const label = (packLabel || rawUnit || "Crt").trim();
  const lower = label.toLowerCase();
  if (lower === "carton" || lower === "ctn" || lower === "crt") return "Crt";
  if (lower === "bag" || lower === "beg") return "Bag";
  if (lower === "hanger" || lower === "hgr") return "Hgr";
  if (lower === "jar") return "Jar";
  if (lower === "dozen" || lower === "dzn") return "Dzn";
  return label;
}

export function getBillLineItemDisplay(
  item: InvoiceWithDetails["items"][number],
  idx: number
): BillLineItemDisplay {
  const packSize = Math.max(1, item.product?.packSize || 1);
  const rawUnit = (item.unitLabel || "").trim();
  const canonicalUnit = normalizeUnitCode(rawUnit);
  const isCarton = (canonicalUnit === "Carton" || canonicalUnit === "Bag") && packSize > 1;

  const qtyValue = isCarton ? item.qty / packSize : item.qty;
  const qtyDisplay = Number.isInteger(qtyValue) ? String(qtyValue) : qtyValue.toFixed(2);
  const unitDisplay = isCarton
    ? normalizeUnitDisplay(rawUnit, item.product?.packLabel)
    : canonicalUnit === "Pcs"
    ? "Pcs"
    : canonicalUnit;
  const ratePaise = isCarton ? item.unitPricePaise * packSize : item.unitPricePaise;
  const amountPaise = item.taxablePaise + item.taxPaise;

  const rawWeight = item.product?.weight?.trim() || "";
  const baseName = item.product?.name || "Item";
  const fullName =
    rawWeight && !baseName.toLowerCase().includes(rawWeight.toLowerCase())
      ? `${baseName} ${rawWeight}`
      : baseName;

  return {
    id: item.id,
    sl: idx + 1,
    fullName,
    qtyDisplay,
    unitDisplay,
    qtyLabel: `${qtyDisplay} ${unitDisplay}`,
    ratePaise,
    rateFormatted: formatRupeesEN(ratePaise),
    amountPaise,
    amountFormatted: formatRupeesEN(amountPaise),
  };
}
