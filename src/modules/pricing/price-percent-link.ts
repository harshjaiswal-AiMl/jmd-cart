/**
 * Bi-directional linked Price <-> Percent discount calculation helpers.
 * Single source of truth: backend stores prices in integer paise.
 * Percent is derived from MRP and Price, or Price is derived from MRP and Percent.
 */

export interface PricePercentState {
  mrpRupees: string;
  priceRupees: string;
  percent: string;
}

/**
 * Calculates discount percent from MRP and Price in paise.
 * Formula: ((mrpPaise - pricePaise) / mrpPaise) * 100
 * Returns formatted 2-decimal string (e.g. "20.00") or empty string if invalid.
 */
export function calculatePercentFromPrice(
  mrpPaise: number | null | undefined,
  pricePaise: number | null | undefined
): string {
  if (mrpPaise == null || mrpPaise <= 0 || pricePaise == null || pricePaise < 0) {
    return "";
  }
  if (pricePaise > mrpPaise) {
    return "0.00";
  }
  const pct = ((mrpPaise - pricePaise) / mrpPaise) * 100;
  // Format to 2 decimal places, trimming trailing zeroes if exact or keeping 2 decimals
  return pct.toFixed(2);
}

/**
 * Calculates price in paise from MRP (in paise) and discount percent (0 - 99.99).
 * Formula: Math.round(mrpPaise * (1 - percent / 100))
 */
export function calculatePriceFromPercent(
  mrpPaise: number | null | undefined,
  percent: number | string | null | undefined
): number | null {
  if (mrpPaise == null || mrpPaise <= 0 || percent == null || percent === "") {
    return null;
  }
  const pctNum = typeof percent === "string" ? parseFloat(percent) : percent;
  if (isNaN(pctNum) || pctNum < 0 || pctNum >= 100) {
    return null;
  }
  const pricePaise = Math.round(mrpPaise * (1 - pctNum / 100));
  return Math.max(0, Math.min(pricePaise, mrpPaise));
}

/**
 * Formats paise to 2-decimal rupees string for inputs (e.g. 5688 -> "56.88").
 */
export function paiseToRupeesString(paise: number | null | undefined): string {
  if (paise == null) return "";
  return (paise / 100).toFixed(2);
}

/**
 * Parses user rupees string input into integer paise.
 */
export function rupeesStringToPaise(rupees: string | null | undefined): number | null {
  if (!rupees || typeof rupees !== "string" || !rupees.trim()) return null;
  const num = parseFloat(rupees.trim());
  if (isNaN(num) || num < 0) return null;
  return Math.round(num * 100);
}

/**
 * Validates price against MRP according to Legal Metrology Act.
 */
export function validatePriceAgainstMrp(
  pricePaise: number | null | undefined,
  mrpPaise: number | null | undefined
): { isValid: boolean; warning?: string } {
  if (pricePaise == null || mrpPaise == null) return { isValid: true };
  if (mrpPaise > 0 && pricePaise > mrpPaise) {
    return {
      isValid: false,
      warning: "Price above MRP is not allowed by Legal Metrology",
    };
  }
  return { isValid: true };
}
