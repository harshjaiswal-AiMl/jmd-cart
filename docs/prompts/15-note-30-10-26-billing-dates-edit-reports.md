<USER_REQUEST>
# PROMPT #15 — Fix and build all 8 items from the owner's note dated 30/10/26: manual invoice date, font size, weight quick access, date issue, invoice modification, item modification, item stock statement with sales and purchases, invoice totals (looping, self-verifying)

Save as `docs/prompts/15-note-30-10-26-billing-dates-edit-reports.md` and paste everything below the line to the agent. **Do not create new doc files.** Update existing `docs/*.md` in place. This is an **update of the live system**: no existing flow or feature may be removed or broken.

## THE OWNER'S NOTE (verbatim intent)
1. Date set manually
2. Font size
3. Quick access to all items according to weight
4. Date issue
5. Invoice modification: all columns (for example party name, date, item, qty, amount)
6. Item details modification
7. All items' stock details with sales and purchases
8. All invoices' amount in total

---

## ROLE
You are the engineer updating JMD Cart (Next.js 14 App Router, Prisma, Postgres, Cloud Run + Cloud SQL, `management.jmdcart.com`). Implement and prove the eight items above. "Done" means built, run, tested in several independent ways, deployed and re-verified, not "it compiles".

Follow `CLAUDE.md` and `docs/rules.md`. **Never open, print or log `.env`, `.env.deploy` or any secret.** Migrations are **additive only**. **Never create or edit real invoices in production** (gapless numbers, real money); production checks are read-only or sample-preview, unless the owner approves one real transaction.

## PART 0 — SYNC GATE (nothing is edited until this passes)
Run exactly the sync gate from `docs/prompts/11-invoice-print-agent-code.md` Part 0: `git fetch`, clean tree, fast-forward to the latest `origin/main`, confirm the commit running on **Cloud Run (100% traffic revision)** is contained in your code and production migrations all exist in the repo, work on a new branch, record the baseline of `pnpm typecheck / lint / test / build`. If branches diverged, the deployed code is not in git, or the tree is dirty: stop with `WAITING_FOR_HUMAN` and show the difference. Never reset, force-push or overwrite anyone's work. Review `git diff --stat` at the end and justify every changed file in `docs/memory.md`. Minimal diffs: no refactors or reformatting of untouched code.

## STEP 1 — READ, MAP, AND HUMAN INPUTS
Read `CLAUDE.md`, `docs/memory.md`, `tasks.md`, `rules.md`, `design.md`, `prisma/schema.prisma`, billing/invoice/stock/purchase/party/accounts modules, POS, Van counter, Create Order, invoice list/detail/print (shared invoice view-model), reports, nav config, settings, shared UI components, and any date/time helpers. Write in `docs/memory.md`: how invoice date, stock-movement timestamps and report date filters work today, and which of the earlier features already exist (weight fields, Pcs/Carton/Dozen/Bag picker, payment Done/Pending, agent code and incentives, role apps, redesigned shell). **Integrate with whatever exists; do not build other prompts' features**, except the small additive pieces this prompt names.

Ask the human ONCE (one message, then continue; use the defaults if there is no answer):
1. **Item 4, "date issue":** what exactly goes wrong? (wrong date on bills, date shifts near midnight, day/month swapped, report totals on the wrong day, something else?) Proceed with the full date audit in Part 4 regardless.
2. **Defaults (all are settings):** manual date allowed for ADMIN, SUPER_ADMIN, ACCOUNTS (and optionally SHOP) with a maximum back-date of 7 days and no future dates; invoice editing allowed for ADMIN and SUPER_ADMIN (optional: ACCOUNTS); an accounts **lock date** after which edits need SUPER_ADMIN; font scale presets Small / Default / Large / Extra Large; "Revised" marker on prints off by default.
3. If the Stitch MCP is connected, new screens are generated with it (invoice edit, item stock statement, totals bar); if it is not, follow the existing design system and log that.

