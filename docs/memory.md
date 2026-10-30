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
- 2026-10-09: Step 19 completed (Security Review & Client Demo Script - Task 1.16). Executed full security audit across authentication, RBAC authorization, stock ledger immutability (`trg_stock_movements_immutable`), non-negative stock constraint (`CHECK qty >= 0`), integer paise arithmetic, gapless invoice sequences (`INV/26-27/XXXXXX`), and recursive audit log redaction, documenting findings and post-Phase 1 hardware testing requirements in `docs/security-checklist.md`. Authored complete 10-scene client demo script in `docs/demo-script.md` covering end-to-end FMCG distribution workflows for the client in Saharsa. All 109 unit/integration tests and 8 browser E2E tests passing. Phase 1 (Core) officially complete.
- 2026-10-09: Step 20 completed (Parties Import from Tally - Task 2.1). Built party repository and service (`src/modules/party`) calculating live party outstanding balance from ledger entries (`sum(debit) - sum(credit)`). Built `PartyImportService` supporting standard Tally ERP/Prime ledger exports with auto-detection of header aliases (`Ledger Name`, `Sundry Debtors/Creditors`, `Credit Limit`, `Credit Period`, `Opening Balance Dr/Cr`), row-level error reporting, integer paise conversions, automatic opening balance ledger entry creation/reconciliation, and idempotent re-runs. Created responsive Party Master UI at `/admin/parties` and Tally import UI at `/admin/parties/import`. All 127 unit/integration tests and 8 Playwright E2E browser tests passing. Next is Step 21: Van Locations & Van Issue Sheet (Task 2.2).
- 2026-10-09: Step 21 completed (Van Locations & Morning Van Load Sheets - Task 2.2). Added `van_days` and `van_day_lines` models with `VanDayStatus` enum (`OPEN`, `RECONCILED`, `CLOSED`) and unique constraint ensuring single active open day per vehicle. Built `VanRepository` and `VanService` (`src/modules/van`) generating gapless sequence numbers (`VIS/26-27/XXXXXX`), executing atomic stock transfers from Godown to Van via `stockService.postMovement()`, and providing on-van inventory summaries with carton calculations. Built Godown dispatch workflow at `/godown/van-issues`, creation modal at `/godown/van-issues/new`, printable dual-signature A4 load sheet at `/godown/van-issues/[id]/print`, and salesperson van workspace at `/van`. 134 unit and integration tests passing. Next is Step 22: Van PWA Shell, Install & Role Routing (Task 2.3).
- 2026-10-09: Step 22 completed (Van PWA Shell, Install & Role Routing - Task 2.3). Built PWA Manifest (`src/app/manifest.ts`, `public/manifest.json`), service worker (`public/sw.js`) with pre-caching, offline fallback page (`/offline`), and PNG icons in `public/icons/`. Built mobile-first handheld PWA layout (`src/app/van/layout.tsx`) featuring native app top bar with live Online/Offline status pill, one-tap PWA installation prompt, and fixed mobile bottom navigation (`VanBottomNav` tabs: Van Stock, New Bill, Invoices, Day End). Configured automatic role routing redirecting Salesperson logins directly to `/van` with 403 Forbidden route boundaries on unauthorized paths. Built interactive on-van inventory matrix (`VanStockView`) and placeholder shells for `/van/billing`, `/van/bills`, and `/van/reconciliation`. 145 unit/integration tests and 9 browser E2E tests pass green. Next is Step 23: Van Billing + Local Draft on Network Loss + Idempotent Finalize (Task 2.4).
- 2026-10-09: Step 23 completed (Van Billing + Local Draft on Network Loss + Idempotent Finalize - Task 2.4). Applied migration `20261009171500_invoice_idempotency_key` adding unique `idempotency_key` column to `invoices` table. Built client offline draft store in IndexedDB with localStorage fallback (`src/lib/offline-drafts.ts`). Built mobile touch billing UI at `/van/billing` (`van-billing-client.tsx`, `actions.ts`) with quick product search, carton/piece quantity steppers, live slab pricing & discount calculation, cash vs customer credit toggling with live party credit limit validation, offline draft queueing on network loss, and automatic draft sync upon network reconnection. Enhanced `billingService.finalizeInvoice` to require active morning load sheet for van channel sales and handle duplicate idempotencyKey replaying without burning numbers or double-deducting stock. 152 unit/integration tests passing. Next is Step 24: Bluetooth ESC/POS Print (Task 2.5).
- 2026-10-09: Step 24 completed (Bluetooth ESC/POS Print - Task 2.5). Built binary ESC/POS command encoder (`src/lib/escpos.ts`) supporting 58mm (32 cols) and 80mm (48 cols) formats with Indian Rupee symbol sanitization, character sizing, tabular rows, and tear cuts. Built invoice and diagnostic test slip generators (`src/lib/escpos-invoice.ts`). Built Web Bluetooth thermal printer client (`src/lib/bluetooth-printer.ts`) with standard printer GATT service discovery, connection state management, and 100-byte packet chunking to prevent buffer overflow on handheld printers. Built interactive Bluetooth printer pairing modal (`BluetoothPrinterModal`), header status pill (`BluetoothHeaderButton`), and one-tap Bluetooth print button with browser print fallback (`BluetoothPrintButton`) across `/van/billing` and `/van/bills`. Created comprehensive hardware manual (`docs/bluetooth-printer-guide.md`). 171 unit/integration tests passing. Next is Step 25: Collections & Party Ledger (Task 2.6).
- 2026-10-09: Step 25 completed (Collections & Party Ledger - Task 2.6). Applied migration `20261009174500_payment_receipt_and_collections` adding `receipt_no` (unique), `notes`, and `van_location_id` to `payments` table. Added `RECORD_COLLECTION` and `VIEW_LEDGER` permissions. Built `partyService.recordCollection()` with gapless sequence numbering (`REC/26-27/XXXXXX`), atomic `RECEIPT` ledger entry creation, payment tracking with collector and route attribution, and immediate outstanding reduction (`sum(debit) - sum(credit)`). Built `partyService.getPartyLedgerStatement()` computing opening balance across date ranges and running balance rows. Formatted route collection receipts for 58mm/80mm ESC/POS Bluetooth thermal printing. Created mobile van collections screen (`/van/collections`), on-route payment receipt modal (`CollectionModal`), admin party ledger view (`/admin/parties/[id]/ledger`), and quick collect/ledger triggers in Party Master directory. 177 unit/integration tests passing. Next is Step 26: Credit limit enforcement + owner override (Task 2.7).
- 2026-10-09: Step 26 completed (Credit Limit Enforcement + Owner Override - Task 2.7). Applied migration `20261009180000_invoice_credit_override` adding `notes`, `credit_override`, `credit_override_reason`, and `credit_override_by` (FK to users) to `invoices` table. Added `Permission.OVERRIDE_CREDIT_LIMIT` strictly to `SUPER_ADMIN`. Enhanced `billingService.finalizeInvoice` to enforce strict credit rules: blocks credit sales if party credit is disabled, credit limit exceeded (`currentOutstanding + balanceDue > party.creditLimitPaise`), or unpaid invoices exist past payment terms (`party.creditDays > 0`), unless verified with Super Admin override (`approvedByUserId` + mandatory audit reason). Created reusable `CreditOverrideModal` with owner credentials verification (`verifyOwnerCredentials`) and integrated it into both Shop POS (`/shop/pos`) and Van Billing (`/van/billing`). Created comprehensive integration suite in `tests/integration/credit-limit-override.test.ts`. All 183 unit and integration tests passing across 30 test files. Next is Step 27: Evening return, reconciliation, shortage/excess (Task 2.8).
- 2026-10-10: Step 27 completed (Evening Return, Reconciliation, Shortage/Excess - Task 2.8). Added `Permission.VAN_RECONCILE` across roles (`SUPER_ADMIN`, `GODOWN`, `SALESPERSON`). Built `vanRepository.getVanReconciliationData()` and `vanRepository.reconcileVanDay()` computing theoretical sales, expected returns, and physical discrepancies. Atomically executes `MovementType.VAN_RETURN` stock transfers from Van to Central Godown, posts balancing ledger adjustments for shortages/excesses, and updates `van_days` status to `RECONCILED` with `reconciledBy` attribution. Built responsive mobile-first route closing UI at `/van/reconciliation` with live handover metrics (Cash in Hand, UPI, Route Sales) and Godown return management at `/godown/van-issues/[id]/reconcile`. 189 unit/integration tests passing across 31 suites. Next is Step 28: Cash handover confirmed by owner (Task 2.9).
- 2026-10-10: Step 28 completed (Cash Handover Confirmed by Owner & Day Closing - Task 2.9). Added `CashHandover` model to schema and applied migration `20261009193426_van_cash_handover`. Added `Permission.CONFIRM_CASH_HANDOVER` restricted strictly to `SUPER_ADMIN` and `ACCOUNTS`. Built `vanService.confirmCashHandover()` verifying `RECONCILED` van day status, recording physical cash received, computing variance (shortage/excess), transitioning `van_days` status to `CLOSED`, attributing `closedBy`, and recording audit logs. Updated van reconciliation UI (`/van/reconciliation`) and godown route closing UI (`/godown/van-issues/[id]/reconcile`) with Owner Cash Handover verification card, variance badge, driver awaiting banner, and closed receipt view. Authored full integration suite (7 tests) in `tests/integration/van-cash-handover.test.ts`. 196 unit and integration tests passing across 32 test files. Next is Step 29: Outstanding and ageing reports (Task 2.10).
- 2026-10-10: Step 29 completed (Outstanding & Ageing Reports - Task 2.10). Implemented FIFO accounts receivables ageing report in `ReportsRepository` and `ReportsService` with 0-15, 16-30, 31-60, and 60+ days bucketed outstanding matching debtor debits and credits chronologically. Added calculations for oldest debt date, overdue days beyond credit terms, over-limit breach amounts, and advances. Enforced `REPORTS_VIEW` / `ACCOUNTS_VIEW` RBAC guards. Built interactive Receivables & Ageing dashboard tab at `/admin/reports` (`?tab=ageing`) with 6 summary KPI cards, search and filter toolbar (Party Type, Overdue Only, Over Limit Only), FIFO ageing breakdown table with direct party ledger links, and CSV export. Authored full integration suite (5 tests) in `tests/integration/reports-ageing.test.ts`. All 201 tests passing across 33 test files. Next is Step 30: Return to company + stock-wise report + debit note (Task 2.11).
- 2026-10-10: Step 30 completed (Return to Company + Stock-Wise Report + Debit Note - Task 2.11). Added `DebitNote` and `DebitNoteItem` models to schema and applied migration `20261009195422_debit_notes_and_company_returns`. Implemented `ReturnsRepository` and `ReturnsService` (`src/modules/returns`): gapless IST FY sequence generation (`DN/26-27/XXXXXX`) via pessimistic row lock, atomic `MovementType.RETURN_TO_COMPANY` stock deduction via `stockService.postMovement()`, and supplier ledger debit entry (`LedgerKind.DEBIT_NOTE`) reducing payables. Implemented aggregated stock-wise returns report with return reason breakdown. Built Godown returns dashboard at `/godown/returns`, return dispatch form at `/godown/returns/new`, debit note detail view at `/godown/returns/[id]`, and formal printable A4 Debit Note template with full GST and transport details at `/godown/returns/[id]/print`. 206 tests passing across 34 test files. Next is Step 31: Phase 2 Demo Script & Client Verification (Task 2.12).
- 2026-10-10: Step 31 completed (Phase 2 Demo Script & Client Verification - Task 2.12). Authored complete 10-act interactive demonstration script in `docs/demo-script-phase2.md` tailored for FMCG operations in Saharsa: Tally debtor migration, morning van load sheets, mobile handheld PWA with offline drafts, on-route ESC/POS Bluetooth thermal printing, credit limit hard blocks with remote owner credentials override, on-route collections & receipts, evening stock return reconciliation, owner two-stage cash handover verification, FIFO 0-15/16-30/31-60/60+ days ageing reports, and manufacturer return debit notes. All 206 unit/integration tests and typechecks pass green. Phase 2 (Van and Credit) is 100% complete ahead of the 3 Nov target! Next is Phase 3: Ecommerce and Delivery (Task 3.1).
- 2026-10-10: Step 32 completed (Buyer Signup/Login & Verification Mode Setting - Task 3.1). Applied migration `20261009210842_buyer_signup_and_verification` adding `phone_verified_at`, `email_verified_at`, `verification_mode`, and `party_id` FK relation to `users` table. Built swappable `SmsProvider` interface (`src/lib/sms.ts`) with zero-dependency `ConsoleSmsProvider`. Implemented buyer registration (`registerBuyer`), admin phone verification (`verifyBuyerPhoneByAdmin`), and SMS OTP verification (`sendPhoneVerificationOtp`, `verifyPhoneWithOtp`) with 5-minute expiry and 5-attempt rate limits. Created buyer registration screen at `/register`, storefront landing shell at `/store`, and Verification Mode radio setting in Admin Settings (`/admin/settings`). 211 tests passing across 35 test files. Next is Step 33: Storefront Catalogue, Search, Product Page (Task 3.2).
- 2026-10-10: Step 33 completed (Storefront Catalogue, Search, Product Page - Task 3.2). Built `StoreService` (`src/modules/store/store.service.ts`) providing multi-token fuzzy search across product name, short code, and brand, live multi-location stock availability (Shop + Central Godown), and dynamic slab calculations. Built responsive mobile-first Storefront catalogue at `/store` (`catalogue-client.tsx`) with brand chips, category pills, in-stock toggling, and wholesale slab previews. Built comprehensive product detail page at `/store/products/[id]` (`product-detail-client.tsx`) with interactive quantity stepper, carton/pack conversions, and live slab rate & savings preview. 216 tests passing across 36 test files. Next is Step 34: Cart with live slab price and buyer tag (Task 3.3).
- 2026-10-10: Step 34 completed (Cart with Live Slab Price & Buyer Tag - Task 3.3). Applied migration `20261009215345_store_cart_and_cart_items` adding `carts` and `cart_items` tables with unique compound key per product. Built `CartService` (`src/modules/cart/cart.service.ts`) integrating `pricingService.calculateOrderPricing()`: dynamically applies quantity price slabs per line, computes total wholesale savings, determines overall order `buyerTag` (`CUSTOMER`, `RETAILER`, `WHOLESALER`), and calculates GST split. Built responsive Cart UI at `/store/cart` (`cart-view-client.tsx`, `actions.ts`) with quantity steppers, carton conversions, clear cart action, and cart icon badge with live piece count in Store header. 221 tests passing across 37 test files. Next is Step 35: Delivery zones, charges and thresholds (Task 3.4).
- 2026-10-10: Step 35 completed (Delivery Zones, Charges and Thresholds - Task 3.4). Defined delivery zone schema, settings, and calculation interfaces (`src/modules/delivery/delivery.types.ts`). Created `DeliveryService` (`src/modules/delivery/delivery.service.ts`) calculating delivery fee, free delivery threshold status, and deficit to free delivery in integer paise. Supported configurable zone directories (Saharsa Town, Outstation / Beyond 5km, Simri Bakhtiarpur, and custom rural routes) with minimum order thresholds and delivery charges. Enforced Super Admin RBAC guards and audit logging on delivery settings modifications. Built admin management form at `/admin/settings` (`DeliverySettingsForm`, `updateDeliverySettingsAction`) and integrated delivery destination selector and real-time fee calculation into Store Cart (`/store/cart`). 230 unit/integration tests passing across 38 test suites. Next is Step 36: Checkout and order creation with stock reservation (Task 3.5).
- 2026-10-10: Step 36 completed (Checkout and Order Creation with Stock Reservation - Task 3.5). Applied migration `20261009222804_store_orders_and_order_items` creating `orders` and `order_items` tables with `OrderStatus` enum (`PENDING`, `CONFIRMED`, `PROCESSING`, `DISPATCHED`, `DELIVERED`, `CANCELLED`). Implemented `OrderRepository` and `OrderService` (`src/modules/order`): verifies stock availability across Shop and Godown distribution locations, calculates delivery charges and slab pricing in integer paise, generates gapless FY sequence numbers (`ORD/26-27/XXXXXX`) via pessimistic row lock, saves order items with HSN and GST breakdowns, and empties active cart upon placement with full audit logging and idempotency support. Built interactive Checkout UI (`/store/checkout`) and Buyer Orders tracking screen (`/store/orders`). 235 tests passing across 39 test suites. Next is Step 37: Admin orders, confirm, split pick lists (Task 3.6).
- 2026-10-10: Step 37 completed (Admin Orders, Confirm, Split Pick Lists - Task 3.6). Added `Permission.MANAGE_ORDERS` and `Permission.VIEW_ORDERS` RBAC definitions. Built `orderService.getSplitPickLists(orderId)` algorithmically partitioning order items into Central Godown Pick List (full unopened cartons/bags: `Math.floor(qty / packSize)`) and Shop Counter Pick List (loose pieces: `qty % packSize > 0` or loose single items). Implemented `orderService.updateOrderStatus()` supporting state workflow (`PENDING` -> `CONFIRMED` -> `PROCESSING` -> `DISPATCHED` -> `DELIVERED`) with full audit trail logging. Built Admin Orders Directory (`/admin/orders`), Order Detail View (`/admin/orders/[id]`), and dedicated printable Split Pick Sheet template (`/admin/orders/[id]/pick-list`). 239 tests passing across 40 test suites. Next is Step 38: One invoice per order; assign delivery; delivery app; payment collected (Task 3.7).
- 2026-10-10: Step 38 completed (One Invoice Per Order, Assign Delivery, Delivery App, Payment Collected - Task 3.7). Applied migration `20261009224851_order_delivery_assignment` adding `assigned_delivery_user_id`, `delivered_at`, `payment_mode`, `payment_reference`, and `payment_notes` to `orders` table. Implemented `orderService.generateOrderInvoice()` guaranteeing one single gapless sales invoice (`INV/26-27/XXXXXX`) per order, linking `order.invoiceId`, freezing prices/GST, deducting stock via `MovementType.SALE` (Godown packs, Shop loose), and debiting customer party ledger. Implemented `orderService.assignDeliveryStaff()` and `orderService.recordOrderDeliveryAndPayment()` recording proof of delivery and cash/UPI collection, transitioning order to `DELIVERED`, marking invoice `paymentStatus = PAID`, and posting customer ledger receipt credits. Built dedicated mobile Delivery App at `/delivery` (`delivery-client.tsx`, `layout.tsx`) for delivery personnel featuring active/completed runs, direct call trigger (`tel:`), Google Maps routing, and payment collection modal with cash and UPI references. Updated Admin Orders detail view with invoice generation and delivery staff assignment dropdown. 244 tests passing across 41 test files. Next is Step 39: Order tracking, reorder, invoice download (Task 3.8).
- 2026-10-10: Step 42 completed (GST Reports, Day Book, Registers - Task 4.2). Built `getGstr1Report`, `getDayBookReport`, and `getSalesRegisterReport` in `reportsRepository` and `reportsService` (`src/modules/reports`). Implemented Table 4A (B2B registered invoices), Table 7 (B2CS consumer walk-ins), Table 12 (HSN-wise summary), and tax rate breakdown (0%, 5%, 12%, 18%, 28%) with one-click CSV exports for CA filing. Built chronological Day Book combining Sales, Purchases, Customer Receipts, and Debit Notes. Integrated GSTR-1 and Day Book tabs into `/admin/reports` with date/month filters. 263 unit and integration tests passing across 45 test files. Next is Step 43: Tally export (Task 4.3).
- 2026-10-10: Step 43 completed (Tally Export - Task 4.3). Built Tally export module (`src/modules/tally`) supporting standard Tally ERP 9 / TallyPrime XML import format (`<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDATA><TALLYMESSAGE><VOUCHER>`) and RFC 4180 CSV export. Implemented sales voucher extraction with inventory allocations, tax breakdown (Output CGST, Output SGST, Output IGST), and customer receipt vouchers. Enforced SUPER_ADMIN and ACCOUNTS RBAC guards. Built interactive export tab in Reports Hub at `/admin/reports?tab=tally` with date filters and one-click XML/CSV downloads. 267 unit and integration tests passing across 46 test files. Next is Step 44: E-invoice adapter wired (Task 4.4).
- 2026-10-10: Step 44 completed (E-Invoice Adapter Wired - Task 4.4). Implemented swappable `EInvoiceProvider` interface (`src/lib/e-invoice.ts`) with default `NoopEInvoiceProvider` per PRD Section 5.10 & 11 (remaining safe and local-first until client supplies GSP credentials). Wired IRN and signed QR generation hooks into `billingService.finalizeInvoice` and `orderService.generateOrderInvoice` for B2B supplies (identified by valid 15-digit GSTIN), and IRN cancellation into `billingService.cancelInvoice`. Updated A4 Tax Invoice and 80mm Thermal Receipt templates to display IRN and signed QR code. Added E-Invoice configuration controls in Admin Settings (`/admin/settings`). 273 unit and integration tests passing across 47 test files. Next is Step 45: Security pass (Task 4.5).
- 2026-10-10: Step 45 completed (Security Pass - Task 4.5). Completed full-system security audit per Prompt 09 checklist: verified 7-role RBAC route boundaries and action permissions, recursive sensitive data masking in audit logs (passwords, tokens, GSP/PG secret keys, phone numbers), 5-attempt / 15-minute brute-force account lockout, database-level immutability triggers on `stock_movements`, non-negative constraints on `stock_balances`, integer paise accounting invariants, gapless invoice sequencing, and zero raw SQL vulnerabilities. Created verification suite `tests/integration/security-pass.test.ts`. Updated `docs/security-checklist.md`. 281 unit and integration tests passing across 48 test files. Next is Step 46: Backup + restore validation (Task 4.6).
- 2026-10-10: Step 46 completed (Backup + Restore Validation - Task 4.6). Enhanced `scripts/backup.ps1` with SHA256 integrity checksum generation (`.sha256`) and `scripts/restore.ps1` with checksum validation and target database routing. Built automated validation harness in `scripts/validate-backup-restore.ps1` (`pnpm db:validate-backup`). Successfully performed full live dump of `idms` (6.16 MB), verified SHA256 checksum, restored into clean isolated test database `idms_restore_test`, and verified 100% exact match across all 29 database tables (users, stock_balances, stock_movements, invoices, items, payments, ledger_entries, audit_logs). Next is Step 47: Hosting selection & Dockerized production deploy (Tasks 4.6a / 4.7).
- 2026-10-10: Step 47 completed (Hosting Selection & Dockerized Production Container - Tasks 4.6a & 4.7). Created production Next.js configuration (`next.config.mjs`) supporting standalone container builds. Fixed static generation on offline screen (`/offline`). Updated `docker-compose.yml` with production `app` service profile and verified multi-stage Docker build pipeline (`Dockerfile`). Verified full production compilation (43/43 static pages, middleware, dynamic routes), zero lint/type errors, and all 48 test suites passing. Next is Step 48: Staff training + one-page guides per role (Task 4.8).
- 2026-10-10: Step 48 completed (Staff Training + One-Page Role Guides - Task 4.8). Authored 6 comprehensive operational guides in `docs/guides/` tailored for daily FMCG operations in Saharsa: `01-owner-guide.md` (super admin controls, credit overrides, van cash reconciliation sign-off), `02-godown-guide.md` (GRN, van load sheets, carton breaks, manufacturer debit notes), `03-shop-cashier-guide.md` (search-first POS, split tender, drawer count), `04-van-salesperson-guide.md` (Android PWA, Bluetooth thermal printing, offline drafts, route collections), `05-delivery-guide.md` (run sheets, 1-tap dialer/maps, POD collection), and `06-accounts-ca-guide.md` (GSTR-1 CSV exports, TallyPrime XML/CSV vouchers, FIFO receivables ageing). Next is Step 49: Handover & parallel run kickoff (Task 4.9).
- 2026-10-10: Step 49 completed (Handover & Parallel Run Kickoff - Task 4.9). Prepared formal delivery handover and 2-3 week parallel run protocol in `docs/handover-and-parallel-run.md`. Verified full system readiness ahead of 15 Nov target: 281/281 Vitest unit/integration tests passing (48 test files), 8/8 Playwright E2E browser tests passing, 0 TypeScript errors, 0 ESLint errors, Next.js Docker standalone production build passing (43/43 pages), and automated backup/restore verification passing with 100% table match across all 29 database tables. Phase 4 and all roadmap delivery milestones are 100% complete!
- 2026-10-13: Prompt 05 completed (Empty Start, First-Run Setup, Isolated Test DB & Stock Update Without GRN). Stripped `prisma/seed.ts` to reference data only; moved test fixtures to `tests/fixtures.ts` running against isolated `idms_test` DB via `tests/global-setup.ts`. Added `/setup` first-run owner creation and `pnpm admin:create` CLI. Built 7-step Getting Started checklist and Quick Actions bar on `/admin`. Built `/godown/stock/update` (Opening Stock, Stock Count, Adjust +/-, Bulk CSV Preview & Apply) posting `OPENING_STOCK` and `ADJUSTMENT` movements without a GRN. Removed all dummy data, sample CSVs, and hardcoded credentials across the app.
- 2026-10-23: Prompt 09 completed (POS Stock Display, OOS-Last Ranking, Brand Suppliers for GRN, and Cloudflare R2 Media Storage).
  - Root Cause 1 (POS zero-stock & zero-price): Verified on live DB that all stock balances (71,100 pcs) resided in 'Main Godown' (loc-godown-main), with 0 pieces in 'Retail Shop' (loc-shop-retail). POS `page.tsx` strictly queried balances for `shopLocation.id` only, completely ignoring godown inventory. Prices defaulted to `mrpPaise ?? priceCPaise ?? 0`, showing ₹0.00 for unpriced rows.
    - Solution: Updated POS grid and billing logic to display dual badges: "Shop: N pcs" and "Godown: N pcs (C cartons)". Carton sales draw from Godown, loose pieces draw from Shop with auto-carton break if needed. Added transfer link for Godown stock when Shop stock is zero. Refactored price resolution to `resolvePrice(product, buyerType)` (walk-in = C, registered = A/B/C); unpriced products show "Price not set" and block ₹0.00 sales, with Admin-only manual rate modal. Created Catalog Data-Quality dashboard at `/admin/catalog/data-quality` with CSV export and bulk deactivate.
  - Root Cause 2 (GRN supplier dropdown missing brands): `purchaseRepository.listSuppliers()` queried `Party` where `type = SUPPLIER`. Brands are stored in `Company`, and no linked supplier parties existed.
    - Solution: Added additive migration `20261023023000_party_company_supplier` with nullable unique `Party.companyId`. Built `ensureSupplierParty` helper and wired into Brand CRUD, catalog import, brand-sheet import, and Tally imports. Ran idempotent backfill script `scripts/backfill-brand-suppliers.ts` linking/creating SUPPLIER parties for all active brands. Enhanced GRN purchase form with searchable supplier combobox, brand filter, and product combobox.
  - Root Cause 3 (Product images failing to load on production): Runtime writes to `public/uploads` in Cloud Run are ephemeral and not served by Next.js standalone server.
    - Solution: Built zero-dependency S3 SigV4 adapter `src/lib/storage/r2-storage.ts` using `node:crypto` + native `fetch`, with fallback to `local-disk-storage.ts` in local dev. Built streaming endpoint `/media/[...key]` with immutable caching (1 year) and ETag support. Implemented magic-byte image validation (blocking SVG and script execution). Created migration script `scripts/migrate-uploads-to-r2.ts`. Created reusable `<ProductImage>` component.
  - Part B (OOS-Last Ranking): Implemented pre-pagination database ranking helper `stockRankSql` in `src/modules/stock/availability.ts`.
    - Included lists: Storefront catalogue & category pages (`store.service.ts`), Storefront search suggestions (`/api/store/search`), Wishlist (`wishlist.service.ts`), Admin catalogue picker (`catalog.repository.ts`), POS product grid (`pos-client.tsx`), Van billing picker (`/van/billing/page.tsx`).
    - Excluded lists (with business reasons): GRN purchases (purchasing goods often requires selecting zero-stock items to restock), Stock audit (auditing requires verifying all products regardless of balance), Low stock report (needs to highlight zero-stock and below-buffer items at the top), Stock movements (chronological ledger order must not be altered), Godown overview (needs location/category grouping).
  - Test & Build Results: 59/59 test suites passed (339/339 tests), 0 failures. Next.js standalone build compiled with zero errors across all 57 static/dynamic routes.
