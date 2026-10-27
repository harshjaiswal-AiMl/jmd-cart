# PROMPT #12 — Receipt tweaks, agent codes for all staff, full incentive system, Stitch redesign of the whole management panel + POS (looping, self-verifying)

## ROLE
You are the engineer updating JMD Cart (Next.js 14 App Router, Prisma, Postgres, Cloud Run + Cloud SQL, `management.jmdcart.com`). Four jobs, in this order: **A** receipt tweaks, **B** agent codes for every existing staff member, **C** a complete incentive system managed from the backend, **D** a full Stitch-designed redesign of the management panel and POS, with **E** useful POS features. "Done" means built, run, screenshot-verified, deployed and re-verified, not "it compiles".

Follow `CLAUDE.md` and `docs/rules.md`. **Never open, print or log `.env`, `.env.deploy` or any secret.** Migrations are **additive only**. Never create test invoices in production (gapless invoice numbers).

## PART 0 — SYNC GATE (nothing is edited until this passes)
Run exactly the sync gate from `docs/prompts/11-invoice-print-agent-code.md` Part 0: `git fetch`, clean working tree, fast-forward to the latest `origin/main`, confirm the commit running on **Cloud Run (100% traffic revision)** is contained in your code and that production migrations all exist in the repo, work on a new branch, record the baseline of `pnpm typecheck / lint / test / build`. If branches diverged, the deployed code is not in git, or the tree is dirty: stop with `WAITING_FOR_HUMAN` and show the difference. Never reset, force-push or overwrite anyone's work. Review `git diff --stat` at the end and justify each changed file in `docs/memory.md`.

## STEP 1 — HUMAN INPUTS (ask ONCE, one message, then continue)
1. **Stitch MCP.** Check your tool list for a Stitch MCP server. If it is not connected, **ask the human to connect it** (look up the current official setup, add the server to your MCP config, the human supplies the Stitch API key through the environment/secret store, never into the repo) and verify by listing projects. Do not start Part D until Stitch is verified, unless the human explicitly says to continue without it (then log that decision).
2. **Dependency approval (one batch):** only what you truly need (for example a PDF/print helper if the browser print path is insufficient). If none, say so.
3. **Confirm these defaults** (proceed with them if there is no answer, and make each a setting): incentive is calculated on the **bill payable amount**; counter and van sales credit the incentive **at invoice**; delivery orders credit **at the owner-chosen trigger (handover or delivered)**; credit sales credit **on sale** (option: on collection).

---

## PART A — Receipt and invoice tweaks (update the existing templates and the shared invoice view-model)
Compare with the owner's current screenshots of the thermal receipt and the A5 invoice. Change only this:

**Thermal (80 mm / 58 mm, HTML print and Bluetooth/ESC-POS stay identical in content):**
1. Logo stays centered but **smaller** (about 70% of the current width, with a sensible max height).
2. In the totals line, **label the quantity**: `Total Pcs : 6.00` on the left of the line, grand total on the right.
3. **Directly under that line, print only `GST included`** in a small font (only when prices are GST-inclusive per data/settings; for GST-exclusive invoices print the real tax lines instead). Remove any other GST wording.
4. In the customer block, **add `Agent Code : A001` directly under Address**. Omit the row only if the invoice has no agent.

**A5:**
1. **Remove the "GST TAX BREAKDOWN" table completely** from print. Keep the tax data in the database. Add a setting `invoice.showGstBreakup` (default **off**) so it can be re-enabled later, and mention in the final report that B2B buyers with a GSTIN may need a tax breakup for their input credit, so the owner should confirm with the CA.
2. Directly under **Round Off**, write only `GST included` (small), same inclusive-only rule.
3. Add **Agent Code** as a row in the Customer Details box under Address.
4. Hide the `(HSN: 0000)` text when the HSN is empty or the `0000` placeholder; show real HSNs.

**Setting:** the owner now wants the agent code printed on the bill. Set `invoice.showAgentCode` to **on** (an explicit, audited, idempotent settings update with the reason "owner decision"). The **storefront customer-facing invoice view** keeps hiding agent fields (separate setting `invoice.showAgentCodeOnline`, default off); staff views always show them.

**Gate A:** updated print tests (label text, `GST included` placement for thermal and A5, no breakdown, agent row present and omitted correctly, ESC/POS text equals the HTML text, A5 page size and pagination), Playwright screenshots of thermal and A5 saved to `docs/screenshots/` and compared with the owner's screenshots so only the intended differences appear.

---

## PART B — Agent codes for all existing staff
1. Idempotent script/migration step: assign a unique `agentCode` (format `A001`, `A002`, … in order of account creation) to **every existing user who has none**, active and inactive, admins included. Never change an existing code, never reuse a code. Print a table of user → code in the final report.
2. New staff get the next code automatically at creation. Admin can edit a code (uniqueness validated, audit logged). Invoices keep their snapshot, so editing a code never rewrites history.

