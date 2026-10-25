# PROMPT #06 — A/B/C price lists, Excel upload (catalog + stock), full sidebar redesign, admin CRUD everywhere

Save this as `docs/prompts/06-pricing-excel-sidebar-crud.md`, then paste the whole thing to the agent. **Do not create any other new doc files.** Update the existing `docs/rules.md`, `architecture.md`, `design.md`, `tasks.md`, `memory.md` in place when done.

---

## ROLE AND CONTEXT
You are continuing the JMD Cart build (Next.js app router, Prisma, Postgres, `pnpm.cmd` on Windows, `src/modules/*` services, server actions). Prompt #05 is finished: the app starts **empty** (no dummy data, no seeded products). **Keep that guarantee.** Real products come only through the importers below; test fixtures live only under `tests/`.

First read the existing schema, `docs/*.md`, the current godown stock update page (`/godown/stock/update`), the product/party importers, the role enum and the current layouts of every dashboard. Reuse existing parsers, services, ledger and audit code. Do not duplicate them.

Work in the **LOOP** at the bottom. Nothing is done until it is built, run, and verified.

---

## PART 1 — A / B / C price lists

### Meaning
| List | Buyer | Notes |
|---|---|---|
| **A** | Wholesaler | lowest |
| **B** | Retailer | |
| **C** | Customer (also walk-in and anonymous storefront visitors) | highest, ≤ MRP |

### Data model (Prisma migration)
On `products`: `mrp_paise` (nullable), `price_a_paise`, `price_b_paise`, `price_c_paise`, and `case_qty` (pieces per case; reuse the existing pack-size field if it is the same thing). All money integer paise. Add `import_batches` (id, type `CATALOG|STOCK`, filename, user_id, location_id nullable, mode, rows_total/applied/skipped, status `APPLIED|UNDONE`, created_at) and a nullable `batch_id` on `stock_movements` so a whole upload can be reversed.

### Price resolution (one function in shared code, used everywhere: billing, van, storefront, orders)
`resolvePrice(product, buyerType)` → A for WHOLESALER, B for RETAILER, C for CUSTOMER/walk-in/anonymous.
The existing quantity-based tier / auto buyer-tag logic stays but becomes an admin setting (default OFF). When ON, the effective list is the cheaper of the party's own list and the quantity-tier list. Admin order discount % still applies on top. Retailer/wholesaler prices are visible on the storefront **only after login and admin approval**. Anonymous visitors see C only. Never expose A/B to the public.
Validation: warn (do not block) when `A ≤ B ≤ C ≤ MRP` is violated.

### Price list screens (admin)
Products page shows MRP, A, B, C columns, inline-editable, with a "margin vs MRP %" hint. Bulk "set A/B/C as % off MRP" action for selected products.

---

## PART 2 — Catalog + price Excel import (admin only)

The client's price sheets look like this. Support exactly these layouts, one sheet or tab per brand:

- Title rows: `JAI MATA DI`, `SAHARSA`, then the **brand name** row (SALONI, MDH, DAWAT). Brand = company. If the file has tabs, the tab name is the brand.
- Header columns (case-insensitive, any order, some optional): `SL NO` (ignore), `ITEMS`, `WEIGHT` (optional; else weight is inside the name), `QTY IN CASE` **or** `PCS` (both mean `case_qty` = pieces per 1 carton), `MRP`, `A`, `B`, `C`.
- **A/B/C cells are either absolute ₹ prices or % off MRP** depending on the sheet. Examples: Saloni and Dawat use absolute prices; MDH uses `22% / 21% / 20%` off MRP. The importer asks per sheet: **Absolute ₹ / % off MRP**, auto-detects (cells with `%` or Excel percent format or values between 0 and 1 → percent), and lets the admin override. Percent mode: `price = round_half_up(MRP × (100 − pct) / 100)` in paise, no rounding to whole rupees.
- SKU is not in the sheets. Generate it deterministically: brand code + normalized name + weight. Match existing products on (brand, normalized name, weight); update on match, create otherwise.

