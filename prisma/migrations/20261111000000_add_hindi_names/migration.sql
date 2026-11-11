ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "name_hi" TEXT,
  ADD COLUMN IF NOT EXISTS "name_hi_source" TEXT;

ALTER TABLE "parties"
  ADD COLUMN IF NOT EXISTS "name_hi" TEXT,
  ADD COLUMN IF NOT EXISTS "name_hi_source" TEXT;