---

## PART C — Complete incentive system (everything managed from the backend)

**Principle:** incentive = percentage of the agent's sale amount, percentage decided by the admin, credited at the moment the admin chose, reversible, auditable, paid out through a locked monthly statement. Integer paise and basis points only.

### C1. Data (additive migrations)
- `IncentiveRule(id, scope GLOBAL|AGENT|BRAND|CATEGORY|PRODUCT, agentUserId?, companyId?, categoryId?, productId?, percentBp, validFrom, validTo?, active, note)`. **Resolution = most specific wins:** agent+product > agent+brand > agent+category > product > brand > category > agent default > global default; ties broken by latest `validFrom`. Rules are versioned by date; **an accrual snapshots the rule id and percent it used**, so later rule changes never alter past entries.
- `IncentiveEntry(id, agentUserId, invoiceId, invoiceLineId?, orderId?, type ACCRUAL|REVERSAL|ADJUSTMENT, status PENDING|CREDITED|REVERSED|VOID|APPROVED|PAID, baseAmountPaise, percentBp, amountPaise, ruleId, triggerEvent, triggeredAt, period YYYY-MM, note, createdBy, payoutId?)`. **Append-only ledger**: corrections are new REVERSAL/ADJUSTMENT rows. Unique key on (invoiceLineId, type) so repeated events never double-count.
- `IncentivePayout(id, agentUserId, period, totalPaise, method, reference, paidAt, paidBy, status DRAFT|APPROVED|PAID)`; paying locks the period for that agent.
- Settings: `incentive.enabled`, `incentive.defaultPercentBp`, `incentive.base` (PAYABLE | TAXABLE), `incentive.creditTrigger` (HANDOVER | DELIVERED, for dispatch/online orders), `incentive.creditSales` (ON_SALE | ON_COLLECTION), `incentive.eligibleRoles`, `incentive.rounding` (half-up per entry).

### C2. When incentive is created and credited
- **Counter (shop POS) and van sales:** goods change hands at billing, so the entry is created and **CREDITED at invoice creation**, in the same transaction as the invoice, attributed to the invoice's agent.
- **Dispatch / online / delivery orders:** an entry is created as **PENDING** at invoice and becomes **CREDITED** when the order reaches the admin-chosen trigger: **handover** (to the delivery person) or **delivered**. Inspect the existing Dispatch module and use its real handover and delivered events; do not invent states. Handover/delivery failures or returns to godown: VOID the pending entry or REVERSE the credited one.
- **Credit sales:** per `incentive.creditSales` (on sale by default; on collection credits proportionally as payments are received).
- **Cancellations and edits:** invoice cancel, order cancel, line edits, or stock return reverse or adjust through new ledger rows. Cancelled invoices never count.
- Eligibility uses the base amount chosen in settings (payable amount by default, net of discounts, excluding rounding).

### C3. Admin screens (Stitch-designed in Part D, built on the CRUD kit)
New sidebar group **People → Staff & Agents** and **Incentives**:
1. **Incentive Dashboard:** month selector, totals (pending, credited, approved, paid), top agents, trend chart, alerts for staff without a code or with unpaid previous periods.
2. **Rules:** full CRUD for rules (global, per agent, per brand, per category, per product), date ranges, a **"test calculation"** box (pick an agent + product + amount and see the percent and incentive that would apply and which rule won).
3. **Settings:** all `incentive.*` options with plain-language help and an audit trail.
4. **Ledger:** filterable (agent, period, status, channel, invoice), drill-down to invoice/order, reversal reasons, CSV export.
5. **Monthly statements and payouts:** per agent per period: draft → admin approves → mark paid (cash/bank/UPI, reference, date) → period locked. Printable/PDF statement with the line items. Manual **adjustments** (plus or minus) with mandatory reason and audit.
6. **Backfill tool:** choose a start date, **preview** the entries and amounts it would create for existing invoices, then apply. Idempotent. Never runs automatically.
7. **Staff self-view "My Incentives"** for any staff with a code: own entries, month total, pending vs credited vs paid, invoice list; read-only; mobile friendly. Staff can never see anyone else's data.
8. Admin can reassign an invoice's agent (reason, audit) and the entries move through reversal + re-accrual.

### C4. Invariants and tests
- Calculation exactness (basis points, integer paise, half-up), rule precedence matrix, snapshot immutability after rule changes, effective-date boundaries.
- Trigger timing per channel (counter, van, dispatch handover, dispatch delivered, credit on sale, credit on collection), reversal on cancel and on handover/delivery failure, idempotency under repeated or concurrent events, period lock after payout, adjustments audit.
- **Report integrity:** dashboard, ledger, statement and payout totals all equal the sum of ledger rows for the same filters.
- Permission matrix: only ADMIN/SUPER_ADMIN manage rules/settings/payouts; staff see only their own; storefront roles see nothing; no incentive fields leak into any customer-facing response.
- Backfill idempotent; existing invoice, stock, GST and numbering tests still pass.

