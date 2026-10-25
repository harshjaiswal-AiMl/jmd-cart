-- CreateEnum
CREATE TYPE "VanDayStatus" AS ENUM ('OPEN', 'RECONCILED', 'CLOSED');

-- CreateTable
CREATE TABLE "van_days" (
    "id" TEXT NOT NULL,
    "branch_id" INTEGER NOT NULL DEFAULT 1,
    "van_location_id" TEXT NOT NULL,
    "salesperson_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "VanDayStatus" NOT NULL DEFAULT 'OPEN',
    "issue_sheet_no" TEXT NOT NULL,
    "notes" TEXT,
    "issued_by" TEXT,
    "reconciled_by" TEXT,
    "closed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "van_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "van_day_lines" (
    "id" TEXT NOT NULL,
    "van_day_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "issued_qty" INTEGER NOT NULL,
    "sold_qty" INTEGER NOT NULL DEFAULT 0,
    "returned_qty" INTEGER NOT NULL DEFAULT 0,
    "shortage_qty" INTEGER NOT NULL DEFAULT 0,
    "excess_qty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "van_day_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "van_days_issue_sheet_no_key" ON "van_days"("issue_sheet_no");

-- CreateIndex
CREATE INDEX "van_days_van_location_id_date_idx" ON "van_days"("van_location_id", "date");

-- CreateIndex
CREATE INDEX "van_days_salesperson_id_date_idx" ON "van_days"("salesperson_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "van_day_lines_van_day_id_product_id_key" ON "van_day_lines"("van_day_id", "product_id");

-- AddForeignKey
ALTER TABLE "van_days" ADD CONSTRAINT "van_days_van_location_id_fkey" FOREIGN KEY ("van_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "van_days" ADD CONSTRAINT "van_days_salesperson_id_fkey" FOREIGN KEY ("salesperson_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "van_day_lines" ADD CONSTRAINT "van_day_lines_van_day_id_fkey" FOREIGN KEY ("van_day_id") REFERENCES "van_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "van_day_lines" ADD CONSTRAINT "van_day_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
