-- CreateEnum
CREATE TYPE "BillScanStatus" AS ENUM ('DRAFT', 'COUNTING', 'READY', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillScanSourceType" AS ENUM ('IMAGE', 'PDF_TEXT', 'PDF_SCAN', 'MANUAL');

-- CreateEnum
CREATE TYPE "BillScanLineMatchStatus" AS ENUM ('SUGGESTED', 'CONFIRMED', 'UNMATCHED', 'EXTRA');

-- CreateEnum
CREATE TYPE "BillScanVariance" AS ENUM ('NONE', 'SHORT', 'EXCESS', 'DAMAGED', 'NOT_RECEIVED', 'EXTRA');

-- AlterTable
ALTER TABLE "purchases" ADD COLUMN "bill_scan_id" TEXT;
ALTER TABLE "purchases" ADD COLUMN "bill_total_paise" INTEGER;

-- AlterTable
ALTER TABLE "purchase_items" ADD COLUMN "billed_qty" INTEGER;
ALTER TABLE "purchase_items" ADD COLUMN "accepted_qty" INTEGER;
ALTER TABLE "purchase_items" ADD COLUMN "variance_reason" TEXT;

-- CreateTable
CREATE TABLE "bill_scans" (
    "id" TEXT NOT NULL,
    "branch_id" INTEGER NOT NULL DEFAULT 1,
    "supplier_party_id" TEXT,
    "company_id" TEXT,
    "location_id" TEXT NOT NULL,
    "status" "BillScanStatus" NOT NULL DEFAULT 'DRAFT',
    "image_keys" TEXT[],
    "source_type" "BillScanSourceType" NOT NULL DEFAULT 'IMAGE',
    "ocr_engine" TEXT,
    "ocr_duration_ms" INTEGER,
    "ocr_confidence" DOUBLE PRECISION,
    "bill_no" TEXT,
    "bill_date" TIMESTAMP(3),
    "bill_total_paise" INTEGER,
    "parsed_json" JSONB,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "posted_at" TIMESTAMP(3),
    "purchase_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "locked_by" TEXT,
    "locked_at" TIMESTAMP(3),

    CONSTRAINT "bill_scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_scan_lines" (
    "id" TEXT NOT NULL,
    "scan_id" TEXT NOT NULL,
    "line_no" INTEGER NOT NULL,
    "raw_text" TEXT NOT NULL,
    "parsed_name" TEXT NOT NULL,
    "hsn" TEXT,
    "billed_qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billed_unit" TEXT NOT NULL DEFAULT 'PCS',
    "billed_qty_pieces" INTEGER NOT NULL DEFAULT 0,
    "rate_paise" INTEGER NOT NULL DEFAULT 0,
    "gst_rate_bp" INTEGER NOT NULL DEFAULT 0,
    "amount_paise" INTEGER NOT NULL DEFAULT 0,
    "product_id" TEXT,
    "match_confidence" DOUBLE PRECISION,
    "match_status" "BillScanLineMatchStatus" NOT NULL DEFAULT 'UNMATCHED',
    "counted_cartons" INTEGER NOT NULL DEFAULT 0,
    "counted_loose" INTEGER NOT NULL DEFAULT 0,
    "counted_pieces" INTEGER NOT NULL DEFAULT 0,
    "variance" "BillScanVariance" NOT NULL DEFAULT 'NONE',
    "variance_reason" TEXT,
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confirmed_as_billed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bill_scan_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_item_aliases" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "normalized_bill_text" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "times_confirmed" INTEGER NOT NULL DEFAULT 1,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_item_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchases_bill_scan_id_key" ON "purchases"("bill_scan_id");

-- CreateIndex
CREATE UNIQUE INDEX "bill_scans_purchase_id_key" ON "bill_scans"("purchase_id");

-- CreateIndex
CREATE UNIQUE INDEX "bill_scans_idempotency_key_key" ON "bill_scans"("idempotency_key");

-- CreateIndex
CREATE INDEX "bill_scans_supplier_party_id_idx" ON "bill_scans"("supplier_party_id");

-- CreateIndex
CREATE INDEX "bill_scans_company_id_idx" ON "bill_scans"("company_id");

-- CreateIndex
CREATE INDEX "bill_scans_status_idx" ON "bill_scans"("status");

-- CreateIndex
CREATE INDEX "bill_scan_lines_scan_id_idx" ON "bill_scan_lines"("scan_id");

-- CreateIndex
CREATE INDEX "bill_scan_lines_product_id_idx" ON "bill_scan_lines"("product_id");

-- CreateIndex
CREATE INDEX "supplier_item_aliases_company_id_idx" ON "supplier_item_aliases"("company_id");

-- CreateIndex
CREATE INDEX "supplier_item_aliases_product_id_idx" ON "supplier_item_aliases"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_item_aliases_company_id_normalized_bill_text_key" ON "supplier_item_aliases"("company_id", "normalized_bill_text");

-- AddForeignKey
ALTER TABLE "bill_scans" ADD CONSTRAINT "bill_scans_supplier_party_id_fkey" FOREIGN KEY ("supplier_party_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_scans" ADD CONSTRAINT "bill_scans_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_scans" ADD CONSTRAINT "bill_scans_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_scans" ADD CONSTRAINT "bill_scans_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_scans" ADD CONSTRAINT "bill_scans_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_scan_lines" ADD CONSTRAINT "bill_scan_lines_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "bill_scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_scan_lines" ADD CONSTRAINT "bill_scan_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_item_aliases" ADD CONSTRAINT "supplier_item_aliases_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_item_aliases" ADD CONSTRAINT "supplier_item_aliases_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
