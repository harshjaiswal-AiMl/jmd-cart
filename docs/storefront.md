# Storefront: quick-commerce style ecommerce with live stock

Owner decision: the online store should feel like Blinkit and Zepto (fast, one-tap, clutter-free) and must read availability **directly from our live stock** (shop + godown). Wholesalers and retailers use the same store.
This file is the source of truth for the storefront (Phase 3). Layout tokens come from `design.md`; data and rules from `architecture.md` and `prd.md`.

## 0. Research note and IP
- Both blinkit.com and zepto.com render with JavaScript, so our page-fetch tool could not read their screens. This analysis comes from published UX teardowns and reviews plus general product knowledge. Screenshots from the owner would let us match specific layouts more closely.
- **We copy patterns, never assets.** No logos, illustrations, icons, copywriting, or brand colours (Blinkit yellow/green, Zepto purple) from those apps. The store uses its own brand and the tokens below.
- Their model (10-minute dark stores) differs from ours (one shop + one godown, own vans, Saharsa town). We borrow the **interaction design**, not the promise.

## 1. What makes those stores fast to use (patterns to adopt)
| Pattern | What they do | Our version |
|---|---|---|
| One-tap add | Add button is always visible on the product card, where the thumb rests; becomes a quantity stepper after the first tap | Same. Stepper in place on every card; no page change |
| Clutter-free flow | Search, products, cart, checkout; few banners | Search and category first; at most one banner row |
| Search + category grid on top | Search box above, category tiles below, scannable | Same, plus brand tiles (Bikaji, MDH, India Gate, Engine...) |
| Location first | Catalogue is tuned to the nearest store | "Delivering to Saharsa town" chip; district later |
| Real-time inventory | Out-of-stock never added silently | Live availability on cards, cart and checkout (section 4) |
| Sticky cart | Bottom bar with item count, total, savings, delivery time | Sticky bar with count, total, buyer tag and delivery estimate |
| Delivery time up front | "Delivered in X minutes" on listing and cart | "Delivery today / tomorrow, slot" with slot capacity |
| Scheduled slots | Pick a time slot, see slot availability, get reminders | Slots set by admin per zone and van capacity |
| Order again | Previous purchases auto-populate | "Order again" row on home and one-tap reorder |
| Live order tracking | Clear statuses, honest ETA | Placed, Confirmed, Packing, Out for delivery, Delivered |
| In-app support | Complaints and issues inside the app | Simple "Need help" with WhatsApp click-to-chat link and order reference |
| Honest fees | Fees visible before payment; hidden/surge charges are a top complaint | Full breakdown on cart and checkout; no surprise fee after pay |
Lessons to avoid: popups that block the main button, unclear which coupon is applied, wrong or mismatched items, extra charges appearing late.

## 2. Storefront for wholesalers and retailers (our differences)
- **Quantity slabs on the card**: "Buy 12+ and save 3%". The price updates live as the quantity changes. A chip shows the applied tier (Customer / Retailer / Wholesaler); tier is auto-tagged from quantity.
- **Unit switch**: Pieces or Carton/Bag (pack size shown, for example "1 carton = 24 pcs"). Cartons fulfil from the godown, loose pieces from the shop.
- **Quick order**: add by short code or product name in a fast list; paste a list or upload CSV; saved lists ("my weekly order").
- **Reorder**: repeat any past order with live prices and availability; out-of-stock lines are flagged.
- **Credit**: approved Tally credit parties see "Pay on credit" at checkout within their limit; others pay at delivery (final payment modes confirmed with client).
- **Invoices**: GST invoice download per order; statement for credit parties.
- **Minimum order** and **delivery rules** from admin settings (free above Rs 2,000 in town, above Rs 5,000 beyond 5 km; charges below set by admin).

## 3. Screens and layout
Mobile-first (360px), responsive up to desktop. Tokens: primary teal `#1B998B`, deep navy `#12355B` for text/headers, amber `#F4A259` for offers, danger `#C0392B`; font Inter. Cards 12px radius, 8px grid. **Final brand colours follow the store name/logo when decided (JMD Cart name to be confirmed).**
1. **Header**: logo, delivery area chip, search (autofocus on tap), account, cart.
2. **Home**: search, category tiles (2x4 grid scroll), brand strip, "Order again", "Bulk deals" (slab offers), category rows with horizontal product scroll, trust strip (genuine products, GST invoice, local delivery).
3. **Category / brand page**: sticky chips for subcategory, sort (popular, price, new), product grid (2 columns mobile, 4-5 desktop), infinite scroll with skeletons.
4. **Product card**: image, name, pack size, price (MRP struck through if discounted), slab hint, stock chip, Add / stepper. Tap opens the product page.
5. **Product page**: gallery, name, company, pack info, unit switch, slab table, live availability, add to cart, similar products, GST/HSN info.
6. **Cart**: sticky bar on mobile and slide-in drawer; lines with steppers, per-line slab price, buyer tag, delivery estimate, coupon/admin discount line, fee breakdown, minimum-order message, "Proceed".
7. **Checkout**: address (saved, map pin optional), delivery slot, payment mode, final summary, place order. One screen, few fields.
8. **Order tracking**: status timeline, ETA, delivery person (name), invoice, "Need help".
9. **Account**: orders, saved lists, addresses, credit statement, profile.
States for every screen: loading (skeletons), empty, error, offline, out-of-stock, slot full.

