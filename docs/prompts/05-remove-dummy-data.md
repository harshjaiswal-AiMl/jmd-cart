# 05 Remove dummy data, empty start, first-run and stock entry (paste into Claude Code)

Use this if any code or database already contains sample or fake data (products, stock, orders, bills, parties, users, demo charts). Goal: the system starts completely empty, the owner sets everything up from the dashboard, and stock can be entered without a GRN.

## Step A: Read
`CLAUDE.md`, `docs/rules.md` ("No dummy data"), `docs/architecture.md` sections 3, 14, `docs/design.md` section 10, `docs/prd.md` (US-0, US-2a), `docs/tasks.md`. Then **search the whole repo** for dummy data: seed files, fixtures used outside tests, hardcoded arrays of products/orders/bills/users, mock API responses, placeholder charts or numbers, lorem ipsum, default passwords, "demo", "sample", "dummy", "fake", "test@" strings. Produce an inventory (file, what it contains, where it is used). Do not delete anything yet.

## Step B: Plan mode, no changes
Plan the cleanup and the new features in small steps, each leaving the app running: files, how I verify (exact command and expected result), size S/M/L. Flag migrations and anything touching auth or the ledger for my sign-off. Stop and wait for "go".

## Step C: Execute one step per "go"
1. **Strip seeds**: `db:seed` keeps reference data only (roles, permissions, locations Godown/Shop/Van 1/Van 2, default settings, invoice sequence, empty business details). Remove all sample products, stock, parties, orders, invoices and users from seeds, fixtures and code paths.
2. **Move test data**: factories and fixtures live only under `tests/` and run against an isolated test database created and destroyed per run. Verify the app database is never touched by tests.
3. **Reset script**: `pnpm db:reset` drops, migrates and runs the reference seed. Do **not** write DELETE scripts against the immutable ledger. Show that after `db:reset` every business table (products, stock_movements, stock_balances, invoices, orders, parties, purchases) has zero rows and only reference tables are populated.
4. **First-run setup**: `/setup` route (shown only while zero `SUPER_ADMIN` users exist) + `pnpm admin:create` CLI. Creates the owner with a chosen password and business details, then permanently locks `/setup`. Remove any hardcoded default passwords.
5. **Owner dashboard**: real values only (`0` / `₹0` when empty), **Getting Started** checklist (7 steps driven by real counts: business details, companies/categories, products, price slabs, stock, credit parties, staff), and a **Quick Actions** bar (`+ Product`, `Import products`, `Update stock`, `+ GRN`, `+ Party`).
6. **Add Product + clean Import**: single-product form (creates company/category inline, HSN, GST %, MRP, pack size, optional opening stock) and Excel/CSV import with downloadable blank template and row errors.
7. **Update Stock without GRN (`/godown/stock/update`)**: 4 tabs — **Opening stock**, **Stock count (set quantity)**, **Adjust (+/-)**, **Excel upload with preview**. Accepts cartons and/or loose pieces (converts using `packSize`), requires location and reason, posts `OPENING_STOCK` or `ADJUSTMENT` via `stock.postMovement()`, writes audit log, rejects negative results.
8. **Empty states everywhere**: every list, report and the storefront (`jmdcart.com`) renders a clean empty state with the next action when data is zero.
9. **Guard test**: add a test that fails if `db:seed` inserts any row into `products`, `stock_movements`, `stock_balances`, `invoices`, `orders`, `parties`, or `users`, plus E2E for first-run setup -> add product -> enter opening stock -> see it on `jmdcart.com`.
10. Update `tasks.md` and `memory.md`.
