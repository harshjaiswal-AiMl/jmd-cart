# 03 Phase 3: Storefront, live stock, orders and delivery (paste into Claude Code)

Prerequisite: Phase 2 demo done. The store is the main homepage at **jmdcart.com**; staff tools stay on **management.jmdcart.com** (`docs/architecture.md` section 14). Local-first; no third-party services. The store must feel like a quick-commerce app (Blinkit/Zepto style patterns, **no copied assets, logos, copy or colours**) and read availability **live from our shop and godown stock**.

## Step A: Read
`CLAUDE.md`, `docs/memory.md`, `docs/rules.md`, **`docs/storefront.md` (all)**, `docs/prd.md` (sections 5, 7, user stories US-S1 to S5), `docs/architecture.md` (sections 3, 5, 6, 11, 12, 13), `docs/design.md`, `docs/tasks.md` (Phase 3). Summarise `storefront.md` section 4 (live stock) in 6 lines and list open questions from its section 7. Do not guess the answers.

## Step B: Plan mode, no code
Plan tasks 3.1 to 3.9 (including 3.1a, 3.1b, 3.2a, 3.2b). Riskiest first: availability service and reservations with the oversell race (3.1a, 3.5). Flag migrations (`orders`, `order_items`, `carts`, `delivery_zones`, `deliveries`, `stock_reservations`). Include a short "what I cannot verify" list (real phones, slow networks). Stop and wait for "go".

## Step C: Build one step per "go"
0. **Visibility and hosts**: the store instance (`APP_MODE=store`) shows all products; out-of-stock ones are visible with a disabled Add and an "Out of stock" chip, listed after in-stock items (setting `storefront.showOutOfStock`, default true). 20-second listing cache, live reads at add-to-cart, cart and checkout; optional `LISTEN/NOTIFY` revalidation. Test that a godown change on the management instance reaches the store within the cache window.
1. **Availability service** (`modules/stock/availability.ts`) per `storefront.md` section 4: online-sellable = **godown only** (setting `online.locations`), minus reservations, minus buffer. Tests: equals godown ledger minus reservations, shop and van stock excluded, a shop POS sale does not change it, a van issue does, pick list cartons + loose split is correct.
2. **Reservations**: `stock_reservations`, reserve in one transaction with row locks, convert to `SALE` at invoice finalization, release on cancel/expiry; `pnpm job:release-reservations` script. Race test: two checkouts for the last unit, exactly one succeeds.
3. **Catalogue pipeline**: images through `FileStorage` with `sharp` (WebP, 3 sizes); `pg_trgm` fuzzy search under 300 ms.
4. **Buyer auth**: phone + password, verification mode setting (`admin` default, `sms` via adapter off), OTP/token rules from architecture section 12.
5. **Storefront UI** per `storefront.md` section 3: home, category/brand, product card with in-place stepper, product page, sticky cart, live availability (cache tag revalidation + polling), unit switch, slab hints, quick order, saved lists, reorder. Our own brand tokens. Skeletons, empty/error/offline/out-of-stock states.
6. **Delivery zones and charges**: admin-editable zones, thresholds (free above Rs 2,000 in town, above Rs 5,000 beyond 5 km, charges below set by admin), slots with capacity. Fee breakdown visible before placing the order; no late charges.
7. **Checkout and orders**: one-screen checkout, payment mode per settings (gateway off by default), credit at checkout only for approved parties within limit, order creation with reservation, exact "only N left" adjustments.
8. **Admin order desk**: confirm/edit/cancel, one godown pick list (cartons + loose pieces per line), pack, **one invoice per order**, assign delivery person and van.
9. **Delivery app screens** (Android PWA): assigned deliveries, mark delivered, collect payment, failed delivery restores stock.
10. **Tracking and invoice download** for buyers; "Need help" with WhatsApp click-to-chat link and order reference.
11. E2E: browse, search, add, wholesale slab change, checkout, admin confirm, pick, invoice, deliver; plus the oversell race. Update docs and the demo script.

## Constraints
Never display a price checkout will not honour. Never show exact large stock numbers (status only unless admin changes the setting). No third-party analytics, chat, search or realtime services. Show real test output at each step.

Begin with Step A.
