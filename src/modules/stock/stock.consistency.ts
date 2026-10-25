import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface StockDiscrepancy {
  productId: string;
  locationId: string;
  expectedQty: number;
  actualQty: number;
  diff: number;
}

export interface ConsistencyCheckResult {
  isConsistent: boolean;
  totalChecked: number;
  discrepancies: StockDiscrepancy[];
}

/**
 * Nightly / on-demand audit function verifying that stock_balances equals
 * the net sum of all immutable movements (Inflows - Outflows) for every product & location.
 * Optionally filter by productId for targeted checks.
 */
export async function verifyStockLedgerConsistency(
  productId?: string
): Promise<ConsistencyCheckResult> {
  const whereClause = productId
    ? Prisma.sql`WHERE p.product_id = ${productId}`
    : Prisma.empty;

  const results = await prisma.$queryRaw<
    {
      product_id: string;
      location_id: string;
      balance_qty: number;
      inflow_qty: bigint;
      outflow_qty: bigint;
    }[]
  >`
    WITH all_pairs AS (
      SELECT product_id, location_id FROM "stock_balances"
      UNION
      SELECT product_id, to_location_id AS location_id FROM "stock_movements" WHERE to_location_id IS NOT NULL
      UNION
      SELECT product_id, from_location_id AS location_id FROM "stock_movements" WHERE from_location_id IS NOT NULL
    ),
    inflows AS (
      SELECT product_id, to_location_id AS location_id, COALESCE(SUM(qty), 0) AS total_in
      FROM "stock_movements"
      WHERE to_location_id IS NOT NULL
      GROUP BY product_id, to_location_id
    ),
    outflows AS (
      SELECT product_id, from_location_id AS location_id, COALESCE(SUM(qty), 0) AS total_out
      FROM "stock_movements"
      WHERE from_location_id IS NOT NULL
      GROUP BY product_id, from_location_id
    )
    SELECT 
      p.product_id,
      p.location_id,
      COALESCE(b.qty, 0) AS balance_qty,
      COALESCE(i.total_in, 0) AS inflow_qty,
      COALESCE(o.total_out, 0) AS outflow_qty
    FROM all_pairs p
    LEFT JOIN "stock_balances" b ON b.product_id = p.product_id AND b.location_id = p.location_id
    LEFT JOIN inflows i ON i.product_id = p.product_id AND i.location_id = p.location_id
    LEFT JOIN outflows o ON o.product_id = p.product_id AND o.location_id = p.location_id
    ${whereClause};
  `;

  const discrepancies: StockDiscrepancy[] = [];

  for (const row of results) {
    const expectedQty = Number(row.inflow_qty) - Number(row.outflow_qty);
    const actualQty = row.balance_qty;

    if (expectedQty !== actualQty) {
      discrepancies.push({
        productId: row.product_id,
        locationId: row.location_id,
        expectedQty,
        actualQty,
        diff: actualQty - expectedQty,
      });
    }
  }

  return {
    isConsistent: discrepancies.length === 0,
    totalChecked: results.length,
    discrepancies,
  };
}
