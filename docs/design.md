# Design: IDMS UI/UX direction

Staff tools first: fast, clear, forgiving. English UI. Built with Tailwind + shadcn/ui.

## 1. Principles
1. **Speed over beauty at the counter.** POS and van billing must be doable with minimal taps/keys.
2. **One job per screen** for godown and van users; no clutter.
3. **Show the number that matters** (stock, total, outstanding) large and early.
4. **Confirm irreversible actions** (finalize bill, issue stock, adjustment); never confirm routine ones.
5. **Never lose work**: hold/resume bills, drafts, clear error recovery.
6. **Forgiving search**: partial words, short codes, company-first filter.

## 2. Tokens
| Token | Value | Use |
|---|---|---|
| Primary | `#12355B` navy | Headers, primary buttons |
| Accent | `#1B998B` teal | Success, active states, links |
| Highlight | `#F4A259` amber | Warnings, attention |
| Danger | `#C0392B` | Errors, destructive |
| Surface | `#FFFFFF` / `#EEF4F8` | Cards / page background |
| Text | `#1F2933` body, `#52606D` muted | |
| Font | Inter (fallback system-ui) | Numbers use tabular figures |
| Radius | 8px cards, 6px inputs | |
| Spacing | 4px scale (4, 8, 12, 16, 24, 32) | |
| Min touch target | 48px on van/delivery screens, 40px on desktop | |

Breakpoints: mobile 360-639, tablet 640-1023, desktop 1024+. Van/delivery screens are designed mobile-first; godown/shop/admin desktop-first.

## 3. Layout patterns
- **Admin/Godown/Accounts**: left sidebar (role-based items), top bar with location switcher, user menu; content in cards and data tables with sticky headers, filters and CSV/Excel export.
- **Shop POS**: full-screen, two panes. Left 60%: search box (autofocus), company chips, favourites/recents grid with product images. Right 40%: bill panel (party, lines, qty steppers, discount, totals, payment, Finalize). Bottom: Hold, Resume, New.
- **Van app**: single column; bottom tab bar (Stock, Bill, Collect, Day). Big totals, sticky Finalize button.
- **Storefront**: mobile-first grid, sticky cart, live price and buyer tag in cart, delivery check at checkout.

## 4. Screen inventory
**Phase 1**: Login; Dashboard (role-aware); Products list/detail/import; Companies and categories; Locations; Stock by location; Product stock history; Purchase (new/list/detail); Transfer and carton break; Stock audit; Damage/adjustment; POS; Held bills; Invoice list/detail/print; Credit note (admin); Users and roles; Settings (slabs, discount limits, business details); Reports (stock, low stock, daily sales, day-end cash); Audit log.
**Phase 2**: Van issue sheet; Van day (bills, collections, return count, reconcile); Cash handover; Parties; Party ledger and ageing.
**Phase 3**: Storefront (home, catalogue, product, cart, checkout, orders, order detail); Admin orders, pick lists, delivery assignment; Delivery app list and detail.

## 5. Components and states
Every component defines: default, hover/focus, disabled, loading, empty, error.
- **Product search result row**: image, name, company, pack info, price, stock at current location (red if 0, amber if low).
- **Qty stepper**: tap to edit, shows pieces and cartons equivalent (e.g. `30 pcs = 1 carton + 6`).
- **Money display**: right-aligned, tabular, Indian grouping, always with the rupee symbol.
- **Status chips**: Draft (grey), Final (teal), Cancelled (red), Pending approval (amber).
- **Toasts** for success; **inline** errors for forms; **blocking dialog** only for irreversible confirms.
- **Tables**: sort, filter, pagination, empty state with the next action.

## 6. Documents
- **A4 invoice**: business name, GSTIN, FSSAI, address; invoice no/date; party and GSTIN; item table (HSN, qty, MRP, rate, taxable, GST%, amount); tax summary by rate; total, round-off, amount in words; payment mode; signature line; terms.
- **80mm receipt**: compact header, lines (name, qty x rate, amount), tax summary, total, payment, footer; monospaced-safe widths; no images.
- Print CSS must render identically on the client's thermal printer; test on the real device.

## 7. Motion
Minimal: 120-150 ms ease-out for panels and toasts. No decorative animation on POS/van screens.

## 8. Accessibility
Labels for all inputs, visible focus rings, contrast AA, keyboard path for the whole POS flow (search, Enter to add, F-keys optional), errors announced, no colour-only meaning.

## 9. Content tone
Plain English, short labels (Receive stock, Issue to van, Break carton). Error messages say what to do next.

## 10. Empty start, onboarding and stock entry (`management.jmdcart.com`)
The system ships with **zero products, zero stock, zero parties, zero bills**. Every screen must look intentional when empty and make the next action obvious.
- **First-run `/setup` screen** (shown only when no `SUPER_ADMIN` exists): single clean card — Owner name, phone, password, confirm password, business legal/trade name, GSTIN, FSSAI, address. Submits once, creates the owner, signs in, and lands on the Owner Dashboard.
- **Owner Dashboard — "Getting Started" checklist** (shown until all steps are completed, dismissible afterwards, always reachable from Help):
  1. Business & GST details (`Settings -> Business details`)
  2. Add companies & categories (or auto-create on product add/import)
  3. Add products (`+ Add product` form **or** `Import from Excel`)
  4. Set price slabs (`Settings -> Price slabs` — Customer / Retailer / Wholesaler)
  5. Enter stock (`Update stock` — Opening stock / Stock count / Excel upload, or `New GRN` with a supplier bill)
  6. Import or add credit parties (`Parties -> Import from Tally` or `+ Add party`)
  7. Create staff logins (`Users -> + Add staff` for Godown, Shop, Van, Delivery, Accounts)
