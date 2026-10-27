-- AlterTable users: add agent_code
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "agent_code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_agent_code_key" ON "users"("agent_code");

-- AlterTable invoices: add customer snapshots and agent fields
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "customer_name" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "customer_phone" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "customer_address" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "agent_user_id" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "agent_code_snapshot" TEXT;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_agent_user_id_fkey') THEN
    ALTER TABLE "invoices" ADD CONSTRAINT "invoices_agent_user_id_fkey" FOREIGN KEY ("agent_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invoices_agent_user_id_created_at_idx" ON "invoices"("agent_user_id", "created_at");

-- Backfill idempotently agent_user_id from created_by where existing info exists
UPDATE "invoices" SET "agent_user_id" = "created_by" WHERE "agent_user_id" IS NULL AND "created_by" IS NOT NULL;
UPDATE "invoices" i SET "agent_code_snapshot" = u."agent_code" FROM "users" u WHERE i."agent_user_id" = u."id" AND i."agent_code_snapshot" IS NULL AND u."agent_code" IS NOT NULL;
