-- CreateTable
CREATE TABLE "cash_handovers" (
    "id" TEXT NOT NULL,
    "branch_id" INTEGER NOT NULL DEFAULT 1,
    "van_day_id" TEXT NOT NULL,
    "salesperson_id" TEXT NOT NULL,
    "received_by_id" TEXT NOT NULL,
    "expected_cash_paise" INTEGER NOT NULL,
    "received_cash_paise" INTEGER NOT NULL,
    "shortage_paise" INTEGER NOT NULL DEFAULT 0,
    "excess_paise" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "confirmed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_handovers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cash_handovers_van_day_id_key" ON "cash_handovers"("van_day_id");

-- CreateIndex
CREATE INDEX "cash_handovers_salesperson_id_confirmed_at_idx" ON "cash_handovers"("salesperson_id", "confirmed_at");

-- CreateIndex
CREATE INDEX "cash_handovers_received_by_id_confirmed_at_idx" ON "cash_handovers"("received_by_id", "confirmed_at");

-- AddForeignKey
ALTER TABLE "cash_handovers" ADD CONSTRAINT "cash_handovers_van_day_id_fkey" FOREIGN KEY ("van_day_id") REFERENCES "van_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_handovers" ADD CONSTRAINT "cash_handovers_salesperson_id_fkey" FOREIGN KEY ("salesperson_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_handovers" ADD CONSTRAINT "cash_handovers_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