**Gate C:** all tests green; a scripted scenario passes end to end (create agent + rules → counter sale → van sale → dispatch order → handover or delivery per setting → cancel one invoice → monthly statement → approve → mark paid → period locked) with the numbers checked by hand in `docs/memory.md`.

---

## PART D — Full redesign of the management panel with Stitch

**Scope:** every management screen (admin dashboard, POS, invoices, orders, dispatch, inventory, purchases, scan-bill, van, catalog, parties, delivery, accounts, reports, people/incentives, settings, login), desktop-first with proper mobile layouts for godown, van, POS and delivery staff. **Presentation only: no business logic changes.** The public storefront is out of scope here.

### D1. Stitch workflow (strict)
1. Use the JMD Cart brand tokens already in the project (maroon, orange, amber, cream, leaf green; Epilogue + Inter) as the Stitch design system. Keep the brand recognizable.
2. For **each distinct page type** (dashboard, POS, data table/list, detail page, form/drawer, wizard/stepper, dispatch board, report/chart page, settings page, mobile staff screen, login) **generate the screen in Stitch** (desktop and mobile), save HTML and screenshots under `design/stitch-export/management/<page-type>/`. Then port to React as shared components and apply them to every page of that type. You do not need a separate Stitch screen for each of the 100+ routes; every route must still be visibly migrated to the new patterns.
3. If Stitch fails mid-task, finish with the already generated references, log `WAITING_FOR_HUMAN: Stitch`, and continue.

### D2. Navigation cleanup (merge or remove extras, lose no feature)
First audit `nav.config` and list every item, its roles and its route in `docs/memory.md`. Then restructure into a shorter, role-aware sidebar. Proposed target (adjust after the audit, but keep it compact):
- **Dashboard** (one role-aware page: owner / godown / shop / van / delivery / accounts views)
- **Sales:** POS · Invoices · Van Sales
- **Orders:** Online Orders · Dispatch Board · Create Order (as tabs of one Orders area where it makes sense)
- **Inventory:** Stock (tabs: Overview, Movements, Carton↔Loose, Transfers, Update & Excel Upload, Low Stock) · Purchases (tabs: GRN, Scan Bill) · Van Stock (Morning Issue, Return, Reconciliation, Cash)
- **Catalog:** Products · Brands & Categories · Price Lists & Slabs · Import · Data Quality
- **Parties** · **Delivery** · **Accounts** · **Reports**
- **People:** Staff & Agents · Incentives
- **Settings:** Business · Invoice & Printing · Storefront · Users & Roles · Audit Log · Backup
Rules: every old URL keeps working (301/redirect to the new location), every old feature stays reachable (tabs or sub-pages), items users cannot access never appear, "Live Storefront" button stays, `Ctrl+K` command palette stays, sidebar collapses on desktop and becomes a drawer plus bottom navigation on mobile staff screens. Before/after nav map goes into `docs/memory.md`.

