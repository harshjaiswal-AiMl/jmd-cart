-- Migration: 20261009120703_core_ledger
-- Description: Core stock ledger tables (locations, products, stock_balances, stock_movements)
-- Invariants:
--   1. stock_balances.qty >= 0 enforced via CHECK constraint
--   2. stock_movements immutability enforced via DB trigger preventing UPDATE/DELETE
-- Rollback:
--   DROP TRIGGER IF EXISTS trg_stock_movements_immutable ON "stock_movements";
--   DROP FUNCTION IF EXISTS prevent_stock_movement_mutation();
--   DROP TABLE IF EXISTS "stock_movements";
--   DROP TABLE IF EXISTS "stock_balances";
--   DROP TABLE IF EXISTS "products";
--   DROP TABLE IF EXISTS "locations";
--   DROP TYPE IF EXISTS "MovementType";
--   DROP TYPE IF EXISTS "LocationType";

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('GODOWN', 'SHOP', 'VAN');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('PURCHASE_RECEIPT', 'TRANSFER', 'CARTON_BREAK', 'VAN_ISSUE', 'VAN_RETURN', 'SALE', 'SALE_CANCEL', 'RETURN_TO_COMPANY', 'DAMAGE', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "branch_id" INTEGER NOT NULL DEFAULT 1,
    "type" "LocationType" NOT NULL,
    "name" TEXT NOT NULL,
    "assigned_user_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "branch_id" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "short_code" TEXT NOT NULL,
    "company_id" TEXT,
    "category_id" TEXT,
    "hsn" TEXT NOT NULL,
    "gst_rate_bp" INTEGER NOT NULL DEFAULT 0,
    "mrp_paise" INTEGER NOT NULL,
    "pack_size" INTEGER NOT NULL DEFAULT 1,
    "pack_label" TEXT NOT NULL DEFAULT 'Carton',
    "reorder_level" INTEGER NOT NULL DEFAULT 0,
    "image_url" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_balances" (
    "product_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "branch_id" INTEGER NOT NULL DEFAULT 1,
    "qty" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_balances_pkey" PRIMARY KEY ("product_id","location_id"),
    CONSTRAINT "check_stock_balance_qty_non_negative" CHECK ("qty" >= 0)
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "branch_id" INTEGER NOT NULL DEFAULT 1,
    "type" "MovementType" NOT NULL,
    "product_id" TEXT NOT NULL,
    "from_location_id" TEXT,
    "to_location_id" TEXT,
    "qty" INTEGER NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "reason" TEXT,
    "meta" JSONB,
    "idempotency_key" TEXT NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_short_code_key" ON "products"("short_code");

-- CreateIndex
CREATE UNIQUE INDEX "stock_movements_idempotency_key_key" ON "stock_movements"("idempotency_key");

-- CreateIndex
CREATE INDEX "stock_movements_product_id_created_at_idx" ON "stock_movements"("product_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_movements_from_location_id_created_at_idx" ON "stock_movements"("from_location_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_movements_to_location_id_created_at_idx" ON "stock_movements"("to_location_id", "created_at");

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Database Trigger to enforce immutability of stock movements
CREATE OR REPLACE FUNCTION prevent_stock_movement_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Stock movements are immutable and cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_movements_immutable
BEFORE UPDATE OR DELETE ON "stock_movements"
FOR EACH ROW
EXECUTE FUNCTION prevent_stock_movement_mutation();
