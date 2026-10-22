# PROMPT #09 — Fix POS stock display, out-of-stock-last everywhere, brands as GRN suppliers, product images on Cloudflare R2 (looping, self-verifying)

## ROLE
You are the engineer fixing four live problems in JMD Cart (Next.js 14 App Router, Prisma, Postgres, deployed on Google Cloud Run + Cloud SQL, `management.jmdcart.com` and `jmdcart.com`). Find the **root cause** of each before changing code, fix it, prove it with tests and a real run. "Done" means verified on the running app and on production, not "it compiles".

Follow `CLAUDE.md` and `docs/rules.md`. Migrations are **additive only**. Ask once, up front, for approval of new dependencies (Step 1). Management UI keeps its current look; add only what each fix needs. **Never open, print or log `.env`, `.env.deploy` or any secret.**

## STEP 0 — READ FIRST
`CLAUDE.md`, `docs/memory.md`, `tasks.md`, `rules.md`, `docs/storefront.md`, `prisma/schema.prisma`, `src/app/shop/pos/*`, `src/modules/stock/*` (`availability.ts`, `stock.service.ts`, `stock.repository.ts`), `src/modules/billing/*`, `src/modules/purchase/*`, `src/app/godown/purchases/new/*`, `src/modules/party/*`, `src/modules/catalog/*` (including `import/*`), `src/app/api/upload/route.ts`, `src/app/admin/catalog/*`, `src/app/store/*`, `src/modules/store/store.service.ts`, `next.config.mjs`, `src/lib/host-routing.ts`, `Dockerfile`, `scripts/deploy-gcp.ps1`.

