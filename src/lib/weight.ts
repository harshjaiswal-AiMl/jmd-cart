/**
 * Weight utility functions: parsing, normalisation, categorization and sorting.
 */

export interface NormalizedWeight {
  value: number; // e.g. 500
  unit: "g" | "kg" | "ml" | "l" | "pcs";
  baseGramsOrMl: number; // in grams for mass, ml for volume, pcs for count
  display: string; // e.g. "500g"
}

export type WeightBand =
  | "50g"
  | "100g"
  | "200g"
  | "250g"
  | "500g"
  | "1kg"
  | "5kg+"
  | "liquid"
  | "other"
  | "none";

export interface WeightFilterOption {
  key: WeightBand;
  label: string;
  count: number;
}

/**
 * Normalises a weight value and unit into standard base units (grams / ml).
 */
export function normalizeWeight(
  val?: number | null,
  unit?: string | null
): NormalizedWeight | null {
  if (val === undefined || val === null || isNaN(val) || val <= 0) return null;
  const rawUnit = (unit || "g").trim().toLowerCase();

  let standardUnit: "g" | "kg" | "ml" | "l" | "pcs" = "g";
  let base = val;

  if (rawUnit === "kg" || rawUnit === "kilogram" || rawUnit === "kilo") {
    standardUnit = "kg";
    base = val * 1000;
  } else if (rawUnit === "g" || rawUnit === "gm" || rawUnit === "gram" || rawUnit === "grams") {
    standardUnit = "g";
    base = val;
  } else if (rawUnit === "l" || rawUnit === "ltr" || rawUnit === "litre" || rawUnit === "liter") {
    standardUnit = "l";
    base = val * 1000;
  } else if (rawUnit === "ml" || rawUnit === "millilitre" || rawUnit === "milliliter") {
    standardUnit = "ml";
    base = val;
  } else if (rawUnit === "pc" || rawUnit === "pcs" || rawUnit === "piece" || rawUnit === "pieces") {
    standardUnit = "pcs";
    base = val;
  }

  const display =
    standardUnit === "kg" || standardUnit === "l"
      ? `${val}${standardUnit}`
      : `${Math.round(val)}${standardUnit}`;

  return {
    value: val,
    unit: standardUnit,
    baseGramsOrMl: base,
    display,
  };
}

/**
 * Parses conservative weight suggestions from product name or text.
 * e.g. "Bikaji Bhujia 400g Pouch" -> { value: 400, unit: "g" }
 * e.g. "Fortune Sunlite Oil 1L Pouch" -> { value: 1, unit: "l" }
 */
export function extractWeightFromText(text: string): {
  value: number;
  unit: "g" | "kg" | "ml" | "l" | "pcs";
} | null {
  if (!text) return null;
  const clean = text.trim();

  // Match: 500g, 500 gm, 1kg, 1.5 kg, 200ml, 1L, 5 ltr
  const pattern = /(\d+(?:\.\d+)?)\s*(kg|kilo|gm|g|gram|grams|ltr|l|litre|liter|ml|pcs|pc)\b/i;
  const match = clean.match(pattern);
  if (!match) return null;

  const num = parseFloat(match[1]);
  if (isNaN(num) || num <= 0) return null;

  const rawUnit = match[2].toLowerCase();
  if (rawUnit.startsWith("k")) return { value: num, unit: "kg" };
  if (rawUnit.startsWith("l")) return { value: num, unit: "l" };
  if (rawUnit === "ml") return { value: num, unit: "ml" };
  if (rawUnit.startsWith("p")) return { value: num, unit: "pcs" };
  return { value: num, unit: "g" };
}

/**
 * Categorizes a product's weight into standard filter bands.
 */
export function categorizeWeightBand(
  val?: number | null,
  unit?: string | null
): WeightBand {
  const norm = normalizeWeight(val, unit);
  if (!norm) return "none";

  if (norm.unit === "ml" || norm.unit === "l") {
    return "liquid";
  }

  if (norm.unit === "pcs") {
    return "other";
  }

  const g = norm.baseGramsOrMl;
  if (g <= 75) return "50g";
  if (g <= 150) return "100g";
  if (g <= 225) return "200g";
  if (g <= 350) return "250g";
  if (g <= 750) return "500g";
  if (g < 5000) return "1kg";
  return "5kg+";
}

/**
 * Standard weight bands in display order.
 */
export const STANDARD_WEIGHT_BANDS: { key: WeightBand; label: string }[] = [
  { key: "50g", label: "50g" },
  { key: "100g", label: "100g" },
  { key: "200g", label: "200g" },
  { key: "250g", label: "250g" },
  { key: "500g", label: "500g" },
  { key: "1kg", label: "1kg - 2kg" },
  { key: "5kg+", label: "5kg & Bulk" },
  { key: "liquid", label: "ml / Litre" },
  { key: "none", label: "No Weight" },
];
