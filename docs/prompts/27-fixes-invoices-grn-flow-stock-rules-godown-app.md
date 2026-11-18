# PROMPT #27 — Fix list: Invoices summary and columns, customer address on the bill, GRN opening flow, stock-movement rules and ledger, Godown app "Today's Dispatch" and "Movement Ledger" (looping, self-verifying)

Save as `docs/prompts/27-fixes-invoices-grn-flow-stock-rules-godown-app.md` and paste everything below the line to the agent. **Do not create new doc files.** Update existing `docs/*.md` in place. **Scope is exactly the six items below. Do not add features that are not listed, and do not remove any existing feature.**

---

## THE SIX ITEMS (owner's words, with what his screenshots show)
1. **Sales Invoices page.** In the dark-blue "FILTERED TOTAL SUMMARY" card show **only: Today's Total Bill, Cash Collected, UPI Collected, Today Credit.** In the table show **only these columns: Invoice #, Date & Time, Customer / Party, Amount.** (Screenshot: the card has six tiles plus Average Bill Value; the table has Invoice #, Date & Time, Customer / Party, Channel, Agent, Buyer Tag, Status, Amount, Actions.)
2. **Bill print.** Under the customer **name and mobile number show the customer's address**, "without changing anything" else. (Screenshot: the 80 mm cash bill prints Date, Bill No, Party, Mobile, Mode.)
3. **GRN opening flow** (`/godown/purchases/new`). **Remove the product that is added by default.** Pressing **New GRN** must first **open the Supplier popup**; after the supplier is chosen the **cursor moves to Bill No.**; typing the bill number and pressing **Enter** moves to **product search**; after that the existing flow stays exactly as it is. (Screenshot: row 1 is pre-filled with "AALO BHUJIYA, 1 Carton" and an "Unsaved purchase draft found, Resume Draft" banner is showing.)
4. **Stock rules (confirm, then make them true).** The owner asks: *"When we bill in the name of JMD Shop, does the item leave the Godown after dispatch and add to the Shop, or not? Confirm and tell me; if not, fix it."* His rule, stated again for the ledger: **cartons always reduce Godown stock; loose pieces always reduce Shop stock.**
5. **Product stock ledger** (`/godown/stock/ledger?productId=…`). **Every stock movement, from the Shop or the Godown, must show a proper date, the party name, the invoice number and the quantity.** (Screenshot, MDH Kitchen King, Main Godown: the Reference column shows internal ids such as `cmwamustu000wzzt…` instead of invoice numbers; Party/Destination shows "—" for every sale; reasons read "Invoice #INV/26-27/000157 (**Loose from Godown**)", "000226 (Loose from Godown)", "000240 (Loose from Godown)", "000270 (Cartons from Godown)", "000280 (Cartons from Godown)"; the live stock is **−9070 pcs (−51 carton + −70 loose)**.)
6. **JMD Godown app** (Android, Hindi/English toggle, bottom bar Home / Orders / Issue / Stock / More). Add a **"Today's Dispatch"** section (what was dispatched, to where, to which customer, which items) and a **"Movement Ledger"** section where he can check **product-wise which product went to which party and when.**

## ROLE
You are the engineer updating JMD Cart (Next.js 14 App Router, Prisma, Postgres on Cloud Run + Cloud SQL, management panel at `management.jmdcart.com`, the native/mobile Godown app). Fix the six items, prove them with several independent test layers, deploy safely and re-verify. "Done" means built, run, tested, deployed and verified, not "it compiles".

Follow `CLAUDE.md` and `docs/rules.md`. **Never open, print or log `.env`, `.env.deploy` or any secret.** Migrations are **additive only**. **Never create real invoices, GRNs or stock changes in production**; verify with the test database, sample previews and read-only checks. **Never rewrite existing ledger rows or old invoices.**

