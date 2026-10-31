/**
 * Universal Currency & Price Formatting for JMD Cart
 *
 * All database and service prices are strictly stored as integer PAISE (100 paise = ₹1.00).
 * This module ensures prices with decimals (e.g. 50 paise = ₹0.50, 40 paise = ₹0.40, ₹10.50)
 * NEVER get rounded off to 0, while whole rupee numbers (e.g. ₹100, ₹1,500) render cleanly
 * without unnecessary trailing zeros.
 */

/**
 * Format integer paise into an Indian Rupee string (e.g. 50 -> "0.50", 1000 -> "10", 125050 -> "1,250.50").
 */
export function formatPaise(paise: number | null | undefined): string {
  if (paise == null || isNaN(paise)) return "0";
  const num = Number(paise);
  if (num === 0) return "0";

  const rupees = num / 100;

  // Whole rupee amount (e.g. 100 paise = 1, 1000 paise = 10, 50000 paise = 500)
  if (Number.isInteger(rupees)) {
    return rupees.toLocaleString("en-IN");
  }

  // Fractional rupee amount (e.g. 50 paise = 0.50, 40 paise = 0.40, 1050 paise = 10.50)
  return rupees.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format float/number rupees into an Indian Rupee string (e.g. 0.5 -> "0.50", 10 -> "10", 10.5 -> "10.50").
 */
export function formatRupees(rupees: number | null | undefined): string {
  if (rupees == null || isNaN(rupees)) return "0";
  const num = Number(rupees);
  if (num === 0) return "0";

  if (Number.isInteger(num)) {
    return num.toLocaleString("en-IN");
  }

  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Convert paise to exact rupee number with 2 decimal precision (e.g. 50 -> 0.5, 1050 -> 10.5).
 */
export function paiseToRupees(paise: number | null | undefined): number {
  if (paise == null || isNaN(paise)) return 0;
  return Number((Number(paise) / 100).toFixed(2));
}
