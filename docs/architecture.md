# Architecture: IDMS

How we build it. WHAT is in `prd.md`; non-negotiables in `rules.md`.
Defaults below are decisions unless marked **(verify)**. Pin exact versions when scaffolding. Development is local-first; hosting is decided later (see sections 9 and 10).

## 1. Stack
| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) everywhere | One language, best agent support |
| Web app | Next.js (App Router) | Admin, POS, van PWA and storefront in one app |
| UI | Tailwind CSS + shadcn/ui | Fast, consistent components |
| DB | PostgreSQL | Transactions, row locks, constraints for stock/billing |
| ORM/migrations | Prisma; raw SQL (`$queryRaw`) only inside repositories for locks | Typed, reversible migrations |
| Validation | Zod at every boundary | Input safety |
| Auth | Auth.js credentials (phone/username + password), JWT session carrying role **(verify current stable)** | Simple RBAC, no external identity service |
| Passwords | argon2 or bcrypt | Standard |
| Tests | Vitest (unit/integration), Playwright (E2E) | Ledger and money flows |
| Package manager | pnpm | Speed |
| Printing | Browser print with A4 and 80mm CSS (Phase 1); ESC/POS over Web Bluetooth for vans (Phase 2; needs HTTPS or localhost) | No native app |
| Excel | exceljs or xlsx | Product/party import |
| Runtime and hosting | **Undecided. Build and run locally first.** Everything runs from Docker Compose (Postgres + Mailpit) plus `pnpm dev`; production is a standard Docker image so any host works later | Keeps hosting a late, cheap decision |

## 2. High-level
Single deployable Next.js app + Postgres. Server Actions / route handlers call **services**; services call **repositories**; only repositories touch Prisma. The stock service is the only code allowed to change stock.

```
src/
  app/                      # routes by area
    (auth)/login
    admin/                  # super admin
    godown/                 # godown module
    shop/                   # POS
    van/                    # van PWA (Phase 2)
    store/                  # ecommerce (Phase 3)
    accounts/               # ledgers, GST (Phase 2-4)
    api/
  modules/
    stock/                  # ledger service, balances, transfers
    catalog/                # products, companies, categories, import
    pricing/                # slabs, discounts, buyer tagging
    billing/                # invoices, numbering, GST calc, credit notes
    parties/                # customers, suppliers, credit
    purchase/
    orders/                 # Phase 3
    delivery/               # Phase 3
    accounting/             # vouchers, reports, tally export
    auth/                   # users, roles, permissions
    audit/
  lib/                      # money, dates, gst, format, errors
  components/
prisma/ (schema.prisma, migrations/, seed.ts)
tests/ (unit, integration, e2e)
docs/
```

## 3. Core principle: the stock ledger
- **Unit of account is the piece.** All stock quantities are integers in pieces. Cartons/bags are `pack_size` multiples shown in the UI.
- Stock is never edited. Every change is an **immutable row in `stock_movements`**. A DB trigger blocks UPDATE/DELETE on it. Mistakes are fixed by a counter-movement.
- `stock_balances(product_id, location_id, qty)` is maintained **inside the same transaction** as the movement, with `CHECK (qty >= 0)` and row lock (`SELECT ... FOR UPDATE`) on the balance rows. A nightly job verifies balance = sum of movements.
- Single entry point: `postMovement({type, productId, fromLocationId?, toLocationId?, qty, reference, reason, idempotencyKey, actorId})`. External side is NULL (purchase has no `from`; sale has no `to`).
- Movement types: `PURCHASE_RECEIPT, TRANSFER, CARTON_BREAK, VAN_ISSUE, VAN_RETURN, SALE, SALE_CANCEL, RETURN_TO_COMPANY, DAMAGE, ADJUSTMENT`.
- `CARTON_BREAK`: godown -> shop transfer of `cartons x pack_size` pieces, recorded with the carton count in `meta`.
- Online order fulfilment: for a line of Q pieces with pack size P, default split = `floor(Q/P)*P` from godown, remainder from shop (configurable). One invoice.
- `idempotency_key` is unique, so retried requests (especially van sync) never double-post.

## 4. Data model (key tables and columns)
Money columns are integer **paise** (`*_paise`). Every business table has `branch_id` (default 1), `created_at`, `updated_at`, `created_by`.