---

## PART 1 — Item 1: Date set manually
- **Where:** Shop POS, Create Order, receipts/payments, and the invoice edit screen (Part 5). Purchases already have a bill date; keep it. Van counter keeps the automatic date (field staff do not back-date).
- A **date and time field** at billing (default: now in IST), keyboard friendly (type `30-10-2026` or use the picker), format **DD-MM-YYYY** everywhere.
- Rules (settings): permission by role; **max back-date window** (default 7 days); **no future dates**; changing the date away from today requires a **reason** and is audit-logged; blocked on or before the **accounts lock date** and in a **closed day-end** unless SUPER_ADMIN overrides with a reason.
- Data (additive): keep the real `createdAt`; add/confirm a **business date** (`invoiceDate`, timestamp in IST semantics) on invoices and an `effectiveDate` on stock movements, payments and receivables so **all reports, day-end, incentives and statements use the business date**, while audit keeps the real timestamp. Print shows the invoice date.
- Numbering stays gapless: a back-dated invoice gets the next number. Show a plain warning "Invoice number will be newer than its date" and record in the final report that the owner should confirm with the CA that this is acceptable.
**Gate 1:** tests: within window OK, beyond window blocked, future blocked, reason required, lock date and closed day respected, reports and day-end group by business date, numbering gapless, audit entry, permission matrix.

## PART 2 — Item 2: Font size
- **UI text size:** per-user preference (stored in the database and mirrored in a cookie so there is no flash) with presets **Small, Default, Large, Extra Large** (about 87.5%, 100%, 112.5%, 125% of the root font size) and quick **A− / A+** buttons in the top bar and the POS header. Implement through a root scale variable. Audit for hard-coded `px` font sizes in management screens and convert the ones that must scale to `rem`.
- **Print font size:** settings for the thermal and A5 templates (base size plus header/total sizes) with a live preview, safe bounds so thermal text still wraps and never overflows, applied identically to HTML print and Bluetooth/ESC-POS where the printer supports sizes.
- Layouts must not break at the largest size (no clipped buttons, no horizontal scroll at 360 px, sticky bars still usable).
**Gate 2:** tests for persistence across devices and reloads, scale applied on every role's key screens, print preview obeys limits, screenshot checks of POS, a table page and the Van screens at each preset.

## PART 3 — Item 3: Quick access to all items by weight
- Needs product weight. If `weightValue`/`weightUnit` do not exist, add them (additive, nullable) with a normalised `weightBase` (grams for mass, millilitres for volume, pieces for count units) and the **suggestion-with-preview backfill** (conservative parsing from names/SKUs such as "50gm", "1 KG", "500ml"; an admin approves in bulk; never overwrite silently; the Excel import maps a WEIGHT column).
- In **POS, Van counter, Create Order, GRN and stock lists** add a **weight quick-filter bar**: chips built from the real data (for example 5-10 g, 50 g, 100 g, 200 g, 250 g, 500 g, 1 kg, 5 kg, 10 kg+, and ml/litre groups) with item counts, multi-select, combinable with brand chips and search, a "No weight" chip with a "set weight" hint for admins, and a **"Weight view"** toggle that groups the item grid into weight sections for fast tap-to-add. A "sort by weight" option. Keyboard accessible (number shortcuts, arrows).
- Out-of-stock items still sort last (existing rule), weight shows next to the product name through the shared product label.
**Gate 3:** tests for normalisation (g/kg/ml/l), chip counts equal query counts, combined filters, no-weight bucket, keyboard operation, performance with 1,000+ items.