- 2026-10-23: Stock Overview Pagination Fix:
  - Fixed godown stock overview pagination (`/godown/stock`) to support 100 products per page with dynamic page navigation.
  - Deployed to GCP Cloud Run revision `jmd-cart-00017-6nr`.
- 2026-10-23: Prompt 10 completed (Receive goods by scanning supplier bill - offline OCR -> draft list -> warehouse count & verify -> Done adds stock).
  - Additive Migration: `20261023101500_bill_scan_receiving` added models `BillScan`, `BillScanLine`, `SupplierItemAlias`, enums `BillScanStatus`, `BillScanSourceType`, `BillScanLineMatchStatus`, `BillScanVariance`, and additive columns `billScanId`, `billTotalPaise` on `Purchase` and `billedQty`, `acceptedQty`, `varianceReason` on `PurchaseItem`.
  - Offline OCR: Zero cloud APIs, zero runtime downloads. Vendored `eng.traineddata` (4,113,088 bytes) in `src/modules/ocr/vendor/tessdata/`.
  - Hybrid Engine: Auto-detects digital PDFs (instant text layer via `pdfjs-dist`) vs scanned PDFs and camera photos (offline WASM Tesseract with semaphore concurrency limiter and 30s timeout).
  - Table Parsing & Arithmetic Safety: Intelligently parses Indian FMCG wholesale bills (Vindhyawasini/Bikaji, Mahashian Di Hatti/MDH, Nilons, Shubham Traders/Patanjali). Preserves pack sizes/grammages (`200 Gm*20`, `45 GM`) in product descriptions. 100% flags arithmetic discrepancies without silent errors.
  - Product Matcher: Multi-tier matcher (exact supplier alias -> HSN + pack size -> fuzzy token similarity). Auto-learns supplier aliases on keeper confirmation.
  - Verification & Stock Posting: Mobile-first responsive UI (`/godown/receive-goods/[id]`) with camera upload, split-view bill inspection, quick stepper counting, "All as per bill" 1-tap verification, and idempotent GRN posting through existing stock & purchase services. Private bill storage in R2 with authenticated endpoint `/api/bills/[scanId]/image/[page]`.
  - Test & Build Results: 62/62 test suites passed (355/355 tests), 0 failures. Typecheck clean (0 errors).
