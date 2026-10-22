-- AlterTable
ALTER TABLE "parties" ADD COLUMN "company_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "parties_company_id_key" ON "parties"("company_id");

-- AddForeignKey
ALTER TABLE "parties" ADD CONSTRAINT "parties_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