## PART 4 — Item 4: Date issue (find and fix every date bug)
1. **Audit** every date/time usage (`new Date(`, `toISOString().slice`, `toLocaleDateString`, date libraries, raw SQL `CURRENT_DATE`, `now()`, `date_trunc`, Excel/CSV date parsing, filters, day-end, FY logic, printing, dispatch/queue timestamps, receipts) and list the suspects in `docs/memory.md`. Typical causes: date-only strings parsed as UTC (shows the previous day), server timezone differing from IST, bills made between 00:00 and 05:30 IST landing on the previous UTC day, day/month swapped by locale formatting or Excel imports, inclusive end-date filters missing the last day, FY rollover at IST midnight, browser time zone differing from IST.
2. **Fix by centralising:** one `datetime` module (`nowIst`, `toIstDateString`, `startOfIstDay`, `endOfIstDay`, `parseDmy`, `formatDmy`, `formatDmyHm`, `fyOf`) used everywhere; store instants as UTC `timestamptz`, business dates as IST-based dates; render **always in IST and DD-MM-YYYY** (and 12-hour or 24-hour consistently via one setting); add a lint rule that blocks raw `new Date()` formatting and `toISOString().slice` outside the module.
3. **Reproduce first, then prove:** write failing tests for each confirmed bug before fixing. Run the date-sensitive tests under **three process time zones** (`UTC`, `Asia/Kolkata`, `America/Los_Angeles`) and with fake timers at 23:30 IST, 00:30 IST, 31 March 23:59 IST and 1 April 00:01 IST; results must be identical.
4. Existing data: **do not rewrite history silently.** If a data scan finds invoices or entries whose stored date is clearly shifted, produce a read-only report with a proposed correction list for the owner to approve; apply only through an explicit, audited admin action.
**Gate 4:** the date test matrix is green in all time zones; screens, prints, reports and exports show the same date for the same record.

## PART 5 — Item 5: Invoice modification (all columns)
**Principle:** editing a posted invoice must leave stock, GST, ledger, payments, incentives and dispatch exactly as if the invoice had been created with the final content, and must be fully auditable.
- **Who:** ADMIN and SUPER_ADMIN by default (setting for ACCOUNTS; optional P1 "edit request → admin approval" for others). Cancelled invoices cannot be edited. Edits on or before the **lock date** need SUPER_ADMIN plus a reason.
- **Editable:** party (name, address, phone, and the linked party), invoice date/time (Part 1 rules), line items (add, remove, replace product), quantity and unit, MRP, rate, discount %, line amount (editing the amount recomputes the rate with a rounding warning), delivery charge, round-off, payment mode and status, remarks, agent (admin only). **Never editable:** invoice number, series, financial year, id, channel.
- **Mechanism:** an `InvoiceRevision` table (invoice, revision number, before and after snapshots, diff, reason, editor, timestamp) and an optimistic-lock `version` on the invoice. In one transaction compute and apply: stock deltas by the existing fulfilment rules (shop loose from shop, cartons from godown, van from van stock) through new **ledger rows only** (never edit old rows), **never allowing negative stock**; GST recomputation (CGST/SGST/IGST by party state, paise-exact); party ledger / receivable adjustment with the credit-limit check; payment status and amounts (an overpayment becomes a recorded credit/refund due, an underpayment becomes pending); incentive reversal and re-accrual if the incentive module exists; dispatch queue lines updated, and if the order was already handed over, flag "edited after handover, re-confirm".
- **UI:** "Edit invoice" opens a POS-style grid with every column editable and fully keyboard operable, live totals, and a **change preview** before saving (old total to new total, stock changes per item, ledger impact, GST change), mandatory reason, then a banner "Edited (revision N) by X on date". A **Revision History** tab with side-by-side diffs and the ability to view or print an earlier revision. Prints always show current values; an optional small "Revised" marker (setting).
- **Equivalence invariant (property test):** apply random sequences of edits to an invoice and assert the final stock, ledger, GST, totals, payment due and incentive entries equal those of a **freshly created invoice with the same final content**.
**Gate 5:** equivalence property test, exact stock deltas, paise-exact GST/rounding, ledger and receivable consistency, concurrent-edit conflict handling, lock-date and permission matrix, audit and revision integrity, incentive and dispatch effects, numbering untouched, existing invoice/stock/GST tests unchanged.

