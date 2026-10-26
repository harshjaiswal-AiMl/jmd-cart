import { describe, it, expect } from "vitest";
import { getISTDayRange, getISTDateString } from "@/lib/date";

describe("Defect B5: Channel & IST Midnight-to-Midnight Boundaries", () => {
  it("correctly includes late-night invoices (11:14 PM IST) in today's IST range", () => {
    const todayStr = "2026-10-25";
    const { startUtc, endUtc } = getISTDayRange(todayStr);

    // 11:14 PM IST on 25 Oct is 17:44 UTC on 25 Oct
    const lateNightInvoiceDate = new Date("2026-10-25T23:14:00.000+05:30");

    expect(lateNightInvoiceDate.getTime()).toBeGreaterThanOrEqual(startUtc.getTime());
    expect(lateNightInvoiceDate.getTime()).toBeLessThanOrEqual(endUtc.getTime());
  });

  it("ensures midnight IST (00:00:00 IST) is the start boundary and 23:59:59.999 IST is the end boundary", () => {
    const todayStr = "2026-10-26";
    const { startUtc, endUtc } = getISTDayRange(todayStr);

    const startIst = new Date("2026-10-26T00:00:00.000+05:30");
    const endIst = new Date("2026-10-26T23:59:59.999+05:30");

    expect(startUtc.getTime()).toBe(startIst.getTime());
    expect(endUtc.getTime()).toBe(endIst.getTime());
  });
});
