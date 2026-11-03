-- Migration: 20261103110000_bill_messaging_and_native_alerts
-- Additive only migration for Prompt #19: Bill messaging, SMS gateway device, Bill tokens, and Native alerts

-- 1. Create Enums
DO $$ BEGIN
  CREATE TYPE "PushSubscriptionType" AS ENUM ('WEB', 'NATIVE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MessageChannel" AS ENUM ('WHATSAPP', 'SMS');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'SKIPPED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MessageProviderType" AS ENUM ('OPEN_WA', 'ANDROID_SMS', 'WA_ME', 'CLOUD_API');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Alter existing tables
ALTER TABLE "parties" ADD COLUMN IF NOT EXISTS "messaging_preference" TEXT DEFAULT 'AUTO';

ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "type" "PushSubscriptionType" NOT NULL DEFAULT 'WEB';
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "app_version" TEXT;
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "battery_opt_disabled" BOOLEAN;
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "notification_permitted" BOOLEAN;
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "full_screen_permitted" BOOLEAN;
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "device_token" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_device_token_key" ON "push_subscriptions"("device_token");

ALTER TABLE "order_alerts" ADD COLUMN IF NOT EXISTS "snoozed_until" TIMESTAMP(3);
ALTER TABLE "order_alerts" ADD COLUMN IF NOT EXISTS "acknowledged_by_device_id" TEXT;

-- 3. Bill Tokens Table
CREATE TABLE IF NOT EXISTS "bill_tokens" (
  "id" TEXT NOT NULL,
  "invoice_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "token_preview" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked" BOOLEAN NOT NULL DEFAULT false,
  "access_count" INTEGER NOT NULL DEFAULT 0,
  "last_accessed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bill_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bill_tokens_invoice_id_key" ON "bill_tokens"("invoice_id");
CREATE UNIQUE INDEX IF NOT EXISTS "bill_tokens_token_hash_key" ON "bill_tokens"("token_hash");
CREATE INDEX IF NOT EXISTS "bill_tokens_expires_at_revoked_idx" ON "bill_tokens"("expires_at", "revoked");

DO $$ BEGIN
  ALTER TABLE "bill_tokens" ADD CONSTRAINT "bill_tokens_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 4. Outbound Messages Table
CREATE TABLE IF NOT EXISTS "outbound_messages" (
  "id" TEXT NOT NULL,
  "invoice_id" TEXT,
  "party_id" TEXT,
  "phone" TEXT NOT NULL,
  "channel" "MessageChannel" NOT NULL,
  "provider" "MessageProviderType" NOT NULL,
  "status" "MessageStatus" NOT NULL DEFAULT 'QUEUED',
  "template_name" TEXT,
  "rendered_content" TEXT NOT NULL,
  "bill_token" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 3,
  "last_error" TEXT,
  "scheduled_for" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_at" TIMESTAMP(3),
  "delivered_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "outbound_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "outbound_messages_idempotency_key_key" ON "outbound_messages"("idempotency_key");
CREATE INDEX IF NOT EXISTS "outbound_messages_status_scheduled_for_idx" ON "outbound_messages"("status", "scheduled_for");
CREATE INDEX IF NOT EXISTS "outbound_messages_phone_idx" ON "outbound_messages"("phone");
CREATE INDEX IF NOT EXISTS "outbound_messages_invoice_id_idx" ON "outbound_messages"("invoice_id");

DO $$ BEGIN
  ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 5. Messaging Opt-Outs Table
CREATE TABLE IF NOT EXISTS "messaging_opt_outs" (
  "id" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "channel" "MessageChannel",
  "reason" TEXT,
  "opted_out_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "messaging_opt_outs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "messaging_opt_outs_phone_key" ON "messaging_opt_outs"("phone");
CREATE INDEX IF NOT EXISTS "messaging_opt_outs_phone_idx" ON "messaging_opt_outs"("phone");

-- 6. SMS Gateway Devices Table
CREATE TABLE IF NOT EXISTS "sms_gateway_devices" (
  "id" TEXT NOT NULL,
  "device_token" TEXT NOT NULL,
  "device_label" TEXT NOT NULL,
  "phone" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "daily_sent_count" INTEGER NOT NULL DEFAULT 0,
  "last_sent_date" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sms_gateway_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sms_gateway_devices_device_token_key" ON "sms_gateway_devices"("device_token");
