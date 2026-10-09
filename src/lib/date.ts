/**
 * Utility functions for formatting dates and times in Indian Standard Time (IST, Asia/Kolkata).
 * Ensures consistency across the entire application per project requirements.
 */

const IST_TIME_ZONE = "Asia/Kolkata";

/**
 * Format a Date or date string to Indian Standard Time (IST) Date string (e.g., "09 Oct 2026").
 */
export function formatISTDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

/**
 * Format a Date or date string to Indian Standard Time (IST) DateTime string (e.g., "09 Oct 2026, 07:45 PM").
 */
export function formatISTDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/**
 * Format a Date or date string to Indian Standard Time (IST) Time string (e.g., "07:45 PM").
 */
export function formatISTTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}
