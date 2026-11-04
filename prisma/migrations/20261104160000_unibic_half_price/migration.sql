-- Set Price A, Price B, Price C to 50% of MRP for all Unibic products
UPDATE products
SET 
  price_a_paise = ROUND(mrp_paise * 0.5)::int,
  price_b_paise = ROUND(mrp_paise * 0.5)::int,
  price_c_paise = ROUND(mrp_paise * 0.5)::int,
  updated_at = NOW()
WHERE mrp_paise IS NOT NULL AND mrp_paise > 0
  AND (
    company_id IN (SELECT id FROM companies WHERE name ILIKE '%unibic%')
    OR name ILIKE '%unibic%'
  );
