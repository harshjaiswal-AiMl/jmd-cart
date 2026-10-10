# 01 Phase 1: Core (paste into Claude Code)

Build Phase 1 of IDMS: auth, catalogue, stock ledger, godown, shop POS, GST invoices. Local-first; no third-party services. Target: working demo for the client at the end.

## Step A: Read
`CLAUDE.md`, `docs/memory.md`, `docs/rules.md`, `docs/prd.md` (section 6), `docs/architecture.md`, `docs/design.md`, `docs/tasks.md` (Phase 1). Summarise each in 2 lines. List conflicts or questions. Do not invent business rules.

## Step B: Plan mode, no code
Plan tasks 1.1 to 1.16. For each step: files touched, change, how I verify (exact command and expected result), size S/M/L, migration or new dependency flag, rollback for risky steps. Riskiest first: stock ledger (1.6), invoice numbering and GST (1.11), concurrency. For any real trade-off give 2 options and pick one in 3 lines. List what you cannot verify (real thermal printer, real Android phone). Then STOP and wait for "go".

## Step C: Execute one step per "go"
For each step: state files to touch; implement exactly per docs (if reality forces a deviation, stop and propose the doc change); write the tests in the same step; run `pnpm typecheck && pnpm lint && pnpm test` and show real output; update `docs/tasks.md` and `docs/memory.md`; propose commits and make them one at a time.

## Suggested order
1. Prisma schema for Phase 1 tables (`docs/architecture.md` section 4), migration, seed (roles, locations Godown/Shop/Van 1/Van 2, sample products, one dev user per role).
2. Auth: staff accounts created by Super Admin, forced password change on first login, Auth.js credentials, role in session, permission map, route/action guards, lockout, audit log service, 403 tests for every role. Verification adapters from architecture section 12 (admin mode default).
3. Settings module (business details, discount limits, slabs).
4. Catalogue: companies, categories, products CRUD, search by name/company/short code, indexes.
5. Excel import with row-level errors and idempotent re-run (900-row fixture).
6. **Stock ledger**: `postMovement()`, balances in the same transaction, `CHECK qty >= 0`, row locks, idempotency key, trigger blocking UPDATE/DELETE on movements, consistency-check function. Tests: every movement type, negative stock rejected, two parallel sales on the last unit, replayed key.
7. Purchase/GRN.
8. Godown: transfer, carton break, damage, adjustment, stock audit, stock views, product history.
9. Pricing engine (slabs, buyer tag, order discount) with edge tests.
10. GST calculation, invoice numbering (locked sequence, FY April-March), finalize and cancel (credit note + counter-movements). Heavy tests.
11. Shop POS per `docs/design.md` (search-first, hold/resume, split payments, discount limit with owner approval).
12. A4 and 80mm print templates.
13. Basic reports (stock, low stock, daily sales, day-end cash).
14. Playwright E2E: login per role, import, receive stock, transfer, carton break, POS sale, admin cancel.
15. Security checklist on what exists; write the client demo script.

## Constraints
No Phase 2 or 3 features. Create only Phase 1 tables (keep `branch_id`). Pieces for quantity, paise for money, English UI, IST display. Never mark a step done without running it and showing output.

Begin with Step A.
