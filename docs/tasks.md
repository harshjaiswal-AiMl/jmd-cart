# Tasks and Progress: IDMS

Final delivery: **15 Nov 2026**. Internal schedule below is a proposal; adjust as inputs arrive. Tick a box only when the work is done AND tests pass.
Legend: S = under half a day, M = about a day, L = 2+ days.

## Phase 0: Setup and inputs (9-12 Oct)
- [ ] Contract signed by both parties; blanks filled
- [ ] Client inputs requested (Tally product list with HSN/MRP/pack size; credit parties + outstanding; business details, GSTIN, FSSAI, logo)
- [ ] Hosting decision parked until before Phase 4 (see architecture section 10)
- [ ] CA asked about e-invoice/e-way bill and GSP
- [x] Repo created, pnpm + Next.js + TypeScript + Tailwind + shadcn scaffolded (S)
- [x] `docker-compose.yml` (Postgres + Mailpit), `.env.example`, env validation, Prisma wired (S)
- [x] Dockerfile + `/api/health` + `db:backup`/`db:restore` scripts (S)
- [ ] Local HTTPS for phone testing (`dev:lan` with mkcert) (S)
- [x] Hooks and commit conventions set up (S)
- [ ] CI: typecheck, lint, test (S)
- [x] `CLAUDE.md` + these docs committed in `docs/` (S)

## Phase 1: Core (13-24 Oct)
- [ ] 1.1 Prisma schema + first migration + seed (roles, locations, sample products) (M)
- [ ] 1.2 Auth + RBAC + permission map + audit log service (M)
- [ ] 1.3 Settings module (business details, discount limits, slabs) (S)
- [ ] 1.4 Product master CRUD, companies, categories, search (M)
- [ ] 1.5 Excel import with row errors and idempotent re-run (M)
- [x] 1.6 **Stock ledger service** + DB trigger blocking edits + balances + tests (L)
- [ ] 1.7 Purchase/GRN screens (M)
- [ ] 1.8 Godown: transfer, carton break, damage, adjustment, stock audit (L)
- [ ] 1.9 Stock views by location + product history (S)
- [ ] 1.10 Pricing engine (slabs, buyer tag, order discount) + tests (M)
- [ ] 1.11 GST calc + invoice numbering + finalize/cancel + tests (L)
- [ ] 1.12 Shop POS (search-first, hold/resume, payments) (L)
- [ ] 1.13 A4 + 80mm print templates; test on real printer (M)
- [ ] 1.14 Basic reports (stock, low stock, daily sales, day-end cash) (M)
- [ ] 1.15 E2E: login by role, import, receive, transfer, POS sale (M)
- [ ] 1.16 Demo to client; collect feedback (S)

## Phase 2: Van and credit (25 Oct - 3 Nov)
- [ ] 2.1 Parties import from Tally (credit-enabled flag, limit, days, opening outstanding) (M)
- [ ] 2.2 Van locations and van issue sheet (M)
- [ ] 2.3 Van PWA shell, install, role routing (M)
- [ ] 2.4 Van billing + local draft on network loss + idempotent finalize (L)
- [ ] 2.5 Bluetooth ESC/POS print; test on real printer and phones (L)
- [ ] 2.6 Collections and party ledger (M)
- [ ] 2.7 Credit limit enforcement + owner override (S)
- [ ] 2.8 Evening return, reconciliation, shortage/excess (M)
- [ ] 2.9 Cash handover confirmed by owner (S)
- [ ] 2.10 Outstanding and ageing reports (S)
- [ ] 2.11 Return to company + stock-wise report + debit note (M)
- [ ] 2.12 Demo; collect feedback (S)

## Phase 3: Ecommerce and delivery (4-12 Nov)
- [ ] 3.1 Buyer signup/login with phone + password; verification mode setting (admin default, sms adapter off) (M)
- [ ] 3.2 Storefront catalogue, search, product page (M)
- [ ] 3.3 Cart with live slab price and buyer tag (M)
- [ ] 3.4 Delivery zones, charges and thresholds (admin-editable) (M)
- [ ] 3.5 Checkout and order creation with stock reservation (L)
- [ ] 3.6 Admin orders, confirm, split pick lists (shop loose / godown packs) (L)
- [ ] 3.7 One invoice per order; assign delivery; delivery app; payment collected (L)
- [ ] 3.8 Order tracking, reorder, invoice download (M)
- [ ] 3.9 Payment-mode switch (gateway off by default) (S)

## Phase 4: Polish and release (13-15 Nov)
- [ ] 4.1 Owner dashboard (S)
- [ ] 4.2 GST reports, day book, registers (M)
- [ ] 4.3 Tally export (M)
- [ ] 4.4 E-invoice adapter wired (no-op until GSP credentials) (S)
- [ ] 4.5 Security pass (use prompt 09 from the prompts pack) (M)
- [ ] 4.6 Backup + restore test on prod (S)
- [ ] 4.6a Choose hosting with the owner and client; open accounts in client's name (S)
- [ ] 4.7 Dockerized production deploy on the chosen host; migrations, cron/jobs, SMTP, domain, SSL (M)
- [ ] 4.8 Staff training + one-page guides per role (M)
- [ ] 4.9 **Delivery on 15 Nov**; start 2-3 week parallel run

## After delivery
- [ ] Warranty (30 days from live use or 21 days after delivery) then AMC start
- [ ] Saharsa district delivery; batch/expiry (if client wants); online payment gateway; WhatsApp invoices

## Blockers and risks
- Schedule is tight for the full scope. If behind at the end of Phase 1, cut order: Tally export polish, dashboard, storefront extras. Never cut ledger tests or backups.
- Client inputs late = delivery date moves (contract clause 7.3). Send reminders in writing.
- Real printer and phone testing cannot be done by AI; schedule time for it.

## Progress log
(Append one line per working session: date, what finished, what is next.)
- 2026-10-09: Scaffolding complete (Next.js 14 App Router, TypeScript strict, Tailwind, PostgreSQL native 16.4 cluster, env validation, /api/health, backup/restore scripts, Vitest).
- 2026-10-09: Step 2 complete. Core ledger schema and migration applied. Invariants verified via integration tests: CHECK (qty >= 0) blocks negative balances, and DB trigger blocks UPDATE/DELETE on stock_movements.
- 2026-10-09: Step 3 complete ([RISK 1] Stock Ledger Engine & Concurrency). Implemented stock.postMovement() with deterministic row locking (FOR UPDATE), idempotency key deduplication, all 10 movement types, and nightly audit function. Integration and concurrency tests passing (parallel racing for last unit cleanly serialized). Next is Step 4: [RISK 2] GST Engine & FY Invoice Numbering Sequence Lock.

