-- Prompt #12 Part B & C: Incentive System and Agent Code Backfill

-- 1. Create Enums if they do not exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IncentiveRuleScope') THEN
        CREATE TYPE "IncentiveRuleScope" AS ENUM ('GLOBAL', 'AGENT', 'BRAND', 'CATEGORY', 'PRODUCT');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IncentiveEntryType') THEN
        CREATE TYPE "IncentiveEntryType" AS ENUM ('ACCRUAL', 'REVERSAL', 'ADJUSTMENT');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IncentiveEntryStatus') THEN
        CREATE TYPE "IncentiveEntryStatus" AS ENUM ('PENDING', 'CREDITED', 'REVERSED', 'VOID', 'APPROVED', 'PAID');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IncentivePayoutStatus') THEN
        CREATE TYPE "IncentivePayoutStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID');
    END IF;
END $$;

-- 2. Create Table: incentive_rules
CREATE TABLE IF NOT EXISTS "incentive_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scope" "IncentiveRuleScope" NOT NULL,
    "agent_user_id" TEXT,
    "company_id" TEXT,
    "category_id" TEXT,
    "product_id" TEXT,
    "percent_bp" INTEGER NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_to" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "incentive_rules_agent_user_id_fkey" FOREIGN KEY ("agent_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "incentive_rules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "incentive_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "incentive_rules_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "incentive_rules_scope_active_idx" ON "incentive_rules"("scope", "active");
CREATE INDEX IF NOT EXISTS "incentive_rules_agent_user_id_active_idx" ON "incentive_rules"("agent_user_id", "active");
CREATE INDEX IF NOT EXISTS "incentive_rules_product_id_active_idx" ON "incentive_rules"("product_id", "active");
CREATE INDEX IF NOT EXISTS "incentive_rules_company_id_active_idx" ON "incentive_rules"("company_id", "active");
CREATE INDEX IF NOT EXISTS "incentive_rules_category_id_active_idx" ON "incentive_rules"("category_id", "active");

-- 3. Create Table: incentive_payouts
CREATE TABLE IF NOT EXISTS "incentive_payouts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agent_user_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "total_paise" INTEGER NOT NULL,
    "method" TEXT,
    "reference" TEXT,
    "paid_at" TIMESTAMP(3),
    "paid_by" TEXT,
    "status" "IncentivePayoutStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "incentive_payouts_agent_user_id_fkey" FOREIGN KEY ("agent_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "incentive_payouts_agent_user_id_period_key" UNIQUE ("agent_user_id", "period")
);

CREATE INDEX IF NOT EXISTS "incentive_payouts_period_status_idx" ON "incentive_payouts"("period", "status");

-- 4. Create Table: incentive_entries
CREATE TABLE IF NOT EXISTS "incentive_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agent_user_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "invoice_line_id" TEXT,
    "order_id" TEXT,
    "type" "IncentiveEntryType" NOT NULL,
    "status" "IncentiveEntryStatus" NOT NULL DEFAULT 'PENDING',
    "base_amount_paise" INTEGER NOT NULL,
    "percent_bp" INTEGER NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "rule_id" TEXT,
    "trigger_event" TEXT NOT NULL,
    "triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "period" TEXT NOT NULL,
    "note" TEXT,
    "created_by" TEXT,
    "payout_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "incentive_entries_agent_user_id_fkey" FOREIGN KEY ("agent_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "incentive_entries_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "incentive_entries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "incentive_entries_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "incentive_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "incentive_entries_invoice_id_invoice_line_id_type_key" UNIQUE ("invoice_id", "invoice_line_id", "type")
);

CREATE INDEX IF NOT EXISTS "incentive_entries_agent_user_id_period_status_idx" ON "incentive_entries"("agent_user_id", "period", "status");
CREATE INDEX IF NOT EXISTS "incentive_entries_invoice_id_status_idx" ON "incentive_entries"("invoice_id", "status");
CREATE INDEX IF NOT EXISTS "incentive_entries_order_id_idx" ON "incentive_entries"("order_id");
CREATE INDEX IF NOT EXISTS "incentive_entries_payout_id_idx" ON "incentive_entries"("payout_id");

-- 5. Part B Backfill: Assign unique agentCode (format A001, A002, ...) in order of account creation to every existing user who has none
DO $$
DECLARE
    u RECORD;
    next_idx INT := 1;
    candidate_code TEXT;
BEGIN
    FOR u IN SELECT id FROM users WHERE agent_code IS NULL ORDER BY created_at ASC, id ASC LOOP
        LOOP
            candidate_code := 'A' || LPAD(next_idx::TEXT, 3, '0');
            EXIT WHEN NOT EXISTS (SELECT 1 FROM users WHERE agent_code = candidate_code);
            next_idx := next_idx + 1;
        END LOOP;
        UPDATE users SET agent_code = candidate_code WHERE id = u.id;
        next_idx := next_idx + 1;
    END LOOP;
END $$;
