# PROMPT #20 — JMD Cart customer mobile app (native, not a PWA): same design, every jmdcart.com feature, plus the extras that make a shopping app great (looping, self-verifying)

Save as `docs/prompts/20-customer-native-app.md` and paste everything below the line to the agent. **Do not create new doc files** (the app project, design exports and scripts are code/assets, not docs). Update existing `docs/*.md` in place. The website and management panel keep working exactly as they do today: backend changes are **additive only**.

---

## WHAT THE OWNER ASKED
Create a **real app** (not a PWA) for the **customer side of https://jmdcart.com/**, with the **same design** and **all the website's features**. The owner also invited **extra features** where they make sense. All screens must be designed with **Stitch**.

## ROLE
You are the lead mobile engineer for JMD Cart. The web stack is Next.js 14, Prisma, Postgres on Google Cloud Run + Cloud SQL, storefront at `jmdcart.com`, staff panel at `management.jmdcart.com`, storefront API under `/api/store/v1`, media on Cloudflare R2, Stitch-designed storefront (Prompt #08), native Godown app already exists. Build the customer app, prove it against a feature-parity checklist and several independent test layers on real devices, ship a Play-Store-ready release, and verify against production. "Done" means built, run on devices, measured, verified, not "it compiles".

Follow `CLAUDE.md` and `docs/rules.md`. **Never open, print or log `.env`, `.env.deploy` or any secret.** Backend migrations are **additive only**. **Never create real orders, invoices or stock changes in production** during verification: use the test database, a clearly marked test customer and a test device.

## PART 0 — SYNC GATE (nothing is edited until this passes)
Run exactly the sync gate from `docs/prompts/11-invoice-print-agent-code.md` Part 0: `git fetch`, clean tree, fast-forward to the latest `origin/main`, confirm the commit running on **Cloud Run (100% traffic revision)** is contained in your code and production migrations all exist in the repo, work on a new branch, record the baseline of `pnpm typecheck / lint / test / build`. If branches diverged, the deployed code is not in git, or the tree is dirty: stop with `WAITING_FOR_HUMAN` and show the difference. Never reset, force-push or overwrite anyone's work. Review `git diff --stat` at the end and justify every changed file in `docs/memory.md`. Minimal diffs to existing web code.

## STEP 1 — READ, MAP, HUMAN INPUTS
Read `CLAUDE.md`, `docs/memory.md`, `tasks.md`, `rules.md`, `docs/storefront.md`, `design.md`, `tailwind.config.ts`, `design/stitch-export/**`, `prisma/schema.prisma`, `src/modules/{store,cart,order,pricing,stock,wishlist,address,banners,settings}`, every route under `src/app/store/*`, `src/app/api/store/*`, `/api/store/v1/*` (Prompt #08 output, if present), the auth/OTP code, the messaging gateway and SMS/WhatsApp sender (Prompt #19, if present), the push/FCM code and the native Godown app (for conventions), `mediaUrl`, `next.config.mjs`.

Record in `docs/memory.md`:
- **Website feature inventory:** every customer-facing page, component and action of jmdcart.com (home sections, categories, brands, search and suggestions, product page with pack/unit/tier prices, wholesale hub and retailer registration, cart, checkout, order success, orders and tracking, invoice view, wishlist, account with profile/addresses/GST/credit summary, contact, CMS pages, FAQs, policies, 404/offline/maintenance). This list is the **parity checklist** for the app.
- **API readiness:** which of those features already have a clean `/api/store/v1` endpoint, and which are server-rendered only (these need an endpoint, added additively, sharing the same service layer so web and app can never disagree).
- The **design tokens and Stitch exports** to reuse.

Ask the human ONCE (one message, then continue; use the defaults if there is no answer):
1. **Stitch MCP:** if not connected, ask the human to connect it (current official setup, key via environment/secret store, never the repo); verify by listing projects. If unavailable and the human says continue, use the existing Stitch exports and design system and log it.
2. **Platform decision (default):** build in **React Native with TypeScript** so one codebase covers Android and iOS and reuses the web team's language and API types; **ship Android first** (Play Store, internal testing track, then production). iOS needs a Mac and an Apple Developer Program account; prepare the code for iOS but mark the iOS release `WAITING_FOR_HUMAN`. If the existing native Godown app's stack strongly argues for a different choice, state the reason and pick, but keep one codebase for both platforms.
3. **Accounts and tooling:** Google Play Console developer account (one-time fee), the app id `com.jmdcart.shop`, a Firebase project (the existing one is fine, with a new Android app registered and `google-services.json`), JDK 17 and the Android SDK on the build machine, at least one **low-end Android phone (Android 8 to 10, 2 to 3 GB RAM)** and one recent Android 14+ phone for testing, the logo and an adaptive-icon source.
4. **Dependency approval (one batch with versions and reasons):** React Native + Expo SDK libraries used **without any paid cloud build service** (local builds with Gradle; no EAS dependency), navigation, data fetching/cache, secure storage, push (FCM), image caching, i18n, a list virtualisation library, and test tooling (Jest, React Native Testing Library, Maestro for end-to-end). No analytics or ad SDKs.
5. **Hindi:** the app ships **English and Hindi (Devanagari)** UI text; the agent writes the Hindi strings, the owner reviews them.

---

## PART A — MAKE THE BACKEND MOBILE-READY (additive, shared service layer)
1. **Complete `/api/store/v1`** so every feature on the parity checklist has a JSON endpoint (catalog, categories, brands, product by slug, search and suggestions, home sections/CMS, menus and pages, FAQs, settings, serviceability, delivery slots, cart, pricing quote, checkout, orders, tracking, invoice link, wishlist, saved lists, addresses, profile, GST details, credit summary and ledger, contact, notify-me, reorder, notification preferences). Same Zod schemas and same services as the web pages; add contract tests so web and API cannot drift.
2. **Auth for apps:** phone-OTP login returning a short-lived access token plus a rotating **refresh token** (device-bound, revocable, stored by the app in the Android Keystore/secure storage); retailer/wholesaler approval and price-list rules unchanged (anonymous = list C, A/B after login and approval). OTP delivery through the existing own-system channels (SMS gateway and WhatsApp driver from Prompt #19, or the safe fallback if not configured), formatted for **Android SMS auto-fill**, with rate limits, lockouts and audit. Guest cart that merges on login.
3. **Device and push registry:** `CustomerDevice` (user, platform, FCM token, app version, locale, notification preferences, last seen) with register/unregister/heartbeat endpoints; unregister on logout; invalid tokens cleaned automatically.
4. **App configuration endpoint** (`/api/store/v1/app-config`): minimum supported version (soft and forced update), maintenance mode and message, feature flags, support phone and WhatsApp, store hours, delivery area text, language defaults. Editable from the existing Storefront Settings in admin (additive fields).
5. **Performance and caching:** ETag/Last-Modified on catalogue, home and menus; pagination with stable cursors; image variants through `mediaUrl` (the R2 sizes from Prompt #09) so lists load small images; gzip/brotli; rate limiting; a published **OpenAPI document** generated from the schemas, used to generate the app's typed client (no hand-written drift).
6. **Account deletion** endpoint and flow (required by Google Play): deletes or anonymises personal data while keeping accounting records legally required for invoices and ledgers, with a clear confirmation and a web page at `jmdcart.com/delete-account` for the same request.
7. Data returned to the app must never include staff-only fields (agent code, cost, other buyers' prices). Add leak tests.
**Gate A:** every checklist feature has an endpoint with a contract test; token auth, refresh rotation, revocation, OTP limits, device registry and account deletion are tested; app-config and OpenAPI are served; existing web tests unchanged; production smoke script extended.

## PART B — DESIGN WITH STITCH (same design, native feel)
1. The app uses **exactly the same design system** as the storefront: tokens from `design.tokens.json` / the Tailwind config (maroon, orange, amber, leaf green, cream), Epilogue + Inter, the same radius, spacing, elevation and component look. **Generate the React Native theme from the token file with a script** (never copy values by hand) and fail the build if they drift.
2. Using **Stitch**, generate native-app screens at 360×800 (and a larger-phone check) for every screen in Part D, reusing the storefront exports as style references, plus the app-only screens: splash, language picker, onboarding (3 slides max), serviceability/area check, bottom-tab shell, in-app notification inbox, order tracking, saved lists, update-required and maintenance screens, empty/error/offline states. Save HTML and screenshots under `design/stitch-export/customer-app/<screen>/`.
3. Native conventions: bottom tab bar (Home, Categories, Cart, Orders, Account) with a badge on Cart, sticky "View cart" bar on listing screens, back gestures, pull-to-refresh, skeleton loading, haptic feedback on add-to-cart, 48 px touch targets, dark-mode **optional** (P1), safe-area insets, large-font support, TalkBack labels.
4. "Same design" means same look, tokens, components and tone, not a pixel-identical copy of web CSS. Record any native adaptation in `docs/design.md`.
**Gate B:** the theme file is generated from tokens and a drift test passes; every Part D screen has a Stitch reference; a side-by-side catalog (website at 390 px versus app) is saved for review.

## PART C — APP FOUNDATION
Project in a clearly separated folder (for example `apps/customer-app/`, or `mobile/customer/`), TypeScript strict, Hermes, new-architecture-ready, Android release config (R8/minify on, 64-bit, AAB), `scripts/build-customer-app.ps1` (clean build, tests, signed AAB and APK), environment config (staging/production API base URLs), typed API client generated from OpenAPI, error boundaries, in-house **crash and error reporting** to our own endpoint (no third-party SDK), structured logging without personal data, secure token storage, offline-aware networking with retry/backoff, i18n framework (English/Hindi), design-token theme, navigation, shared components (ProductCard with ADD/stepper, price block with tier hints, search box using the shared matching rules from the API, sticky cart bar, skeletons, empty states, toasts).
**Gate C:** the app builds and runs on an emulator and a real phone, tests run in CI-like script, bundle and install size recorded (targets: install size under 25 MB, cold start under 2.5 s on the low-end phone).

## PART D — SCREENS AND FEATURES (parity checklist; nothing on the website may be missing)
Home (CMS sections, banners, category rail, brand shelves, product rows, announcement text) · All categories · Category listing (filters, sort, infinite scroll) · Brand list and brand page · **Search** (instant suggestions, `bhuj 400`-style name + weight matching, price and weight in results, out-of-stock last, recent searches) · Product page (gallery with swipe and zoom, pack/unit options Pcs/Carton/Dozen/Bag where offered, tier-price table and "add N more to get wholesale price" hint, stock status, delivery check, description/specs, share) · Wholesale hub and **retailer/wholesaler registration with GSTIN** · Cart (live server-priced totals, delivery charge from admin rules, minimum order messages) · Checkout (address, delivery slot, payment mode COD / credit for eligible accounts, order summary, GSTIN for a GST bill) · Order success · Orders list and **live tracking** (Booked, Accepted, Packing, Packed, Out for delivery, Delivered, with call-delivery-person after dispatch) · Cancel before packing · Invoice/bill view and share (the secure bill link, opened in-app) · Wishlist · Account (profile, addresses with area/serviceability, GST details, credit summary and ledger statement for credit parties, notification preferences, language, delete account) · Contact and support (call and WhatsApp buttons from settings, enquiry form) · FAQs, About, Delivery info, policies (CMS) · Offline, maintenance and update-required screens.
Rules: prices only from the server; anonymous browsing like the website; A/B prices only after login and approval; no fake ratings or reviews; every empty state offers a next action; all text through i18n.
**Gate D:** a machine-checkable `parity.json` maps every website feature to an app screen (or a recorded, justified exclusion); a test fails if any checklist item is unmapped; Maestro end-to-end flows pass on an emulator: browse, search by fragment, add to cart with tier price change, register/login with OTP, place a COD order, track it, reorder, cancel, change language.

## PART E — NATIVE CAPABILITIES (what makes it an app, not a PWA)
1. **Push notifications (FCM):** order status updates (high importance channel), back-in-stock for **Notify me** items, and **opt-in only** offers (separate channel, consent stored, quiet hours respected). Deep link from each notification to the right screen. Server sends only after the same events the web already records; idempotent, rate limited, preferences honoured; token cleanup.
2. **Deep links / App Links:** `https://jmdcart.com/product/...`, `/category/...`, `/brand/...`, `/orders/...` and the bill link `/b/<token>` open inside the app when installed (Digital Asset Links file served from the site), otherwise on the web.
3. **OTP auto-fill** via the Android SMS Retriever flow, with manual entry as fallback.
4. **Offline and slow-network behaviour:** last-seen home, categories and product lists cached and shown instantly with a "last updated" note; cart and wishlist survive restarts; clear offline banner; requests queue only for safe actions; checkout requires connectivity (no offline orders).
5. **Share** product and order link, **call** and **WhatsApp** support through system intents (no SDK), **device language** detection with in-app override, image caching, font scaling, TalkBack support.
6. **Biometric/device unlock** for the credit/ledger screens (P1).
**Gate E:** server tests with a mocked FCM sender (payloads, channels, preferences, consent, idempotency, cleanup), deep-link tests (valid and malicious links), SMS auto-fill format test, offline cache tests, Maestro tests for notification tap and deep link, TalkBack pass on core flows.

## PART F — EXTRA FEATURES (researched; implement P0, record P1)
- **P0:** **Buy again / reorder** from past orders · **Saved shopping lists** (for example "Monthly kirana list") with one-tap add-all · **Notify me** when out-of-stock items return · **Delivery slot** choice when the admin has configured slots · tier-price nudges in cart ("add 2 cartons to get wholesale rate") · live order tracking with push · **language toggle English/Hindi** · in-app notification inbox · app update prompts and maintenance mode from `app-config` · easy support (call, WhatsApp) · skeletons, haptics, smooth transitions.
- **P1 (list in `docs/memory.md` with a reason, do only if time remains):** order rating and feedback with moderation · UPI "pay on delivery" QR/intent with manual confirmation · bulk order upload (Excel) for retailers · voice search · product barcode scan (needs barcode data) · loyalty/referral · dark mode · home-screen widgets.

## PART G — PLAY STORE READINESS
Privacy policy and delete-account URLs live and linked; Data Safety answers prepared in a checklist; target API level meets Google's current requirement (verify the current policy before building); AAB with Play App Signing and an upload key (owner-held keystore, never committed); icons (adaptive), splash, feature graphic and screenshots generated from the app on an emulator; store listing text in English and Hindi; content rating answers; permissions limited to what is used (internet, notifications, optional camera/gallery only if a feature needs it); no ad or tracking SDKs; release notes. Roll out **internal testing → closed testing → production**; keep a signed **APK** for direct download from `jmdcart.com/app` as well (with install steps) until the Play listing is live.
**Gate G:** the release AAB passes `bundletool` validation and the Play pre-launch checklist items you can run locally; every policy item has a recorded answer; the human completes the Play Console steps (`WAITING_FOR_HUMAN`).

## PART H — VERIFICATION (multiple independent layers; none may be weakened)
1. **Parity:** `parity.json` complete; website feature inventory versus app screens; no website regressions (existing web suites unchanged, storefront screenshots unchanged).
2. **API:** contract tests, token and refresh security, OTP abuse limits, leak tests (no staff-only fields), account deletion, rate limits, ETag behaviour.
3. **App tests:** unit and component tests, Maestro end-to-end flows, deep-link and push tests, i18n completeness (no missing Hindi keys), design-token drift test, accessibility checks (TalkBack labels, touch targets, contrast, large font at 130%).
4. **Devices:** manual checklist on the low-end Android 8 to 10 phone and an Android 14+ phone: install from the signed APK, OTP auto-fill, browse on 3G-throttled network, add to cart, checkout (test customer, test DB or staging), push received with app closed, deep link opens the right screen, offline start, language switch, rotate/fold, low-memory behaviour; record results and performance (cold start, scroll smoothness, memory) in `docs/memory.md`.
5. **Security:** no secrets in the bundle, certificate and cleartext rules, tokens only in secure storage, WebView limited to our hosts, debug off in release, dependency audit, minification on.
6. **Data integrity:** orders created by the app produce the same stock reservations, pricing, GST, ledger and dispatch/alert effects as web orders (golden tests); stock never negative; numbering gapless.
7. **Stability:** run all suites twice, then once after a clean install and fresh test DB; results identical.

## PART I — DEPLOY, RELEASE, DOCS
1. Deploy the additive backend changes through the existing migration job and deploy script (labelled with the commit SHA), run `scripts/smoke-prod.ts` (extended for `/api/store/v1` health, `app-config`, assetlinks file, device registration rejecting bad tokens), roll back automatically on failure.
2. Build the signed release AAB/APK with `scripts/build-customer-app.ps1`; install on the test phones; run the production-API smoke flows with a **test customer only**; store the APK in the private bucket and publish the download page.
3. Update in place: `docs/architecture.md` (mobile API, token model, push pipeline, deep links, release process), `docs/rules.md` (app and web share one service layer; app never computes prices; no third-party SDKs in the app; offers only with consent; account deletion supported), `docs/design.md` (app design adaptations), `docs/storefront.md`, `docs/tasks.md`, `docs/memory.md` (root findings, parity result, device results, open items).

## LOOP (follow strictly)
```
Part 0 sync gate → Step 1 → for each of Parts A to G:
  define the invariant or checklist → write tests (failing first for bugs) → implement the smallest correct change
  → run: pnpm typecheck; pnpm lint; pnpm test; pnpm build; the app's tests; the Android release build
  → run the app on an emulator and a real phone, exercise it, screenshot at 360×800
  → if anything fails: root-cause it, fix, rerun from the top of the part
  → proceed only when the part's gate is green and demonstrated
Then Part H (twice) → Part I → re-verify everything once more end to end.
```
- Never claim success without running the check and reading the output; quote key results in `docs/memory.md`.
- Never weaken or delete a failing test, never remove a website feature, never compute prices in the app, never add third-party analytics or ad SDKs, never send promotional notifications without consent, never commit secrets or the keystore, never force-push.
- Same failure 5 times: write hypotheses and evidence in `docs/memory.md`, try a different approach. Ask the human only after 3 different approaches fail, with the exact error.
- When blocked on a human action (Stitch key, Play Console, Firebase, Android tools, real phones, iOS Mac/Apple account, Hindi review, diverged git), print `WAITING_FOR_HUMAN: <what>` with exact steps and keep working on whatever does not depend on it.
- Local tests use the isolated test DB. Never run destructive scripts against production.

## FINISH
Only when all gates pass, print exactly:

`PROMPT 20 COMPLETE — API ready PASS — design parity PASS — feature parity PASS — native push + deep links PASS — device checklist PASS — release build PASS`

then: the commit live before and after, the parity table (website feature → app screen), install size and cold-start numbers, device checklist results, screenshots (website versus app), the Play Store checklist status, files changed with reasons, open items (Play Console steps, iOS build, Hindi review, P1 features). If you cannot reach that state, print `PROMPT 20 BLOCKED` with the exact blocker.