## PART 6 — Item 6: Item details modification
- Full edit of every product field from the admin catalog (name, brand, category, pack size, bag size, weight, HSN, GST slab, MRP, A/B/C prices, reorder level, image, active, short code), plus a **quick-edit drawer** reachable from POS, stock lists, GRN and invoice item rows.
- **Field-level permissions:** price and MRP fields for ADMIN/SUPER_ADMIN; HSN/GST for ADMIN/SUPER_ADMIN/ACCOUNTS; descriptive and stock-label fields for GODOWN as well (settings).
- **Safety:** changing **pack size** on a product that has stock, open dispatch orders or van loads shows an impact summary (stock stays in pieces, cartons display changes) and needs an explicit confirm; SKU uniqueness; HSN format check (4, 6 or 8 digits); the A ≤ B ≤ C ≤ MRP warning; past invoices are unaffected (snapshots).
- **History:** `ProductRevision` (field-level before/after, who, when, reason) and a price-history view; **bulk edit** for selected products (brand, category, GST, HSN, weight, bag size, reorder level, active) with a preview table, an apply step and an **undo of the whole batch**.
- Product detail page with tabs: Overview, Pricing, Stock by location, History, Sales and Purchases (links into Part 7).
**Gate 6:** tests for field permissions, pack-size impact guard, revisions and undo, bulk edit preview/apply/undo, snapshots protect old invoices.

## PART 7 — Item 7: All items' stock details with sales and purchases
New report **Reports → Item Stock Statement**, plus a per-item **stock card**.
- Per item for a date range and location filter: **Opening qty, Purchased (qty and value), Sold (qty and value, split shop / van / online), Transfers in/out, Adjustments and wastage, Van returns, Closing qty**, plus current stock by location (godown, shop, each van), average purchase rate, average sale rate, margin %, reorder status. Toggle between pieces and "cartons + loose". Product label shows weight.
- Filters: brand, category, weight chips, location, "only items with movement", search; sort on any column; pagination; **totals row**; drill-down to the movements, invoices and GRNs behind every number; export to Excel, CSV and PDF with the same filters.
- Summary cards: total stock value at cost and at MRP, top movers, dead stock (no sale in N days), fast movers.
- Built from the stock ledger, invoice lines (cancelled excluded, edits reflected through revisions) and accepted purchase quantities, **grouped by business date** (Part 1). Fast aggregation with proper indexes: a 1,000+ item statement for a month loads in about 2 seconds or less (record the timing).
**Gate 7 invariants:** for every item and location, Opening + In − Out = Closing; with the end date = today, Closing equals the current balance; report totals equal the sum of the drill-down records; sales and purchase totals reconcile with the invoice and GRN totals for the same filters; exports match the screen.

## PART 8 — Item 8: Total of all invoices
- On the **Invoices list** (and Online Orders, Van invoices, Pending Payments, party ledger and agent reports where invoices are listed) add a **totals bar for the entire filtered result, not just the visible page**: invoice count, **total amount**, taxable value, tax, discount, paid, pending, average bill value, and cancelled count shown separately (cancelled excluded from the totals). A small breakdown by day, channel and payment mode. Quick ranges (Today, Yesterday, This week, This month, This FY, Custom) use the business date. CSV/Excel/PDF exports include the totals row.
**Gate 8:** the totals bar equals a direct database sum for the same filters (tests with random data and every filter combination), unchanged by pagination, exports match.

---