### D3. Shell and components
New app shell (sidebar, top bar with search, location switcher, notifications, user menu), consistent `PageHeader` with breadcrumbs and primary action, KPI cards, a single **DataTable** pattern (sticky header, server-side search/filter/sort/pagination, column toggle, bulk actions, density toggle comfortable/compact, CSV export, row actions), forms in drawers or full pages, confirm dialogs, toasts, skeletons, empty and error states with helpful next actions, status chips with consistent colors, keyboard shortcuts overlay. Dashboards show **live useful KPIs** per role (today's sales, cash collected, pending and dispatching orders, low and out-of-stock counts, receivables, agent incentives pending). Reuse the existing chart library; no new dependency without approval.
Quality bar: WCAG AA contrast (resolve with in-theme token pairings only), visible focus, keyboard-operable everywhere, works on 1366×768 laptops and 360 px phones, no layout shift, route-level code splitting, no regression in page weight (record before/after).

### D4. Safety for a UI-wide change
- Do the shell, tokens and shared components first (largest global effect), then migrate page by page in the order: Dashboard → POS → Invoices → Orders/Dispatch → Inventory/Purchases/Scan Bill → Catalog → Parties → Van → Accounts/Reports → People/Incentives → Settings → Login.
- The app must compile and all existing tests pass after every migrated page. Update only selectors/snapshots that the redesign legitimately changes; never delete a behavioral assertion.
- **Nav-coverage test:** every sidebar link returns 200 for its roles, every old URL redirects to a working page, no role sees a link it cannot open. **Screenshot catalog:** each page type at 360 / 768 / 1280 saved to `docs/screenshots/management/`.

**Gate D:** typecheck, lint, tests, build green; nav-coverage and screenshot catalog complete; accessibility checks (axe) show no serious/critical issues on dashboard, POS, a table page, a form and a mobile staff page; the incentive screens from Part C are built in the new design.

---

## PART E — POS: research, then add the features that fit this business
Research what strong POS systems offer for Indian distributors/kirana (use web research if you have it; otherwise use the candidate list below), then implement the items marked P0 and list the rest in `docs/memory.md` with a one-line reason. **Every feature must respect the business rules:** loose from shop stock, cartons from godown, credit only for approved parties, price lists A/B/C by buyer, no market-return policy for customers/retailers (so no customer returns/exchanges), gapless invoice numbers, role-based discount limits with audit.
- **P0:** **hold and resume bills** (several parked carts per counter); **split payments** (cash + UPI + credit portion, change-due calculator, mode recorded on the invoice); **UPI QR on screen** generated locally from the owner's UPI ID (setting; payment confirmed manually by the cashier, no payment gateway); **keyboard-first billing** (F-keys, `qty*` shortcut, short-code entry, USB barcode scanner as keyboard input if the shop gets one, shortcut help overlay); **customer panel** (lookup by mobile, shows credit balance and limit, last purchases, one-click reorder); **line discount / price override with reason, within role limits, audited**; **undo last line**; **day-end close** (cash expected vs counted, sales by mode, by agent and top items, locks the day, printable summary); **reprint last bill / bill search**; **"send for home delivery"** (turns a counter bill into a dispatch order); invoice share via a plain `wa.me` link (no third-party API).
- **P1 (only if time remains):** quick-add favorites and recently sold; bill notes; phone-camera barcode scan; sound/visual add feedback.
- **Not now (explain in the report):** offline billing queue (it conflicts with gapless numbering unless number ranges are reserved), customer returns/exchanges (business rule), loyalty points.
Add tests for hold/resume, split payment totals, day-end totals equal the sum of invoices, discount limits, home-delivery conversion creating a dispatch order, and stock deduction by location unchanged.

---

## PART F — Deploy and verify
1. Gate before deploy: baseline-equal-or-better test counts, `git diff --stat` justified, migrations additive, backfills idempotent.
2. Run additive migrations via the existing migration job, deploy a new revision with the existing script (revision labeled with the commit SHA), run `scripts/smoke-prod.ts`, roll back automatically on failure.
3. Production checks without creating test invoices: sample-preview route for thermal and A5 prints; open real existing invoices in preview only; confirm agent codes exist for all staff; Incentive dashboard loads; "My Incentives" shows only the logged-in staff's data; new sidebar and old URL redirects work; POS loads with stock.
4. Re-run the whole verification once more from a clean checkout of the deployed commit.

## PART G — Docs
Update in place: `docs/architecture.md` (incentive ledger, triggers, redesign shell), `docs/rules.md` (incentive rules: append-only, snapshot, idempotent; UI redesign approved; Stitch workflow for management), `docs/design.md` (new management design system, page types, component patterns), `docs/tasks.md`, `docs/memory.md` (nav before/after map, decisions, default settings chosen, POS features shipped and deferred, open items).

## LOOP (follow strictly)
```
Part 0 sync gate → for each PART (A → B → C → D → E → F → G):
  plan → write tests → implement the smallest correct change → run: pnpm typecheck; pnpm lint; pnpm test; pnpm build
  → run the app, exercise the flow, screenshot at 360 and 1280, compare with the requirement
  → if anything fails: root-cause it, fix, rerun from the top of the part
  → proceed only when the gate is green and demonstrated
Finally: re-verify everything once more end to end (all gates), from a clean state.
```
- Never claim success without running the check and reading the output; quote key results in `docs/memory.md`.
- Never weaken or delete a failing test, never overwrite code you were not asked to touch, never force-push, never change business logic during the redesign.
- Same failure 5 times: write hypotheses and evidence in `docs/memory.md`, try a different approach. Ask the human only after 3 different approaches fail, with the exact error.
- When blocked on a human action (Stitch key, diverged git, approvals, owner decisions), print `WAITING_FOR_HUMAN: <what>` with exact steps and keep working on whatever does not depend on it.
- Local tests use the isolated test DB. Never run destructive scripts against production.

## FINISH
Only when all gates pass, print exactly:

`PROMPT 12 COMPLETE — synced PASS — receipt PASS — agent codes PASS — incentives PASS — redesign PASS — POS PASS — production PASS`

then: the commit live before and after, receipt screenshots, agent-code table, incentive defaults chosen and how to change them, nav before/after map, POS features shipped vs deferred, files changed with reasons, open items (incentive base/trigger confirmation, GST breakup for B2B, UPI ID, Stitch coverage). If you cannot reach that state, print `PROMPT 12 BLOCKED` with the exact blocker.