## PART 0 — SYNC GATE (nothing is edited until this passes)
Run exactly the sync gate from `docs/prompts/11-invoice-print-agent-code.md` Part 0: `git fetch`, clean tree, fast-forward to the latest `origin/main`, confirm the commit running on **Cloud Run (100% traffic revision)** is contained in your code and production migrations all exist in the repo, work on a new branch, record the baseline of `pnpm typecheck / lint / test / build`. If branches diverged, the deployed code is not in git, or the tree is dirty: stop with `WAITING_FOR_HUMAN` and show the difference. Never reset, force-push or overwrite anyone's work. Review `git diff --stat` at the end and justify every changed file in `docs/memory.md`.

## STEP 1 — READ, MAP, BASELINE
Read `CLAUDE.md`, `docs/memory.md`, `tasks.md`, `rules.md`, `design.md`, `prisma/schema.prisma` (Invoice, InvoiceLine, StockMovement, StockBalance, reservations, Party, Location), the invoices list and its summary query, the shared invoice view-model and every print template, the purchase (GRN) screen and its keyboard/navigation code, the stock service (`availability.ts`, deduction by location, handover/dispatch code), the product ledger page and API, the dispatch/warehouse queue, and the Godown app routes (`/app/godown/*`) and its native shell. Record in `docs/memory.md`: how each of the six items works today, and the **baseline** (screenshots of the invoices page, the thermal and A5 and GST and credit prints, the GRN new screen, the ledger page, the Godown app home; golden fixtures for invoice totals and print output; existing test counts).

## PART A — INVOICES PAGE: SUMMARY AND COLUMNS
1. **Summary card** shows exactly four tiles: **Today's Total Bill**, **Cash Collected**, **UPI Collected**, **Today Credit**. Definitions (IST business date, cancelled invoices excluded):
   - *Total Bill* = sum of invoice amounts in scope.
   - *Cash Collected* and *UPI Collected* = amounts actually received in that mode on those invoices (payment status Done or collected part of Partial).
   - *Today Credit* = amount still to be received on those invoices (Credit mode plus Payment Pending).
   - The four tiles **reconcile**: Cash + UPI + Credit = Total Bill (within rounding).
   The tiles keep following the page filters (range, search, channel, status). Their labels read "Today's …" when the range is Today and "<range> …" otherwise (for example "This Week's Total Bill"). The default range stays Today.
2. The six other metrics (taxable value, GST collected, discount given, average bill, pending/credit combined, channel counts) are **not deleted**: they move into a small collapsed **"More totals"** control under the card (keyboard accessible), unchanged in value and logic.
3. **Table columns** default to **Invoice #, Date & Time, Customer / Party, Amount** plus the existing **Actions** column (view, edit, print, delete; Actions is not data and stays). Keep the small markers that live inside the Invoice # cell (REV n, POST-DATED, cancelled). The customer's phone stays as the small second line under the party name. The other columns (Channel, Agent, Buyer Tag, Status) are **not removed**: a **"Columns"** menu restores any of them, and the choice is remembered per user. Filters, search, "Show cancelled" and sorting keep working as today; cancelled rows stay clearly marked even when Status is hidden.
**Gate A:** tests: tile definitions against a direct database sum for every filter combination, reconciliation, labels, column default and restoration, filters unchanged, keyboard operation of "More totals" and "Columns", screenshots at 1366×768 and 1920×1080 at 100% and 125% font.