- 2026-10-23: Prompt 06 Dispatch & Shared Fulfilment implemented.
  - Role WAREHOUSE_MANAGER added to `UserRole` and permission matrix with godown + dispatch controls, read-only invoices and catalog.
  - Additive migration `20261023143000_dispatch_and_warehouse_manager` applied.
  - Section 5a Shared Sellable Pool: Shop + Godown stock pooled (`available = shop + godown - reservations - buffer`). Godown fulfills whole cartons first; Shop fulfills loose units first. Shortfalls at POS counter generate Counter Pickups from Godown. Pessimistic row locking implemented with `lockAndGetBalance(tx, productId, locationId)`.
  - Section 5b Manual Orders: Phone/counter orders placed on behalf of party with instant A/B/C tier pricing (`resolvePrice`), credit validation, immediate stock reservations, and gapless `ORD` sequence numbering.
  - Section 5 & 8 Dispatch Board: Built at `/godown/dispatch` with Today's Load Summary (cartons/loose needed vs available, shortages), orders kanban, delivery trip creation/handover (`RUN` and final `INV` sequence numbering), and failed delivery returns.
  - All 64 test suites (363 tests) passing green. Zero type errors. Zero lint errors.
- 2026-10-24: Universal SearchableSelect & Out-of-Stock Products Last Ranking:
  - Built reusable `SearchableSelect` component (`src/components/common/SearchableSelect.tsx`) with real-time text query filtering, outside-click listener, keyboard support (Escape/Enter), badges (stock qty, tier A/B/C, credit status), and hidden input support for native forms.
  - Replaced long native HTML `<select>` elements across Dispatch manual order creation (`new-order-client.tsx` for party and line products), POS billing (`pos-client.tsx` for party/customer), Purchase GRN (`purchase-form.tsx` for supplier), Returns to company (`return-form.tsx` for supplier and product), Single-product stock update (`update-stock-client.tsx`), Godown operations (`operations-client.tsx` for convert, carton break, damage, adjust), Van issue sheet (`new-van-issue-client.tsx` for salesperson), and Van billing (`van-billing-client.tsx` for party).
  - Out-of-stock ranking enforced universally: Storefront catalogue client (`catalogue-client.tsx`), store search suggestions API (`api/store/search/route.ts`), POS products, and Dispatch/Van sheets strictly rank in-stock products first, with out-of-stock items relegated to the bottom. Fixed store service (`store.service.ts`) stock calculation to evaluate the shared sellable pool (Godown + Shop per Section 5a).
  - Deployed Cloud Run revision `jmd-cart-00024-785` to production; 14/14 smoke tests passed.
