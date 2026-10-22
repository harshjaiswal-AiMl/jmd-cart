# Storefront: quick-commerce style ecommerce with live stock

Owner decision: the online store should feel like Blinkit and Zepto (fast, one-tap, clutter-free) and must read availability **directly from our live godown stock**. Wholesalers and retailers use the same store.
This file is the source of truth for the storefront (Phase 3). The store lives at **jmdcart.com** (the main homepage); all staff work happens at **management.jmdcart.com** (see `architecture.md` section 14). Layout tokens come from `design.md`; data and rules from `architecture.md` and `prd.md`.

## 0. Research note and IP
- Both blinkit.com and zepto.com render with JavaScript, so our page-fetch tool could not read their screens. This analysis comes from published UX teardowns and reviews plus general product knowledge. Screenshots from the owner would let us match specific layouts more closely.
- **We copy patterns, never assets.** No logos, illustrations, icons, copywriting, or brand colours (Blinkit yellow/green, Zepto purple) from those apps. The store uses its own brand and the tokens below.
- Their purple and yellow/green identities are not ours; JMD Cart uses maroon, orange and cream (`docs/brand.md`).
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
- **Unit switch**: Pieces or Carton/Bag (pack size shown, for example "1 carton = 24 pcs"). Both cartons and loose pieces are fulfilled from the godown.
- **Quick order**: add by short code or product name in a fast list; paste a list or upload CSV; saved lists ("my weekly order").
- **Reorder**: repeat any past order with live prices and availability; out-of-stock lines are flagged.
- **Credit**: approved Tally credit parties see "Pay on credit" at checkout within their limit; others pay at delivery (final payment modes confirmed with client).
- **Invoices**: GST invoice download per order; statement for credit parties.
- **Minimum order** and **delivery rules** from admin settings (free above Rs 2,000 in town, above Rs 5,000 beyond 5 km; charges below set by admin).

## 3. Screens and layout
Mobile-first (360px), responsive up to desktop. Tokens and logo: **JMD Cart brand in `docs/brand.md`** (maroon primary, orange/amber accents, cream background, Poppins + Inter). Logo files in `design/brand/`.
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
- Online-sellable locations: **`GODOWN` only** (setting `online.locations`). **Shop and van stock are excluded.** Damaged stock is not in balances.
- `reserved(product)`: pieces held by open online orders in `stock_reservations`.
- `buffer(product)`: pieces kept back from online sale so the counter never runs dry (admin setting per product or global; default 0).
- `available_pieces(product) = godown - reserved - buffer` (not below 0).
- Fulfilment: every online line is picked from the godown. For the picker the line is shown as `floor(Q/P)` cartons plus `Q mod P` loose pieces. Because the godown counts in pieces, no carton break is needed online. Feasible when `godown >= Q` for every line.

Service (`modules/stock/availability.ts`)
- `getAvailability(productIds[]) -> {productId, godown, shop, reserved, availablePieces, status}` where `status` is `IN_STOCK | LOW | OUT`.
- `checkFeasible(lines[]) -> {ok, adjustments[]}` checks each line against godown availability.
- One SQL query over `stock_balances` joined with open reservations; indexed on `(product_id, location_id)`.

Reservation flow (prevents overselling)
1. Cart does **not** reserve. It shows live availability and warns.
2. **Place order** runs one DB transaction: lock balance rows (`FOR UPDATE`), re-check feasibility, insert `stock_reservations(order_id, product_id, location_id, qty, status, expires_at)`. If not feasible, return exact adjustments ("Only 5 left of X") and do not create the order.
3. Admin confirms; the godown pick list is generated from reservations (cartons + loose pieces per line).
4. On invoice finalization, reservations convert into `SALE` movements and are marked consumed.
5. Cancel or expiry releases reservations. A cron script (`pnpm job:release-reservations`) expires unpaid or unconfirmed orders after the admin-set time (default 2 hours, confirm with client).

Freshness (no third-party realtime service)
- Listing pages use short server cache (about 15-30 seconds) and are **revalidated immediately** after any stock movement commits (cache tag `stock`).
- Add-to-cart, cart and checkout always read live. Visible cards and the cart refresh availability by polling (every 20-30 s) or Server-Sent Events from a Next.js route handler fed by Postgres `LISTEN/NOTIFY`. Start with polling; add SSE only if needed.
- Every godown movement (purchase, van issue and return, transfer to shop, carton break, damage, adjustment, online reservation) updates the same balances, so online availability changes within seconds of the godown change.

Display policy (admin settings)
- **Default: out-of-stock products stay visible** with a disabled Add and an "Out of stock" chip, listed after in-stock items. Setting `storefront.showOutOfStock=false` hides them from listings and search (their URL then shows "Currently unavailable").
- Default: show `In stock`, `Only N left` when `available <= low threshold` (default 10), or `Out of stock`. Do **not** show exact large numbers to buyers (competitors can scrape them).
- Admin can hide a product online, mark "available in shop only", or set an online buffer.
- Items that become unavailable while in a cart show "Unavailable" and are removed at checkout with a clear message.

Tests (required)
- Availability equals godown ledger balances minus reservations in every case.
- Two simultaneous checkouts for the last unit: exactly one succeeds.
- Reservation expiry and cancel restore availability.
- A shop POS sale does **not** change online availability; a van issue or godown sale does; van stock never counts.
- Pick list shows correct cartons + loose split; shop stock never affects online availability.

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
1. ~~Auto carton break~~ Settled: online orders come from the godown only, loose and cartons.
2. Show exact stock numbers or only status? (default status only)
3. Reservation expiry time for unconfirmed orders (default 2 hours)?
4. Minimum order value per buyer type, and per-line minimum for wholesale?
5. Delivery slot structure (for example morning, afternoon, evening) and max orders per slot.
6a. ~~Show or hide out-of-stock~~ Settled: show them (disabled Add).
6. Online payment modes (still unclear: "both nope").
7. ~~Store name and brand colours~~ Settled: JMD Cart, see `docs/brand.md`.

