-- CreateTable
CREATE TABLE "debit_notes" (
    "id" TEXT NOT NULL,
    "branch_id" INTEGER NOT NULL DEFAULT 1,
    "number" TEXT NOT NULL,
    "fy" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "subtotal_paise" INTEGER NOT NULL,
    "tax_paise" INTEGER NOT NULL,
    "round_off_paise" INTEGER NOT NULL DEFAULT 0,
    "total_paise" INTEGER NOT NULL,
    "notes" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debit_note_items" (
    "id" TEXT NOT NULL,
    "debit_note_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit_price_paise" INTEGER NOT NULL,
    "taxable_paise" INTEGER NOT NULL,
    "gst_rate_bp" INTEGER NOT NULL DEFAULT 0,
    "tax_paise" INTEGER NOT NULL DEFAULT 0,
    "total_paise" INTEGER NOT NULL,
    "batch_no" TEXT,
    "reason" TEXT,

    CONSTRAINT "debit_note_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "debit_notes_number_key" ON "debit_notes"("number");

-- CreateIndex
CREATE INDEX "debit_notes_supplier_id_created_at_idx" ON "debit_notes"("supplier_id", "created_at");

-- CreateIndex
CREATE INDEX "debit_notes_location_id_created_at_idx" ON "debit_notes"("location_id", "created_at");

-- AddForeignKey
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_note_items" ADD CONSTRAINT "debit_note_items_debit_note_id_fkey" FOREIGN KEY ("debit_note_id") REFERENCES "debit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_note_items" ADD CONSTRAINT "debit_note_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
