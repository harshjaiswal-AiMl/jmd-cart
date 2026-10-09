# Memory: IDMS project context

Read this first in every session. Keep it current: add decisions and gotchas as they happen.

## Project
- **What**: Web-based distribution system for an FMCG business in Saharsa, Bihar: inventory (godown, shop, 2 vans), shop POS and GST billing, van sales, credit, accounts support, and an online store for customers, retailers and wholesalers. Super admin has full access.
- **Client**: Sachin Prakash, Saharsa. **Developer**: Harsh Jaiswal (solo, using AI agents).
- **Final delivery date**: 15 Nov 2026, then a 2-3 week parallel run. Contract: development + 12-month AMC; infrastructure costs are the client's.
- **Scale**: 900+ products (Bikaji, MDH, India Gate, Engine and more), about 10 staff (2 each: godown, shop, van, delivery, accounts), 2 vans, 1 shop, 1 godown.

## Confirmed decisions
- Quantity-only stock; no batch/expiry in v1 (schema batch-ready).
- Every product has a pack size; loose stock lives in the shop, packs in the godown; carton break moves godown -> shop.
- Prices = % discount off MRP by quantity slab; buyer type auto-tagged by quantity; admin adds % order discount.
- Credit only for parties already in client's Tally; cash and credit both allowed.
- One invoice series for shop and van. Bill edit/cancel Admin-only.
- Returns only to companies (stock-wise report). No market returns.
- Delivery by own vans, Saharsa town first; free above Rs 2,000 in town, above Rs 5,000 beyond 5 km; charges below those set by admin, editable anytime.
- Van cash goes to the owner and is confirmed in-system.
- UI in English; thermal printer exists; no barcode scanner; web app only (PWA for van/delivery).
- Accounting: everything except P&L and Balance Sheet; Tally stays for final accounts; system exports to Tally.
- Client is GST registered with FSSAI; turnover likely requires e-invoice. GSP credentials pending.

## Technical decisions
- Next.js + TypeScript + PostgreSQL + Prisma + Tailwind/shadcn; Auth.js credentials; Vitest + Playwright; pnpm.
- **Local-first**: build and demo everything locally (Docker Compose: Postgres + Mailpit). Hosting is undecided and will be chosen before Phase 4. No Vercel.
- **No third-party dependencies to build**: email via SMTP adapter (Mailpit locally), SMS via console adapter (real gateway later, off by default), auth and verification logic written in-house.
- Hosting candidates: Indian VPS + Coolify (Hostinger Mumbai KVM 2: 2 vCPU, 8 GB, Rs 799/mo intro, Rs 1,199/mo renewal), Railway Pro (USD billing, Singapore), DigitalOcean Bangalore, Fly.io Mumbai. Regular shared hosting would force MySQL, so it is not planned.
- Stock in integer pieces; immutable movements; balances maintained in same transaction.
- Money in integer paise; percentages in basis points; MRP tax-inclusive (verify with CA).
- Van billing needs data to finalize (server issues invoice number); local drafts on network loss.

## Assumptions to confirm with client
1. Slab applies per line quantity; order buyer tag = highest tier among lines.
2. Online payment modes and whether credit parties may order on credit online (answer was unclear: "both nope").
3. Delivery charge below thresholds.
4. Invoice format `INV/26-27/000001`, FY reset in April.
5. Store name and domain.

## Inputs still needed from client
- [ ] Product list: name, company, HSN, GST %, MRP, pack size (+ photos if any)
- [ ] Credit parties + opening outstanding (Tally export)
- [ ] GSTIN, FSSAI, legal name, address, logo, bank details
- [ ] Hosting + domain accounts in client's name (only after hosting is chosen; not needed to build)
- [ ] GSP credentials (via CA)
- [ ] Slab values and discount percentages