## PART B — CUSTOMER ADDRESS ON EVERY CUSTOMER-FACING BILL
1. In the shared invoice view-model and every template that prints the customer block (80 mm cash bill, 58 mm if present, credit bill, GST A4 and GST thermal, A5, Demand Bill, reprint, the secure bill link page), print **Address directly under Mobile** when the invoice has one (snapshot first, then the party's address as the existing fallback). Long addresses **wrap** within the template width; an empty address prints **nothing** (no blank label).
2. **Nothing else changes** on any bill: same rows, order, fonts, totals, footer, numbering.
**Gate B:** golden print fixtures: the output differs from the baseline **only** by the new Address row(s) (automated diff of rendered text); wrapping and empty-address cases; ESC/POS text equals the HTML text; the Bluetooth path matches.

## PART C — GRN OPENING FLOW (supplier popup → Bill No. → product search)
1. A **new GRN starts empty**: no default product, no pre-filled rows. Find where the "AALO BHUJIYA 1 Carton" line comes from (a hard-coded default, a seed, an auto-restored draft, a "last product" memory) and remove the cause. Drafts restore **only when the user chooses Resume**.
2. **On New GRN** (the New button, `F3`, and opening `/godown/purchases/new`): the **Select Supplier** popup opens immediately with the cursor in its search box (the shared supplier search, ↑/↓ to choose, Enter to select). After the supplier is selected the **cursor goes to Bill No.**; typing the bill number and pressing **Enter** moves the cursor to the **product search box**. From there the flow is unchanged (item → Qty → Unit → Rate … new row), as it is today.
3. Details: Enter on an empty Bill No. stays put with the existing required message; the duplicate-bill check still runs; Esc in the supplier popup closes it and returns focus to the Supplier control (a second Esc follows the global Esc-back rules); if the user had already chosen a supplier (for example after "Repeat GRN"), the popup is skipped and the cursor goes to Bill No.
4. **Unsaved-draft banner:** keep the feature. When a draft exists, `New` first shows a small keyboard dialog "Unsaved draft from HH:MM found. **Enter = Resume**, **N = Start new**, **D = Discard**"; choosing Start new continues to the supplier popup. The banner must never steal focus from this flow.
**Gate C:** a no-mouse Playwright test: press New → supplier popup open → type a fragment → Enter → cursor in Bill No. → type and Enter → cursor in product search → add two lines → post; the same with an existing draft; the same after posting a GRN and pressing New again; no row is ever pre-filled; existing GRN, scan-bill and keyboard suites pass unchanged.

## PART D — STOCK RULES: EVIDENCE FIRST, THEN MAKE THEM TRUE
1. **Evidence matrix (on the test database, scripted, saved as a test fixture and summarised in `docs/memory.md`).** For each scenario record which location(s) change, **when** (at invoice or at dispatch/handover), and the exact ledger rows (type, location, quantity, party, invoice number, reason): Shop POS loose only; carton only; mixed; loose with not enough Shop stock; cartons with not enough Godown stock; Create Order / dispatch order; online order; van invoice; invoice edit changing quantity or unit; invoice cancel; the handover step; transfers; carton-to-loose auto-conversion. Include the owner's two questions answered in plain words: **(a)** on a JMD Shop bill, does stock leave the Godown after dispatch, and **(b)** is anything added to the Shop? The screenshot already shows that **loose sales are being taken from the Godown** ("Loose from Godown"), which contradicts the owner's rule; find out why (which channel those invoices had, which code path, whether a silent fallback to Godown exists when the Shop has no stock).
2. **Make the owner's rules true** (settings with these defaults; log each decision):
   - **Cartons always reduce Godown stock. Loose pieces always reduce Shop stock.** There is **no silent fallback** from Shop loose to Godown. If Shop loose is short, the existing "stock short — update stock now" flow applies (or the Godown transfers loose pieces to the Shop through the existing Transfers). Van invoices deduct **van stock** as before.
   - **Timing (owner: "after dispatch"):** for cartons that the warehouse must pack and hand over, stock leaves the Godown **when the warehouse confirms the dispatch/handover**, and from the moment of billing the quantity is **reserved** so availability and the POS never oversell (available = on hand − reserved). Setting `stock.cartonDeductAt` = `HANDOVER` (default) or `INVOICE` (the previous behaviour, one switch to go back). Cancelling or editing an invoice before dispatch releases or adjusts the reservation; after dispatch it follows the existing reversal rules. Existing invoices already deducted at billing time are **not touched**.
   - **No automatic "plus" on the Shop when billing** (the goods go to the customer). Shop stock increases only through GRN, Transfers, carton-to-loose conversion and adjustments, as today; state this plainly in the report.
   - Never create negative stock in any new operation. The ledger shows the live stock at **−9070 pcs**: **investigate and report** how it became negative (which path, which date) in `docs/memory.md`; **do not auto-correct existing data**.
3. Keep the warehouse queue, storefront availability, dispatch and alert behaviour consistent with these rules (loose pieces never appear in the warehouse queue).
**Gate D:** the evidence matrix test passes against the rules; tests for each scenario above including reservation, handover deduction, cancel/edit before and after dispatch, short Shop stock without fallback, idempotent handover, `stock.cartonDeductAt = INVOICE` still works; invariants hold (never negative for new operations, `SUM(ledger) = balances`, numbering gapless, GST paise-exact); existing stock, dispatch, POS and van suites pass unchanged except assertions that encoded the old timing, each updated deliberately and explained.

## PART E — PRODUCT STOCK LEDGER SHOWS DATE, PARTY, INVOICE NO., QUANTITY
1. For **every** movement (sale/dispatch, van issue and return, transfer, GRN, carton break, adjustment, damage, return to company) the ledger row shows:
   - **Date and time (IST)** of the movement, plus the **invoice date** as a small second line when it differs (post-dated or edited invoices);
   - **Invoice number** in human-readable form (`INV/26-27/000157`) as the link text (never an internal id); GRN number, transfer number or van trip number for the other types;
   - **Party name**: the customer/party for sales and dispatches; the van name for van issue/return; the destination or source location for transfers; the supplier for GRN; "—" only when there is genuinely none;
   - **Quantity** in pieces with the carton + loose breakdown, IN and OUT columns as today, running balance, user, and a corrected **reason** ("Loose from Shop", "Cartons from Godown, dispatched").
2. **Location view:** Main Godown / Retail Shop / All, each with its own running balance (the page currently shows only Main Godown). Add filters for party, date range and movement type if not present, and search by invoice number; keep the existing movement-type chips, the "Matches Current Stock" audit box, Print A4 and Export to Excel (the export and print include the new columns).
3. **No data rewrite:** enrich at read time by joining movements to invoices and parties; old rows show correct numbers and names without changing the ledger.
**Gate E:** tests: every movement type renders date, invoice/reference number, party and quantity; old rows enriched correctly; no internal id appears in the UI; location views reconcile with balances; exports match the screen; screenshots at 1366×768.

## PART F — GODOWN APP: "TODAY'S DISPATCH" AND "MOVEMENT LEDGER"
Inspect how the app is built (web routes inside the native shell, or native screens) and extend it in the same way, keeping the Hindi/English toggle (add both languages for every new string) and the existing design system (design the two new mobile screens with Stitch at 360 px if the Stitch MCP is connected, otherwise reuse the existing tokens and log that).
1. **Today's Dispatch** (a tile on Home and an entry under More): date selector (default today); a summary (number of dispatches, cartons, pieces); a list of every dispatch/handover that day. Each entry shows **invoice/order number, customer/party name and phone (tap to call), where it went** (customer address or area, "Van 2" for a van issue, "Counter pickup"), the **handover time**, the person it was handed to if recorded, and an expandable **item list** (name + weight, quantity with unit and pieces). Search by party or invoice number. Data comes from the same dispatch/handover records and stock rules as Part D.
2. **Movement Ledger** (a tile on Home and an entry under More): search a product with the shared item search, see its stock by location, then a chronological list of movements as cards with **date and time, party name, invoice number, quantity in/out, running balance, type, user**; filters for party, date range and type; location toggle. It uses the same API and enrichment as the web ledger (Part E) so both always agree.
3. Permissions: GODOWN, ADMIN, SUPER_ADMIN and ACCOUNTS; no cost or margin data; works at 320 to 412 px width, large-font and TalkBack labels, loads fast (paginate, 20 rows first).
**Gate F:** Playwright at 360 px for both screens (today's dispatch list with expand, party search, product search and ledger filters), data parity with the web ledger for the same product, Hindi and English strings complete, role access tests, the app builds if it has a native shell (release build) and the new routes open inside it.

## PART G — VERIFICATION (multiple independent layers; none may be weakened)
1. **Parity:** feature inventory before/after (invoices page, bills, GRN, stock, ledger, Godown app): nothing removed; moved items reachable (More totals, Columns menu, draft dialog); API changes additive.
2. **Golden tests:** invoice totals, GST, rounding and print output unchanged except the new Address row; purchase and GRN posting unchanged; stock effects match the evidence matrix and the rules above.
3. **Existing suites** (invoices, billing, print, GRN, scan bill, stock, dispatch, warehouse queue, van, POS, permissions, keyboard) pass unchanged except deliberately updated timing assertions.
4. **No-mouse proof** for the GRN opening flow and the invoices page (filters, More totals, Columns).
5. **Reconciliation checks:** summary tiles equal direct sums; ledger totals equal balances; Today's Dispatch totals equal the day's handover records.
6. **Accessibility** (axe zero serious/critical on the changed screens), **responsive** at 360, 768, 1366, 1920 px and 125% font.
7. **Stability:** run everything twice, then once from a clean install and fresh DB; results identical.

## PART H — DEPLOY AND VERIFY
1. Gate before deploy: Part G green, `git diff --stat` justified, migrations additive (reservation fields/settings only if needed).
2. Deploy with the safe path from Prompt #24 (no-traffic revision, smoke tests, canary 10% → 50% → 100%, automatic rollback), labelled with the commit SHA; run `scripts/smoke-prod.ts`; build and publish the Godown app update if it has a native shell.
3. Production checks without real transactions: invoices page shows the four tiles and four columns with the Columns menu; sample-preview prints show Address under Mobile; the GRN new screen opens the supplier popup (UI check, no save); the ledger page renders invoice numbers and party names for existing movements (read-only); the Godown app screens load for a test GODOWN user. Re-run the verification once more from a clean checkout of the deployed commit.
4. Update in place: `docs/architecture.md` (stock rules by location, reservation and handover timing, ledger enrichment), `docs/rules.md` (cartons from Godown, loose from Shop, no silent fallback, ledger rows must carry invoice number, party and date, no internal ids in the UI), `docs/design.md`, `docs/tasks.md`, `docs/memory.md` (evidence matrix, the answer to the owner's question, root causes, open items).

## NOT IN SCOPE (record in `docs/memory.md` if you notice them, do not fix here)
The negative live stock beyond the investigation above; the Godown app's "Incoming Phone Call Alert: OFF (Silent), Turn ON" state; thermal logo print quality; any new report or feature not listed.

## LOOP (follow strictly)
```
Part 0 sync gate → Step 1 baseline → for each of Parts A to F:
  state the invariant or the evidence → write tests (failing first) → implement the smallest correct change
  → run: pnpm typecheck; pnpm lint; pnpm test; pnpm build → exercise the screen, screenshot
  → if anything fails or differs: root-cause it, fix, rerun from the top of the part
  → proceed only when the part's gate is green and demonstrated
Then Part G (twice) → Part H → re-verify once more end to end.
```
- Never claim success without running the check and reading the output; quote key results in `docs/memory.md`.
- Never weaken or delete a failing test, never remove or rename an existing feature, never rewrite stored ledger rows or old invoices, never allow negative stock in new operations, never add unlisted features, never force-push.
- Same failure 5 times: write hypotheses and evidence in `docs/memory.md`, try a different approach. Ask the human only after 3 different approaches fail, with the exact error.
- When blocked on a human action (diverged git, Stitch key, device test), print `WAITING_FOR_HUMAN: <what>` with exact steps and keep working on whatever does not depend on it.
- Local tests use the isolated test DB. Never run destructive scripts against production.

## FINISH
Only when all gates pass, print exactly:

`PROMPT 27 COMPLETE — invoices summary + columns PASS — bill address PASS — GRN flow PASS — stock rules PASS — ledger PASS — godown app PASS — production PASS`

then: the commit live before and after, the plain-language answer to the owner's stock question with the evidence matrix, root causes (default GRN product, loose-from-Godown, internal ids in the ledger), before/after screenshots, the setting names and defaults (`stock.cartonDeductAt`), files changed with reasons, and the recorded out-of-scope observations. If you cannot reach that state, print `PROMPT 27 BLOCKED` with the exact blocker.
