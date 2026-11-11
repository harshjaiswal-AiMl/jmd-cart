ALTER TABLE "products"
  DROP COLUMN IF EXISTS "name_hi_source",
  DROP COLUMN IF EXISTS "name_hi";

ALTER TABLE "parties"
  DROP COLUMN IF EXISTS "name_hi_source",
  DROP COLUMN IF EXISTS "name_hi";