## PART 9 — Verification (multiple independent layers, none may be weakened)
1. All existing suites pass unchanged (only legitimate selector/snapshot updates; never delete a behavioural assertion).
2. New unit, integration and e2e tests for every Part above, including keyboard-only paths for billing, invoice edit and the weight filter.
3. **Parity:** a feature-inventory comparison (routes, actions, API contracts; additive changes only) shows nothing was lost.
4. **Data-integrity suite** (run on every part): stock never negative, `SUM(ledger) = balances`, invoice numbering gapless, GST paise-exact, ledger and receivable consistent, incentive and payment totals consistent.
5. **Time-zone matrix** from Part 4 for every date-dependent test.
6. **Accessibility** (axe, zero serious/critical) on each new or changed screen, including at the Extra Large font preset; **responsive** at 360 / 768 / 1280 px with no horizontal scroll.
7. **Performance:** report and totals queries within budget, no page-weight regression.
8. **End-to-end scenario** in Playwright: set a back-dated invoice with a reason, bill using the weight filter and the keyboard, change the font size, edit the invoice (party, date, item, qty, amount) and verify the revision history and the preview, edit an item's details and confirm old invoices are unchanged, open the Item Stock Statement and reconcile it with the invoice and GRN totals, check the invoice totals bar.
9. **Stability:** run the whole suite twice, then once more after a clean install and a fresh database; results must be identical.

## PART 10 — Deploy and verify
1. Gate before deploy: all of Part 9 green, `git diff --stat` justified, migrations additive, any backfill idempotent and previewed.
2. Run additive migrations via the existing migration job, deploy a new revision with the existing script (labelled with the commit SHA), run `scripts/smoke-prod.ts` (extend it for the new report and totals endpoints), roll back automatically on failure.
3. Production checks without real transactions: pages load for each role, the new report returns plausible read-only numbers that reconcile with the existing dashboards, sample-preview prints at each font setting, the date display is DD-MM-YYYY in IST. Re-run the verification once more from a clean checkout of the deployed commit.

## PART 11 — Docs
Update in place: `docs/architecture.md` (datetime module, business date vs created time, invoice revisions, product revisions, weight normalisation, report queries), `docs/rules.md` (all dates through the datetime module; invoice edits via revisions only; ledger rows are append-only; lock date; no silent history rewrites), `docs/design.md`, `docs/tasks.md`, `docs/memory.md` (root causes of the date issue, defaults chosen, open items).

## LOOP (follow strictly)
```
Part 0 sync gate → for each of Parts 1 to 8:
  find root cause or define the invariant → write tests (failing first for bugs) → implement the smallest correct change
  → run: pnpm typecheck; pnpm lint; pnpm test; pnpm build → run the app, exercise the flow, screenshot at 360 and 1280
  → if anything fails: root-cause it, fix, rerun from the top of the part
  → proceed only when the part's gate is green and demonstrated
Then Part 9 (twice) → Part 10 → Part 11 → re-verify everything once more end to end.
```
- Never claim success without running the check and reading the output; quote key results in `docs/memory.md`.
- Never weaken or delete a failing test, never remove a feature, never edit ledger rows (only append), never rewrite stored data without a previewed, audited action, never force-push.
- Same failure 5 times: write hypotheses and evidence in `docs/memory.md`, try a different approach. Ask the human only after 3 different approaches fail, with the exact error.
- When blocked on a human action (the date-issue symptom, approvals, diverged git), print `WAITING_FOR_HUMAN: <what>` with exact steps and keep working on whatever does not depend on it.
- Local tests use the isolated test DB. Never run destructive scripts against production.

## FINISH
Only when all gates pass, print exactly:

`PROMPT 15 COMPLETE — manual date PASS — font size PASS — weight access PASS — date issue PASS — invoice edit PASS — item edit PASS — item stock statement PASS — invoice totals PASS — production PASS`

then: the commit live before and after, the root causes of the date issue, defaults chosen and where to change them, screenshots of each new screen, test counts by layer, files changed with reasons, open items (back-date versus invoice numbering with the CA, lock date value, who may edit invoices, bag sizes). If you cannot reach that state, print `PROMPT 15 BLOCKED` with the exact blocker.


reverify kar liyo bhai jo pahle se ho rakha hai usko change nhi karna make sure 
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-10-30T16:00:54+05:30.
</ADDITIONAL_METADATA>