- 2026-10-27: Synced upstream updates from GitHub and reconciled billing, stock fallback, and metadata:
  - Pulled commits up to `ea72944` on `main`: receipt enhancements, Busy-style speed improvements, catalog stock editor, van handed-over delivery orders, password reset with nodemailer.
  - Added additive migration `20261027144000_category_image_url` for `categories.image_url` and applied to PostgreSQL.
  - Reconciled POS billing credit checks (enforcing walk-in retail full payment and debtor credit policy) and Godown shortfall stock fulfillment for shop sales.
  - Updated management layout metadata to "JMD Cart Management" and removed obsolete 30-min delivery claims.
  - Restricted party ageing report authorization to ACCOUNTS and ADMIN/SUPER_ADMIN roles.
  - All 71 test suites (378 tests) passing green. Typecheck (0 errors) and Lint (0 errors) passing cleanly. Next.js production build (`pnpm build`) completed with 0 errors across all 67 routes.
  - Pushed synchronized commits to `origin/main` and `origin/deploy-jmd1`.

- 2026-10-27: Prompt #11 Completed & Verified:
  - Deployed revision on Cloud Run: jmd-cart-00041-6k9 (serving 100% traffic, built from ancestor commit ea72944).
  - Branch: feat/invoice-print-agent-code.
  - Added single-line git SHA annotation tracking to scripts/deploy-gcp.ps1.
  - Verification tallies:
    - pnpm typecheck: 0 errors (PASS)
    - pnpm lint: 0 errors (PASS)
    - pnpm test: 73 test suites passed, 387/387 tests passed (PASS)
    - pnpm build: 69 routes generated with zero errors (PASS)
  - Justification of touched files (git diff --stat review):
    - `docs/prompts/11-invoice-print-agent-code.md`: Saved prompt specifications.
    - `scripts/deploy-gcp.ps1`: Added `--update-annotations="commit-sha=$GIT_SHA"` per Part 0.3.
    - `prisma/schema.prisma` & `prisma/migrations/20261027150000_invoice_print_agent_code/`: Added nullable `agentCode` to `User`, `customerName`, `customerPhone`, `customerAddress`, `agentUserId`, `agentCodeSnapshot` to `Invoice` with composite index `[agentUserId, createdAt]`.
    - `src/lib/number-to-words.ts` & `tests/unit/number-to-words.test.ts`: Added `amountInWords(paise)` supporting Indian number formatting, paise, zero, and lakhs/crores.
    - `src/lib/phone.ts` & `tests/unit/phone.test.ts`: 10-digit Indian mobile number normalization and validation.
    - `src/modules/billing/invoice-view-model.ts`: Single shared invoice view-model builder unifying thermal, demand bill, A5, and ESC/POS render paths.
    - `src/modules/billing/billing.types.ts`, `billing.repository.ts`, `billing.service.ts`: Snapshot persistence, agent snapshot capture upon invoice finalize, walk-in party auto-creation.
    - `src/modules/billing/agent.service.ts` & `tests/unit/agent-service.test.ts`: Agent code generation, invoice reassignment with audit logging, and sales incentive reporting.
    - `src/components/printing/cash-receipt-slip.tsx`: Updated thermal slip (removed CASH header, removed cashier row, added side "GST included", amount in words, dynamic footer).
    - `src/components/printing/a5-invoice.tsx`: New A5 portrait invoice template with pagination and maroon table design.
    - `src/components/printing/demand-bill-credit.tsx` & `thermal-receipt.tsx`: Routed through unified invoice view-model.
    - `src/lib/escpos-invoice.ts` & `tests/unit/escpos.test.ts`: ESC/POS thermal formatting using unified view-model.
    - `src/app/shop/invoices/[id]/print/page.tsx` & `print-viewer.tsx`: Added A5 format selector and rendering.
    - `src/app/shop/invoices/[id]/invoice-detail-client.tsx`: Added A5 action button, customer snapshot rows, and agent badge.
    - `src/modules/crud/crud.registry.ts` & `crud.service.ts`: Agent code validation and uniqueness check in User CRUD.
    - `src/components/crud/crud-data-table.tsx`: Agent code display with missing warning badge for staff roles.
    - `src/modules/settings/settings.types.ts` & `settings.service.ts`: Added `invoicePrintSettings` for footer and agent code display.
    - `src/app/shop/pos/actions.ts` & `pos-client.tsx`: Walk-in customer inputs (Mobile, Name, Address) with auto-lookup and snapshot submission.
    - `src/app/van/billing/actions.ts` & `van-billing-client.tsx`: Walk-in customer inputs and snapshot submission.
    - `src/app/shop/invoices/sample/preview/page.tsx` & `sample-preview-client.tsx`: Staff-only sample preview route for Thermal and A5 with zero DB writes.
    - `src/app/admin/reports/agent-sales/`: Agent Sales & Incentives report with filters, KPIs, leaderboard, drill-down, CSV export, and Admin Reassign modal.
    - `src/config/nav.config.ts`: Added Agent Sales report to navigation.