- **Quick-action bar on Owner & Godown dashboards**: `+ Product`, `Import products`, `Update stock`, `+ GRN (purchase)`, `+ Party` — one click from anywhere.
- **Update Stock screen (`/godown/stock/update`)** — works **without** a supplier GRN so the owner/godown keeper can set or correct stock anytime:
  - **Tab 1 — Opening stock**: pick location (`Godown` or `Shop`), search/select products, enter cartons and/or loose pieces (auto-calculates total pieces from `packSize`), reason defaults to `"Opening stock"`, posts `OPENING_STOCK` movements.
  - **Tab 2 — Stock count (set current quantity)**: shows current system balance (cartons + loose), user types actual counted cartons + loose, system previews the delta (`+` or `−` pieces) and posts an `ADJUSTMENT` movement with reason `"Stock count"`.
  - **Tab 3 — Quick adjust (+/-)**: add or subtract cartons/loose on a single product with a mandatory reason.
  - **Tab 4 — Excel / CSV upload**: upload `shortCode, cartons, loosePieces, reason` for bulk opening stock or stock count, with row-level preview and error report before committing.
- **Empty-state rule across every table and report**: show real `0` / `₹0` KPIs (never sample numbers or demo charts) plus a centered empty card with a one-sentence explanation and the primary action button (`+ Add your first product`, `Enter opening stock`, `Import parties`, etc.).
- **Storefront (`jmdcart.com`) when catalog is empty**: shows the header, location strip, and a clean "Store is being stocked — check back soon" card; never fake products.

## 11. Shared Management App Shell & Reusable CRUD Kit (Prompt #06)
- **JMD Cart Brand Palette on Management Shell**:
  - Persistent left sidebar in deep maroon (`#790E11`) with cream text (`#FEFDF7`), active item highlight in vibrant orange (`#FC830D`), badges in warm amber (`#FDAF18`), and positive/storefront actions in leaf green (`#075828`).
  - Desktop sidebar collapses to an icon rail (`64px`) and remembers group collapse state in `localStorage`. On mobile (`360px`), collapses into a slide-over drawer.
  - Top bar includes dynamic Group/Page breadcrumbs, `Ctrl+K` Global Search Command Palette (searching both navigation pages and product SKUs), active Location Switcher, Notifications Bell (Auto-Converted Cartons, Low Stock Alerts, Pending Online Orders), and User Menu.
- **Reusable CRUD DataTable (`src/components/crud/crud-data-table.tsx`)**:
  - Unified toolbar with instant search, "Show Archived / Voided" filter toggle, column visibility pills, sortable headers, multi-select checkboxes, CSV export, slide-over Create/Edit Drawer, and safe Delete/Archive/Void confirmation modal with mandatory audit reason for accounting records.

## 12. Stitch Storefront Design System (`jmdcart.com` Rebuild - Prompt #08)
- **Token Decisions & Fidelity**:
  - Storefront uses the exact Stitch design export tokens (`design/stitch-export/ecommerce/`):
    - `primary`: `#5c0c1e` (deep brand maroon)
    - `primary-container`: `#7a2433` (card accents and header strip)
    - `secondary-container`: `#fc9430` (warm CTA orange)
    - `on-secondary-container`: `#663500` (deep contrast text for WCAG AA compliance)
    - `surface`: `#fff8f6`, `surface-container`: `#faecea` (soft warm cream backgrounds)
    - `outline`: `#857372`, `outline-variant`: `#d7c1bf`
  - Radii: `rounded`: `0.25rem`, `rounded-lg`: `0.5rem`, `rounded-xl`: `0.75rem`.
- **Typography & Icons**:
  - Epilogue (display/headings) and Inter (UI/body) self-hosted via `next/font/google`.
  - Tabular figures on all prices, weights, quantities, and GST numbers.
  - Icons: Material Symbols Outlined self-hosted and vendored at `/public/fonts/material-symbols-outlined.woff2`. Zero runtime external Google Fonts / CDN calls.
- **Accessibility & Contrast Audit**:
  - Fixed WCAG AA contrast on CTA buttons: replaced pure white text on `#fc9430` with `text-on-secondary-container` (`#663500`), achieving > 4.5:1 contrast ratio.
  - Form controls include explicit `<label>` and `aria-label` tags. Touch targets exceed 44px on mobile viewports.
- **Staff Boundary Invariance**:
  - `management.jmdcart.com` and all staff screens (`/admin`, `/godown`, `/shop`, `/van`, `/delivery`, `/reports`, `/setup`, `/management`) remain untouched visually and functionally.