## 4. Live stock: how the store reads our shop and godown
**Single source of truth is the stock ledger** (`stock_balances`). The storefront never keeps its own stock number.

Definitions
- Online-sellable locations: `GODOWN` and `SHOP` only. **Van stock is excluded.** Damaged stock is not in balances.
- `reserved(product)`: pieces held by open online orders in `stock_reservations`.
- `buffer(product)`: pieces kept back from online sale so the counter never runs dry (admin setting per product or global; default 0).
- `available_pieces(product) = godown + shop - reserved - buffer` (not below 0).
- Fulfilment split for a line of Q pieces with pack size P: cartons `c = floor(Q/P)` come from the godown, remainder `r` loose from the shop. Feasible when `godown >= c*P` and `shop >= r`. **If the shop is short on loose pieces, allow auto carton break at fulfilment** (setting `allowAutoBreak`, default on, confirm with client). When on, feasibility is `godown + shop >= Q` with godown cartons broken as needed.

Service (`modules/stock/availability.ts`)
- `getAvailability(productIds[]) -> {productId, godown, shop, reserved, availablePieces, status}` where `status` is `IN_STOCK | LOW | OUT`.
- `checkFeasible(lines[]) -> {ok, adjustments[]}` runs the split rule above.
- One SQL query over `stock_balances` joined with open reservations; indexed on `(product_id, location_id)`.

Reservation flow (prevents overselling)
1. Cart does **not** reserve. It shows live availability and warns.
2. **Place order** runs one DB transaction: lock balance rows (`FOR UPDATE`), re-check feasibility, insert `stock_reservations(order_id, product_id, location_id, qty, status, expires_at)`. If not feasible, return exact adjustments ("Only 5 left of X") and do not create the order.
3. Admin confirms; pick lists are generated from reservations (shop loose, godown packs).
4. On invoice finalization, reservations convert into `SALE` movements and are marked consumed.
5. Cancel or expiry releases reservations. A cron script (`pnpm job:release-reservations`) expires unpaid or unconfirmed orders after the admin-set time (default 2 hours, confirm with client).

Freshness (no third-party realtime service)
- Listing pages use short server cache (about 15-30 seconds) and are **revalidated immediately** after any stock movement commits (cache tag `stock`).
- Add-to-cart, cart and checkout always read live. Visible cards and the cart refresh availability by polling (every 20-30 s) or Server-Sent Events from a Next.js route handler fed by Postgres `LISTEN/NOTIFY`. Start with polling; add SSE only if needed.
- Every movement (shop POS sale, van issue, purchase, transfer) updates the same balances, so a shop sale at the counter lowers online availability within seconds.

Display policy (admin settings)
- Default: show `In stock`, `Only N left` when `available <= low threshold` (default 10), or `Out of stock`. Do **not** show exact large numbers to buyers (competitors can scrape them).
- Admin can hide a product online, mark "available in shop only", or set an online buffer.
- Out-of-stock products stay visible with a disabled Add and "Notify me" later (post-v1).

Tests (required)
- Availability equals ledger balances minus reservations in every case.
- Two simultaneous checkouts for the last unit: exactly one succeeds.
- Reservation expiry and cancel restore availability.
- Shop POS sale reduces online availability; van stock never counts.
- Split rule: cartons from godown, remainder from shop; auto-break on/off.

## 5. Pricing display rules
- Show MRP, our price after slab discount, and the discount percentage. Prices are tax-inclusive; GST shown on checkout and invoice.
- The buyer tag and slab apply per `docs/prd.md` section 5. Admin order-level % discount appears as its own line.
- Never show a price that checkout will not honour. Recompute at checkout.

## 6. Technical notes
- Server components for catalogue pages (fast first paint), client components only for steppers, cart, slot picker.
- Images through `FileStorage` (local disk now); generate WebP thumbnails (about 3 sizes) with `sharp`; lazy load; explicit width/height to avoid layout shift.
- Search: standard PostgreSQL full-text plus `pg_trgm` for fuzzy matching on name, company, short code; results under 300 ms; debounce 150 ms.
- PWA: installable, offline shell, cached catalogue shell; checkout requires network.
- SEO and Google presence: server-rendered pages, clean URLs, metadata, `Product` JSON-LD.
- Accessibility: AA contrast, labelled controls, focus rings, 44px touch targets.
- No third-party analytics, chat widgets or realtime services. WhatsApp click-to-chat is just a link.

## 7. Open questions
1. Auto carton break when shop loose stock is short (default on)?
2. Show exact stock numbers or only status? (default status only)
3. Reservation expiry time for unconfirmed orders (default 2 hours)?
4. Minimum order value per buyer type, and per-line minimum for wholesale?
5. Delivery slot structure (for example morning, afternoon, evening) and max orders per slot.
6. Online payment modes (still unclear: "both nope").
7. Store name and brand colours (JMD Cart?).