## Invoice Render Paths Map (Prompt #11 Step 1)
1. HTML Thermal Receipt (80mm/58mm Cash/UPI): src/components/printing/cash-receipt-slip.tsx
2. HTML Demand Bill (Credit with DUES stamp): src/components/printing/demand-bill-credit.tsx
3. HTML GST Thermal Receipt (Detailed tax): src/components/printing/thermal-receipt.tsx
4. HTML GST A4 Invoice: src/components/printing/a4-invoice.tsx
5. HTML A5 Portrait Invoice (New): src/components/printing/a5-invoice.tsx
6. Bluetooth ESC/POS van/shop printer: src/lib/escpos-invoice.ts via src/components/van/bluetooth-printer-modal.tsx
7. Admin/Staff Invoice Detail: src/app/shop/invoices/[id]/invoice-detail-client.tsx
8. Van Bills / Van Spot Billing: src/app/van/bills/van-bills-client.tsx & src/app/van/billing/van-billing-client.tsx
9. Storefront Customer Order Invoice: src/app/store/orders/[id]/invoice/buyer-invoice-viewer.tsx
10. Unified View-Model Builder: src/modules/billing/invoice-view-model.ts (single source of truth for all print/display paths)


## Prompt #12 Session (Receipt Tweaks, Agent Codes, Incentives System, Management Navigation & POS)
- **Status**: Complete & Verified (Gates A, B, C, D, E PASS).
- **Summary of Changes**:
  1. **Receipt & Print Tweaks (Part A)**:
     - Thermal Receipt (`src/components/printing/cash-receipt-slip.tsx` & `src/lib/escpos-invoice.ts`):
       - Logo scaled to 70% width (`max-w-[130px] max-h-12`).
       - Totals line: `Total Pcs : {vm.totals.totalPiecesFormatted}` on left, grand total on right.
       - Directly under totals line: only `GST included` (small font).
       - Customer details: Added `Agent Code : <code_here>` directly under Address row (omitted when invoice has no agent).
     - A5 Invoice (`src/components/printing/a5-invoice.tsx`):
       - GST Tax Breakdown table hidden when `invoicePrintSettings.showGstBreakup` is false (default off).
       - Directly under Round Off, prints only `GST included` (small).
       - Added Agent Code as a dedicated row in Customer Details box under Address.
       - Hidden `(HSN: 0000)` placeholder.
     - Settings: `showAgentCode: true`, `showAgentCodeOnline: false`, `showGstBreakup: false`.
  2. **Agent Codes for All Staff (Part B)**:
     - Idempotent backfill migration `20261027170000_incentive_system_and_agent_backfill` assigning unique `agentCode` (`A001`, `A002`, ...) in order of account creation to every existing staff member who had none.
     - Auto-assign next sequential code `Axxx` in `src/modules/crud/crud.service.ts` whenever a new user is created without one.
     - Uniqueness validation and audit logging on edit.
  3. **Complete Incentive System (Part C)**:
     - PostgreSQL Models: `IncentiveRule`, `IncentivePayout`, `IncentiveEntry` (append-only ledger).
     - Cascade Resolution Precedence: Agent+Product > Agent+Brand > Agent+Category > Product > Brand > Category > Agent Default > Global Default.
     - Triggers: Counter and Van sales credit at invoice immediately; Online/Dispatch orders credit on Handover/Delivery per setting; Credit sales credit on sale; Cancellations & failed deliveries auto-reverse append-only.
     - Admin Screens:
       - Dashboard (`/admin/incentives`): KPI summaries, top agents, channel breakdown, unassigned staff alert.
       - Rules & Simulator (`/admin/incentives/rules`): Rule CRUD and cascade simulator.
       - Audit Ledger (`/admin/incentives/ledger`): Filterable append-only ledger, CSV export, Super Admin manual adjustments.
       - Monthly Statements & Payouts (`/admin/incentives/statements`): Period statements, lock/approve, mark paid (Cash/Bank/UPI), printable statement.
       - Historical Backfill (`/admin/incentives/backfill`): Scan invoices, preview eligible counts and estimated paise, idempotent apply.
       - Settings (`/admin/incentives/settings`): Engine toggle, base, credit triggers, eligible roles.
       - Staff Self-View (`/shop/my-incentives`): Personal earnings, recent sales, payment status.
  4. **Management Navigation & Shell (Part D)**:
     - Consolidated navigation into 12 structured groups including "People" (`/admin/crud/users`, `/admin/incentives/*`, `/shop/my-incentives`).
     - Added 301 permanent redirects in `next.config.mjs` for legacy aliases.
  5. **POS Enhancements (Part E)**:
     - Multi-tab parked carts (hold/resume), split payments (Cash + UPI), change-due calculator, keyboard shortcuts (`F2`, `F3`, `F4`, `F5`, `F9`, `Ctrl+Z`), stock alerts & replenishment, customer lookup, WhatsApp bill sharing link.
