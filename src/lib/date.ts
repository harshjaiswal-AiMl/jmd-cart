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

/**
 * Returns current or given date in YYYY-MM-DD format according to Indian Standard Time.
 */
export function getISTDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Computes the UTC start and end Date objects corresponding to an IST date (YYYY-MM-DD).
 */
export function getISTDayRange(dateStr?: string): {
  startUtc: Date;
  endUtc: Date;
  dateStr: string;
} {
  const targetDateStr = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
    ? dateStr
    : getISTDateString();

  const startUtc = new Date(`${targetDateStr}T00:00:00.000+05:30`);
  const endUtc = new Date(`${targetDateStr}T23:59:59.999+05:30`);

  return {
    startUtc,
    endUtc,
    dateStr: targetDateStr,
  };
}

