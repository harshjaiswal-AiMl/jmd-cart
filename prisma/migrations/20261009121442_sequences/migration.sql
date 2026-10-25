-- Migration: 20261009121442_sequences
-- Description: Sequences table for locked invoice/document numbering per FY
-- Invariants: (name, fy) primary key with FOR UPDATE locking prevents duplicate or gapped invoice numbers
-- Rollback:
--   DROP TABLE IF EXISTS "sequences";

-- CreateTable
CREATE TABLE "sequences" (
    "name" TEXT NOT NULL,
    "fy" TEXT NOT NULL,
    "next_value" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sequences_pkey" PRIMARY KEY ("name","fy")
);
