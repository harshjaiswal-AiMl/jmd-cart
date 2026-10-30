/**
 * Centralized Date & Time Utility for JMD Cart
 *
 * Invariants:
 * 1. Storage: Timestamps are stored in UTC (timestamptz) in PostgreSQL.
 * 2. Semantics: All business operations (invoices, day-ends, reports, sequences, FY rollover)
 *    are strictly evaluated in Indian Standard Time (IST, UTC+05:30, Asia/Kolkata).
 * 3. Formats: User-facing dates are always DD-MM-YYYY in IST.
 * 4. Determinism: Produces identical results regardless of the process/server timezone (UTC, America/Los_Angeles, etc.).
 */

export const IST_TIMEZONE = "Asia/Kolkata";
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +05:30 in ms

export interface IstDateParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hours: number; // 0-23
  minutes: number; // 0-59
  seconds: number; // 0-59
}

/**
 * Extracts year, month, day, hours, minutes, seconds of a Date in IST.
 * Safe across all process/OS timezones.
 */
export function getIstParts(input?: Date | string | number | null): IstDateParts {
  const d = input instanceof Date ? input : input ? new Date(input) : new Date();
  if (isNaN(d.getTime())) {
    const fallback = new Date();
    return getIstParts(fallback);
  }

  // Use Intl.DateTimeFormat to reliably extract parts in Asia/Kolkata
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(d);
  let year = 1970;
  let month = 1;
  let day = 1;
  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  for (const p of parts) {
    if (p.type === "year") year = parseInt(p.value, 10);
    else if (p.type === "month") month = parseInt(p.value, 10);
    else if (p.type === "day") day = parseInt(p.value, 10);
    else if (p.type === "hour") hours = parseInt(p.value, 10);
    else if (p.type === "minute") minutes = parseInt(p.value, 10);
    else if (p.type === "second") seconds = parseInt(p.value, 10);
  }

  return { year, month, day, hours, minutes, seconds };
}

/**
 * Returns current timestamp.
 */
export function nowIst(): Date {
  return new Date();
}

/**
 * Formats date as YYYY-MM-DD in IST.
 */
export function toIstDateString(input?: Date | string | number | null): string {
  const { year, month, day } = getIstParts(input);
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * Formats date as DD-MM-YYYY in IST (standard Indian business format).
 */
export function formatDmy(input?: Date | string | number | null): string {
  if (!input) return "-";
  const { year, month, day } = getIstParts(input);
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${dd}-${mm}-${year}`;
}

/**
 * Formats date and time as DD-MM-YYYY hh:mm A or DD-MM-YYYY HH:mm in IST.
 */
export function formatDmyHm(
  input?: Date | string | number | null,
  is24Hour: boolean = false
): string {
  if (!input) return "-";
  const { year, month, day, hours, minutes } = getIstParts(input);
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const dmy = `${dd}-${mm}-${year}`;

  if (is24Hour) {
    const hh = String(hours).padStart(2, "0");
    const min = String(minutes).padStart(2, "0");
    return `${dmy} ${hh}:${min}`;
  }

  const ampm = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  const hh = String(h12).padStart(2, "0");
  const min = String(minutes).padStart(2, "0");
  return `${dmy} ${hh}:${min} ${ampm}`;
}

/**
 * Parses DD-MM-YYYY or DD/MM/YYYY or YYYY-MM-DD into a Date representing IST start of that day.
 * Returns null if format is invalid.
 */
export function parseDmy(input: string): Date | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();

  // Check DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) {
      return null;
    }
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return new Date(`${year}-${mm}-${dd}T00:00:00.000+05:30`);
  }

  // Check YYYY-MM-DD
  const ymdMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) {
      return null;
    }
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return new Date(`${year}-${mm}-${dd}T00:00:00.000+05:30`);
  }

  return null;
}

/**
 * Returns UTC Date object representing 00:00:00.000 IST on the given day.
 */
export function startOfIstDay(input?: Date | string | number | null): Date {
  const dateStr = toIstDateString(input);
  return new Date(`${dateStr}T00:00:00.000+05:30`);
}

/**
 * Returns UTC Date object representing 23:59:59.999 IST on the given day.
 */
export function endOfIstDay(input?: Date | string | number | null): Date {
  const dateStr = toIstDateString(input);
  return new Date(`${dateStr}T23:59:59.999+05:30`);
}

/**
 * Computes startUtc, endUtc, dateStr (YYYY-MM-DD) and dmyStr (DD-MM-YYYY) in IST.
 */
export function getIstDayRange(input?: Date | string | number | null): {
  startUtc: Date;
  endUtc: Date;
  dateStr: string;
  dmyStr: string;
} {
  const dateStr = toIstDateString(input);
  const startUtc = new Date(`${dateStr}T00:00:00.000+05:30`);
  const endUtc = new Date(`${dateStr}T23:59:59.999+05:30`);
  return {
    startUtc,
    endUtc,
    dateStr,
    dmyStr: formatDmy(startUtc),
  };
}

/**
 * Returns the Indian Financial Year string (e.g. "26-27") for the given date in IST.
 * FY runs from 1st April to 31st March.
 */
export function fyOf(input?: Date | string | number | null): string {
  const { year, month } = getIstParts(input);
  // If month is January (1), February (2), or March (3), FY belongs to previous calendar year
  const startYear = month >= 4 ? year : year - 1;
  const endYear = startYear + 1;
  const s2 = String(startYear).slice(-2);
  const e2 = String(endYear).slice(-2);
  return `${s2}-${e2}`;
}

/**
 * Validates whether a manual invoice date is permitted.
 * Rules:
 * 1. Future dates are strictly disallowed (date <= now in IST).
 * 2. Backdating is allowed up to maxBackDays (e.g. 30 days for admin, 7 days for shop).
 * 3. Cannot be on or before an accounts lock date (if lockDate is set).
 */
export function validateManualDate(params: {
  date: Date;
  maxBackDays: number;
  lockDate?: Date | null;
  now?: Date;
}): { valid: boolean; error?: string } {
  const now = params.now || nowIst();
  const todayEnd = endOfIstDay(now);

  // Check future date
  if (params.date.getTime() > todayEnd.getTime()) {
    return { valid: false, error: "Future dates are not permitted for invoices." };
  }

  // Check backdate limit
  const earliestAllowed = startOfIstDay(
    new Date(now.getTime() - params.maxBackDays * 24 * 60 * 60 * 1000)
  );
  if (params.date.getTime() < earliestAllowed.getTime()) {
    return {
      valid: false,
      error: `Invoice date cannot be older than ${params.maxBackDays} days.`,
    };
  }

  // Check lock date
  if (params.lockDate) {
    const lockDayEnd = endOfIstDay(params.lockDate);
    if (params.date.getTime() <= lockDayEnd.getTime()) {
      return {
        valid: false,
        error: `Accounts locked up to ${formatDmy(params.lockDate)}. Editing before this date requires Super Admin authorization.`,
      };
    };
  }

  return { valid: true };
}
