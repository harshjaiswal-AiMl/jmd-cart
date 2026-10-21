-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ADMIN';

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ImportBatchType" AS ENUM ('CATALOG', 'STOCK');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ImportBatchStatus" AS ENUM ('APPLIED', 'UNDONE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable: users
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "buyer_type" "PartyType" DEFAULT 'CUSTOMER',
  ADD COLUMN IF NOT EXISTS "buyer_approved" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: products
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "weight" TEXT,
  ADD COLUMN IF NOT EXISTS "price_a_paise" INTEGER,
  ADD COLUMN IF NOT EXISTS "price_b_paise" INTEGER,
  ADD COLUMN IF NOT EXISTS "price_c_paise" INTEGER,
  ALTER COLUMN "mrp_paise" DROP NOT NULL,
  ALTER COLUMN "hsn" SET DEFAULT '0000';

-- CreateTable: import_batches
CREATE TABLE IF NOT EXISTS "import_batches" (
    "id" TEXT NOT NULL,
    "branch_id" INTEGER NOT NULL DEFAULT 1,
    "type" "ImportBatchType" NOT NULL,
    "filename" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "location_id" TEXT,
    "mode" TEXT NOT NULL,
    "rows_total" INTEGER NOT NULL DEFAULT 0,
    "rows_applied" INTEGER NOT NULL DEFAULT 0,
    "rows_skipped" INTEGER NOT NULL DEFAULT 0,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'APPLIED',
    "summary" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undone_at" TIMESTAMP(3),
    "undone_by" TEXT,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- AlterTable: stock_movements
ALTER TABLE "stock_movements"
  ADD COLUMN IF NOT EXISTS "batch_id" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "import_batches_type_created_at_idx" ON "import_batches"("type", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "import_batches_user_id_created_at_idx" ON "import_batches"("user_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stock_movements_batch_id_idx" ON "stock_movements"("batch_id");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
