-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "assigned_delivery_user_id" TEXT,
ADD COLUMN     "delivered_at" TIMESTAMP(3),
ADD COLUMN     "payment_mode" "PaymentMode",
ADD COLUMN     "payment_notes" TEXT,
ADD COLUMN     "payment_reference" TEXT;

-- CreateIndex
CREATE INDEX "orders_assigned_delivery_user_id_status_idx" ON "orders"("assigned_delivery_user_id", "status");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_assigned_delivery_user_id_fkey" FOREIGN KEY ("assigned_delivery_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