### Data-quality rules (the real sheets have these problems; handle them, never silently "fix")
1. **MRP = 0 or blank.** Absolute mode: allow, store `mrp_paise = null`, warn "MRP missing". Percent mode: prices cannot be computed → row error, with an option to import the product as inactive without prices.
2. **Duplicate items in the same file** with different pcs/MRP (e.g. several "Chilli Powder (Kashmiri) 50 Gm", two "Chana Masala 10gm/10g", "Dhania Powder 100gm" twice, repeated `SL NO 1`). Mark `NEEDS_REVIEW`. Admin picks per group: keep all as separate variants (auto-suffix the SKU), keep one, or skip. Never merge automatically.
3. **Suspicious values:** `case_qty` > 5000, `case_qty` equal to MRP, MRP wildly out of line for the weight (e.g. Haldi 200gm MRP 2286.15 with 6 pcs, Mustard Oil 5ltr with pcs 3308). Flag `SUSPICIOUS`, require explicit confirm.
4. Name typos and mismatched weights (e.g. "Mdh Vemicelli", "Vermicelli 550gm") are imported as-is but listed in the report for admin review.
5. Order-of-columns changes, extra blank/merged rows, trailing spaces, `Gm/gm/GM` variants must not break parsing.

### Flow
Upload → parse → **preview table** with row status (OK / WARNING / NEEDS_REVIEW / SUSPICIOUS / ERROR), filter by status, fix-in-place, → Commit. Atomic per commit. Downloadable error/review report (xlsx). Neutral header-only template download (no sample data). Creates brands/categories on the fly after confirmation.

---

## PART 3 — Excel upload that updates stock instantly (admin **and** warehouse manager)

Check the real role enum; the warehouse manager role may be named `GODOWN_*`. Both ADMIN/SUPER_ADMIN and the warehouse manager role get this page. Enforce on the server, not only in the UI. Warehouse manager is limited to the godown location. Admin can choose any location.

### Behavior (this is deliberately one step, no manual per-row work)
- Upload `.xlsx/.xls/.csv`. Columns: `ITEM` or `SKU`, `CARTONS`, `LOOSE` (or `PIECES`, converted by `case_qty`), optional `LOCATION`. Mode selector: **Opening stock / Set quantity (count) / Add (+) / Deduct (−)**, default Set quantity.
- On upload the system validates, then **immediately applies every valid row** in one transaction per row set. No second confirm click. Invalid rows are skipped and returned in a downloadable error file with a reason per row (unknown item, ambiguous match, negative result, bad number, location not allowed).
- Each applied row writes ledger entries through the existing stock service, reason auto-filled `Excel upload <filename>`, tagged with `batch_id`.
- Result screen: applied count, skipped count, total cartons/loose changed, per-row before → after, and a **Undo this upload** button. Undo posts exact reversal ledger rows (never deletes). Admin can undo any batch; warehouse manager can undo only their own within 24 hours. Undo refuses if it would make any stock negative, and says which rows block it.
- Matching: SKU first, else exact normalized (brand + name + weight). Never fuzzy-guess. Ambiguous → skipped with candidates listed.
- Stock invariants from before still hold: never negative, `SUM(ledger) = balances`, audit logged, storefront availability and out-of-stock badges update immediately.
- Include a "Download current stock as Excel" button producing the same template pre-filled, so the warehouse manager can edit and re-upload.

---

## PART 4 — Full dashboard redesign with sidebar

Replace the current per-page dashboard layouts with **one shared app shell** for the whole management side (admin, godown, shop billing, van, delivery, accounts). Keep every existing URL working.

