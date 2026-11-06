# PROMPT #21 — Performance rescue: jmdcart.com Lighthouse 57 → 95+, customer app from 8 s open / 26 s full load to seconds, images actually served fast from Cloudflare, verified many times (looping, self-verifying)

Save as `docs/prompts/21-performance-rescue-web-and-app.md` and paste everything below the line to the agent. **Do not create new doc files.** Update existing `docs/*.md` in place. Work is **non-destructive**: no image, product or order data is deleted, and the site must keep working at every step.

---

## THE PROBLEM (owner's Lighthouse run on https://jmdcart.com/, mobile)
- **Performance 57**, Accessibility 88, Best Practices 100, SEO 100. Lighthouse warning: *"The page loaded too slowly to finish within the time limit."*
- **FCP 4.1 s, LCP 6.0 s, Speed Index 4.3 s**, TBT 0 ms, CLS 0.
- **Total network payload 43,239 KiB (about 42 MB)**, "Improve image delivery" 3,854 KiB flagged, "Minimize main-thread work" **28.7 s**.
- Insights: render-blocking requests (740 ms), **document request latency (720 ms)**, forced reflow, network dependency tree, legacy JavaScript (11 KiB), unused CSS (17 KiB), **back/forward cache blocked (3 reasons)**, images without width/height, 8 non-composited animations, 1 long task.
- The **customer app** takes about **8 seconds to open** and about **26 seconds to finish loading**.
- The owner moved images to Cloudflare **to make the site fast**, but it is not helping.

## WHAT THE LIVE HTML ALREADY SHOWS (verify each, do not assume)
- Product and category images are referenced as `https://jmdcart.com/media/products/<id>/original.png`: **full-size original PNGs, served through the app's own `/media` route** (so through Cloud Run), **not through the Cloudflare CDN and not as resized WebP/AVIF variants.**
- Category tiles also use `original.png`; some items fall back to `https://jmdcart.com/brand/jmd-cart-logo.png` (a heavy logo repeated as a placeholder, for example "Electronics" and some products).
- The home page renders **well over 100 product cards** in one HTML response (several rails plus a full "Biscuit & Snacks" grid and more), so the DOM is large and every card pulls an image.
- Icons are an **icon font** (the text content shows names like `near_me`, `expand_more`, `favorite`).

