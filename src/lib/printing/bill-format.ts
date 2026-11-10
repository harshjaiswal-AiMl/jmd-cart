import { InvoiceWithDetails } from "@/modules/billing/billing.types";

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
  const modes = (invoice.payments || []).map((p) => p.mode);
  if (modes.includes("CREDIT")) return "CREDIT";
  if (modes.length > 1 && modes.includes("CASH") && modes.includes("UPI")) {
    return "SPLIT (CASH + UPI)";
  }
  if (modes.includes("UPI")) return "UPI";
  if (modes.includes("CARD")) return "CARD";
  return "CASH";
}

function normalizeUnitDisplay(rawUnit: string, packLabel?: string | null): string {
  const label = (packLabel || rawUnit || "Crt").trim();
  const lower = label.toLowerCase();
  if (lower === "carton" || lower === "ctn" || lower === "crt") return "Crt";
  if (lower === "bag") return "Bag";
  return label;
}

export function getBillLineItemDisplay(
  item: InvoiceWithDetails["items"][number],
  idx: number
): BillLineItemDisplay {
  const packSize = Math.max(1, item.product?.packSize || 1);
  const rawUnit = (item.unitLabel || "").trim();
  const explicitCartonUnit =
    rawUnit === "Carton" || rawUnit === "Ctn" || rawUnit === "Crt" || rawUnit === "Bag";
  const inferredCartonUnit =
    !rawUnit && packSize > 1 && item.qty >= packSize && item.qty % packSize === 0;
  const isCarton = (explicitCartonUnit || inferredCartonUnit) && packSize > 1;

  const qtyValue = isCarton ? item.qty / packSize : item.qty;
  const qtyDisplay = qtyValue.toFixed(2);
  const unitDisplay = isCarton
    ? normalizeUnitDisplay(rawUnit, item.product?.packLabel)
    : "Pcs.";
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