- **Verification Summary**:
  - `pnpm typecheck`: 0 errors (PASS).
  - `pnpm lint`: 0 errors (PASS).
  - Target Vitest suites: 5/5 test suites passed, 34/34 tests passed (PASS).
  - Next.js production build: 76/76 static & dynamic routes generated with zero errors (PASS).
  - Git commit: 09dce8209821badd0a14ffc74e1ce57e2ae49d9f merged to main and pushed to origin/main.
  - Cloud Build: d839db14-416d-4903-97fa-6a7ca3833a9d SUCCESS (container digest sha256:23de2099d1c9f764c05a20947c343648215f72879a2e17d75d08783c4bb9a39c).
  - Migration Job: jmd-cart-migrate-85qwp completed successfully on Cloud SQL (applied migration 20261027170000_incentive_system_and_agent_backfill).
  - Cloud Run: Revision jmd-cart-00043-99x serving 100% of traffic with annotation commit-sha=09dce8209821badd0a14ffc74e1ce57e2ae49d9f.
  - Production Smoke Test: scripts/smoke-prod.ts 14 PASS, 0 FAIL.
  - Endpoints & Redirects verified on live production: /admin/staff -> 308 /admin/crud/users, /admin/incentives-report -> 308 /admin/incentives, /admin/reports/agent-incentives -> 308 /admin/incentives. Authenticated paths redirect cleanly to /login.

## Prompt #13 Session (Van Counter Fixes, Warehouse Queue Cleanup, Payment Done/Pending, Role Installable Apps)
- **Status**: Complete & Verified (Gates A, B, C, D, E PASS).
- **Summary of Changes**:
  1. **Van Counter Fixes (Part A)**:
     - `QtyUnitPicker` (`src/components/billing/qty-unit-picker.tsx`): Shared segmented toggle (`Pcs` | `Carton (Peti)`), quantity steppers, live carton/piece breakdown, per-unit price display, and over-stock prevention.
     - Customer details in Van Billing (`src/app/van/billing/van-billing-client.tsx`, `page.tsx`): Prominently surfaces Customer Name, Mobile Number, and Address in header & bill summary, along with Credit Limit, Current Outstanding, and Remaining Credit.
     - Mixed-unit support: Allows adding both Peti and Pcs lines for the same product without cart key collision.
     - Brand cream theme (`src/app/van/layout.tsx`): Updated Van layout from dark slate to brand warm cream (`bg-[#FAF7F2] text-slate-900`) matching shop & print surfaces.
  2. **Warehouse Queue Cleanup (Part B)**:
     - Excluded `InvoiceChannel.VAN` from warehouse queue: Van sales are fulfilled from van load stock and NEVER create warehouse packing or dispatch tasks.
     - Shop invoices filter: Only shop counter invoices containing at least one carton line (`cartons > 0`) enter the warehouse queue. Loose pieces only do not generate warehouse tickets.
     - Line badges: Added "Fulfilled from: Godown" line-level badge on warehouse dispatch board (`src/app/godown/dispatch/dispatch-client.tsx`).
     - Line index idempotency: Added `${lineIdx}` to stock movement idempotency keys (`${validated.idempotencyKey}_sale_${lineIdx}_${line.productId}`) preventing collisions on multi-unit lines.
  3. **Payment Done / Pending for Cash and UPI (Part C)**:
     - Payment status capture: Added `paymentStatus` (`PAID` vs `PENDING`) to `billingService.finalizeInvoice`, `vanInvoiceActionSchema`, and POS `finalizeBillAction`.
     - Validation: When `PENDING` is selected for Cash or UPI, customer Name and 10-digit Mobile Number are mandatory.
     - Invoice View-Model & Prints: Updated `invoice-view-model.ts`, `cash-receipt-slip.tsx`, `a5-invoice.tsx`, and `escpos-invoice.ts` to surface `Payment Pending: ₹X due` only when pending/unpaid.
     - Accounts Module (`src/app/app/accounts/`): Added accounts server action (`receiveInvoicePaymentAction`) and UI to collect pending balances, update invoice payment status to PAID, and record receipts into ledger.
  4. **Shared Shortcuts & Tests (Part D)**:
     - `tests/unit/prompt13-van-warehouse-payment.test.ts`: 14 unit tests covering QtyUnitPicker, mixed units, van/warehouse separation, payment status, pending bill customer validation, and role app routing.
     - Full Vitest suite: 76 test files passed, 414 tests passed (PASS).
  5. **Role-Specific Installable PWA Apps (Part E)**:
     - Host routing: Added `"/app"` and `"/accounts"` to `STAFF_ROUTES` in `src/lib/host-routing.ts` so role apps return 404 on storefront host (`jmdcart.com`) and are served on management host (`management.jmdcart.com`).
     - Dynamic PWA Manifests: Built `/app/[role]/manifest.webmanifest` and `/app/[role]/manifest.json` providing distinct standalone manifests, names, start URLs, and theme colors for `shop`, `godown`, `van`, `delivery`, `accounts`, and `owner`.
     - Role App Shell: Built `/app/layout.tsx` and `role-app-shell.tsx` featuring live sync status bar, bottom navigation, PWA install prompt button, and admin role switcher.
     - Role Dashboards: Created dedicated home dashboards at `/app/shop`, `/app/godown`, `/app/van`, `/app/delivery`, `/app/accounts`, `/app/owner`, and `/app/` router.