## ROLE
You are the performance engineer for JMD Cart (Next.js 14 App Router, Prisma, Postgres on Cloud Run + Cloud SQL behind a global load balancer, Cloudflare R2 media, storefront `jmdcart.com`, customer React Native app from Prompt #20). Find the **root causes with measurements**, fix them, prove the fixes with **repeated, multi-condition measurements**, and put **guardrails** in place so speed cannot silently regress. "Done" means measured on the live site and on real devices, repeatedly, not "it looks faster".

Follow `CLAUDE.md` and `docs/rules.md`. **Never open, print or log `.env`, `.env.deploy` or any secret.** Migrations are **additive only**. Never create real orders, invoices or stock changes in production; load tests hit read-only public endpoints only.

## PART 0 — SYNC GATE (nothing is edited until this passes)
Run exactly the sync gate from `docs/prompts/11-invoice-print-agent-code.md` Part 0: `git fetch`, clean tree, fast-forward to the latest `origin/main`, confirm the commit running on **Cloud Run (100% traffic revision)** is contained in your code and production migrations all exist in the repo, work on a new branch, record the baseline of `pnpm typecheck / lint / test / build`. If branches diverged, the deployed code is not in git, or the tree is dirty: stop with `WAITING_FOR_HUMAN` and show the difference. Never reset, force-push or overwrite anyone's work. Review `git diff --stat` at the end and justify every changed file in `docs/memory.md`.

## STEP 1 — MEASURE FIRST (baseline, committed under `tests/perf/baseline/`)
1. **Lighthouse CLI against production**, mobile profile, **5 runs each** for: Home, a Category page, a Product page, Search results, Cart, Wholesale hub, a CMS page. Save the JSON and the median table.
2. **Network capture (HAR)** of the home page on a throttled mobile profile: the 30 heaviest requests by bytes and by time, number of requests, bytes by type (image, JS, CSS, font, HTML), the LCP element and what it loads, the critical request chain.
3. **Headers audit** of the HTML document and of `/media/...` images: `cache-control`, `content-type`, `content-length`, `content-encoding`, `age`, `cf-cache-status`/`x-cache` style headers, HTTP version. Record whether images are cacheable and whether any CDN actually serves them.
4. **Image inventory (read-only):** list every object in the R2 bucket and every image referenced by products, categories, banners and CMS: count, total bytes, the 50 largest, formats, natural dimensions versus the largest displayed size, how many have no resized variants, and how many were uploaded **directly in the Cloudflare dashboard** (these bypass the app's upload pipeline).
5. **Server timing:** TTFB of the HTML cold versus warm, Cloud Run revision settings (min instances, CPU, memory, concurrency, startup time, CPU boost), request logs for cold starts, load balancer and CDN configuration, database query timings for the home page (count queries, slowest, N+1).
6. **Front-end analysis:** Chrome trace of the home page (main-thread breakdown: image decode, layout, script, style), JS and CSS bundle sizes per route, hydration cost, animation properties used, forced-reflow stacks, the **bfcache blockers** (DevTools "Back/forward cache" test), DOM node count, third-party requests, font and icon-font requests, the full list of failing accessibility audits from the Lighthouse JSON.
7. **Customer app:** `adb shell am start -W` cold and warm start times, Perfetto/Android Studio trace of startup, in-app marks (process start, first frame, config loaded, home data loaded, first images visible, fully drawn via `reportFullyDrawn()`), network timeline of the first screen on the owner's phone, request count and bytes of the home screen.
Write a **root-cause table** (symptom → measured cause → fix → expected gain) in `docs/memory.md` before changing code.

Ask the human ONCE (one message, then continue):
1. **Cloudflare DNS move** (needed so images and other assets are really served by Cloudflare from `cdn.jmdcart.com`): explain that the domain's DNS must be on Cloudflare for R2 custom domains, and that **before** switching nameservers every existing record (the `A` records for `@`, `management` and `www` pointing to the Google load balancer) must be recreated **exactly as DNS-only (grey cloud)** to avoid downtime. If the owner declines, use Cloud CDN on the existing load balancer for `/media/*` instead (Part B, option 2).
2. **Cost approval:** Cloud Run `min-instances ≥ 1` with CPU boost, and CDN usage (state the estimated monthly cost first).
3. **Dependency approval (one batch):** Lighthouse and Lighthouse CI, a load-testing CLI (for example k6), a bundle analyzer, `sharp` (if not already present), and a small first-party web-vitals helper. No third-party analytics.
4. **A real low-end Android phone (Android 8 to 10, 2 to 3 GB RAM)** and a recent phone for the app and web checks.

---

## PART A — MEDIA: SMALL, FAST, REALLY ON THE CDN (the biggest win)
1. **Optimise what exists (idempotent script `scripts/optimize-media.ts`, dry-run by default, `--apply` to write):** for every image key generate **AVIF and WebP variants at widths 160, 320, 480, 640, 960 and 1280** (banners up to 1920, separate **mobile and desktop crops** for hero banners), cap the maximum dimension, strip metadata, preserve transparency, tuned quality (about WebP 75, AVIF 50, verify visually on 30 samples), plus a tiny **LQIP/blur placeholder** per image. Keys are content-hash based and immutable. **Originals move to an archive prefix and are never deleted.** Store the variants in the database additively (a `variants` JSON on the media/image records) and map every existing reference (products, categories, banners, CMS, the placeholder logo).
2. **Close the bypass:** every upload path (admin product images, quick-add, banners, category images, Excel import with images) already must use the variant pipeline; add a **media reconciler** job (nightly and an admin "Optimise images" button) that finds R2 objects or records **without variants** (including those uploaded directly in the Cloudflare dashboard) and optimises them. A health card in admin shows "images without variants: N".
3. **Serve from Cloudflare:** set up the R2 **custom domain `cdn.jmdcart.com`** (public access only through that domain; bucket stays private otherwise) with response headers `Cache-Control: public, max-age=31536000, immutable`, correct `Content-Type`, and `Vary: Accept` only if negotiating formats. Switch `MEDIA_BASE_URL` so `mediaUrl()` emits CDN URLs; keep `/media/<key>` only as a fallback that 301-redirects to the CDN. **Option 2 if the DNS move is declined:** enable Cloud CDN on the load balancer backend for `/media/*` with long TTL and a cache key without cookies. Verify with two consecutive requests that the second shows a cache **HIT**.
4. **Use images correctly everywhere** (storefront, admin lists, customer app via the API): `srcset` and `sizes` per slot (category tiles 160 px, product cards 320 to 480 px, product gallery 960 to 1280 px, banners responsive), **explicit width and height** on every image (fixes layout-shift and the Lighthouse warning), `loading="lazy"` and `decoding="async"` below the fold, **one** LCP image with `fetchpriority="high"` and a preload, aspect-ratio boxes with the LQIP, and **no repeated heavy placeholder**: replace the logo-PNG fallback with a tiny inline SVG placeholder.
5. **Budgets:** the largest image in the initial viewport at most 100 KB; the first-view home page transfer at most **1.2 MB**; at most about 25 image requests before scrolling; admin product tables use 160 px thumbnails.
**Gate A:** inventory before/after table (count, total MB, largest files), the home page's image bytes cut by at least 90%, no `original.*` URL in public HTML, CDN **HIT** proven on production, variants exist for 100% of records (reconciler report), all existing images still display.

## PART B — SERVER TIME (document request latency 720 ms, cold starts)
1. **Cloud Run:** `min-instances ≥ 1`, startup CPU boost, tuned memory/CPU/concurrency from the load test, `output: standalone`, lean imports, Prisma client and DB connection warm at start, keep-alive to Cloud SQL with a bounded pool. Measure cold start before and after.
2. **Cache the anonymous storefront:** hot data (home sections, menus, categories, brands, settings) in a small in-memory cache with TTL plus **tag-based revalidation** when admin edits; **ISR** for anonymous HTML with `s-maxage` and `stale-while-revalidate`; edge cache the anonymous HTML at the CDN layer only if safe. **Logged-in or personalised responses are never cached or shared** (cookie-aware cache key / bypass, `Cache-Control: private`). A security test proves a logged-in A/B-price page is never served to an anonymous visitor.
3. **Home page weight:** the server returns **a small first batch** (for example 12 products per rail and a few rails above the fold); the rest loads on scroll or "See all". The full 100-plus-card grid must not be in the initial HTML.
4. **Database:** indexes for the catalogue/home/search queries, eliminate N+1, `EXPLAIN` the slowest queries and record before/after timings; aggregated home endpoint for the app (Part E).
5. Compression (brotli) at the edge, HTTP/2 or HTTP/3, `Link: preload` for the LCP image and the two critical fonts, `preconnect` to `cdn.jmdcart.com`.
**Gate B:** TTFB for anonymous HTML at most 400 ms (warm) and at most 1 s (after a cold start), recorded from at least two networks; cache correctness tests green.

## PART C — FRONT-END CRITICAL PATH (render blocking, JS, CSS, animations, bfcache)
1. **Render-blocking requests:** inline the critical CSS or cut CSS to a small route-specific bundle (purge unused Tailwind, fixes the 17 KiB), defer non-critical scripts, remove CSS `@import` chains, shorten the **network dependency tree** with preload where it helps.
2. **Fonts and icons:** subset and self-host only the weights used, `font-display: swap`; **replace the icon font with an inline SVG sprite or a subset font containing only the icons used.**
3. **JavaScript:** modern `browserslist` (removes the legacy 11 KiB), server components by default, small client islands, **lazy-hydrate below-the-fold sections** (IntersectionObserver), lazy-load carousels and drawers, split the home bundle, remove unused dependencies. First-load JS for Home at most 170 KB gzipped.
4. **Forced reflow and the long task:** find the layout read-after-write stacks (carousel, sticky header, measurements) and replace with `ResizeObserver`/`IntersectionObserver` and batched reads; break up the long task.
5. **Animations:** the 8 non-composited animations animate **only `transform` and `opacity`**; honour `prefers-reduced-motion`.
6. **DOM size:** cap the initial DOM (Part B 3) and use `content-visibility: auto` for off-screen sections.
7. **bfcache:** identify the 3 blockers (typical: `Cache-Control: no-store` on the document, `unload` listeners, open SSE/WebSocket/BroadcastChannel, service worker interference) and remove them so back/forward restores instantly.
8. **Main-thread 28.7 s:** re-profile after Part A (giant PNG decode is the likely cause) and fix whatever remains.
**Gate C:** Lighthouse diagnostics for render-blocking, unused CSS, legacy JS, forced reflow, non-composited animations, width/height and bfcache are clean; main-thread work and DOM size recorded before/after.

## PART D — ACCESSIBILITY 88 → 95+
From the Lighthouse JSON and axe, list every failing audit (likely candidates: low contrast, icon-only buttons such as the "favorite" heart without an accessible name, links that contain only an image, heading order, ARIA misuse, tap-target size/spacing, missing form labels). Fix them **with in-theme token pairings only** (no new colours), keep the Stitch design intact, and record each change. Target Accessibility ≥ 95 and zero serious/critical axe issues on Home, Category, Product, Search, Cart, Checkout.

## PART E — CUSTOMER APP: 8 s OPEN AND 26 s FULL LOAD
Use the measured startup trace to fix, in this order:
1. **Server side first** (Parts A and B remove the cold-start and huge-image causes for the app too).
2. **Startup path:** never block the splash on network; show **cached last home content instantly** (persisted query cache) and refresh in the background; defer push registration, config refresh, analytics-like work and non-visible tabs until after first paint; Hermes with precompiled bytecode, `inlineRequires`, remove heavy dependencies, bundle splitting by tab, fonts bundled.
3. **Data:** one **aggregated home endpoint** (`/api/store/v1/home`) with ETag and stale-while-revalidate, small first page (12 items per rail), field selection, compressed responses, parallel requests instead of waterfalls, CDN cache for public GETs.
4. **Images:** the app only requests **variants** sized to the slot (never an original), disk-cached, with the LQIP while loading, lazy loading in lists via a virtualised list.
5. **Budgets (low-end phone, median of 5 runs):** cold start to first meaningful content **at most 2.5 s** with a warm server (at most 4 s with a cold server), home fully loaded with images **at most 5 s on 4G** and at most 10 s on a throttled 3G profile, warm start at most 1 s, first-screen payload at most 1.5 MB.
**Gate E:** before/after table of the marks from Step 1.7 on the low-end phone and a recent phone, release build only.

## PART F — GUARDRAILS SO IT STAYS FAST
- **Lighthouse CI** config committed (mobile): Performance ≥ 95, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95, LCP ≤ 2.5 s, FCP ≤ 1.8 s, TBT ≤ 200 ms, CLS ≤ 0.1, total byte weight ≤ 1.5 MB, for Home, Category, Product, Search (Cart and Checkout ≥ 90). `scripts/perf-gate.ps1` runs it and is wired into `scripts/deploy-gcp.ps1`: **fail the deploy and roll back** if a budget is missed.
- **Static guards:** a test fails if public HTML contains an `original.*` image URL, an image without width/height, a request over the image budget, an uncompressed response, or JS above the route budget.
- **Real-user monitoring (first-party, no third-party SDK):** a sampled `/api/rum` beacon for LCP, INP, CLS, TTFB (web and app), an admin "Performance" card showing p75 by page and device, and an alert when p75 regresses past the budget.
- **Media health card** (images without variants, largest images, CDN hit ratio if available).

## PART G — VERIFICATION (repeat, vary conditions, never trust one run)
1. **Lighthouse CLI mobile, 5 runs per page type, median reported**, in three sessions at different times; both simulated and applied throttling (3 runs each); cold (after a cache purge) and warm.
2. **Real devices:** the low-end Android phone on real 4G with Chrome remote debugging (Home and Product page traces), and the app (Part E marks).
3. **Production header proofs:** images return `cache-control: public, max-age=31536000, immutable`, small `content-length`, correct type, a cache **HIT** on the second request, from the CDN host; the HTML returns the expected cache headers; compression on.
4. **Load test (read-only):** 100 concurrent virtual users for 2 minutes on Home, Category and Product: p95 TTFB at most 500 ms, error rate under 1%, no instance thrash; record Cloud Run instance count and cost impact.
5. **Correctness:** logged-in versus anonymous cache isolation test, prices and stock unchanged, all existing web/API/e2e suites pass unchanged, storefront screenshots visually identical except where images are now sharper or lazy, SEO still 100 with unchanged structured data, bfcache restore demonstrated.
6. **Before/after table** for every metric from Step 1 (Lighthouse scores and metrics, payload bytes, request counts, TTFB, DOM nodes, JS/CSS size, app marks).
7. **Stability:** run the whole suite twice, then once from a clean install; results identical.
**Targets:** Performance ≥ 95 (median of 5) on Home, Category, Product, Search; Accessibility ≥ 95; LCP ≤ 2.5 s, FCP ≤ 1.8 s, Speed Index ≤ 3.4 s, TBT ≤ 200 ms, CLS ≤ 0.1; home first-view transfer ≤ 1.2 MB; the "loaded too slowly" warning gone; app targets from Part E. If a target is missed, find the cause, fix, and rerun; never lower the bar or disable an audit.

## PART H — DEPLOY, MONITOR, DOCS
1. Order of rollout (each step verified before the next, each reversible): non-destructive media optimisation → CDN domain and `MEDIA_BASE_URL` switch → code changes (images, CSS, JS, caching) → Cloud Run settings → guardrails. Run additive migrations via the existing migration job, deploy with the existing script (revision labelled with the commit SHA), run `scripts/smoke-prod.ts` (extended: CDN image headers, cache isolation, perf gate), roll back automatically on failure.
2. After deploy, rerun Part G on the live site, then **again after 24 hours** (record both). Provide the owner a PageSpeed Insights link to check himself, with a note that lab scores vary by a few points between runs.
3. Update in place: `docs/architecture.md` (media pipeline, CDN, caching and ISR rules, Cloud Run settings, RUM), `docs/rules.md` (never serve originals to clients; every image has variants; public HTML must stay within budgets; personalised responses never cached; performance gate blocks deploys), `docs/design.md`, `docs/storefront.md`, `docs/tasks.md`, `docs/memory.md` (root-cause table, before/after numbers, costs, open items).

## LOOP (follow strictly)
```
Part 0 sync gate → Step 1 baseline → for each of Parts A to F:
  state the root cause with data → write the guard test (failing first) → implement the smallest correct change
  → run: pnpm typecheck; pnpm lint; pnpm test; pnpm build; the Lighthouse run for the pages in scope
  → compare with the baseline; if the target is not met: find the next cause, fix, rerun
  → proceed only when the part's gate is green and demonstrated
Then Part G (three sessions) → Part H → re-verify everything once more, 24 hours later.
```
- Never claim an improvement without the measurement; quote before/after numbers in `docs/memory.md`.
- Never weaken or delete a failing test, never delete an original image, never cache personalised pages, never remove a feature to gain speed, never lower a budget, never force-push.
- Same failure 5 times: write hypotheses and evidence in `docs/memory.md`, try a different approach. Ask the human only after 3 different approaches fail, with the exact error.
- When blocked on a human action (Cloudflare DNS move, cost approval, real phone, diverged git), print `WAITING_FOR_HUMAN: <what>` with exact steps and keep working on whatever does not depend on it.
- Local tests use the isolated test DB. Never run destructive scripts against production.

## FINISH
Only when all gates pass, print exactly:

`PROMPT 21 COMPLETE — images on CDN PASS — Lighthouse 95+ PASS — accessibility 95+ PASS — app speed PASS — guardrails PASS — verified repeatedly PASS`

then: the commit live before and after, the root-cause table, the before/after table (scores, LCP/FCP/SI, payload MB, requests, TTFB, app open and full-load times), image inventory before/after, CDN hit proof, load-test results, cost changes (min instances, CDN), files changed with reasons, open items (Agentic Browsing audit that scored 1/2, Cloudflare DNS steps completed or pending). If you cannot reach that state, print `PROMPT 21 BLOCKED` with the exact blocker.
