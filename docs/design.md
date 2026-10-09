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
