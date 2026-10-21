# Rules: IDMS

Short imperatives for humans and AI agents. If a rule blocks you, stop and ask. Do not work around it.

## Never without asking the owner (Harsh)
- Change auth, roles, permissions or session logic.
- Write or edit a migration that drops or rewrites data.
- Touch anything that posts money or stock outside the approved services.
- Add a dependency, a paid service, or a new third-party integration.
- Change the invoice number format or GST calculation.
- Deviate from `prd.md` or `architecture.md`. Update the doc first, get approval, then code.

## Stock and money (highest risk)
- Change stock only through `stock.postMovement()`. Never write to `stock_balances` or `stock_movements` directly elsewhere.
- Never UPDATE or DELETE a stock movement. Fix mistakes with a counter-movement.
- Store money as integer paise. No floats for money, tax or discounts. Percentages are basis points (integers).
- Compute tax in one place: `lib/gst.ts`. Compute prices in one place: `modules/pricing`.
- Finalized invoices are immutable. Cancel via credit note, Admin only, with reason.
- Invoice numbers come only from the locked sequence at finalization. No gaps, no manual numbers.
- Every stock/money mutation runs in one DB transaction and carries an `idempotencyKey` where retries are possible.
- Negative stock is impossible. Do not add overrides.

## Security
- Check permissions on the server in every action and route. Never rely on hidden buttons.
- Validate all input with Zod at the boundary. Use Prisma or parameterized SQL only.
- Never hardcode secrets. Use env vars and keep `.env.example` current. Never commit `.env`.
- Write an audit log row for every create/update/delete on prices, slabs, discounts, users, settings, invoices, stock and credit limits.
- Log no passwords, tokens or full phone numbers.

## Code
- TypeScript strict. No `any` without a comment explaining why.
- Layers: route/action -> service -> repository -> Prisma. Components never call Prisma.
- Raw SQL only inside repositories, only for locking or performance, always parameterized.
- Business logic goes in `modules/*`, not in components or route files.
- Name things in business language: `invoice`, `party`, `carton break`, `van issue`.
- Keep functions small and files focused. No dead code, no commented-out blocks, no TODOs without an entry in `tasks.md`.
- Dates stored in UTC, shown in IST (`Asia/Kolkata`). Currency shown as `Rs`/rupee symbol with Indian grouping (`en-IN`).
- All user-facing text in English.

## Database
- One migration per logical change, with a short rollback note in its header.
- Every table has `branch_id` (default 1), timestamps and `created_by` where users act.
- Add indexes for known hot queries (product search, stock by location, invoices by date/party).
- Use constraints (`CHECK`, `UNIQUE`, FKs) rather than trusting code alone.

## Portability and local-first
- Everything must run locally with `docker compose up -d` and `pnpm dev`. No cloud account may be required to develop or test.
- No third-party SaaS or hosting-specific SDKs in the code. Third-party-capable features go behind the interfaces in `architecture.md` section 11, with a local implementation.
- Config only through env vars, validated in `src/lib/env.ts`. No hardcoded hosts, keys or paths.
- Standard PostgreSQL only. Migrations run via an explicit command, never on app boot.
- Scheduled jobs are CLI scripts or HTTP-triggered handlers. No in-process schedulers.
- Keep the Dockerfile and `/api/health` working at all times.
- Verification codes, tokens and sessions are our own logic: random, hashed at rest, expiring, rate limited, single use.
- Never use public tunnels or put real client data on a machine without the owner's approval.

## Testing (required, not optional)
- Unit tests for: GST calc, slab pricing, buyer tagging, rounding, invoice numbering, carton break maths.
- Integration tests for: every movement type, negative-stock rejection, concurrent sale on last unit, idempotent replay, invoice finalize and cancel.
- E2E (Playwright) for: login by role, import products, receive stock, transfer, POS sale and print preview.
- A feature is not done until its tests pass and `pnpm typecheck && pnpm lint && pnpm test` are green.

## No dummy data (empty start)
- **Never commit or seed fake business data.** No sample products, stock balances, parties, orders, invoices, payments, charts with hardcoded numbers, or demo accounts with default passwords in any app database or UI component.
- **`db:seed` is reference-only**: roles, permissions, the four location shells (`Godown`, `Shop`, `Van 1`, `Van 2`), default settings, the invoice sequence row, and an empty `business_details` row. Nothing else.
- **First-run creates the owner**: the first Super Admin is created via `/setup` (shown only when zero `SUPER_ADMIN` users exist) or `pnpm admin:create` (interactive prompt). Never hardcode a default password.
- **Test fixtures stay in `tests/`** and run against an isolated test database created and destroyed per test run.
- **Empty states are real**: when a table has zero rows, show `0` and a clear call-to-action ("Add your first product", "Import from Excel", "Enter opening stock") — never fake rows or placeholder charts.
- **Stock entry without a GRN is supported**: opening stock, stock counts, adjustments, and instant 1-step Excel stock uploads (`/godown/stock/update`) go through the stock ledger with a required reason, `batchId`, and full batch undo support (posting reversal ledger rows, never deleting movements).
- **A/B/C Price Lists & Public Privacy**: `resolvePrice(product, buyerType)` is the single shared resolver (`A` = Wholesaler, `B` = Retailer, `C` = Customer/walk-in/anonymous). Anonymous and unapproved storefront visitors see `C` only; never expose `priceAPaise` or `priceBPaise` in public storefront responses.
- **Delete vs Archive/Void Policy**: Records with history or foreign-key references (products with movements, companies with products, invoices, orders, purchases, receipts, payments) are **never hard-deleted** — they are either **Archived** (`active = false`, restorable by Admin) or **Voided/Cancelled** with a mandatory reason and reversing stock movements.

## UI
- Follow `design.md`. Every screen has loading, empty, error and success states.
- All management screens share `ManagementShell` driven by `src/config/nav.config.ts` (zero orphan pages, zero 404 links).
- POS and van screens work with large touch targets and are keyboard-friendly on desktop.
- No barcode scanner dependency. Search-first.

## Workflow
- Plan first for any task touching more than one file. Work in small steps, each leaving the app compiling and running.
- Conventional commits: `type(scope): subject` under 50 chars, imperative. Never mix refactor and behavior change.
- One feature = one branch. Show the diff plan before committing.
- After each step: update `tasks.md` (tick the box) and add decisions or gotchas to `memory.md`.
- Never claim something works without running it. Show the command and output.
- If unsure about a business rule, ask. Do not invent it.
