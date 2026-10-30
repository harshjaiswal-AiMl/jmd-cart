-- AlterTable: Add business date, version and revision flags to invoices
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "invoice_date" TIMESTAMPTZ;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "is_revised" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "date_change_reason" TEXT;

CREATE INDEX IF NOT EXISTS "invoices_invoice_date_idx" ON "invoices"("invoice_date");

-- AlterTable: Add effective_date to stock_movements, ledger_entries, payments
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "effective_date" TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS "stock_movements_effective_date_idx" ON "stock_movements"("effective_date");

ALTER TABLE "ledger_entries" ADD COLUMN IF NOT EXISTS "effective_date" TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS "ledger_entries_effective_date_idx" ON "ledger_entries"("effective_date");

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "effective_date" TIMESTAMPTZ;

-- AlterTable: Add font_size_preference to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "font_size_preference" VARCHAR(20) DEFAULT 'DEFAULT';

-- CreateTable: invoice_revisions
CREATE TABLE IF NOT EXISTS "invoice_revisions" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "before_snapshot" JSONB NOT NULL,
    "after_snapshot" JSONB NOT NULL,
    "diff" JSONB,
    "reason" TEXT NOT NULL,
    "editor_user_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_revisions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "invoice_revisions_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "invoice_revisions_editor_user_id_fkey" FOREIGN KEY ("editor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "invoice_revisions_invoice_id_revision_number_key" ON "invoice_revisions"("invoice_id", "revision_number");
CREATE INDEX IF NOT EXISTS "invoice_revisions_invoice_id_idx" ON "invoice_revisions"("invoice_id");
CREATE INDEX IF NOT EXISTS "invoice_revisions_editor_user_id_idx" ON "invoice_revisions"("editor_user_id");

-- CreateTable: product_revisions
CREATE TABLE IF NOT EXISTS "product_revisions" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "before_snapshot" JSONB NOT NULL,
    "after_snapshot" JSONB NOT NULL,
    "diff" JSONB,
    "reason" TEXT,
    "editor_user_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_revisions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_revisions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "product_revisions_editor_user_id_fkey" FOREIGN KEY ("editor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "product_revisions_product_id_idx" ON "product_revisions"("product_id");
CREATE INDEX IF NOT EXISTS "product_revisions_editor_user_id_idx" ON "product_revisions"("editor_user_id");
