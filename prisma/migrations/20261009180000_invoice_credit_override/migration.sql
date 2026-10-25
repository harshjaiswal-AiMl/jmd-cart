-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "notes" TEXT;
ALTER TABLE "invoices" ADD COLUMN "credit_override" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "invoices" ADD COLUMN "credit_override_reason" TEXT;
ALTER TABLE "invoices" ADD COLUMN "credit_override_by" TEXT;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_credit_override_by_fkey" FOREIGN KEY ("credit_override_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
