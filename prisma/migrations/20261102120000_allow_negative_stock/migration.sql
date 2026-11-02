-- Drop the check constraint enforcing stock_balances.qty >= 0
-- This allows zero/negative stock billing and morning van issues without blocking operations
ALTER TABLE "stock_balances" DROP CONSTRAINT IF EXISTS "check_stock_balance_qty_non_negative";
