-- AlterTable
ALTER TABLE "payments" ADD COLUMN "receipt_no" TEXT;
ALTER TABLE "payments" ADD COLUMN "notes" TEXT;
ALTER TABLE "payments" ADD COLUMN "van_location_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "payments_receipt_no_key" ON "payments"("receipt_no");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_van_location_id_fkey" FOREIGN KEY ("van_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