**Identity and control**
- `users(id, name, phone, email, password_hash, role, active)`; roles: `SUPER_ADMIN, GODOWN, SHOP, SALESPERSON, DELIVERY, ACCOUNTS, CUSTOMER`.
- `role_permissions` or a static permission map in code (`modules/auth/permissions.ts`); discount limit per role in `settings`.
- `audit_logs(id, actor_id, action, entity, entity_id, before jsonb, after jsonb, ip, at)`.
- `settings(key, value jsonb)`: slabs thresholds, delivery rules, discount limits, invoice prefix, business details.
- `sequences(name, fy, next_value)` for invoice numbers.

**Catalog**
- `companies(id, name)`, `categories(id, name)`.
- `products(id, name, short_code, company_id, category_id, hsn, gst_rate_bp, mrp_paise, pack_size, pack_label, reorder_level, image_url, active)`; `short_code` unique; GST rate in basis points.
- `price_slabs(id, scope, scope_id, buyer_type, min_qty, max_qty, discount_bp, active)`; scope = `GLOBAL|COMPANY|CATEGORY|PRODUCT`; most specific wins.

**Locations and stock**
- `locations(id, branch_id, type[GODOWN|SHOP|VAN], name, assigned_user_id?)`.
- `stock_movements(id, type, product_id, from_location_id?, to_location_id?, qty, reference_type, reference_id, reason, meta jsonb, idempotency_key unique, created_by, created_at)`.
- `stock_balances(product_id, location_id, qty, PK(product_id, location_id))`.
- `stock_audits(id, location_id, status)` and `stock_audit_lines(audit_id, product_id, system_qty, counted_qty)` -> adjustment on approval.

**Parties and credit** (schema now, used in Phase 2)
- `parties(id, type[CUSTOMER|RETAILER|WHOLESALER|SUPPLIER], name, phone, gstin, address, credit_enabled, credit_limit_paise, credit_days, tally_ref)`.
- `ledger_entries(id, party_id, kind[INVOICE|RECEIPT|CREDIT_NOTE|DEBIT_NOTE|OPENING|ADJUSTMENT], debit_paise, credit_paise, reference_type, reference_id, at)`. Outstanding = sum(debit) - sum(credit).

**Purchase**
- `purchases(id, supplier_id, bill_no, bill_date, location_id, total_paise, status)`, `purchase_items(id, purchase_id, product_id, qty, rate_paise, gst_rate_bp)`.
- `company_returns(id, supplier_id, status, reason)`, `company_return_items(...)` -> debit note.

**Billing**
- `invoices(id, number unique, fy, status[DRAFT|FINAL|CANCELLED], channel[SHOP|VAN|ONLINE], location_id, party_id?, buyer_type, subtotal_paise, discount_paise, taxable_paise, cgst_paise, sgst_paise, igst_paise, round_off_paise, total_paise, payment_status, created_by, finalized_at, irn?, qr?)`.
- `invoice_items(id, invoice_id, product_id, qty, mrp_paise, discount_bp, unit_price_paise, taxable_paise, gst_rate_bp, tax_paise, hsn)`.
- `payments(id, invoice_id?, party_id?, mode[CASH|UPI|CARD|CREDIT], amount_paise, received_by, at)`.
- `credit_notes(id, number, invoice_id, reason, total_paise)`.

**Phase 2-3 tables** (create when needed): `van_days`, `van_day_lines`, `cash_handovers`, `orders`, `order_items`, `delivery_zones`, `deliveries`, `carts`.