## Gotchas
- Tally credit list is the allow-list for credit; do not auto-grant credit to new parties.
- Shop and van share one invoice series, so numbering must be server-assigned and gapless.
- Online orders can need loose stock from the shop AND packs from the godown in one order.
- Real printer and Android testing is mandatory; AI cannot do it.
- PWA and Web Bluetooth need HTTPS or localhost. Testing on a phone over Wi-Fi needs local HTTPS (mkcert) and the root CA installed on the phone.
- Never use public tunnel services for demos; use the shop Wi-Fi.

## Session notes
- 2026-10-09: Scaffolding completed. Node.js v24 LTS and pnpm v12 configured in user scope. Portable PostgreSQL 16.4 cluster initialized and running on localhost:5432 with database `idms` and user `postgres`. Created `/api/health`, `src/lib/env.ts` with Zod validation, multi-stage Dockerfile, `docker-compose.yml`, backup/restore PowerShell scripts, Tailwind design tokens, and Vitest test harness. All typecheck, lint, and unit tests passing green.
- 2026-10-09: Step 2 completed. Created core ledger tables (`locations`, `products`, `stock_balances`, `stock_movements`). Added `CHECK (qty >= 0)` constraint on `stock_balances` and PostgreSQL trigger `trg_stock_movements_immutable` preventing `UPDATE` and `DELETE` on `stock_movements`. Integration tests in `tests/integration/ledger-trigger.test.ts` confirmed immutability and non-negative constraints.
- 2026-10-09: Step 3 completed ([RISK 1] Stock Ledger Engine & Concurrency). Built `src/modules/stock` (`stock.types.ts`, `stock.repository.ts`, `stock.service.ts`, `stock.consistency.ts`). Implemented deterministic alphabetical row-locking order across locations to eliminate deadlock conditions, atomic transactional balance deduction/addition, idempotency deduplication, and nightly consistency verification. Concurrency race test verified parallel sales on the last unit are serialized safely.
- 2026-10-09: Step 4 completed ([RISK 2] GST Engine & FY Invoice Numbering Sequence Lock). Created `sequences` table with migration. Built `src/lib/gst.ts` (tax-inclusive MRP extraction, integer paise arithmetic, half-up rounding to paise, CGST/SGST splitting for Bihar intra-state, and nearest-rupee round-off) and `src/lib/invoice-number.ts` (evaluated strictly in Indian Standard Time `Asia/Kolkata` across April boundaries, with pessimistic row locking). Concurrency test verified 20 parallel transactions generate strictly gapless numbers `INV/26-27/000001` through `000020`, and failed transactions do not burn sequence values.
- 2026-10-09: Step 5 completed (Full Phase 1 Schema & Seed Data - Task 1.1). Added models for `users` (7 roles), `companies`, `categories`, `parties`, `ledger_entries`, `purchases`, `purchase_items`, `invoices`, `invoice_items`, `payments`, `credit_notes`, `stock_audits`, `audit_logs`, and `settings`. Migration applied. Seed script created 6 staff test accounts with bcrypt hashes, 4 locations, catalog master, business details, and FY 26-27 sequence. 32 tests passing across 7 test files.
- 2026-10-09: Step 6 completed (Auth + RBAC + Permission Map + Audit Log Service - Task 1.2). NextAuth v5 configured with credentials provider and JWT session strategy. Implemented temporary lockout after 5 consecutive failed login attempts (15 min window). Added password change workflow enforcing first-login password rotation. Defined static permission matrix and route prefix map per role, with middleware intercepting unauthorized routes and returning 403 Forbidden. Implemented audit logging with recursive masking of passwords, secrets, tokens, and phone numbers. Integration tests covering credentials authentication, lockout, password changes, RBAC assertions, route access, and audit log masking all pass green (42 tests total).
- 2026-10-09: Step 7 completed (Settings Module - Task 1.3). Implemented centralized settings repository and service managing business details, invoice printing metadata, role discount limits (Shop/Cashier, Salesperson), delivery thresholds, and verification modes. Super Admin permission guards enforced on all mutations, validated with Zod (GSTIN regex, FSSAI 14 digits, basis points 0-10000), and audit logged with before/after state diff. Created server actions and responsive admin UI at /admin/settings. 49 tests passing across 9 test files.
- 2026-10-09: Step 8 completed (Catalog Master CRUD & Search - Task 1.4). Implemented catalog repository and service for products, companies, and categories. Added multi-token case-insensitive search matching across product name, short code, and company name. Enforced unique uppercase shortCode, valid 4-8 digit HSN codes, and allowed Indian GST rates (0%, 5%, 12%, 18%, 28%). Super Admin permission guards on create/edit/toggle mutations with audit logs, and VIEW_PRODUCTS guards on queries. Built admin catalog page and interactive client with filters and product creation modal at /admin/catalog. 57 tests passing across 10 test suites.
- 2026-10-09: Step 9 completed (Catalog Excel/CSV Import - Task 1.5). Built a zero-dependency RFC 4180 CSV parser in TypeScript with auto-delimiter detection and fuzzy column header normalization. Implemented `CatalogImportService` with comprehensive row-level error validation (invalid HSN, non-standard GST slabs, negative/zero MRP, pack size), on-the-fly brand/category registration, and idempotent upserts keyed by shortCode. Built upload UI and action at `/admin/catalog/import` with file drag-and-drop, pasteable template, and live error reporting. Benchmark test verified 900-row fixture imports in ~870ms (well under the 30-second requirement). 61 tests passing across 11 test suites.
- 2026-10-09: Step 10 completed (Purchase & GRN Service + UI - Task 1.7). Implemented purchase repository and service for supplier goods receipts. Atomically posts `PURCHASE_RECEIPT` movements through the core stock ledger, increases Godown balances, updates supplier ledger entries with `LedgerKind.INVOICE`, and writes audit trails. Enforced `STOCK_RECEIVE` permission check and built complete Godown GRN UI at `/godown/purchases` and `/godown/purchases/new`. 64 tests passing across 12 test suites.
- 2026-10-09: Step 11 completed (Godown Operations - Task 1.8). Implemented `GodownService` and `/godown/operations` UI covering stock transfers, carton breaks (multiplied by `product.packSize` into loose shop inventory), damage deductions (`STOCK_DAMAGE`), manual stock adjustments, and stock audits with approval gating (`APPROVAL_DISCOUNTS_AND_ADJUSTMENTS`). Discrepancies generate pending `stock_audits` records; on approval, the system atomically posts `STOCK_ADJUSTMENT` balancing movements to align the physical count with ledger balances. 72 tests passing across 13 test suites.
- 2026-10-09: Step 12 completed (Stock Views by Location & Product Movement History - Task 1.9). Created `src/lib/date.ts` providing standardized IST datetime formatting (`Asia/Kolkata`). Built `StockRepository` and `StockService` view methods (`listStockBalances`, `getProductStockDetails`, `getProductMovements`, `getStockKPIs`) guarded by `STOCK_VIEW` RBAC permission. Built responsive inventory overview at `/godown/stock` featuring real-time location breakdown (Godown, Shop, Vans), carton conversions (`Math.floor(qty / packSize)` + loose pieces), low-stock alert filtering, and summary KPI stats. Implemented product movement ledger at `/godown/stock/[productId]` displaying chronological ledger records with IST timestamps, route badges, and actor resolution. 79 tests passing across 14 test suites.
- 2026-10-09: Step 13 completed (Pricing Engine - Task 1.10). Implemented `PricingRepository` and `PricingService` storing and managing price slabs in the `settings` table (`price_slabs` key) with zero schema migrations. Built dynamic quantity slab resolution implementing the priority cascade (Product > Category > Company > Global). Built automatic buyer classification tagging (`CUSTOMER`, `RETAILER`, `WHOLESALER`) taking the maximum tier among all order lines. Integrated order-level % discount combining with slab discounts, and enforced role discount limits from settings with approval flagging (`requiresDiscountApproval`). Built admin slab management UI at `/admin/pricing`. 93 tests passing across 16 test suites.
- 2026-10-09: Step 14 completed (Billing Service & Invoicing Finalize/Cancel - Task 1.11). Built `BillingService` executing single-transaction invoice finalization. Enforced pessimistic locked gapless FY sequence numbering (`INV/26-27/XXXXXX`), price and GST freezing, atomic `MovementType.SALE` stock ledger deductions with non-negative check validation, multi-split payment logging (Cash/UPI/Card/Credit), and linked customer ledger postings. Built Admin-only invoice cancellation issuing Credit Notes (`CN/26-27/XXXXXX`), posting counter-movements (`MovementType.SALE_CANCEL`) restoring inventory, and offsetting party accounts. 99 tests passing across 17 test suites.
- 2026-10-09: Step 15 completed (Shop POS UI - Task 1.12). Built dedicated search-first POS UI at `/shop/pos` designed for 2-3 minute retail counter workflow. Features keyboard-friendly search, product categorization, live shop stock validation, instant carton-to-piece conversions, pricing preview with automatic buyer classification, multi-split payments (Cash, UPI, Card, Credit) with quick rupee notes, cashier discount limit warnings with owner approval flagging, bill hold/resume using browser localStorage, and completion modal linking directly to A4 and thermal receipts. 99 tests passing across 17 test suites.
- 2026-10-09: Step 16 completed (A4 & 80mm Print Templates - Task 1.13). Built `src/lib/number-to-words.ts` converting integer paise to Indian currency words format. Built A4 GST tax invoice template adhering to CGST Act Section 31 rules (tax breakdown table by HSN/rate, amount in words, bank remittance and UPI info, terms and authorized signatory). Built 80mm thermal receipt template (`72mm` printable width, monospaced layout, dashed dividers, no images). Configured `@media print` CSS hiding controls and formatting page sizes. Added print view `/shop/invoices/[id]/print`, invoice detail view `/shop/invoices/[id]` with Credit Note cancellation tracking, and invoice register `/shop/invoices`. 105 tests passing across 19 test suites.
- 2026-10-09: Step 17 completed (Basic Reports - Task 1.14). Built `src/modules/reports` (`reports.types.ts`, `reports.repository.ts`, `reports.service.ts`) and interactive UI at `/admin/reports` with redirect from `/reports`. Added 4 reports: Stock Valuation (multi-location matrix with carton/pack conversions and integer paise valuation), Low Stock Alerts (real-time deficit tracking against reorder levels), Daily Sales Summary (IST date ranges, taxable/tax collections, payment tender breakdown by Cash/UPI/Card/Credit, GST slab distribution, top product sales, and invoice drilldown), and Day-End Cash Register (cash receipts ledger with interactive physical denomination counter and drawer variance detection). 109 tests passing across 20 test suites.
- 2026-10-09: Step 18 completed (Playwright E2E Test Suite - Task 1.15). Configured Playwright with Chromium headless browser (`playwright.config.ts`, Next.js webServer integration). Resolved NextAuth session decryption in middleware by setting `trustHost: true`, `secret: process.env.AUTH_SECRET`, and `session: { strategy: "jwt" }` in `auth.config.ts`. Isolated Playwright tests from Vitest unit runner by configuring `include` and `exclude` paths in `vitest.config.ts`. All 8 E2E scenarios in `tests/e2e/core-flows.spec.ts` pass green in ~35 seconds: health check, admin/godown authentication, RBAC 403 route blocking, CSV catalog upload and search, location stock overview, POS counter flow, sales invoice view with A4 & thermal print formatting, and business reporting tabs. 109 unit/integration tests pass. Next is Step 19: Security Review & Client Demo Script (Task 1.16).








