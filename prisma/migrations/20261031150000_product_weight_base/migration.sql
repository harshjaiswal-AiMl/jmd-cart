-- Additive migration for single source of truth weight_base
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "weight_base" DOUBLE PRECISION;
