# PROMPT #18 — Edit invoices inside POS + future dates, search that works everywhere, Esc to go back, new PRO role, wider Accountant and Cashier access, POS quick-add and stock fix, full Godown mobile app (Stitch) with Morning Issue fixed, instant order alerts with push and ring (looping, self-verifying)

Save as `docs/prompts/18-godown-mobile-alerts-roles-pos-upgrades.md` and paste everything below the line to the agent. **Do not create new doc files.** Update existing `docs/*.md` in place. This is an **update of the live system**: every existing flow and feature must keep working.

---

## WHAT THE OWNER ASKED (mandatory, plus research-based additions)
1. **Edit an invoice by opening it directly in POS** (not on a separate edit page).
2. **Allow future dates** for the bill date, not only past dates.
3. **Unified search is not working everywhere** (the agent's summary claims Shop POS, Dispatch/Create Order, Van, GRN and Ctrl+K). Make it work on every search surface and prove it.
4. **Esc goes back everywhere in the dashboard** (back to the previous process/page).
5. **Godown (warehouse manager) dashboard in mobile view**, the whole godown manageable from a phone, UI redesigned with **Stitch**.
6. **Instant notification to the warehouse manager's phone** (push, pop-up, with ring) whenever an order arrives from Shop POS, online, Create Order or anywhere.
7. **Morning Issue: make it easy and fully phone-friendly (Stitch redesign)** and **fix the bug**: after removing an added product it still shows as added and cannot be added again.
8. **New role `PRO`**: can take other people's orders and punch them into the system.
9. **Accountant**: the same product, brand and stock management access as admin, plus billing, party access and day sales reports.
10. **Shop POS enhancements:** (a) a shortcut key to **quick-add a product that search cannot find, with its stock, and add it to the bill instantly**; (b) when billing a quantity that is not available (for example 1 carton), the cashier can **update the stock on the spot and continue**.
11. **Cashier gets access to:** Purchase/GRN, product stock update, parties (view and edit), and today's total sales.
12. **Research and add anything else that clearly helps** (see Part H).

## ROLE
You are the engineer updating JMD Cart (Next.js 14 App Router, Prisma, Postgres, Cloud Run + Cloud SQL, `management.jmdcart.com`). Implement and prove everything above. "Done" means built, run on real mobile viewports, tested in several independent layers, deployed and re-verified, not "it compiles".

Follow `CLAUDE.md` and `docs/rules.md`. **Never open, print or log `.env`, `.env.deploy` or any secret.** Migrations are **additive only**. **Never create or edit real invoices, orders or stock in production** (gapless numbers, real money); verify with automated tests on the test database, and in production do read-only checks, sample-preview prints, and notification tests that only touch a clearly marked test device.

## PART 0 — SYNC GATE (nothing is edited until this passes)
Run exactly the sync gate from `docs/prompts/11-invoice-print-agent-code.md` Part 0: `git fetch`, clean tree, fast-forward to the latest `origin/main`, confirm the commit running on **Cloud Run (100% traffic revision)** is contained in your code and production migrations all exist in the repo, work on a new branch, record the baseline of `pnpm typecheck / lint / test / build`. If branches diverged, the deployed code is not in git, or the tree is dirty: stop with `WAITING_FOR_HUMAN` and show the difference. Never reset, force-push or overwrite anyone's work. Review `git diff --stat` at the end and justify every changed file in `docs/memory.md`.

## STEP 1 — READ, MAP, BASELINE, HUMAN INPUTS
Read `CLAUDE.md`, `docs/memory.md`, `tasks.md`, `rules.md`, `design.md`, `prisma/schema.prisma`, the role enum and permission code, `nav.config`, the Shop POS and `VoucherGrid`, Invoice Edit (revisions from Prompt #15), the shared search (`searchItems`, `searchParties`, `ItemSearchBox`, `PartySearchBox`), Dispatch / Create Order / warehouse queue, Morning Issue / Van Return, stock services, GRN and Scan Bill, the role apps and service worker/manifest code (Prompt #13), the redesigned shell and design tokens (Prompt #14), the dashboards, and the incentive module if present. Record in `docs/memory.md`: which earlier prompts' features exist, the **permission matrix as it is today** (role × permission), the **search-surface inventory** (every text search for items and parties, and which engine each uses), and the **Morning Issue state logic** (how added products are tracked).

Ask the human ONCE (one message, then continue; use the defaults if there is no answer):
1. **Stitch MCP:** if not connected, ask the human to connect it (current official setup, key via environment/secret store, never the repo); verify by listing projects. If unavailable and the human says continue, use the existing design system and log it.
2. **Dependency approval (one batch):** a Web Push library (for example `web-push`) and nothing else you can avoid.
3. **VAPID keys:** generate them yourself, store the private key in Secret Manager and local git-ignored `.env.deploy`, never in git or chat.
4. **Defaults (all are settings):** future bill dates allowed up to 30 days for ADMIN, SUPER_ADMIN and ACCOUNTS with a reason; warehouse alerts for orders that contain godown-fulfilled lines; re-alert every 60 s until accepted, escalate to admin after 3 minutes.
5. **Native Android wrapper** for a true background ring is a P1 decision for the owner (see Part F, honest limits). Do not build it now.

---

## PART A — Invoice edit opens inside POS, and future dates
1. **Edit in POS:** every "Edit" entry point (invoice list, detail, print page, party ledger) opens **Shop POS in edit mode** (`/shop/pos?edit=<id>`), using the same `VoucherGrid`. The header shows "Editing INV/26-27/000012 · Rev N" and the original values; all columns stay editable (party, date, lines, qty, unit, MRP, rate, discount, payment mode and status, document type, narration, agent for admin). Saving goes through the **existing revision mechanism** of Prompt #15 (stock deltas by ledger rows, GST, ledger, payments, incentives, dispatch effects, lock date, optimistic version) with the Save dialog showing changed lines highlighted and a mandatory reason. Keep **Revision History** reachable from POS and from the invoice page. The old edit page redirects to the POS edit route. Permissions unchanged (plus ACCOUNTS from Part C). A second person opening the same invoice sees a lock message.
2. **Future dates:** the Bill Date field accepts **future dates up to `invoice.maxFutureDays` (default 30)** for ADMIN, SUPER_ADMIN and ACCOUNTS, with a mandatory reason, in POS, Create Order and edit mode. Such invoices carry a **"Post-dated" badge**, are excluded from today's totals and day-end, appear in the reports of their business date, and print the chosen date. Stock and ledger effects happen at the real time of entry; the audit keeps the real timestamp. Numbering stays gapless. State in the final report that the owner should confirm with the CA that post-dated invoices are acceptable for his registration.
**Gate A:** tests: edit-in-POS equivalence with the Prompt #15 invariant (edited invoice equals a fresh invoice with the same final content), redirect from the old page, lock handling, future-date rules and reports, post-dated badge and exclusions, permissions; Playwright keyboard flow editing an invoice in POS.

## PART B — SEARCH THAT REALLY WORKS EVERYWHERE, AND ESC TO GO BACK
1. **Prove it, do not claim it.** Build a Playwright **search-surface suite** that, for every surface in the inventory, types `bhuj 400` (and a party fragment such as `sh`) and asserts the right result appears with name, weight and price. Surfaces include at least: Shop POS item box, party box, **Invoice Edit "Add item to invoice…"**, Create Order, Dispatch, Van counter, Purchase/GRN lines, Scan Bill matching picker, Update Stock screens, catalogue/admin product search, price lists, reports filters, stock movements, command palette (`Ctrl+K`), storefront header search and suggestions, the PRO order screen and the Godown mobile screens. A surface that fails or still uses legacy code is **fixed to use the shared core**; the suite fails the build on any miss, and a code scan forbids legacy search patterns.
2. Likely causes to check: surfaces never migrated, weight read from the empty weight field instead of the parsed one (the weight filter had reported "No Weight (876)"), an index that is not refreshed, case/spacing handling. Fix at the shared core when it is the cause; record root causes in `docs/memory.md`.
3. **Esc = go back, everywhere in the management dashboard.** One shared handler in the shell with this order: close an open dropdown/popover/dialog/drawer → cancel a cell or field edit → clear a non-empty search box → **navigate back** (to the previous page when it came from the same app, otherwise to the parent route from the nav/breadcrumb hierarchy). Guard unsaved changes with a confirm ("Discard changes? Enter = Stay, Esc = Leave" style, consistent with Busy-like dialogs). Screens with their own meaning keep it: in POS Esc closes dropdowns, cancels cell edit, returns from the Save dialog to editing, and on a **non-empty** voucher it never leaves without confirm; on an empty voucher it goes back. Does not fire while typing in an IME or when a native `<select>` is open. Show "Esc Back" in the key hints. On phones the hardware back button follows the same history.
**Gate B:** the search-surface suite is green on every surface; an Esc test matrix (list → detail → edit → new, dialogs, dropdowns, unsaved changes, POS rules) passes; keyboard-only e2e.

## PART C — ROLES AND PERMISSIONS (new PRO, wider Accountant, wider Cashier)
Make the permission model explicit and editable: a **Roles & Permissions matrix screen** (SUPER_ADMIN edits, ADMIN views) showing permission × role with the defaults below, a change log, and field-level rules. Migrations only **add** permissions or roles; never remove an existing permission from an existing role. Existing users keep their roles; the owner assigns new ones in Users.

**New role `PRO` (order-taking executive; mobile first):**
- Can **punch orders taken from other people**: search any party (Prompt #17 search), see its name, phone, address and tier, create a **new party** (flagged "needs review"), build an order in a mobile order screen, submit. The order enters the normal Dispatch/warehouse flow with status **Booked by PRO**, shows "Booked by: name (agent code)", and uses the party's price tier. PRO cannot finalize bills, collect payments, edit stock, see purchase rates, margins or other PROs' orders; PRO can **view own orders and their live status** and **cancel own order only before the warehouse accepts it**. Credit orders respect the party's credit limit (over-limit needs admin approval). Discount limits come from `role_discount_limits` (default 0 for PRO). Duplicate-order warning when the same party and items were punched recently. "Reorder last order" per party. Incentive attribution to the PRO's agent code when the incentive module exists.
- Gets the **JMD PRO** mobile app (see Part E pattern): Parties · Punch Order · My Orders · Today.

**Accountant (`ACCOUNTS`) gains everything admin has for:** products, brands/companies, categories, price lists and slabs, weights and bag sizes, Data Quality, stock management (update stock, adjustments, transfers, conversions, movements, Excel upload), purchases/GRN and Scan Bill, **bills/invoices (create, edit through revisions, cancel with reason, reprint, all formats)**, parties (full CRUD including credit settings), receipts and payments, and **reports including party-wise and day-wise sales**. Excluded (stay SUPER_ADMIN/ADMIN): user and role management, security/business-identity settings, backups, deployment, SUPER_ADMIN accounts, audit-log deletion (none exists), and incentive payout approval (view only by default). Every sensitive action still needs a reason and is audit-logged.

**Cashier (`SHOP`) gains:** **Purchase/GRN** (create and view), **Update Stock** (opening, count, adjust, Excel upload for the shop location), **Parties** (view; edit name, phone, address, area; **not** credit limit, credit permission, price tier, GSTIN, Tally mapping), **Today's total sales** card and report for the shop (count, amount, by payment mode, pending payments; no cost, margin or profit). Stock changes by cashiers are **reviewable** (Part D4).

Update nav per role (role-specific sidebars/bottom navs), route guards on the server, and the role matrix tests.
**Gate C:** permission matrix tests (role × permission × route × API) including the new and widened roles, field-level party edit rules, PRO isolation (own orders only), accountant exclusions, existing role behavior unchanged, nav shows only permitted items.

## PART D — SHOP POS ENHANCEMENTS
**D1. Quick-add product (`F6`, also "Add new product" row when search finds nothing).** A compact drawer: name, brand (pick or type), weight and unit, pack size, MRP, selling price (list C; A/B optional), GST slab and HSN (defaults from brand/category), **stock quantity (cartons and loose) to add at the shop**. On Enter: create the product, post the stock through the stock service (reason "Quick add from POS", audit), and **add it to the current bill immediately** with focus back on the grid. Duplicate-name/weight check with "use existing" suggestion. The product is flagged **needs review** and appears in Data Quality for admin/accountant. Permission `product.quickCreate` for SHOP, ADMIN, SUPER_ADMIN, ACCOUNTS.
**D2. Stock short at billing, fixed on the spot.** When the entered quantity exceeds availability, show an inline panel, not a hard block: "Available 0, you need 1 Ctn. **Update stock now**". It opens a small form (actual quantity found, reason preset) and posts an **adjustment** through the stock service, then continues the bill with the same line. Negative stock remains impossible (stock is raised first). Settings: maximum quick correction per line/day for cashiers (default 500 pieces; above it needs admin approval).
**D3. Cashier access** from Part C is wired into POS (links to GRN, Update Stock, Parties, Today's sales).
**D4. Review of stock corrections:** a report **"Stock corrections at billing"** (who, when, product, before, after, reason, invoice) for admin/accountant, with a badge on the dashboard when unreviewed items exist and a "mark reviewed" action.
**Gate D:** tests: quick-add creates product + stock + bill line atomically and is audited; duplicates warned; short-stock fix raises stock then bills; limits enforced; ledger invariants hold (never negative, sum of ledger = balances); the correction report lists entries; keyboard-only e2e for both flows.

---

## PART E — GODOWN MOBILE APP (Stitch) INCLUDING MORNING ISSUE
The whole godown must be manageable from a phone. Build the **JMD Godown** mobile-first app (route group `/app/godown`, installable PWA with its own manifest as in Prompt #13 Part E; reuse what exists). Generate **every screen with Stitch at 360 px** (save under `design/stitch-export/apps/godown/`), keep the clean white-card style on the brand/management theme, big tap targets (48 px), plain words, bottom navigation **Home · Orders · Issue · Stock · More**.
- **Home:** alert state (alerts on/off, last notification), today's counts (To pack, Packing, Ready, Handed over), low stock, receive-pending, van status, unreviewed items.
- **Orders (Pack & Dispatch):** the godown queue (carton and godown lines only, per the rules from Prompt #13), tap to **Accept**, pack with a saved checklist, mark packed, **handover** to the delivery person, filters and search.
- **Issue (Morning Issue):** a **3-step flow**: **1 Choose van** (and date) → **2 Add products** (shared item search, big stepper for **Carton / Pcs**, "Repeat last load for this van" and "Add from yesterday's return" shortcuts, running list with quantities, edit or remove any line) → **3 Review and issue** (clear summary, stock check, one confirm). Evening **Van Return** uses the same pattern.
- **Stock:** search, quick count, adjust, update, Excel upload, low stock, movements, transfers, carton↔loose log, auto-converted cartons.
- **Receive:** Scan Bill and GRN (from Prompt #10) on mobile; More: notifications inbox, settings (alert test, sound, vibration), profile, "Open full panel".
**Morning Issue bug (mandatory root-cause fix):** reproduce on a phone viewport: add a product, **remove it, it still shows as added and cannot be added again.** Find the cause (likely a de-duplication set or "already added" flag keyed by product id that is not cleared on removal, or state mutated in place) and write it in `docs/memory.md`. Fix so that the list is the **single source of truth**: removing a line clears every flag; re-adding works; adding the same product twice merges quantities (with a visible message) or increments; quantity edits are possible; submit is idempotent (double tap cannot issue twice); stock is validated at submit; errors are plain words.
**Gate E:** Playwright on a 360 px device profile for every godown flow; a dedicated regression test for add → remove → re-add → edit → add multiple → submit (issued stock equals the list), double-submit protection, search works in the add step; screenshot catalog in `docs/screenshots/apps/godown/`; accessibility (axe) and no horizontal scroll; manifest/service-worker tests.

## PART F — INSTANT ORDER ALERTS WITH PUSH, POP-UP AND RING
**Trigger:** a new order or bill that contains **godown-fulfilled lines** from **any source** (Shop POS carton lines, online order, Create Order/Dispatch, PRO punched order) alerts the warehouse manager(s) immediately. Optional setting to alert for every order regardless of lines.

**Delivery (self-hosted Web Push, no paid service):**
1. `PushSubscription` (user, endpoint, keys, device label, created/last-seen, active) and `OrderAlert` (order, user, state NOTIFIED / SEEN / ACCEPTED, timestamps, attempts). Subscribe from the Godown app after an **"Enable alerts"** onboarding that requests notification permission, asks to install the app, and shows Android steps (allow notifications with pop-up, remove battery optimization for the browser/app).
2. Send with the Web Push library using **high urgency**, short TTL, and a per-order `tag`. Payload: title "New order · INV/26-27/000031", body "3 Ctn · Aakash Kirana · ₹3,880", deep link to the Accept screen. Service worker `push` handler shows a persistent notification (`requireInteraction`), a strong vibration pattern, badge and icon, actions **Accept** and **Open**; `notificationclick` opens the exact order.
3. **Ring when the app is open or in Alert Mode:** a full-screen "NEW ORDER" overlay with a **looping ring tone** (generated with Web Audio so no asset is needed; optional owner-supplied file), vibration, Screen Wake Lock, big **Accept** and **Snooze 1 min** buttons; audio unlocked by the "Alert Mode ON" button at app start. Real-time delivery to the open app by SSE or short polling with reconnect and backoff (respect Cloud Run limits).
4. **Escalation:** not accepted within the setting (default 60 s) → re-send; after 3 minutes → notify admin and the accountant; stop all re-alerts the moment any warehouse manager accepts. Idempotent per order (no duplicate storms), rate-limited, quiet-hours off by default for warehouse.
5. Preferences per user (sound, vibration, which events), a **Test alert** button, an in-app notification inbox with unread counts, expired/invalid subscriptions removed automatically, everything audit-logged. Payloads contain no secrets.
6. **Honest limits to state in the app's help and the final report:** a PWA push shows a system notification with the phone's notification sound and vibration, but it **cannot ring continuously in the background** like a phone call. The continuous ring works while the app is open or in Alert Mode. A true background ring (full-screen call-style alert) needs a **native Android wrapper** with FCM and a high-priority notification channel; record it as an owner decision and do not build it here.
**Gate F:** unit tests with a mocked push sender (payloads, urgency, tags, escalation timeline with fake timers, stop-on-accept, dedupe, invalid subscription cleanup), SSE/polling tests, service worker tests (push, click, actions), role scoping (only warehouse roles and escalation targets receive), end-to-end test that creating an order from each source produces exactly one alert chain; a **manual real-device checklist** (install, permission, locked-screen push, tap opens the order, ring in Alert Mode, escalation) recorded in `docs/memory.md`.

## PART G — PRO MOBILE APP
Build **JMD PRO** with the same pattern as Part E (own manifest, bottom nav, Stitch-designed at 360 px, saved under `design/stitch-export/apps/pro/`): **Parties** (shared party search, new party), **Punch Order** (mobile order screen with shared item search, Pcs/Carton/Dozen/Bag picker, party tier prices, order summary, credit-limit check), **My Orders** (live status, cancel before acceptance, reorder), **Today** (orders punched, value). Submission triggers the Part F alert for the warehouse.
**Gate G:** Playwright at 360 px for a full PRO flow, isolation tests (own orders only, no cost visibility, no stock or billing actions), order appears in Dispatch with "Booked by PRO" and fires one alert chain.

## PART H — RESEARCHED ADDITIONS (implement P0, record P1)
- **P0:** shortcut/help overlay listing all new keys (`F6` quick-add, Esc back, `?`); "Stock corrections at billing" report (Part D4); notification inbox; duplicate-order warning; reorder-last-order; dashboard badges for unreviewed quick-added products and unaccepted orders; a warehouse "unaccepted orders" widget; the Roles & Permissions matrix screen.
- **P1 (list in `docs/memory.md` with a reason, do only if time remains):** daily summary push to the owner; low-stock push to accountant; payment-pending reminders; voice note on order; phone-camera barcode scan; native Android wrapper for background ring.

## PART I — VERIFICATION (multiple independent layers; none may be weakened)
1. **Parity:** the Step 1 feature inventory shows nothing was removed (moved or gated only); API contract changes additive.
2. **Behaviour:** all existing suites pass unchanged (legitimate selector updates only); new tests for Parts A to H.
3. **Golden billing:** identical totals, GST, stock, ledger and incentive effects between old and new entry paths for the same scripted bills; invoice edit equivalence invariant.
4. **Permissions:** full role × permission × route × API matrix, field-level party rules, PRO and cashier and accountant cases, server-side enforcement (not only hidden UI).
5. **Search:** the surface suite and party/item tables from earlier prompts.
6. **Mobile:** Playwright device profiles (Pixel-class 360×800, a small 320 px phone, and a tablet) for Godown and PRO apps; no horizontal scroll; tap targets ≥ 44 px; safe areas; offline page; installability checks.
7. **Accessibility:** axe zero serious/critical on new and changed screens; focus handling for overlays and the ring screen (stop sound on dismiss).
8. **Data integrity:** stock never negative, `SUM(ledger) = balances`, invoice numbering gapless, GST paise-exact, ledger/receivables consistent after quick-add, stock correction, edit and future-date flows.
9. **Different from before:** screenshots of the Godown, Morning Issue and PRO screens differ materially from the baseline and meet the Stitch designs.
10. **Stability:** run the whole suite twice, then once after a clean install and fresh DB; results identical.

## PART J — DEPLOY AND VERIFY
1. Gate before deploy: Part I green, `git diff --stat` justified, migrations additive, VAPID secrets configured.
2. Run additive migrations via the existing migration job, deploy a new revision with the existing script (labelled with the commit SHA), run `scripts/smoke-prod.ts` (extend it: push public key endpoint, manifests for Godown and PRO apps, role-guarded routes), roll back automatically on failure.
3. Production checks without real transactions: each new route and manifest loads for its role; Godown and PRO nav correct; permission guards reject wrong roles; a **test alert to the owner's registered test device only**; Esc-back and search spot checks on read-only data. Re-run verification once more from a clean checkout of the deployed commit.
4. Update in place: `docs/architecture.md` (permission matrix, push pipeline, alert state machine, role apps), `docs/rules.md` (permissions only added, never silently removed; stock changes at billing are audited and reviewable; one shared search; alerts idempotent), `docs/design.md`, `docs/tasks.md`, `docs/memory.md` (root causes, decisions, manual device checklist results, open items).

## LOOP (follow strictly)
```
Part 0 sync gate → Step 1 baseline → for each of Parts A to H:
  find root cause or define the invariant → write tests (failing first for bugs) → implement the smallest correct change
  → run: pnpm typecheck; pnpm lint; pnpm test; pnpm build → run the app (desktop keyboard and 360 px mobile), screenshot
  → if anything fails: root-cause it, fix, rerun from the top of the part
  → proceed only when the part's gate is green and demonstrated
Then Part I (twice) → Part J → re-verify everything once more end to end.
```
- Never claim success without running the check and reading the output; quote key results in `docs/memory.md`.
- Never weaken or delete a failing test, never remove an existing feature or permission, never change business rules beyond what is written here, never allow negative stock, never rewrite stored data without a previewed and audited action, never force-push.
- Same failure 5 times: write hypotheses and evidence in `docs/memory.md`, try a different approach. Ask the human only after 3 different approaches fail, with the exact error.
- When blocked on a human action (Stitch key, dependency approval, real-device test, diverged git), print `WAITING_FOR_HUMAN: <what>` with exact steps and keep working on whatever does not depend on it.
- Local tests use the isolated test DB. Never run destructive scripts against production.

## FINISH
Only when all gates pass, print exactly:

`PROMPT 18 COMPLETE — edit-in-POS + future dates PASS — search everywhere PASS — Esc back PASS — roles PASS — POS quick-add + stock fix PASS — godown mobile + morning issue PASS — alerts PASS — PRO app PASS — production PASS`

then: the commit live before and after, root causes (Morning Issue, search gaps), the permission matrix before/after, screenshots of the Godown, Morning Issue and PRO apps, the real-device checklist results, honest limits of push ringing, files changed with reasons, open items (CA view on post-dated invoices, native Android wrapper decision, ring tone file, PRO party scope). If you cannot reach that state, print `PROMPT 18 BLOCKED` with the exact blocker.
