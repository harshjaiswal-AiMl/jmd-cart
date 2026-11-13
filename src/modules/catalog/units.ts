/**
 * Shared Unit Catalogue & Conversion System
 * Supports standard units: Pcs, Carton (Crt), Dozen (12), Bag (Beg), Jar, Hanger (60)
 */

export type UnitCode = "Pcs" | "Carton" | "Dozen" | "Bag" | "Jar" | "Hanger";

export interface UnitDefinition {
  code: UnitCode;
  label: string;
  shortLabel: string;
  hotkey: string;
  defaultPcs: number | null; // null if derived from product
}

export const UNIT_CATALOGUE: UnitDefinition[] = [
  { code: "Pcs", label: "Pcs (Piece)", shortLabel: "Pcs", hotkey: "p", defaultPcs: 1 },
  { code: "Carton", label: "Carton (Crt)", shortLabel: "Crt", hotkey: "c", defaultPcs: null },
  { code: "Dozen", label: "Dozen (12)", shortLabel: "Dzn", hotkey: "d", defaultPcs: 12 },
  { code: "Bag", label: "Bag (Beg)", shortLabel: "Bag", hotkey: "b", defaultPcs: null },
  { code: "Jar", label: "Jar", shortLabel: "Jar", hotkey: "j", defaultPcs: null },
  { code: "Hanger", label: "Hanger (60)", shortLabel: "Hgr", hotkey: "h", defaultPcs: 60 },
];

/**
 * Normalizes any unit string to its canonical UnitCode or short display name.
 */
export function normalizeUnitCode(rawUnit?: string | null): UnitCode {
  if (!rawUnit) return "Pcs";
  const u = rawUnit.trim().toLowerCase();
  if (u === "hanger" || u === "hgr" || u === "h") return "Hanger";
  if (u === "jar" || u === "j") return "Jar";
  if (u === "dozen" || u === "dzn" || u === "dz" || u === "d") return "Dozen";
  if (u === "carton" || u === "ctn" || u === "crt" || u === "c") return "Carton";
  if (u === "bag" || u === "beg" || u === "b") return "Bag";
  return "Pcs";
}

/**
 * Returns the piece multiplier for a given unit and product.
 * Standard rules:
 * - Pcs: 1
 * - Hanger: 60 pcs (1 Hanger = 60 Pieces)
 * - Dozen: 12 pcs
 * - Carton: product.packSize (defaults to 1)
 * - Bag: product.bagSize || product.packSize (defaults to 1)
 * - Jar: product.jarSize || product.packSize (defaults to 1)
 */
export function getUnitMultiplier(
  unit: string | null | undefined,
  product?: { packSize?: number | null; bagSize?: number | null; jarSize?: number | null } | null
): number {
  const code = normalizeUnitCode(unit);
  switch (code) {
    case "Hanger":
      return 60;
    case "Dozen":
      return 12;
    case "Carton":
      return Math.max(1, product?.packSize || 1);
    case "Bag":
      return Math.max(1, (product as any)?.bagSize || product?.packSize || 1);
    case "Jar":
      return Math.max(1, (product as any)?.jarSize || product?.packSize || 1);
    case "Pcs":
    default:
      return 1;
  }
}

/**
 * Formats unit totals summing by the sold unit.
 * Rules:
 * - Single unit: formatted total + unit name (e.g. "104.00 Carton", "14 Pcs", "5 Hanger")
 * - Mixed units: joined with " + " (e.g. "104 Carton + 12 Pcs")
 * - Empty: "0 Pcs"
 */
export function formatUnitTotals(
  items: Array<{ qty: number; unit?: string | null; unitLabel?: string | null }>
): string {
  if (!items || items.length === 0) return "0 Pcs";

  const totalsByUnit: Record<string, number> = {};

  for (const item of items) {
    const rawUnit = item.unitLabel || item.unit || "Pcs";
    const canonical = normalizeUnitCode(rawUnit);
    totalsByUnit[canonical] = (totalsByUnit[canonical] || 0) + (Number(item.qty) || 0);
  }

  const parts: string[] = [];
  const priorityOrder: UnitCode[] = ["Carton", "Bag", "Jar", "Hanger", "Dozen", "Pcs"];

  for (const code of priorityOrder) {
    const qty = totalsByUnit[code];
    if (qty && qty > 0) {
      if (code === "Carton") {
        // Match bill convention: 104.00 Carton or 104 Carton if single
        parts.push(`${qty.toFixed(2)} Carton`);
      } else {
        parts.push(`${qty} ${code}`);
      }
    }
  }

  // Handle any other unrecognized units
  for (const [unit, qty] of Object.entries(totalsByUnit)) {
    if (!priorityOrder.includes(unit as UnitCode) && qty > 0) {
      parts.push(`${qty} ${unit}`);
    }
  }

  return parts.length > 0 ? parts.join(" + ") : "0 Pcs";
}