## 8. Reference screenshots reviewed (Zepto web and Blinkit web, 11 Oct 2026)
What the five screenshots show and what we do with it. Layout reference only; no assets, copy or brand colours are reused.
| Seen on | Observation | Our decision |
|---|---|---|
| Both | Header: logo, delivery promise ("Delivery in minutes*" / "Delivery in 14 minutes") with a location dropdown, wide search bar with rotating example placeholder, Login and Cart on the right | Header with fixed chip "Delivering in Saharsa town" (no dropdown in v1), rotating placeholder with our products, Login and Cart |
| Zepto | Top category tab row with icons and an active underline (All, Cafe, Home, Toys...) | Tab row: All, Staples, Masala, Snacks, Oil & Ghee, Drinks, Cleaning, Personal Care |
| Zepto | Fee strip banner: Rs 0 handling, delivery and rain/surge fees, with ticks and a small T&C line | Fee transparency strip: free delivery above Rs 2,000, GST invoice, genuine products; real rules shown in cart |
| Both | Large rounded hero banner plus 2-3 promo cards with CTA buttons | One hero ("Stock up for your shop") plus 3 cards: Bulk deals, Order again, New arrivals |
| Both | "Shop by Category" grid of image tiles on soft grey/blue squares, label below, 10-11 per row | Same pattern, 10 tiles, "See all" link |
| Zepto | Product rails with title and "See All", round black next arrow; card has image with border, outlined ADD button overlapping the image corner, green price chip, struck MRP, 2-3 line name, grey pack size | Same card anatomy with our colours; ADD becomes a stepper in place; added stock chip and slab hint |
| Blinkit | Footer with Useful Links and a long Categories index | Footer with Contact, FAQs, Terms, Privacy, GSTIN/FSSAI, WhatsApp, plus category index for SEO |
| Both | Heavy promotional banners; product catalogue is the real content | Keep banners minimal; products and search first |
Gaps in those stores that we fill for wholesale: quantity slab table, carton/piece switch, quick order and CSV, saved lists, credit statement, GST invoice, minimum order and free-delivery progress.
Full Stitch prompts are in `docs/storefront-stitch-prompts.md`; build prompt in `docs/prompts/03a-storefront-from-stitch.md`.

## 9. Stitch Design Rebuild & Dynamic Storefront Architecture (Prompt #08)
The customer storefront at `jmdcart.com` has been completely rebuilt from the exported Stitch reference designs (`design/stitch-export/ecommerce/`). All mock content has been completely replaced with live database and backend API queries.

### Architecture & Dynamic APIs (`/api/store/v1/*`)
- `GET /api/store/v1/settings` - Public store metadata (business name, support phone/WhatsApp, free delivery threshold, announcement text).
- `GET /api/store/v1/home-sections` - Dynamic home layout sections (Hero banners, categories, brands, featured products).
- `GET /api/store/v1/catalog` - Dynamic product listing with multi-attribute filtering (category, brand, price range, in-stock only), sorting, and pagination.
- `GET /api/store/v1/products/[slug]` - Complete product detail including volume price slabs, pack conversions, real-time Godown availability, and specifications.
- `GET /api/store/v1/categories` & `GET /api/store/v1/categories/[slug]` - Category directory and category-filtered product catalog.
- `GET /api/store/v1/brands` & `GET /api/store/v1/brands/[slug]` - Brand directory and brand catalog.
- `GET /api/store/v1/search` - Multi-token fuzzy search with dynamic filter options.
- `GET /api/store/v1/serviceability` - Instant pincode check against active delivery zones.
- `GET /api/store/v1/cart` & `POST /api/store/v1/cart` - Live shopping cart with volume slab rate calculation.
- `POST /api/store/v1/checkout` - Checkout processing with stock reservation, address validation, delivery slot, and optional commercial GST ITC invoice.
- `GET /api/store/v1/wishlist` & `POST /api/store/v1/wishlist` - Customer saved items.
- `GET /api/store/v1/addresses` & `POST /api/store/v1/addresses` - Saved delivery addresses with default selection.
- `POST /api/store/v1/contact` - Customer enquiries stored securely in database for admin review.
- `GET /api/store/v1/faqs` - Dynamic categorized FAQs.
- `GET /api/store/v1/pages/[slug]` - CMS store pages (About, Terms, Privacy, Shipping/Returns).

### SEO & Structured Data (JSON-LD)
- `Organization` + `WebSite` schemas emitted on Homepage with SearchAction.
- `ItemList` schema on Category, Brand, and Search result listings.
- `Product` + `Offer` schema on Product detail pages with accurate availability (`InStock` / `OutOfStock`), price, currency, and HSN/SKU.
- `FAQPage` schema on `/faqs`.
- Dynamic `sitemap.xml` listing all canonical URLs (products, categories, brands, content pages) with proper `lastmod` timestamps.
- Host-aware `robots.txt` allowing public indexing of `jmdcart.com` while strictly disallowing indexing of `management.jmdcart.com`.

### Zero Third-Party CDN Guarantee
- Google Fonts removed: Epilogue and Inter bundled via `next/font`.
- External icon font links removed: Material Symbols Outlined subset vendored locally at `/public/fonts/material-symbols-outlined.woff2`.
- Zero external trackers or analytics scripts at runtime.


