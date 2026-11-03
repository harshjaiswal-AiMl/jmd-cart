-- Migration: 20261103210000_customer_mobile_backend
-- Additive only migration for Prompt #20: Customer native mobile app backend tables

-- 1. Customer Devices Table
CREATE TABLE IF NOT EXISTS "customer_devices" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "device_id" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "fcm_token" TEXT,
  "app_version" TEXT,
  "locale" TEXT NOT NULL DEFAULT 'en',
  "notification_preferences" JSONB NOT NULL DEFAULT '{"orderUpdates": true, "backInStock": true, "promotional": false}',
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "customer_devices_device_id_key" ON "customer_devices"("device_id");
CREATE INDEX IF NOT EXISTS "customer_devices_user_id_idx" ON "customer_devices"("user_id");
CREATE INDEX IF NOT EXISTS "customer_devices_fcm_token_idx" ON "customer_devices"("fcm_token");

DO $$ BEGIN
  ALTER TABLE "customer_devices" ADD CONSTRAINT "customer_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. App Refresh Tokens Table
CREATE TABLE IF NOT EXISTS "app_refresh_tokens" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "device_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "app_refresh_tokens_token_hash_key" ON "app_refresh_tokens"("token_hash");
CREATE INDEX IF NOT EXISTS "app_refresh_tokens_user_id_device_id_idx" ON "app_refresh_tokens"("user_id", "device_id");
CREATE INDEX IF NOT EXISTS "app_refresh_tokens_expires_at_revoked_idx" ON "app_refresh_tokens"("expires_at", "revoked");

DO $$ BEGIN
  ALTER TABLE "app_refresh_tokens" ADD CONSTRAINT "app_refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Saved Shopping Lists Table
CREATE TABLE IF NOT EXISTS "saved_shopping_lists" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saved_shopping_lists_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "saved_shopping_lists_user_id_idx" ON "saved_shopping_lists"("user_id");

DO $$ BEGIN
  ALTER TABLE "saved_shopping_lists" ADD CONSTRAINT "saved_shopping_lists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 4. Saved Shopping List Items Table
CREATE TABLE IF NOT EXISTS "saved_shopping_list_items" (
  "id" TEXT NOT NULL,
  "list_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unit" TEXT NOT NULL DEFAULT 'Pcs',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saved_shopping_list_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "saved_shopping_list_items_list_id_idx" ON "saved_shopping_list_items"("list_id");
CREATE INDEX IF NOT EXISTS "saved_shopping_list_items_product_id_idx" ON "saved_shopping_list_items"("product_id");

DO $$ BEGIN
  ALTER TABLE "saved_shopping_list_items" ADD CONSTRAINT "saved_shopping_list_items_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "saved_shopping_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "saved_shopping_list_items" ADD CONSTRAINT "saved_shopping_list_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 5. Product Notification Requests Table
CREATE TABLE IF NOT EXISTS "product_notification_requests" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "user_id" TEXT,
  "phone" TEXT,
  "device_id" TEXT,
  "fcm_token" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notified_at" TIMESTAMP(3),
  CONSTRAINT "product_notification_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "product_notification_requests_product_id_status_idx" ON "product_notification_requests"("product_id", "status");
CREATE INDEX IF NOT EXISTS "product_notification_requests_user_id_idx" ON "product_notification_requests"("user_id");
CREATE INDEX IF NOT EXISTS "product_notification_requests_phone_idx" ON "product_notification_requests"("phone");

DO $$ BEGIN
  ALTER TABLE "product_notification_requests" ADD CONSTRAINT "product_notification_requests_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "product_notification_requests" ADD CONSTRAINT "product_notification_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
