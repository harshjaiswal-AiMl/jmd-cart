import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type TransactionClient = Prisma.TransactionClient;

export interface InvoiceNumberResult {
  number: string;
  fy: string;
  sequenceValue: number;
  series: string;
}

/**
 * Returns the Indian Financial Year string in "YY-YY" format (April 1 to March 31)
 * evaluated in Indian Standard Time (IST, Asia/Kolkata).
 * E.g., October 2026 -> "26-27", January 2027 -> "26-27", April 2027 -> "27-28".
 */
export function getFinancialYear(date: Date = new Date()): string {
  // Extract Year and Month explicitly in IST (Asia/Kolkata)
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
  });
  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find((p) => p.type === "year")!.value, 10);
  const month = parseInt(parts.find((p) => p.type === "month")!.value, 10); // 1 = Jan, 4 = April, 12 = Dec

  let startYear: number;
  let endYear: number;

  if (month >= 4) {
    // April to December
    startYear = year;
    endYear = year + 1;
  } else {
    // January to March
    startYear = year - 1;
    endYear = year;
  }

  const startStr = String(startYear % 100).padStart(2, "0");
  const endStr = String(endYear % 100).padStart(2, "0");

  return `${startStr}-${endStr}`;
}

/**
 * Read-only preview of the next sequence number without locking or reserving.
 * Safe for display in UI before voucher saving.
 */
export async function previewNextInvoiceNumber(
  series: string = "INV",
  date: Date = new Date()
): Promise<string> {
  const fy = getFinancialYear(date);
  try {
    const row = await prisma.sequence.findUnique({
      where: { name_fy: { name: series, fy } },
    });
    const val = row?.nextValue ?? 1;
    const padded = String(val).padStart(6, "0");
    return `${series}/${fy}/${padded}`;
  } catch {
    return `${series}/${fy}/000001`;
  }
}

/**
 * Generates the next gapless sequential document number inside an existing PostgreSQL transaction.
 * Uses pessimistic row locking (SELECT ... FOR UPDATE) on the sequences table.
 * If the transaction aborts, the sequence value is not consumed.
 */
export async function getNextSequenceNumber(
  tx: TransactionClient,
  series: string = "INV",
  date: Date = new Date()
): Promise<InvoiceNumberResult> {
  const fy = getFinancialYear(date);

  // 1. Ensure the sequence row exists for this series & FY
  await tx.$executeRaw`
    INSERT INTO "sequences" ("name", "fy", "next_value", "updated_at")
    VALUES (${series}, ${fy}, 1, NOW())
    ON CONFLICT ("name", "fy")
    DO NOTHING;
  `;

  // 2. Pessimistically lock the counter row
  const rows = await tx.$queryRaw<{ next_value: number }[]>`
    SELECT "next_value"
    FROM "sequences"
    WHERE "name" = ${series} AND "fy" = ${fy}
    FOR UPDATE;
  `;

  if (!rows || rows.length === 0) {
    throw new Error(`Failed to acquire sequence lock for series ${series} in FY ${fy}`);
  }

  const currentValue = rows[0].next_value;

  // 3. Increment counter for next caller
  await tx.$executeRaw`
    UPDATE "sequences"
    SET "next_value" = ${currentValue + 1}, "updated_at" = NOW()
    WHERE "name" = ${series} AND "fy" = ${fy};
  `;

  // 4. Format 6-digit zero-padded number e.g. INV/26-27/000001
  const paddedSequence = String(currentValue).padStart(6, "0");
  const number = `${series}/${fy}/${paddedSequence}`;

  return {
    number,
    fy,
    sequenceValue: currentValue,
    series,
  };
}