### Shell
- Persistent left sidebar (collapsible to icons on desktop, slide-over drawer on mobile at 360px), top bar (page title/breadcrumbs, global search `Ctrl+K` command palette for pages and products, location switcher, notifications bell incl. auto-convert alerts and low stock, user menu). JMD Cart brand tokens from `design.md`: maroon sidebar or header, cream surfaces, orange active state, amber badges, leaf-green positive.
- Nav comes from **one config file** (`nav.config.ts`): `{ group, label, icon, href, roles, badge? }`. Sidebar renders only what the current role may open, but for ADMIN/SUPER_ADMIN **every feature is visible**. The same config drives server-side route guards and the tests. No orphan pages: every page is reachable from the sidebar. No dead links: a feature not yet built is built now as at least a working list page, never a 404 and never a "coming soon".

### Sidebar structure (groups → items)
- **Dashboard** — Owner overview (admin), Godown overview (warehouse manager)
- **Sales** — Shop Billing, Invoices, Online Orders, Van Sales
- **Inventory** — Stock Overview, Update Stock (Opening / Count / Adjust / **Excel Upload**), Transfers, Carton↔Loose Conversions, Stock Movements, Purchases / GRN, Low Stock, Wastage
- **Van** — Morning Issue, Evening Return, Reconciliation, Van Cash
- **Catalog** — Products, Brands/Companies, Categories, **Price Lists (A/B/C)**, Price Slabs, **Import Products & Prices**
- **Parties** — Customers, Retailers, Wholesalers, Suppliers, Credit & Limits, Party Import
- **Delivery** — Delivery Orders, Zones, Delivery Charge Rules, Delivery Staff
- **Accounts** — Receipts, Payments, Party Ledger, Outstanding, Day Book, Cash Book, GST Reports, Tally Export
- **Reports** — Sales, Stock, Van, Returns, Auto-converted Cartons, Staff Performance
- **Admin** — Users & Roles, Business Details, Invoice Settings, Discount Limits, Locations, Storefront Settings, Audit Log, Backup

Group headers collapsible, state remembered. Active item highlighted. Counts/badges where useful (pending orders, low stock). Warehouse manager sees Inventory, Van, Catalog (read-only except Excel stock upload), Reports (stock/van), and their dashboard.

### Pages
Every dashboard (owner, godown, shop, van, delivery, accounts) is rebuilt on the shell with consistent `PageHeader`, KPI cards driven by real DB counts, and meaningful empty states (the Getting Started checklist from #05 stays). Responsive at 360px and 1280px.

---

## PART 5 — Admin full CRUD on everything

Build **one reusable CRUD kit** (DataTable + form drawer/page + confirm dialog + server-action helpers) and drive every entity from an **entity registry** (fields, validation schema, list columns, filters, permissions). Do not hand-write 20 different tables.

DataTable: server-side search, filters, sort, pagination, column toggle, multi-select with bulk actions, CSV export, row actions (View / Edit / Delete-or-Archive), create button, loading/empty/error states, keyboard friendly.

Entities that need full Create / Read / Update / Delete for ADMIN and SUPER_ADMIN:
users, locations, companies/brands, categories, products (incl. A/B/C), price slabs, parties (customers, retailers, wholesalers, suppliers), orders, purchases/GRN, stock transfers, van trips, delivery zones, delivery charge rules, receipts, payments, discount limits, business details, storefront settings/banners.

### Delete policy (important, do not break accounting)
- Records **with history** (invoices, stock movements/ledger, payments, posted receipts, anything referenced by another record): **no hard delete.** Delete = *Archive* (hidden from pickers, kept in history) or *Cancel/Void with mandatory reason*. Stock effects are reversed with new ledger rows. Invoice numbers are never reused.
- Records **without references**: hard delete allowed after a confirm dialog that shows what will be removed.
- Every create/update/delete/archive/cancel writes an **audit log** entry (who, what, before, after, reason).
- Admin can restore archived records. Archived records show in a filter, not by default.
- Users: cannot delete or demote the last SUPER_ADMIN; cannot delete yourself.
- Super admin can do everything; admin can do everything except manage SUPER_ADMIN accounts.