## STEP 1 — HUMAN INPUTS (ask ONCE, one message, then continue)
1. **Dependency approval (one batch, yes/no):** `@aws-sdk/client-s3` (Cloudflare R2 is S3-compatible), `sharp` (image re-encode and sizes), optionally `@aws-sdk/s3-request-presigner`. If refused, propose the smallest alternative.
2. **Cloudflare R2.** The human creates or uses a Cloudflare account, enables R2 (a payment method may be required even for the free tier; verify on Cloudflare's pricing page), creates a bucket (suggest `jmdcart-media`, region hint closest to India), and creates an **R2 API token (S3 credentials) limited to that bucket with Object Read & Write**. The agent needs: Account ID, bucket name, Access Key ID, Secret Access Key. These go into Secret Manager and a local git-ignored `.env.deploy`; never into git, logs or chat. Keep the bucket **private**.
3. **Optional later:** moving DNS to Cloudflare to serve images from `cdn.jmdcart.com` (R2 custom domains need the zone on Cloudflare). Not required for this prompt; see Part D.

## ROOT CAUSES ALREADY OBSERVED (verify each, do not assume)
- **POS shows `0 pcs` everywhere:** `src/app/shop/pos/page.tsx` reads stock **only from the SHOP location** (`shopStockQty = stockBalances[0]?.qty ?? 0`), while the owner's stock upload went to the **GODOWN** (the storefront availability reads godown only). POS prices come from `mrpPaise ?? priceCPaise ?? 0`, so unpriced products show ₹0.00. The screenshot also shows junk catalog rows (names like `756.0`, `761.07`, `400ml`, pack sizes like 357830 pcs/Carton, SKUs with numeric tails) that look like Excel columns imported into the wrong fields.
- **GRN supplier dropdown only offers "Direct / Unlisted Supplier":** `purchaseService.getFormData` lists `Party` rows of type `SUPPLIER`, and none exist. The owner's suppliers are the **brands** (rows in `Company`).
- **Uploaded images do not show:** `src/app/api/upload/route.ts` writes files to `public/uploads/products` at runtime. On Cloud Run the filesystem is ephemeral and per-instance, and Next.js production servers do not serve files added to `public/` after build. The route also accepts **SVG** (stored-XSS risk) and trusts the client-supplied MIME type.

---

## PART A — POS (shop billing) shows real stock and real prices

1. Reproduce the zero-stock POS on a test database, then **query the data** to confirm the cause (stock in GODOWN, none in SHOP; or a wrong/duplicate SHOP location; or something else). Report the finding in `docs/memory.md` before fixing.
2. POS product cards show **both**: `Shop: N pcs` and `Godown: N pcs (C cartons)` with a status badge. State clearly at the top "Billing from: Retail Shop". Sellable rules stay as defined by the business: **loose from shop stock (auto-open shop cartons if any), cartons from godown**. Check how `billing.service` already deducts by location and keep that logic; fix the UI/data feeding it, not the accounting rules.
3. When shop stock is zero but the godown has stock: show an inline "Godown has N pcs" hint, allow carton sales from godown per the rules, and give ADMIN/SUPER_ADMIN/GODOWN a one-click link to **Transfer godown → shop** (prefilled). SHOP role sees the message "Ask the godown keeper to transfer stock". Do not silently sell godown stock as loose from the shop.
4. Stock Excel upload already supports choosing a location; make sure the **Retail Shop** location can be selected by admin and verify an upload to it makes POS show the numbers immediately.
5. **Prices:** POS price = `resolvePrice(product, buyerType)` for the selected buyer (walk-in = list C, registered party = their A/B/C). A product with no price for that list shows "Price not set" and cannot be added except through an admin-only manual rate with an audit entry. Never show or bill ₹0.00 silently.
6. **Catalog data-quality report** (new, read-only, in the admin Catalog area): flags numeric/very short names, `packSize` outliers (> 5000 or implausible), missing price (any list), missing brand/category, duplicate names, missing image. Filters, CSV export, and a bulk **Deactivate** action (confirm dialog, audit logged). **Never auto-edit or delete data.** Inactive or unpriced products are excluded from the storefront and POS pickers until fixed.

**Gate A:** tests: POS with stock only in godown, only in shop, in both, in neither; carton and loose sale deduct the right locations; auto-open of shop cartons; price resolution for walk-in/A/B/C; no-price product blocked; data-quality report finds the sample junk rows (fixtures under `tests/` only). Manual run: upload stock to the Retail Shop and see it in POS; screenshot at 1280 px.

---

## PART B — Out-of-stock products always last, everywhere

**Rule:** in any list or picker where items are browsed or sold, products that are out of stock for that context sort **after** all in-stock products, keeping the existing order within each group. An explicit user-chosen sort (clicking a column) overrides this default.

1. Implement **one** helper (`stockRank` SQL fragment/function in `modules/stock/availability.ts`) used by every list. It must run **in the database before pagination** (never client-side after fetching a page), be index-friendly (`stock_balances(product_id, location_id)`), and stay identical to the existing availability definitions: storefront = `godown − reserved − buffer > 0` (same as `getAvailability`); POS = shop pieces > 0 or godown ≥ one carton; van billing = van stock > 0; admin catalogue and admin order creation = total across active locations > 0.
2. **Storefront (all):** catalogue, search results and suggestions, category and brand pages, home shelves, related products, wishlist, order-again/recommendation rails, API responses (`/api/store/*`). Out-of-stock items remain visible with the badge and disabled Add to Cart (existing rule).
3. **Management (product pickers and catalog lists):** POS grid, van billing picker, online-order creation, admin catalogue, price lists. **Excluded on purpose** (zero stock is the point there): GRN/purchase product picker, stock audit, low-stock report, stock movements, godown stock overview. List every list you changed and every one you excluded, with the reason, in `docs/memory.md` so the owner can adjust.
4. Property test: random stock data; `stockRank` matches `getAvailability` for every product. Pagination test: with 35 products at 10 per page, all in-stock items appear before any out-of-stock item **across pages**, stable ordering within groups.

**Gate B:** tests above green; Playwright check on storefront category page and POS showing out-of-stock products at the end; query plan on a 2,000-product dataset stays fast (record timing).

---

## PART C — GRN: brands are the suppliers

1. Additive migration: `Party.companyId` (nullable, unique) linking a supplier party to a brand. **Backfill idempotently:** for every active `Company`, find an existing SUPPLIER party with the same normalized name and link it, otherwise create a SUPPLIER party named exactly as the brand. Never duplicate, never touch ledger history.
2. A single `ensureSupplierParty(company)` used everywhere a company is created or renamed: admin CRUD, `catalog/import`, `brand-sheet-import`, any script. Creating a brand creates/links its supplier party in the same transaction. Renaming a brand renames the linked party only if the party name still equals the old brand name. Deactivating a brand hides its supplier party from pickers; history stays.
3. Tally party import: a supplier ledger whose normalized name matches a brand's party **merges into it** (sets `tallyRef`), no duplicate.
4. GRN form: "Supplier / Company" is a searchable list of **all active brands (suppliers)**, sorted by name, plus the existing "Direct / Unlisted" option. Selecting a brand filters the product picker to that brand's products with an "All products" toggle. Replace the 900-option native product `<select>` with a searchable combobox (name, short code, brand). Keep totals, GST and the posted stock/ledger behavior unchanged.
5. Admin parties list tags linked suppliers as "Brand".

**Gate C:** tests: backfill creates one party per brand and is re-runnable; no duplicates when a Tally supplier matches; creating a company via import creates the party; GRN posts stock and supplier ledger exactly as before for a brand supplier; existing `purchase-grn` tests still pass. Manual: dropdown lists all brands (screenshot).

---

## PART D — Product images on Cloudflare R2

**Design (follow the repo rule "external capabilities behind adapters"):**
- `StorageAdapter` interface (`put`, `get`, `head`, `delete`, `exists`) with `LocalDiskStorage` (dev/tests; writes outside `public/`, e.g. `.local-media/`) and `R2Storage` (S3-compatible client, endpoint `https://<account>.r2.cloudflarestorage.com`, region `auto`). **In production the app must fail fast if R2 is not configured**, never fall back to local disk.
- Env contract (names only, no values): `STORAGE_DRIVER`, `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `MEDIA_BASE_URL` (optional CDN origin). Secrets in Secret Manager, wired into the Cloud Run service via the existing deploy script; add the names to `.env.example`.
- **Database stores object keys**, not absolute URLs. One helper `mediaUrl(key, size?)` builds the public URL: `MEDIA_BASE_URL/<key>` when set, otherwise the same-origin route `/media/<key>`. Switching to a CDN domain later is config-only.
- **`GET /media/[...key]`** public route (allowed on both hosts via `isStaticOrPublicAsset`): validates the key against a strict pattern (no traversal), streams the object from storage, sends the stored content type, `ETag`, and `Cache-Control: public, max-age=31536000, immutable`; 404 for missing keys.

**Upload pipeline (`POST /api/upload`, roles ADMIN, SUPER_ADMIN, GODOWN as today):**
1. Verify the file by **magic bytes**, not the client MIME. Accept JPEG, PNG, WebP (and GIF as a still). **Reject SVG** and anything else. Max input 10 MB, max 8000×8000 px (decompression-bomb guard). Per-user rate limit.
2. Re-encode with `sharp`: strip EXIF/metadata, auto-orient, produce **WebP at 400, 800, 1200 px** (never upscale), plus the original-ratio 1:1-friendly version without cropping.
3. Keys are **content-hash based** (`products/<hash>/<size>.webp`) so identical uploads dedupe and URLs are cache-safe. Return `{ key, url, variants[] }`.
4. Deleting an image removes objects only when no product row references the key.
5. Admin product image UI (catalog list and the "Re-upload / Change Photo" modal): preview updates immediately after upload, shows the new thumbnail in the table, supports replace and clear, and shows a neutral placeholder component on any load error (never the raw alt text like "Product preview"). POS cards, storefront and admin tables all use `mediaUrl` and an `onError` placeholder.
6. Update `next.config.mjs` (`images`/CSP `img-src` for `'self'` and `MEDIA_BASE_URL` host if set), keep `Dockerfile`, `.dockerignore`, `.gcloudignore` free of local upload folders. Keep `/uploads/*` working for legacy rows via a mapper in `mediaUrl`.

**Legacy data:** `scripts/migrate-uploads-to-r2.ts` (dry-run by default, `--apply` to write, refuses unless run intentionally): for each product whose `imageUrl` is `/uploads/products/<file>` and the file exists locally, upload and rewrite to a key; rows whose file is missing are **listed, not guessed**. Missing images appear in the data-quality report from Part A. The owner re-uploads those in the admin UI.

**Tests (use an in-memory/local adapter, no network):** magic-byte rejection (SVG, renamed `.exe`, spoofed MIME), size/dimension limits, EXIF stripped, variants produced and never upscaled, content-hash dedupe, `/media` key traversal blocked, cache headers present, `mediaUrl` with and without `MEDIA_BASE_URL`, production fails fast without R2 config, delete-only-when-unreferenced, legacy mapper.

**Gate D (local):** upload from the admin modal shows the image in the modal, table, POS and storefront; typecheck, lint, tests, build green.

---

## PART E — Deploy and verify on production

1. Create the Cloudflare bucket settings you can (CORS is not needed for the server-side upload path). If you need something only the human can do, print `WAITING_FOR_HUMAN: <exact steps>` and keep going on the rest.
2. Add the R2 secrets to Secret Manager and the Cloud Run service (existing `scripts/deploy-gcp.ps1`), run migrations through the existing migration job (additive only), run the supplier backfill, deploy a new revision, run `scripts/smoke-prod.ts` and extend it: `/media/<known key>` returns 200 with immutable cache headers.
3. **Live checks, with the owner's go-ahead for test data:** upload one test product image on `management.jmdcart.com`, confirm it shows in the admin table, POS and storefront; deploy a **new revision** and confirm the image still loads (this proves it no longer depends on the instance filesystem); then delete the test image. Open POS with stock uploaded to the Retail Shop and confirm numbers. Confirm the GRN supplier dropdown lists all brands. Confirm out-of-stock items sit last on the storefront.
4. Roll back automatically if smoke fails (existing script behavior). The old Google Cloud Storage uploads bucket/mount from the earlier deploy is no longer used: **do not delete it**; list it in the final report so the owner can retire it.
5. Optional, only if the human has moved DNS to Cloudflare: create the R2 custom domain `cdn.jmdcart.com`, set `MEDIA_BASE_URL`, redeploy, recheck. **Before any DNS move, recreate every existing record exactly (A `@`, `management`, `www` → the load balancer IP, as DNS-only/grey cloud) to avoid downtime.** Do not use the `r2.dev` public URL for production.

**Gate E:** production smoke all PASS, image persists across revisions, no secrets in logs or the repo, `db:verify-empty` logic shows no unintended business-data changes.

---

## PART F — Docs
Update in place: `docs/architecture.md` (storage adapter, R2, media route, key scheme), `docs/rules.md` (R2 is an owner-approved external service behind an adapter; SVG uploads banned; production never writes uploads to local disk), `docs/storefront.md` (use `mediaUrl`, OOS-last rule), `docs/design.md`, `docs/tasks.md`, `docs/memory.md` (root causes found, lists changed/excluded for OOS-last, decisions, open items).

## LOOP (follow strictly)
```
for each PART (A → F):
  find root cause → write tests → fix → run: pnpm typecheck; pnpm lint; pnpm test; pnpm build
  → run the app, reproduce the original complaint, confirm it is gone, screenshot at 1280
  → if anything fails: root-cause it, fix, rerun from the top
  → proceed only when the gate is fully green and demonstrated
```
- Never claim success without running the check and reading its output; quote key result lines in `docs/memory.md`.
- Never weaken or delete a failing test. Never disable auth, validation or headers to make something pass. Never fall back to local-disk uploads in production.
- Same failure 5 times: write hypotheses and evidence in `docs/memory.md`, then try a different approach. Ask the human only after 3 different approaches fail, with the exact error.
- When blocked on a human action (Cloudflare account/token, DNS, approvals), print `WAITING_FOR_HUMAN: <what>` with exact steps and keep working on everything that does not depend on it.
- Local tests use the isolated test DB. Never run destructive scripts against production.

## FINISH
Only when all gates pass, print exactly:

`PROMPT 09 COMPLETE — POS stock PASS — OOS-last PASS — GRN brands PASS — R2 uploads PASS — production PASS`

then: root causes found, lists where out-of-stock-last applies and the ones excluded, number of brand-suppliers created, products with missing/junk data from the quality report, images that need re-upload, env variable names added, the unused GCS bucket to retire, open items. If you cannot reach that state, print `PROMPT 09 BLOCKED` with the exact blocker.