## 5. Pricing and GST
- MRP is tax-inclusive. Line price = `MRP x (1 - discount_bp/10000)`, rounded half-up to paise per unit. Taxable value = `line_total / (1 + rate)`; tax = line_total - taxable. CGST+SGST for intra-state (Bihar), IGST otherwise. Invoice total rounded to nearest rupee with `round_off_paise` shown. **(verify with client's CA)**
- Slab resolution: find the most specific active slab by (product > category > company > global) matching qty, then apply admin order-level % if any. Buyer tag = tier of matched slabs (default: highest tier among lines). All thresholds read from `price_slabs`/`settings`; none hardcoded.
- Discount over the role limit raises an approval request to SUPER_ADMIN.

## 6. Invoicing
- Number format `INV/<FY>/<6 digits>` e.g. `INV/26-27/000001`; FY runs April to March; counter row locked with `SELECT ... FOR UPDATE` at finalization. One series for shop, van and online.
- Finalize in one DB transaction: assign number, freeze prices, post `SALE` movements, write payments and ledger entries, write audit.
- Finalized invoices are immutable. Cancel = credit note + `SALE_CANCEL` movements, Admin only, with reason.
- Print: server-rendered HTML with `@media print` templates for A4 and 80mm. QR for UPI later. E-invoice (IRN/QR) via GSP adapter behind an interface (`EInvoiceProvider`); a no-op provider is used until credentials exist.

## 7. Van, offline and sync (Phase 2 design)
- Van app is a PWA. Billing requires connectivity to finalize (server assigns the invoice number). On network loss the bill is saved as a **local draft** (IndexedDB) and finalized on reconnect, then printed.
- Every client action carries a client-generated `idempotencyKey`. Server replays are safe.
- Van stock is owned by one user, so conflicts are rare. Server is the source of truth.

## 8. Security
- Server-side permission check on every action/route; UI hiding is cosmetic.
- Zod validation on all input; parameterized queries only; rate limit login and OTP.
- Secrets in env vars; `.env.example` committed, `.env` never.
- Session expiry, lockout after repeated failures, password reset by admin.
- `db:backup` works from day one; before go-live, daily backups with an off-site copy and a tested restore.
- Customer data (phones, addresses) accessible only to roles that need it.

## 9. Local-first development and environments
- **Now: local only.** One machine runs everything. No cloud account, no hosting provider, no third-party service is needed to build Phases 0-4.
- `docker-compose.yml`: `postgres` (named volume), `mailpit` (catches all outgoing email at `localhost:8025`). Optional profile `app` builds the production image to prove portability.
- The app runs with `pnpm dev` on the host. Config comes only from env vars, validated at startup with Zod (`src/lib/env.ts`); the app refuses to start on bad config.
- Scripts: `db:up`, `db:down`, `db:reset` (drop, migrate, seed), `db:backup` (pg_dump to `./backups`), `db:restore`, `dev:lan`.
- **Testing on phones over the local network:** PWA service workers and Web Bluetooth only work on HTTPS or `localhost`. Use `pnpm dev:lan` (bind `0.0.0.0` with local HTTPS via mkcert; verify current Next.js flags) and install the mkcert root CA on test phones. Never use a public tunnel service.
- **Client demos** run from a laptop on the shop Wi-Fi at `https://<laptop-ip>:3000`. Data is fake or a restored backup, never live client data on a developer laptop without the owner's OK.
- Environments later: `local` -> `staging` -> `prod`, all built from the same image with different env vars.
- CI (when added): typecheck, lint, unit/integration tests, migration check, Playwright on main flows.
- Migrations are forward-only in prod with a written rollback note per migration.

## 10. Portability (so hosting can be chosen late)
- **12-factor config**: no hostnames, keys or paths in code. Everything via env vars; `.env.example` is complete.
- **Standard Postgres only.** No provider-specific extensions or services. Connection via `DATABASE_URL`.
- **Dockerfile** (multi-stage, non-root, standalone Next.js output) and a `/api/health` endpoint exist from Phase 0 and are kept working.
- **Migrations run as a separate command** (`pnpm db:migrate:deploy`), never implicitly inside the app on boot.
- **Scheduled jobs** are plain HTTP-triggered or CLI scripts (`pnpm job:<name>`), so any cron (system cron, platform cron) can call them. No in-process schedulers.
- **File storage behind `FileStorage`** (local disk now, S3-compatible later). Product images go through it.
- **No serverless assumptions**: long-lived Node process, one connection pool, no per-request cold-start tricks.
- **Candidates when we pick hosting** (decision later): Indian VPS with Coolify (for example Hostinger Mumbai KVM 2), Railway Pro, DigitalOcean Bangalore, Fly.io Mumbai. Regular shared hosting is not planned; it would force MySQL.

## 11. Integrations behind interfaces (no third-party needed to build)
Principle: **our logic, swappable delivery.** We write all verification logic ourselves; only the final transport is pluggable.
| Interface | Local/default implementation | Real implementation (later, optional) |
|---|---|---|
| `MailProvider` | SMTP via Nodemailer to **Mailpit** | SMTP of the client's domain mailbox |
| `SmsProvider` | `ConsoleSmsProvider`: logs the message and stores it in a dev-only table | DLT-registered SMS gateway adapter, off by default |
| `WhatsAppProvider` | No-op | Optional later |
| `PaymentGateway` | Off | Optional later |
| `EInvoiceProvider` | No-op | GSP adapter once credentials exist |
| `TallyExporter` | File export (XML/CSV) | Same |
| `FileStorage` | Local disk | S3-compatible |

## 12. Identity and verification (our own logic)
- Staff: accounts created by the Super Admin, password set at first login. No OTP needed.
- Buyers: phone number + password. `users.phone` unique; `phone_verified_at` and `email_verified_at` nullable.
- Verification mode is a setting: `off`, `admin` (default; admin confirms by phone call when confirming the first order and marks the phone verified) or `sms` (OTP through `SmsProvider`).
- OTP/token rules: 6 digits, random, stored hashed, 5-minute expiry, max 5 attempts, per-phone and per-IP rate limit, single use. Email verification uses signed, expiring, single-use tokens.
- Password reset: by admin for staff; for buyers via verified phone or email when a provider is enabled, else by admin.
- Login throttling and lockout after repeated failures; all auth events go to the audit log.

## 13. Domains and surface split
One codebase, one database, two hostnames routed by Next.js `middleware.ts` based on the `Host` header (configurable via `STORE_HOST` and `MANAGEMENT_HOST` env vars):
- **`jmdcart.com`** (`STORE_HOST`, default `localhost:3000` in dev): public customer/retailer/wholesaler **storefront is the main homepage (`/`)**. Serves `/`, `/c/*`, `/brand/*`, `/p/*`, `/search`, `/cart`, `/checkout`, `/orders/*`, `/account/*`, `/login`. Any request to `/admin`, `/godown`, `/shop`, `/van`, `/delivery`, `/accounts` on the store host returns `404` (never leaks staff routes).
- **`management.jmdcart.com`** (`MANAGEMENT_HOST`, or `/management` path prefix in local dev when a single host is used): staff portal. Serves `/login` and the role-routed apps: `/admin` (Super Admin), `/godown` (Godown), `/shop` (Shop POS), `/van` (Van PWA), `/delivery` (Delivery PWA), `/accounts` (Accounts). Unauthenticated requests redirect to `/login`.
- Session cookies are scoped per host (`__Host-` in prod over HTTPS) so a buyer session on `jmdcart.com` never grants access on `management.jmdcart.com`.
- Both surfaces read and write the **same PostgreSQL database** through the same services (`stock`, `pricing`, `billing`, `orders`), so stock changes in the godown or on a van reflect on `jmdcart.com` immediately.

## 14. Empty start, seeding and first-run setup
- **Zero dummy data in the app database.** `pnpm db:seed` is idempotent and inserts **reference data only**:
  - Roles & permissions map.
  - Default locations: `Godown` (`type = GODOWN`), `Shop` (`type = SHOP`), `Van 1` (`type = VAN`), `Van 2` (`type = VAN`).
  - Default settings keys (discount limits, slab tier names, verification mode `admin`, delivery charge defaults, auto-convert on) and the `INV` sequence row for the current FY.
  - Empty `business_details` row (trade name `JMD Cart`, other fields blank until the owner fills them in Settings).
  - **Never** seeds products, companies, categories, stock balances, stock movements, parties, orders, invoices, or sample users.
- **First-run bootstrap**:
  - If `users` has zero `SUPER_ADMIN` rows, `management.jmdcart.com` redirects any request to `/setup` (one-time owner creation screen: name, phone, email, password, business details) **or** the operator runs `pnpm admin:create` (interactive CLI that prompts for phone and password — never a hardcoded default password).
  - Once one `SUPER_ADMIN` exists, `/setup` is permanently disabled (`404` / `403`).
- **Test fixtures** live exclusively under `tests/fixtures.ts` and are loaded only against a dedicated test database (`DATABASE_URL` pointing to `idms_test`) inside Vitest / Playwright setup, torn down after the run. They are never imported by `src/` or `prisma/seed.ts`.
- **Entering stock on day 1 (and ongoing)**: the owner or godown keeper can populate stock in three ways, all calling `stockService.postMovement()` with audit logs:
  1. **Direct Opening / Stock Update** (`/godown/stock/update` — single product or bulk table/Excel): posts `OPENING_STOCK` or `ADJUSTMENT` (`STOCK_COUNT`) for a chosen location (`Godown` or `Shop`, cartons + loose pieces) with a mandatory reason, **no supplier GRN required**.
  2. **Purchase / GRN** (`/godown/purchases/new`): when entering a supplier bill.
  3. **Excel import** (`/admin/catalog/import` for products, `/godown/stock/update` CSV/Excel tab for instant stock uploads with batch undo, `/admin/parties/import` for Tally credit parties).

## 15. A/B/C Price Lists, Brand Sheet Importers, Shared Nav Shell & Admin CRUD Registry (Prompt #06)
- **A / B / C Price Lists**:
  - `products` stores `mrp_paise` (nullable), `price_a_paise` (Wholesaler), `price_b_paise` (Retailer), `price_c_paise` (Customer / walk-in / anonymous storefront), `weight`, and `pack_size` (`QTY IN CASE` / `PCS` = pieces per 1 carton).
  - `resolvePrice(product, buyerType)` in `src/modules/pricing/pricing.service.ts` resolves the unit price across Shop POS, Van billing, Online Storefront, and Orders.
  - Quantity-tier slab pricing (`enableQuantityTierPricing`) defaults to `false` in `settings` (`pricing_settings`). When enabled by Admin, the customer gets `min(partyTierPrice, quantitySlabPrice)`.
  - Storefront API and server components strip `priceAPaise` and `priceBPaise` for anonymous and unapproved buyers.
- **Multi-Sheet Brand Catalog & Price Importer (`/admin/catalog/import`)**:
  - Zero-dependency `.xlsx` and `.csv` engine (`src/lib/xlsx.ts`) + `brandSheetImportService` (`src/modules/catalog/import/brand-sheet-import.service.ts`).
  - Auto-detects brand from title rows (ignoring `JAI MATA DI` / `SAHARSA` headers) or sheet tab names (`SALONI`, `DAWAT`, `MDH`), maps `QTY IN CASE` / `PCS` to `packSize`, auto-detects Absolute ₹ vs `% off MRP` (`round_half_up(MRP * (100 - pct) / 100)`), and flags `OK`, `WARNING`, `NEEDS_REVIEW`, `SUSPICIOUS`, and `ERROR` rows with a downloadable multi-sheet `.xlsx` review report.
- **Instant 1-Step Excel Stock Upload & Batch Undo (`/godown/stock/update`)**:
  - Accessible to `SUPER_ADMIN`, `ADMIN`, and `GODOWN` (Warehouse Manager restricted to Godown location on the server).
  - Validates and immediately applies all valid rows in one DB transaction, tagging `StockMovement` rows with `batch_id` (`ImportBatch`).
  - Supports 1-click **Undo this upload** posting exact reversal ledger movements (blocked by negative-stock guard if stock was subsequently consumed; `GODOWN` restricted to own batches within 24h).
- **Shared Management App Shell & `src/config/nav.config.ts`**:
  - Single navigation source of truth (`src/config/nav.config.ts`) with 10 groups (`Dashboard`, `Sales`, `Inventory`, `Van`, `Catalog`, `Parties`, `Delivery`, `Accounts`, `Reports`, `Admin`) rendered by `ManagementShell` (`src/components/layout/management-shell.tsx`).
- **Reusable Admin CRUD Kit (`src/modules/crud/*`)**:
  - Entity registry (`crud.registry.ts`) and service (`crud.service.ts`) powering `/admin/crud` and `/admin/crud/[entity]` across all 19 entities with Archive/Void vs Hard Delete protection and full `AuditLog` coverage.

## 16. Google Cloud Production Deployment (Prompt #07 GCP)
- **Region**: Mumbai (`asia-south1`), Project: `jmd-cart`.
- **Application**: Cloud Run service `jmd-cart` running Next.js standalone container (`node:20-alpine`, non-root `nextjs` user, port 8080).
- **Database**: Cloud SQL PostgreSQL 16 (`jmd-cart-db`, Enterprise edition, `db-g1-small`, SSD 10GB, automated 02:00 UTC backups, 7-day point-in-time recovery, SSL required). Connected via `/cloudsql/jmd-cart:asia-south1:jmd-cart-db` Unix domain socket with a connection limit of 5.
- **Uploads & File Storage**: Cloud Storage bucket `gs://jmd-cart-uploads` mounted directly into Cloud Run container at `/uploads` via Cloud Run second-generation volume mount with versioning and public-access-prevention enforced.
- **Secrets**: Managed in Google Secret Manager (`AUTH_SECRET`, `SETUP_TOKEN`, `DB_PASSWORD`, `DATABASE_URL`) with runtime accessor permissions for `jmd-cart-run@jmd-cart.iam.gserviceaccount.com`. `SETUP_TOKEN` is recorded in git-ignored `.env.deploy`.
- **Networking & Domains**:
  - Global External Application Load Balancer with static IPv4 `136.81.89.67`.
  - Regional Serverless NEG in `asia-south1` routing to `jmd-cart` Cloud Run service.
  - Google-Managed SSL Certificate (`jmd-cart-cert`) securing `jmdcart.com`, `management.jmdcart.com`, and `www.jmdcart.com`.
  - HTTP-to-HTTPS automatic 301 redirect map on port 80.
  - Host-based routing via `src/middleware.ts`: `jmdcart.com` serves the storefront and returns 404 for staff paths; `management.jmdcart.com` serves all staff interfaces with unauthenticated redirect to `/login`; `www.jmdcart.com` redirects permanently to apex.


