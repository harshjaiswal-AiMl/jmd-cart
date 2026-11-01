-- Migration: 20261102030000_prompt18_godown_alerts_roles
-- Additive only migration for Prompt #18: PRO role, BOOKED_BY_PRO status, OrderAlertState, PushSubscriptions, OrderAlerts, StockCorrections, needs_review, is_post_dated

-- 1. Enum updates
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PRO';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'BOOKED_BY_PRO';

DO $$ BEGIN
  CREATE TYPE "OrderAlertState" AS ENUM ('NOTIFIED', 'SEEN', 'ACCEPTED', 'ESCALATED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Additive columns on existing tables
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "needs_review" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "parties" ADD COLUMN IF NOT EXISTS "needs_review" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "parties" ADD COLUMN IF NOT EXISTS "booked_by_pro_id" TEXT;

ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "is_post_dated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "post_dated_reason" TEXT;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "booked_by_pro_id" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "booked_by_agent_code" TEXT;

-- 3. Push subscriptions table
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "device_label" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");
CREATE INDEX IF NOT EXISTS "push_subscriptions_user_id_active_idx" ON "push_subscriptions"("user_id", "active");

DO $$ BEGIN
  ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 4. Order alerts table
CREATE TABLE IF NOT EXISTS "order_alerts" (
  "id" TEXT NOT NULL,
  "order_id" TEXT,
  "invoice_id" TEXT,
  "user_id" TEXT NOT NULL,
  "state" "OrderAlertState" NOT NULL DEFAULT 'NOTIFIED',
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "deep_link" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "seen_at" TIMESTAMP(3),
  "accepted_at" TIMESTAMP(3),
  CONSTRAINT "order_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "order_alerts_user_id_state_idx" ON "order_alerts"("user_id", "state");
CREATE INDEX IF NOT EXISTS "order_alerts_order_id_idx" ON "order_alerts"("order_id");
CREATE INDEX IF NOT EXISTS "order_alerts_invoice_id_idx" ON "order_alerts"("invoice_id");

DO $$ BEGIN
  ALTER TABLE "order_alerts" ADD CONSTRAINT "order_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "order_alerts" ADD CONSTRAINT "order_alerts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 5. Stock corrections table
CREATE TABLE IF NOT EXISTS "stock_corrections" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "location_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "invoice_id" TEXT,
  "previous_qty" INTEGER NOT NULL,
  "added_qty" INTEGER NOT NULL,
  "new_qty" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "reviewed" BOOLEAN NOT NULL DEFAULT false,
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_corrections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "stock_corrections_location_id_reviewed_idx" ON "stock_corrections"("location_id", "reviewed");
CREATE INDEX IF NOT EXISTS "stock_corrections_product_id_idx" ON "stock_corrections"("product_id");

DO $$ BEGIN
  ALTER TABLE "stock_corrections" ADD CONSTRAINT "stock_corrections_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "stock_corrections" ADD CONSTRAINT "stock_corrections_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "stock_corrections" ADD CONSTRAINT "stock_corrections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