- **Verification Summary**:
  - `pnpm typecheck`: 0 errors (PASS).
  - `pnpm lint`: 0 errors (PASS).
  - Target Vitest suites: 76/76 test files passed, 414/414 tests passed (PASS).
  - Next.js production build: All routes compiled with zero errors (PASS).


## Party Import from Tally
- **Status**: Complete & Verified.
- **Summary**:
  - Imported 1660 unique parties directly from client's Tally export with 100% preservation of original names, mobile numbers, and addresses (no values altered or truncated).
  - Filtered out 71 accounting ledger heads (TDS, Bank charges, Cash, Depreciation, etc.).
  - Categorization:
    - 67 Wholesalers (`WHOLESALER`)
    - 809 Retailers (`RETAILER`)
    - 784 Customers (`CUSTOMER`)
  - Migration: `prisma/migrations/20261028150000_import_parties/migration.sql` (additive & idempotent `WHERE NOT EXISTS`).
  - Automated verification: `tests/unit/parties-migration-verify.test.ts` (PASS, 77 test files, 415 tests passed).

### 2026-10-28: Shop POS Carton vs Loose Stock Separation & Warehouse Dispatch Queue
- **Problem:**
  1. In Shop POS (`/shop/pos`), when a product line unit was set to `Carton`, it was comparing against `shopStockQty` (displaying "Shop Stock: X pcs") and throwing shortage errors if shop pieces were insufficient, even when godown carton stock was abundant.
  2. For Shop bills, warehouse packing queue on the Dispatch Board (`/godown/dispatch`) was displaying loose piece items and loose piece counts, confusing godown packing workers since counter customers take loose items directly from shop shelves.
- **Changes:**
  - `src/app/shop/pos/pos-client.tsx`:
    - Decoupled stock sufficiency and shortage calculation by unit: `Carton` checks against `godownStockQty` (`godownCartons`); `Pcs` checks against `shopStockQty`.
    - Badge display updated: when `Carton` is selected, shows `Godown Stock: <X> ctn (<Y> pcs) | Shop: <Z> pcs`. When `Pcs` is selected, shows `Shop Stock: <Z> pcs | Godown: <X> ctn`.
    - "Set to available" and "Adjust all" actions respect unit selection.
    - Real-time pre-flight shortage count and checkout validation check Godown stock for cartons and Shop stock for pieces.
  - `src/modules/billing/billing.service.ts`:
    - For shop sales, carton stock strictly deducts from Godown (`godownLocation.id`), and loose pieces deduct from Shop (`validated.locationId`).
    - Warehouse counter pickup records only full carton quantities (`cartons * packSize`) and 0 loose pieces.
  - `src/app/godown/dispatch/dispatch-client.tsx`:
    - For `sale.channel === "SHOP"`, warehouse queue filters out loose items and displays only carton lines (`qty = cartons * packSize`), showing `📦 <N> Cartons` and 0 loose pieces.
  - Automated tests: `tests/unit/pos-carton-godown-stock.test.ts` added and passed. Production deployed (revision `jmd-cart-00050-kc9`), 29/29 smoke tests passed.

### 2026-10-28: POS Busy-Style Complete Keyboard Workflow & Multi-Unit Options (Pcs, Carton, Dozen, Bag)
- **Problem:**
  1. Pressing `Ctrl+K` on `/shop/pos` was opening the Global Command Palette modal from `management-shell.tsx` instead of focusing the POS Item Search Bar.
  2. In Item Search autocomplete dropdown, cashier could not use `↑` (ArrowUp) and `↓` (ArrowDown) to browse suggestions and press `Enter` to select.
  3. Cashiers had to use a mouse to navigate between Qty, Unit, Rate, and Discount fields.
  4. Unit dropdown only had `Pcs` and `Carton` (Carton/Bag were disabled if packSize <= 1). User requested all 4 units (`Pcs`, `Carton (Crt)`, `Dozen (12)`, `Bag (Beg)`) always selectable with full automated rate, discount, and stock calculation.
  5. Stock Update page needed product weight displayed next to the product name.
- **Changes:**
  - `src/components/layout/management-shell.tsx`:
    - Disabled global `Ctrl+K` command palette when `pathname` starts with `/shop/pos`, letting POS handle `Ctrl+K` for high-speed item search.
  - `src/app/shop/pos/pos-client.tsx`:
    - Added `searchSelectedIndex` state: `ArrowDown` and `ArrowUp` navigate through autocomplete suggestions with auto-scrolling (`scrollIntoView({ block: 'nearest' })`) and amber highlight.
    - Pressing `Enter` in Search Bar selects the highlighted item and immediately focuses the newly created row's `Qty` input with text selected.
    - Busy-style voucher entry flow via `Enter`: Qty (`Enter`) -> Unit (`Enter`) -> Rate (`Enter`) -> Disc % (`Enter`) -> automatically jumps back to Search Bar for the next item. Pressing `Esc` at any step returns focus to Search Bar.
    - Keyboard shortcuts: `F1` or `Ctrl+K` (focus Search Bar), `F2` (Finalize Bill), `F9` (Delete row), `Esc` (Cancel/Return to Search).
    - Unit dropdown updated with all 4 units always selectable: `Pcs`, `Carton (Crt)`, `Dozen (12)`, `Bag (Beg)`.
    - Pricing, stock deduction, and finalization updated to support Dozen (`qty * 12`) and Bag (`qty * packSize`).
  - Production deployed (revision `jmd-cart-00052-qbt`), 29/29 smoke tests passed.

### 2026-10-28: Dozen/Bag Rate Multiplier Fix & Production DB Test Data Purge
- **Dozen Pricing Issue & Resolution:**
  - In `src/app/shop/pos/pos-client.tsx`, when selecting `Dozen (12)`, `updateLineUnit` was dividing `customRatePaise` by packSize instead of multiplying the piece rate by 12, resulting in rate becoming ~₹9.58 against MRP of ₹4,200 (showing 99.8% discount).
  - Fixed `addItemToCart` and `updateLineUnit`: Unit multiplier is strictly defined (`Pcs` = 1, `Dozen` = 12, `Carton` = packSize, `Bag` = packSize).
  - Rate is cleanly calculated as `resolved.unitPricePaise * multiplier` (or scaled proportionally if custom rate).
  - Discount % remains strictly preserved at the natural tier discount (e.g. 14.3% retail discount for piece is identically 14.3% for dozen).
  - Production deployed (revision `jmd-cart-00053-kmw`), 29/29 smoke tests passed.
