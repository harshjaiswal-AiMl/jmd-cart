import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { getFinancialYear, getNextSequenceNumber } from "@/lib/invoice-number";

describe("Invoice Numbering & Concurrency: Integration Tests", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("calculates Indian Financial Year accurately across April boundary in IST", () => {
    expect(getFinancialYear(new Date("2026-04-01T00:00:00+05:30"))).toBe("26-27");
    expect(getFinancialYear(new Date("2026-10-15T12:00:00+05:30"))).toBe("26-27");
    expect(getFinancialYear(new Date("2026-12-31T23:59:59+05:30"))).toBe("26-27");
    expect(getFinancialYear(new Date("2027-01-15T12:00:00+05:30"))).toBe("26-27");
    expect(getFinancialYear(new Date("2027-03-31T23:59:59+05:30"))).toBe("26-27");
    expect(getFinancialYear(new Date("2027-04-01T00:00:00+05:30"))).toBe("27-28");
  });

  it("generates strictly gapless, unique numbers under 20 concurrent parallel requests", async () => {
    const series = `CONC_${Date.now()}`;
    const testDate = new Date("2026-10-09");
    const fy = getFinancialYear(testDate);

    // Launch 20 concurrent transactions
    const concurrentRequests = Array.from({ length: 20 }, () =>
      prisma.$transaction(
        async (tx) => {
          return getNextSequenceNumber(tx, series, testDate);
        },
        { timeout: 15000 }
      )
    );

    const results = await Promise.all(concurrentRequests);

    // 1. Verify all 20 succeeded
    expect(results).toHaveLength(20);

    // 2. Extract returned numbers and sequence values
    const numbers = results.map((r) => r.number);
    const sequenceValues = results.map((r) => r.sequenceValue).sort((a, b) => a - b);

    // 3. Verify zero duplicates
    const uniqueNumbers = new Set(numbers);
    expect(uniqueNumbers.size).toBe(20);

    // 4. Verify strictly gapless sequence: 1, 2, 3, ... 20
    const expectedSequences = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(sequenceValues).toEqual(expectedSequences);

    // 5. Verify format of the first and last generated invoice number
    expect(numbers).toContain(`${series}/${fy}/000001`);
    expect(numbers).toContain(`${series}/${fy}/000020`);
  });

  it("does not consume or burn sequence numbers when a transaction rolls back", async () => {
    const series = `RB_${Date.now()}`;
    const testDate = new Date("2026-10-09");
    const fy = getFinancialYear(testDate);

    // 1. First transaction gets sequence #1 and successfully commits
    const firstCommit = await prisma.$transaction(async (tx) => {
      return getNextSequenceNumber(tx, series, testDate);
    });
    expect(firstCommit.sequenceValue).toBe(1);
    expect(firstCommit.number).toBe(`${series}/${fy}/000001`);

    // 2. Second transaction gets sequence #2, but then aborts / rolls back
    await expect(
      prisma.$transaction(async (tx) => {
        await getNextSequenceNumber(tx, series, testDate);
        throw new Error("Simulated payment gateway or stock failure during finalization");
      })
    ).rejects.toThrow("Simulated payment gateway or stock failure");

    // 3. Third transaction runs: must receive sequence #2 (no gap left!)
    const thirdCommit = await prisma.$transaction(async (tx) => {
      return getNextSequenceNumber(tx, series, testDate);
    });
    expect(thirdCommit.sequenceValue).toBe(2);
    expect(thirdCommit.number).toBe(`${series}/${fy}/000002`);
  });
});
