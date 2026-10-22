# PROMPT #08 — Rebuild the jmdcart.com customer storefront from the Stitch design: fully dynamic, API-driven, responsive, SEO 95+ (looping, self-verifying)

Save as `docs/prompts/08-storefront-stitch-redesign.md` and paste everything below the line to the agent. **Do not create new doc files.** Update the existing `docs/*.md` (especially `docs/storefront.md`, `design.md`, `tasks.md`, `memory.md`) in place. Design assets go under `design/stitch-export/` (not docs).

---

## ROLE
You are a senior full-stack engineer + UI engineer finishing the **customer side of JMD Cart (`jmdcart.com` only)**. You rebuild every customer-facing page so it matches the **Stitch design exactly**, makes **everything dynamic from the backend**, is **fully responsive**, and scores **95+ on Lighthouse (Performance, Accessibility, Best Practices, SEO)** on mobile. "Done" means built, running, measured, and verified, not "it compiles".

## SCOPE RULES (hard)
1. **Only the public storefront changes.** `management.jmdcart.com` and every staff screen (`/admin`, `/godown`, `/shop`, `/van`, `/delivery`, `/reports`, `/setup`, `/management`) stay exactly as they are visually and behaviorally. Allowed on the staff side, **additive only**: new CRUD entities, a new sidebar group "Storefront" in `nav.config.ts`, and extra SEO/content fields on existing forms, all via the existing CRUD kit and styling. Take before/after screenshots of 6 key staff screens (admin dashboard, products, orders, godown stock, POS, van billing); the only allowed diff is the new nav group.
2. **Do not change the token values in `tailwind.config.ts`.** They already equal the Stitch tokens and the staff UI uses them.
3. Keep the empty-start guarantee (#05). Mock content from the design (product names, prices, phone numbers, "Free delivery above ₹2,000", etc.) is **reference only**. At runtime all of it comes from the database/settings. Test fixtures live only under `tests/`.
4. Keep all business rules: A/B/C price lists by buyer type, anonymous visitors see C only, A/B only after login + approval, godown availability = godown loose + (openable cartons × pack size), out-of-stock shown with badge and disabled Add to Cart, admin-configurable delivery rules, COD/credit payment modes per settings.
5. No third-party scripts, trackers, embeds, or CDN assets at runtime. Fonts and icons are self-hosted. The design export uses `cdn.tailwindcss.com`, Google Fonts links, Material Symbols from Google and `lh3.googleusercontent.com` images; **none of that may ship**. Use the project's compiled Tailwind, `next/font`, a vendored icon font subset, and images from `/public/brand` or uploads.
6. Follow `CLAUDE.md` and `docs/rules.md`. Ask once, up front, before adding dependencies (see Step 1).

## STEP 0 — READ FIRST
Read `CLAUDE.md`, `docs/memory.md`, `tasks.md`, `rules.md`, `docs/storefront.md`, `design.md`, `prisma/schema.prisma`, `tailwind.config.ts`, `next.config.mjs`, `src/middleware.ts`, `src/lib/host-routing.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `sitemap.ts`, `robots.ts`, `src/modules/{store,cart,order,pricing,stock,banners,settings,wishlist,address}`, `src/components/store/*`, and every file under `src/app/store/*` and `src/app/api/store/*`. **Never open, print or log `.env`, `.env.deploy` or any secret.** Confirm they are git-ignored and excluded from `.dockerignore`/`.gcloudignore`.

Copy the Stitch export into `design/stitch-export/ecommerce/` (the 14 files: `index.html`, `category.html`, `checkout.html`, `wholesale.html`, 4 product pages, `cart.js`, `DESIGN.md`, `design.tokens.json`, `design.config`, `.design`, `README.md`). It holds 8 reference screens: Home, Category, Checkout, Wholesale hub, and 4 product pages.

## STEP 1 — HUMAN INPUTS (ask ONCE in one message, then continue)
1. **Stitch MCP.** Check whether a Stitch MCP server is already available in your tool list. If yes, verify it (list projects/screens). If not, **add it first**: look up the current official Stitch MCP/SDK setup instructions, add the server to your MCP configuration, and verify the connection. The human supplies the Stitch API key (from Stitch settings) via environment/secret store; never write it into the repo. Do not start page work until Stitch is verified, or until the human explicitly says to proceed with the export only (then log that decision in `docs/memory.md`).
2. **Dependency approval (one batch).** Propose the exact dev/runtime additions you need and why, for one yes/no: Lighthouse CI (`@lhci/cli`), `@axe-core/playwright`, `pixelmatch` + `pngjs` (fidelity diffs), `sharp` (image sizes, if not already present via Next). If refused, use `npx` on-demand equivalents.
3. **Content owner inputs** you cannot invent: real business phone, WhatsApp number, address, hours, GSTIN, FSSAI number, social links, policy wording, product photos. Build the admin fields and pages; leave values empty until entered. Pages must render a clean state when a value is missing (hide the element, no placeholder text).

## STEP 2 — DESIGN SOURCE OF TRUTH
- The **rendered result of the exported HTML pages is the standard**. Where `DESIGN.md` prose and the exported pages disagree, the pages win. Known disagreements to resolve by inspecting the HTML: prose says primary `#7A2433` while tokens/HTML use `primary #5c0c1e` with `primary-container #7a2433` (header strip and cards use `primary-container`); prose says CTA orange `#F28C28` while HTML uses `secondary-container #fc9430`; `rounded` DEFAULT differs (HTML config: `0.25rem`, `lg 0.5rem`, `xl 0.75rem`). Record the final decisions in `docs/design.md`.
- Typography: Epilogue (display) + Inter (UI), tabular figures on prices/quantities, no text under 11px. Icons: Material Symbols Outlined, vendored as a subset font containing only the icons used.
- Keep Tailwind class names from the export wherever possible. Port class-for-class, replacing only mock data and CDN assets.
- Layout rules from the design: mobile ≤640px 2-column grid, 12px gutters, 16px margins; 641–1024px 4-column with persistent bottom navigation and a category drawer; ≥1025px 12-column, max-width 1280px, 3 columns navigation / 9 columns catalog; sticky bottom cart bar; elevation levels and shapes as specified.
- **Accessibility vs exact theme:** white text on `#fc9430` fails WCAG AA. Fix it with in-theme token pairings only (for example `on-secondary-container #663500` on `secondary-container`), run a contrast audit over every text/background pair, and list each deviation from the Stitch pixels in `docs/design.md` for the owner. Do not introduce new colors.
- **No fake social proof.** If the design shows ratings, reviews or "X sold" counts, render them only from real data (a moderated reviews table). With no real data, hide the block and never emit `aggregateRating` JSON-LD.

## STEP 3 — STITCH WORKFLOW (use Stitch wherever a screen is needed)
For every page in the page list below:
1. Look for it in the export. If present, use it as the reference.
2. If absent, **generate it with Stitch MCP** using the JMD Cart design system (tokens + `DESIGN.md`) and 2 or 3 export screens as style references. Request both a mobile and a desktop layout. Keep the same header, footer, spacing, components and tone.
3. Save the generated HTML and screenshots under `design/stitch-export/<page>/` for traceability.
4. Port to React (server components by default, small client islands for interactivity) with the same classes. Never paste Stitch HTML wholesale; extract shared components.
5. Fidelity test (see Part G).
If Stitch is unavailable mid-task, stop generating new screens, finish what has references, log `WAITING_FOR_HUMAN: Stitch`, and continue with the rest.

## STEP 4 — PAGES (all customer-facing, all designed through Stitch, all driven by the backend)
**P0 (must ship):**
Home · All Categories · Category listing (filters, sort, pagination) · Brand listing + Brand page · Search results · Product detail · Wholesale hub · Cart (page + mini-cart drawer) · Checkout · Order success · Login / Register / OTP (restyle existing flows) · Account (profile, addresses, GST details, orders, wishlist, credit summary for credit parties) · Order list, Order tracking, Invoice view (restyle) · Wishlist · Contact (form saved to DB, visible in admin) · About · Delivery & serviceability · Shipping/Refund/Returns policy · Terms · Privacy · FAQs · Wholesale enquiry / become a retailer · 404 · 500 · Offline · Maintenance.
**P1 (after P0 passes all gates):** Guides/blog (CMS articles for SEO), recently viewed, recommendations rail.
Policy pages must reflect the actual business rule (no market-return policy for customers/retailers). Ship them as CMS pages with owner-approval status; the default text is a draft and must be flagged in admin as "needs owner review".

**Global components:** announcement strip (text from settings, no hardcoded offers), header (logo, serviceable-area chip, search with live suggestions, account, wishlist, cart with count and total, category navigation with mega-menu on desktop, hamburger drawer + bottom nav on mobile), footer (columns from CMS menus, contact block, GST/FSSAI trust badges, accepted payment modes, social links, PWA install), floating cart bar, toasts, breadcrumbs, skeletons, empty and error states.

## STEP 5 — DYNAMIC DATA LAYER (everything managed from the backend)
**Additive Prisma migrations only (never drop or rewrite data):**
- `Product`: `slug` (unique, stable), `description`, `highlights` (JSON list), `specs` (JSON), `metaTitle`, `metaDescription`, gallery table `ProductImage(productId, url, alt, sort, width, height)`.
- `Category` and `Company` (brand): `slug`, `description`, `imageUrl`, `metaTitle`, `metaDescription`, `sort`, optional `parentId` for category, `featured`.
- `SlugRedirect(entity, oldSlug, newSlug)` so renamed slugs 301 forever.
- CMS: `StorePage(slug, title, body blocks, status draft/published, needsReview, seo fields)`, `HomeSection(type, title, config JSON, sort, active)` (hero banners, category rail, brand shelf, product shelves by rule: featured / best sellers / new / wholesale deals, trust strip, promo tiles), `MenuItem(menu, label, href, sort, parent)`, `Faq(group, question, answer, sort)`, `ContactMessage`, `ProductReview(moderated)` and `StoreSettings` keys (phone, WhatsApp, address, hours, social, tagline, announcement text, free-delivery text derived from delivery rules, logo, OG default image).
- Slugs auto-generated from names on import and in admin, collision-safe. Backfill slugs for existing products/categories/brands in the migration script, idempotent.

**API:** versioned public JSON API under `/api/store/v1/*` (catalog, categories, brands, product by slug, search + suggestions, home sections, menus, pages, FAQs, settings, serviceability check, cart, pricing quote, checkout, orders, wishlist, addresses, contact). Zod-validated input and output, consistent error shape, rate limiting on search/contact/OTP, sensible `Cache-Control`/ISR tags. **One service layer, thin handlers.** Server components call the same service functions the API wraps, and client islands call the API. Add contract tests so the API and the pages cannot drift.
- Prices are **always computed on the server**. The client never decides price, tier, tax or availability. Cart changes call a debounced pricing quote.
- Guest cart: cookie-keyed server cart that merges into the user's cart on login. Anonymous visitors get C prices.
- Admin edits trigger **on-demand revalidation by tag** so storefront pages update quickly without a redeploy.

**Staff side (additive):** CRUD entities for the above via the existing registry and kit, nav group "Storefront" (Home Sections, Banners (existing), Pages, Menus, FAQs, Reviews, Enquiries, Storefront Settings, Redirects). SEO fields on product/category/brand forms with live preview of the Google snippet. Image upload through the existing upload route with type/size validation and content-hash filenames.

## STEP 6 — URLS, ROUTING, HOSTS
- Clean canonical URLs: `/`, `/categories`, `/category/[slug]`, `/brands`, `/brand/[slug]`, `/product/[slug]`, `/search`, `/wholesale`, `/cart`, `/checkout`, `/account/*`, `/orders/*`, `/wishlist`, `/page/[slug]` (or top-level `/about`, `/contact`, `/faqs`, `/privacy`, `/terms`, `/shipping-policy`, `/delivery`). Keep `/login` and `/register`.
- **301-redirect every old URL** (`/store`, `/store?category=`, `/store?company=`, `/store/products/[id]`, `/store/wholesale`, `/store/cart`, `/store/checkout`, `/store/orders/*`, `/store/account`, `/store/wishlist`) to its new canonical equivalent, preserving query intent. Test every mapping.
- Update `host-routing.ts` and middleware: all new storefront routes are public on `jmdcart.com`; on the management host they redirect to `https://jmdcart.com` (existing behavior extended); staff routes still 404 on the storefront host. Add tests.
- Trailing-slash policy consistent; unknown slugs return a real 404 status.

## STEP 7 — SEO (target Lighthouse SEO 100, overall 95+)
- Metadata API on every page: unique title and description (from SEO fields with smart fallbacks), canonical, Open Graph, Twitter card, `en_IN` locale, default OG image. Remove hardcoded claims from `layout.tsx` ("1,800+ products", fixed offers); derive from the DB or omit.
- JSON-LD (server-rendered, valid): `Organization`, `GroceryStore`/`LocalBusiness` with NAP from settings, `WebSite` + `SearchAction`, `BreadcrumbList` everywhere, `Product` + `Offer` (INR, price, availability InStock/OutOfStock, URL, GTIN only if real), `ItemList` on category/brand pages, `FAQPage` where FAQs exist. No `aggregateRating` without real reviews.
- `sitemap.xml` as an index (products, categories, brands, pages) with real `lastmod`, only canonical indexable URLs. `robots.txt`: allow storefront, disallow `/api/`, cart, checkout, account, orders, `/search`, and parameterized filter combos; management host stays disallow-all with `noindex`.
- Faceted/filter/sort/search URLs: `noindex, follow` with canonical to the base listing. Pagination via `?page=` with self-canonical and links in markup.
- One `h1` per page, logical heading order, descriptive alt text from product name + pack, descriptive link text, breadcrumb markup, internal links (related, same brand, same category), semantic landmarks, `<html lang="en-IN">`, `theme-color`, valid `manifest`.
- Out-of-stock products stay indexed with `OutOfStock` availability. Deleted/archived products return 410 or 301 to the category.

## STEP 8 — PERFORMANCE, ACCESSIBILITY, BEST PRACTICES
- Server components by default; client JS only for cart steppers, search suggestions, drawers, gallery, forms. Per-route first-load JS budget (target ≤ 170 KB gzipped on Home; justify any excess in `docs/memory.md`).
- LCP: hero/main image via `next/image` with `priority`, correct `sizes`, AVIF/WebP, explicit width/height; preload only needed font weights; `display: swap`. CLS < 0.1: reserve space for every image, banner, header, bottom bar and skeleton. INP < 200 ms: no long tasks on stepper/search; debounce quotes; optimistic UI with server reconciliation.
- Fonts: Epilogue 600/700 and Inter 400–700, Latin subset, self-hosted. Icon font vendored and subset.
- Caching: `immutable` for static assets and hashed uploads, ISR with tag revalidation for HTML, compression on. Service worker must never serve stale HTML for SEO-critical pages and must not break the offline page.
- Accessibility to WCAG 2.2 AA: contrast audit passed, visible focus rings (design uses a 2px maroon outline), full keyboard use (drawers trap focus, Escape closes), labels and `aria-live` for cart updates, tap targets ≥ 44px with spacing, `prefers-reduced-motion`, form errors announced. Automated axe checks must show zero serious/critical issues on every page type.
- Best Practices: HTTPS-only assets, no console errors, no deprecated APIs, image aspect ratios correct, security headers kept.

## STEP 9 — RESPONSIVE (header, footer and every page)
Test at 320, 360, 390, 768, 1024, 1280, 1536 px and in landscape phone. No horizontal scroll anywhere. Header collapses cleanly (strip → hamburger drawer, search becomes a full-width row, bottom nav on mobile/tablet). Footer reflows to accordions on mobile. Respect safe-area insets (bottom bar vs bottom nav must never overlap). Tables (tier price, order lines) scroll inside their own container or restack. Test on a throttled low-end Android profile (4× CPU slowdown, slow 4G) for the Lighthouse runs.

## PARTS AND GATES (loop each until its gate is fully green)

**Part A — Foundations.** Stitch verified, export copied, tokens/fonts/icons vendored, data-model migrations + slug backfill, service layer + `/api/store/v1`, host-routing + redirects, shared design components.
Gate A: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` green; migrations apply on a fresh DB and on a copy of the current DB with zero data loss; `db:verify-empty` still shows 0 business rows; redirect-map test passes.

**Part B — Shell.** Header, footer, drawers, bottom nav, mini-cart, floating bar, announcement strip, breadcrumbs, skeletons.
Gate B: matches the Stitch header/footer at 360/768/1280 (Part G diffs), keyboard and a11y checks pass.

**Part C — Discovery pages.** Home (CMS sections), categories, category/brand pages, search + suggestions, product page.
Gate C: dynamic data only (edit in admin → storefront updates after revalidation), JSON-LD validates, canonical/robots rules tested, Lighthouse ≥ 95 ×4 for Home, Category, Product.

**Part D — Buying flow.** Cart, pricing quote, checkout, success, auth restyle, account, orders, tracking, invoice, wishlist.
Gate D: Playwright e2e: guest browse → add (C price) → login/register → B or A price after approval → cart updates → checkout with delivery rule → order created → appears in management orders → godown availability reduces; out-of-stock behavior; guest-cart merge.

**Part E — Content pages.** About, Contact (stored enquiries), Delivery, policies, Terms, Privacy, FAQs, Wholesale enquiry, 404/500/offline/maintenance.
Gate E: all render from CMS, flagged `needsReview` where owner approval is required, empty-value states clean.

**Part F — SEO / performance / accessibility hardening.**
Gate F: against `next build && next start` (production mode), Lighthouse mobile median of 3 runs **≥ 95 in Performance, Accessibility, Best Practices and SEO** for Home, Category, Brand, Product, Cart, Checkout, Wholesale, Contact, one CMS page. Axe: zero serious/critical. Rich-result structured data valid. Record the scores table in `docs/memory.md`. If a score is below 95, find the cause, fix, rerun; never lower the bar or disable audits.

**Part G — Fidelity and responsiveness QA.** For every page, render with a fixed **test fixture** (mirroring the Stitch mock content, under `tests/` only) at 360/768/1280 and compare against the Stitch reference screenshots with a pixel diff (target ≤ 4% changed pixels per page, ignoring dynamic regions you explicitly mask). Add a token test asserting computed colors, fonts, radii and spacing on key elements equal the tokens. Review visually and list every intentional deviation (contrast fixes, removed fake data) in `docs/design.md`.
Gate G: all diffs under threshold, deviations documented, no horizontal scroll at any tested width, staff-screen before/after screenshots unchanged except the new nav group.

**Part H — Finish.** Update `docs/storefront.md`, `design.md`, `architecture.md`, `tasks.md`, `memory.md` in place (URLs, API, CMS entities, SEO rules, redirect map, scores, deviations, open items). Run the full verification once more from a clean state.

## LOOP (follow strictly)
```
for each PART (A → H):
  plan → write tests → build → run the gate checks → read the real output
  open the running app, exercise it, screenshot at 360 and 1280
  if anything fails: root-cause it, fix, rerun from the start of that part's checks
  proceed only when the gate is fully green and demonstrated
```
- Never claim success without running the check and reading its output; quote key result lines in `docs/memory.md`.
- Never weaken or delete a failing test, lower a Lighthouse threshold, disable an audit, or add `noindex`/hacks to dodge a check.
- Same failure 5 times: write hypotheses and evidence in `docs/memory.md`, then try a different approach. Ask the human only after 3 different approaches fail, with the exact error.
- When blocked on a human action (Stitch key, content values, approvals), print `WAITING_FOR_HUMAN: <what>` with exact steps and keep working on everything that does not depend on it.
- Small commits per task. The app must compile after every step.

## FINISH
Only when all gates pass, print exactly:

`STOREFRONT COMPLETE — fidelity PASS — Lighthouse 95+ PASS — e2e PASS — staff UI unchanged PASS`

then: page list with URLs, Lighthouse score table (median of 3, mobile), list of intentional design deviations, new admin entities, redirect map summary, open items (content owner inputs, policy approvals, post-deploy re-measure on the live URL, Google Search Console/Bing submission, Google Business Profile). If you cannot reach that state, print `STOREFRONT BLOCKED` with the exact blocker.
