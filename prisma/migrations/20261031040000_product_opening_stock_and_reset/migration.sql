-- 1. Add opening stock columns to products table (if not exists)
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "opening_stock_qty" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "opening_stock_godown_qty" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "opening_stock_shop_qty" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "opening_stock_date" TIMESTAMPTZ DEFAULT '2026-10-18 00:00:00+05:30';

-- 2. Restore all stock_balances from SALE stock_movements (reversing bills back to initial stock)
UPDATE "stock_balances" sb
SET "qty" = sb."qty" + sm.sale_qty,
    "updated_at" = NOW()
FROM (
  SELECT "product_id", "from_location_id", SUM("qty") as sale_qty
  FROM "stock_movements"
  WHERE "type" = 'SALE' AND "from_location_id" IS NOT NULL
  GROUP BY "product_id", "from_location_id"
) sm
WHERE sb."product_id" = sm."product_id" AND sb."location_id" = sm."from_location_id";

-- 3. Delete all test invoices and related records
DELETE FROM "stock_movements" WHERE "type" = 'SALE' OR "reference_type" = 'INVOICE';
DELETE FROM "party_ledger_entries" WHERE "reference_type" = 'INVOICE';
DELETE FROM "incentive_entries" WHERE "invoice_id" IS NOT NULL;
DELETE FROM "invoice_revisions";
DELETE FROM "counter_pickups";
DELETE FROM "payments" WHERE "invoice_id" IS NOT NULL;
DELETE FROM "invoice_items";
DELETE FROM "invoices";

-- Reset invoice sequence to 1
UPDATE "sequences" SET "next_value" = 1, "updated_at" = NOW() WHERE "name" = 'INV';

-- 4. Initialize opening stock values from restored stock_balances and lock them into products
UPDATE "products" p
SET "opening_stock_godown_qty" = COALESCE(sb."qty", 0),
    "opening_stock_date" = '2026-10-18 00:00:00+05:30'
FROM "stock_balances" sb
JOIN "locations" l ON sb."location_id" = l."id"
WHERE sb."product_id" = p."id" AND l."type" = 'GODOWN';

UPDATE "products" p
SET "opening_stock_shop_qty" = COALESCE(sb."qty", 0),
    "opening_stock_date" = '2026-10-18 00:00:00+05:30'
FROM "stock_balances" sb
JOIN "locations" l ON sb."location_id" = l."id"
WHERE sb."product_id" = p."id" AND l."type" = 'SHOP';

UPDATE "products"
SET "opening_stock_qty" = "opening_stock_godown_qty" + "opening_stock_shop_qty",
    "opening_stock_date" = '2026-10-18 00:00:00+05:30';

-- 5. Shift all initial stock movements to 18-10-2026
UPDATE "stock_movements"
SET "effective_date" = '2026-10-18 00:00:00+05:30',
    "created_at" = '2026-10-18 00:00:00+05:30',
    "reference_type" = 'OPENING_STOCK',
    "reason" = 'Opening Stock as of 18-10-2026'
WHERE "type" = 'ADJUSTMENT' OR "reference_type" = 'OPENING_STOCK' OR "reference_type" IS NULL;
