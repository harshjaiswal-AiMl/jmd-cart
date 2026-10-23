-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'WAREHOUSE_MANAGER';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PICKING';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PACKED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'OUT_FOR_DELIVERY';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'FAILED';

-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('ONLINE', 'MANUAL');
CREATE TYPE "DispatchRunStatus" AS ENUM ('DRAFT', 'PICKING', 'PACKED', 'OUT', 'CLOSED', 'CANCELLED');
CREATE TYPE "ShopRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DISPATCHED', 'RECEIVED', 'CANCELLED');
CREATE TYPE "CounterPickupStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ShopPickStatus" AS ENUM ('PENDING', 'PICKED', 'CANCELLED');

-- AlterTable orders
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "channel" "OrderChannel" NOT NULL DEFAULT 'ONLINE';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "created_by_user_id" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "party_id" TEXT;

-- CreateTable stock_reservations
CREATE TABLE IF NOT EXISTS "stock_reservations" (
    "id" TEXT NOT NULL,
    "branch_id" INTEGER NOT NULL DEFAULT 1,
    "product_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "order_id" TEXT,
    "qty" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable dispatch_runs
CREATE TABLE IF NOT EXISTS "dispatch_runs" (
    "id" TEXT NOT NULL,
    "run_number" TEXT NOT NULL,
    "branch_id" INTEGER NOT NULL DEFAULT 1,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "van_id" TEXT,
    "delivery_user_id" TEXT,
    "slot" TEXT,
    "status" "DispatchRunStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispatch_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable dispatch_run_orders
CREATE TABLE IF NOT EXISTS "dispatch_run_orders" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "dispatch_run_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable order_packages
CREATE TABLE IF NOT EXISTS "order_packages" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "bundle_count" INTEGER NOT NULL DEFAULT 1,
    "packed_by" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable shop_requests
CREATE TABLE IF NOT EXISTS "shop_requests" (
    "id" TEXT NOT NULL,
    "request_number" TEXT NOT NULL,
    "branch_id" INTEGER NOT NULL DEFAULT 1,
    "status" "ShopRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by" TEXT NOT NULL,
    "approved_by" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable shop_request_lines
CREATE TABLE IF NOT EXISTS "shop_request_lines" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "requested_qty" INTEGER NOT NULL,
    "approved_qty" INTEGER,

    CONSTRAINT "shop_request_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable counter_pickups
CREATE TABLE IF NOT EXISTS "counter_pickups" (
    "id" TEXT NOT NULL,
    "branch_id" INTEGER NOT NULL DEFAULT 1,
    "invoice_id" TEXT,
    "bill_number" TEXT NOT NULL,
    "cashier_name" TEXT,
    "status" "CounterPickupStatus" NOT NULL DEFAULT 'PENDING',
    "items" JSONB NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "counter_pickups_pkey" PRIMARY KEY ("id")
);

-- CreateTable shop_pick_tasks
CREATE TABLE IF NOT EXISTS "shop_pick_tasks" (
    "id" TEXT NOT NULL,
    "branch_id" INTEGER NOT NULL DEFAULT 1,
    "order_id" TEXT NOT NULL,
    "status" "ShopPickStatus" NOT NULL DEFAULT 'PENDING',
    "items" JSONB NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "picked_at" TIMESTAMP(3),

    CONSTRAINT "shop_pick_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable van_loading_templates
CREATE TABLE IF NOT EXISTS "van_loading_templates" (
    "id" TEXT NOT NULL,
    "branch_id" INTEGER NOT NULL DEFAULT 1,
    "van_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lines" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "van_loading_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndices
CREATE UNIQUE INDEX IF NOT EXISTS "dispatch_runs_run_number_key" ON "dispatch_runs"("run_number");
CREATE UNIQUE INDEX IF NOT EXISTS "dispatch_run_orders_run_id_order_id_key" ON "dispatch_run_orders"("run_id", "order_id");
CREATE UNIQUE INDEX IF NOT EXISTS "shop_requests_request_number_key" ON "shop_requests"("request_number");

CREATE INDEX IF NOT EXISTS "stock_reservations_product_id_location_id_active_idx" ON "stock_reservations"("product_id", "location_id", "active");
CREATE INDEX IF NOT EXISTS "stock_reservations_order_id_idx" ON "stock_reservations"("order_id");
CREATE INDEX IF NOT EXISTS "dispatch_runs_status_date_idx" ON "dispatch_runs"("status", "date");
CREATE INDEX IF NOT EXISTS "dispatch_run_orders_run_id_sequence_idx" ON "dispatch_run_orders"("run_id", "sequence");
CREATE INDEX IF NOT EXISTS "order_packages_order_id_idx" ON "order_packages"("order_id");
CREATE INDEX IF NOT EXISTS "shop_requests_status_created_at_idx" ON "shop_requests"("status", "created_at");
CREATE INDEX IF NOT EXISTS "shop_request_lines_request_id_idx" ON "shop_request_lines"("request_id");
CREATE INDEX IF NOT EXISTS "counter_pickups_status_created_at_idx" ON "counter_pickups"("status", "created_at");
CREATE INDEX IF NOT EXISTS "shop_pick_tasks_status_created_at_idx" ON "shop_pick_tasks"("status", "created_at");
CREATE INDEX IF NOT EXISTS "van_loading_templates_van_id_idx" ON "van_loading_templates"("van_id");
CREATE INDEX IF NOT EXISTS "orders_channel_idx" ON "orders"("channel");
CREATE INDEX IF NOT EXISTS "orders_party_id_idx" ON "orders"("party_id");

-- AddForeignKeys
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dispatch_runs" ADD CONSTRAINT "dispatch_runs_van_id_fkey" FOREIGN KEY ("van_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "dispatch_runs" ADD CONSTRAINT "dispatch_runs_delivery_user_id_fkey" FOREIGN KEY ("delivery_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dispatch_run_orders" ADD CONSTRAINT "dispatch_run_orders_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "dispatch_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dispatch_run_orders" ADD CONSTRAINT "dispatch_run_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_packages" ADD CONSTRAINT "order_packages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shop_request_lines" ADD CONSTRAINT "shop_request_lines_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "shop_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shop_request_lines" ADD CONSTRAINT "shop_request_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "counter_pickups" ADD CONSTRAINT "counter_pickups_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "shop_pick_tasks" ADD CONSTRAINT "shop_pick_tasks_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
