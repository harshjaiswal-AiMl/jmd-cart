import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  nowIst,
  toIstDateString,
  startOfIstDay,
  endOfIstDay,
  parseDmy,
  formatDmy,
  formatDmyHm,
  fyOf,
  validateManualDate,
  getIstParts,
} from "../../src/lib/datetime";

describe("Prompt #15 Part 4: Centralized Datetime Module & Timezone Invariance Matrix", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("consistently formats dates as DD-MM-YYYY in IST across midnight boundaries", () => {
    // 30 Oct 2026, 01:15 AM IST is 29 Oct 2026, 19:45 UTC
    const dateAt115AmIst = new Date("2026-10-29T19:45:00.000Z");

    // In UTC date would be 2026-10-29, but in IST it MUST be 30-10-2026
    expect(toIstDateString(dateAt115AmIst)).toBe("2026-10-30");
    expect(formatDmy(dateAt115AmIst)).toBe("30-10-2026");
    expect(formatDmyHm(dateAt115AmIst)).toContain("30-10-2026");
    expect(formatDmyHm(dateAt115AmIst)).toContain("01:15 AM");
  });

  it("correctly identifies FY across midnight of March 31 / April 1 in IST", () => {
    // 31 March 2027 23:59:00 IST is 31 March 2027 18:29:00 UTC
    const march31Night = new Date("2027-03-31T18:29:00.000Z");
    expect(toIstDateString(march31Night)).toBe("2027-03-31");
    expect(fyOf(march31Night)).toBe("26-27");

    // 01 April 2027 00:01:00 IST is 31 March 2027 18:31:00 UTC
    const april1Morning = new Date("2027-03-31T18:31:00.000Z");
    expect(toIstDateString(april1Morning)).toBe("2027-04-01");
    expect(fyOf(april1Morning)).toBe("27-28");
  });

  it("accurately computes startOfIstDay and endOfIstDay boundaries", () => {
    const randomTime = new Date("2026-10-30T14:35:12.456Z"); // ~20:05 IST
    const start = startOfIstDay(randomTime);
    const end = endOfIstDay(randomTime);

    expect(start.toISOString()).toBe("2026-10-29T18:30:00.000Z"); // 00:00 IST
    expect(end.toISOString()).toBe("2026-10-30T18:29:59.999Z"); // 23:59:59.999 IST
    expect(formatDmy(start)).toBe("30-10-2026");
    expect(formatDmy(end)).toBe("30-10-2026");
  });

  it("parses DD-MM-YYYY and DD/MM/YYYY into exact IST start-of-day UTC Date", () => {
    const d1 = parseDmy("30-10-2026");
    expect(d1).not.toBeNull();
    expect(d1!.toISOString()).toBe("2026-10-29T18:30:00.000Z");
    expect(formatDmy(d1!)).toBe("30-10-2026");

    const d2 = parseDmy("05/11/2026");
    expect(d2).not.toBeNull();
    expect(d2!.toISOString()).toBe("2026-11-04T18:30:00.000Z");
    expect(formatDmy(d2!)).toBe("05-11-2026");

    const invalid = parseDmy("invalid-date");
    expect(invalid).toBeNull();
  });

  it("enforces backdate window, rejects future dates and accounts lock date", () => {
    // Current time: 30-10-2026 12:00 IST
    const now = new Date("2026-10-30T06:30:00.000Z");

    // 1. Same day allowed
    const today = parseDmy("30-10-2026")!;
    expect(validateManualDate({ date: today, maxBackDays: 30, now }).valid).toBe(true);

    // 2. 10 days backdate with 30-day limit allowed
    const tenDaysAgo = parseDmy("20-10-2026")!;
    expect(validateManualDate({ date: tenDaysAgo, maxBackDays: 30, now }).valid).toBe(true);

    // 3. 10 days backdate with 7-day limit (shop) rejected
    expect(validateManualDate({ date: tenDaysAgo, maxBackDays: 7, now }).valid).toBe(false);

    // 4. Future date rejected
    const tomorrow = parseDmy("31-10-2026")!;
    const futureCheck = validateManualDate({ date: tomorrow, maxBackDays: 30, now });
    expect(futureCheck.valid).toBe(false);
    expect(futureCheck.error).toContain("Future dates are not permitted");

    // 5. Date on or before lock date rejected
    const lockDate = parseDmy("25-10-2026")!;
    const lockedCheck = validateManualDate({
      date: parseDmy("24-10-2026")!,
      maxBackDays: 30,
      lockDate,
      now,
    });
    expect(lockedCheck.valid).toBe(false);
    expect(lockedCheck.error).toContain("Accounts locked");
  });
});
