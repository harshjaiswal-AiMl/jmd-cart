/**
 * Indian phone number normalization and validation.
 */

/**
 * Normalizes an Indian mobile number to a standard 10-digit string (e.g. "9876543210").
 * Strips whitespace, hyphens, and common prefixes (+91, 91, 0).
 * Returns null if the input cannot be resolved to a valid 10-digit mobile starting with 6-9.
 */
export function normalizeIndianMobile(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return digits;
  }
  if (digits.length === 11 && digits.startsWith("0") && /^[6-9]/.test(digits.slice(1))) {
    return digits.slice(1);
  }
  if (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits.slice(2))) {
    return digits.slice(2);
  }
  return null;
}

/**
 * Checks whether a phone number is a valid 10-digit Indian mobile.
 */
export function isValidIndianMobile(raw: string | null | undefined): boolean {
  return normalizeIndianMobile(raw) !== null;
}
