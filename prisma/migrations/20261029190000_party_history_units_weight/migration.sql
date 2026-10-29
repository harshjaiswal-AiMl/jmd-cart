-- AlterTable
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "weight_value" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "weight_unit" TEXT,
ADD COLUMN IF NOT EXISTS "bag_size" INTEGER;

-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "unit_label" TEXT DEFAULT 'Pcs',
ADD COLUMN IF NOT EXISTS "original_mrp_paise" INTEGER,
ADD COLUMN IF NOT EXISTS "mrp_overridden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "rate_overridden" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "party_name_histories" (
    "id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "old_name" TEXT NOT NULL,
    "new_name" TEXT NOT NULL,
    "old_phone" TEXT,
    "new_phone" TEXT,
    "old_address" TEXT,
    "new_address" TEXT,
    "reason" TEXT,
    "changed_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "party_name_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "party_name_histories_party_id_idx" ON "party_name_histories"("party_id");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'party_name_histories_party_id_fkey'
    ) THEN
        ALTER TABLE "party_name_histories" ADD CONSTRAINT "party_name_histories_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'party_name_histories_changed_by_id_fkey'
    ) THEN
        ALTER TABLE "party_name_histories" ADD CONSTRAINT "party_name_histories_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