- **Production Database Test Data Cleaned (Cloud SQL):**
  - Invoices & Items: Fully cleared (0)
  - Orders & Items & Packages: Fully cleared (0)
  - Carts & Items: Fully cleared (0)
  - Credit Notes & Debit Notes: Fully cleared (0)
  - Stock Movements: Fully cleared (0, trigger `trg_stock_movements_immutable` safely restored)
  - Physical Stock Balances: All locations (Godown, Shop, Vans) reset to 0
  - Van Operations (van_days, van_day_lines, cash_handovers): Fully cleared (0)
  - Counter Pickups: Fully cleared (0)
  - Payments: Fully cleared (0)
  - Party Ledgers (`ledger_entries`): Fully cleared (0, all party balances reset to ₹0.00)
  - Invoice & Order Sequences (`sequences`): Reset to 1 (Next invoice: `INV/26-27/000001`, Next order: `ORD/26-27/000001`)
  - Preserved intact: 950 Catalog Products, 1702 Parties, 31 Companies, 4 Locations, Users and system configuration.

### 2026-10-29: Prompt #14 — Management Panel Redesign (Stitch Direction A), Simplified Van App, POS Upgrades & Busy-Style Keyboard Flow

- **Executive Summary:**
  - Implemented Prompt #14 delivering:
    1. Redesigned Management Theme (Direction A: "Executive Slate Precision") with scoped tokens under `[data-app="management"]` and responsive density modes (comfortable/compact). Storefront (`jmdcart.com`) remains pixel-identical and isolated.
    2. Role-specific Sidebar Clean-up: Admin navigation consolidated into exactly 8 top-level groups (`Dashboard`, `Sales`, `Orders & Dispatch`, `Inventory`, `Catalog`, `Parties`, `Accounts & Reports`, `Settings & People`). Non-admin roles capped at ≤6 operational items (Shop: 6, Godown: 6, Van: 6, Delivery: 2, Accounts: 6). Zero 404s verified across all roles.
    3. Drastically Simplified Van App: Redesigned `/van` dashboard with bold high-contrast KPIs (Today's Sales, Cash in Hand, Available Stock, Pending Deliveries) and 3 HUGE primary buttons: `1. 🛒 NEW SALE`, `2. 📦 MY STOCK`, `3. 🏁 END OF DAY`. Redesigned `/van/billing` with visible 3-step stepper (`1. Customer` -> `2. Items & Units` -> `3. Tender & Print`) and multi-unit selector (`QtyUnitPicker`) supporting Dozen and Bag.
    4. POS Upgrades from Owner Handwritten Note:
       - Customer Party Card displaying Name, Phone, Address, and direct Edit button.
       - Party Name/Contact Modification: Cashiers (`SHOP`), Van Salespeople (`SALESPERSON`), `ACCOUNTS`, `ADMIN`, and `SUPER_ADMIN` can edit customer details with audit history tracked in `PartyNameHistory`.
       - Line MRP & Rate Edit: Line MRP is now an editable field for all customer tiers. Changing MRP recalculates Disc %; changing Rate recalculates Disc %; changing Disc % recalculates Rate. Admin has a "Master" checkbox (`updateMasterMrp`) to sync edited MRP back to the product master.
       - Busy-Style Keyboard Billing: `Ctrl+K` exclusively focuses POS product search without shell popup interference; `ArrowDown`/`ArrowUp` navigates suggestions; `Enter` adds item and tabs into `qty` -> `unit` -> `mrp` -> `rate` -> `disc` -> `Enter` jumps directly to search next item.
       - Multi-unit options: Full support for `Dozen` (12 pcs) and `Bag` (`bagSize`) for ₹1–₹100 items with live rate calculation based on piece discount.
       - Product weight badge displayed next to product short code/name in POS lines and search.

- **Git Diff --stat Justification:**
  - `prisma/schema.prisma`: Added `weightValue`, `weightUnit`, `bagSize` to `Product`; added `PartyNameHistory` audit table; added `unitLabel`, `originalMrpPaise`, `mrpOverridden`, `rateOverridden` to `InvoiceItem`.
  - `prisma/migrations/20261029190000_party_history_units_weight/migration.sql`: Additive database migration.
  - `src/app/globals.css`: Added CSS variables for Executive Slate Precision theme under `[data-app="management"]` with density variants.
  - `src/components/layout/management-shell.tsx`: Scoped shell with `data-app="management"` and `data-density`, added density switcher pill, bypassed global `Ctrl+K` on `/shop/pos`.
  - `src/config/nav.config.ts`: Streamlined admin navigation to 8 groups and enforced ≤6 items for non-admin roles.
  - `src/modules/billing/billing.types.ts`: Extended invoice item input schema with unit label and MRP override metadata.
  - `src/modules/billing/billing.service.ts`: Handled invoice item creation with unit override metadata and optional admin master MRP sync.
  - `src/app/shop/pos/actions.ts`: Added `updatePartyNameAndContactAction` recording name history.
  - `src/app/shop/pos/pos-client.tsx`: Implemented Party card, edit modal, editable line MRP/rate with Enter key flow, product weight badge, and Dozen/Bag units.
  - `src/components/billing/qty-unit-picker.tsx`: Added Dozen (12 pcs) and Bag options.
  - `src/app/van/page.tsx`: Transformed van home into 4 big bold KPI cards + 3 HUGE touch buttons.
  - `src/app/van/billing/van-billing-client.tsx`: Added 3-step sale workflow header and integrated Dozen/Bag units.
  - `tests/integration/nav-routes.test.ts`: Verified zero broken routes and enforced nav group limits.
  - `tests/unit/prompt14-pos-van-upgrades.test.ts`: Added unit test suite covering party history, unit multipliers, and MRP overrides.

- **Verification & Proof Layer:**
  - `pnpm typecheck`: Passed with 0 errors.
  - `pnpm lint`: Passed with 0 errors.
  - Vitest test suite: 81 test files, 437 tests passed (100% green).
  - Next.js production build (`pnpm build`): Compiled successfully across 83 static & dynamic routes.
  - Storefront Isolation: Verified `jmdcart.com` routes and styling remain untouched and pixel-identical.

  - Production Deployment: Cloud Run revision `jmd-cart-00055-4kx` deployed with 100% traffic; Cloud SQL migration `20261029190000_party_history_units_weight` applied; all 29/29 production smoke tests passed against `https://management.jmdcart.com` and `https://jmdcart.com`.

### 2026-10-30: POS Inline Party Editing Strip & Van Sales App Stepped UI Redesign (Morning Stock Only)

- **User Feedback & Request:**
  1. **POS Party Edit:** Removed the separate edit modal/pill. When a party is selected, an inline details strip appears directly below the party selector with editable Name, Phone, and Address inputs and an instant "💾 Save" button. Saving immediately updates the party in the database (`PartyNameHistory` audit), updates the local party state, and allows pressing Enter to advance focus straight into the item search bar for pure keyboard billing.
  2. **Van App Workflow & Redesign:**
     - **Step 1: Customer Selection:** Salesperson chooses between a Registered Shop/Party (with live balance, credit limit, and inline name/phone/address editor) or Walk-in Cash Customer (10-digit mobile auto-lookup).
     - **Step 2: Morning Load Stock Only:** Strictly filters products to those dispatched in today's active morning load sheet (`stockSummary.activeVanDay.lines`) with available stock > 0. Displays morning load count, available cartons and pieces, weight badges, and `QtyUnitPicker` (`Pcs`, `Carton`, `Dozen`, `Bag`).
     - **Step 3: Payment Mode & Finalize:** Big visual cards for Cash, UPI, and Credit (with remaining credit limit), payment received/pending toggle, giant Grand Total display, and one-tap finalization with Bluetooth thermal receipt printing.
- **Verification:**
  - `pnpm typecheck`: Passed with 0 errors.
  - `pnpm lint`: Passed with 0 errors.
  - Vitest test suite: 81 test files, 437 tests passed (100% green).
  - Next.js production build (`pnpm build`): Compiled successfully across 83 static & dynamic routes.
