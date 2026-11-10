# PROMPT #17 — Proper party search, working A/B/C tiers and discounts, price in the item search (one search everywhere, storefront included), item preview in "Save voucher", and bill formats by payment mode with a GST Bill option (looping, self-verifying)

Save as `docs/prompts/17-party-search-tiers-preview-gst-bill.md` and paste everything below the line to the agent. **Do not create new doc files.** Update existing `docs/*.md` in place. This is an **update of the live system**: every existing flow and feature must keep working.

---

## WHAT THE OWNER REPORTED (from his screenshots)
1. **Party search is not proper.** Typing `sh` in the party selector shows Walk-in Customer, Aakash kirana Store, Aakash Kr, Aashirvad Grocery Store, AASHISH BIHRA... (substring hits, no useful ranking, Walk-in pinned even though it does not match). He expects parties whose name words **start with** `sh` first.
2. **A / B / C price tier buttons do nothing** when pressed. Discounts must also work properly.
3. In the item search dropdown (name + weight on the left, brand on the right) **the price must also be shown next to the weight**.
4. **Use this same search everywhere** a product is searched on the whole website (management screens and the storefront).
5. **"Save Voucher Confirmation" shows only totals.** It must show **which products are in the bill** (a preview), and Esc must return to editing so more items can be added.
6. On the invoice print page (tabs: Thermal 80mm, Demand Bill, A5 Invoice, GST A4, GST Thermal): **if the sale was Cash/UPI show only the cash bill (Thermal 80mm); if it was Credit show only the credit bill and add the amount to that party's credit; add a GST Bill option at billing: when chosen, only the GST bill is issued.**

## ROLE
You are the engineer updating JMD Cart (Next.js 14 App Router, Prisma, Postgres, Cloud Run + Cloud SQL, `management.jmdcart.com` and `jmdcart.com`). Fix and build the six items, prove them with several independent test layers, deploy, and re-verify. "Done" means built, run, measured and verified, not "it compiles".

Follow `CLAUDE.md` and `docs/rules.md`. **Never open, print or log `.env`, `.env.deploy` or any secret.** Migrations are **additive only**. **Never create or edit real invoices in production** (gapless numbers, real money): verify with automated tests and the test database; in production do read-only checks and sample-preview prints only.

## PART 0 — SYNC GATE (nothing is edited until this passes)
Run exactly the sync gate from `docs/prompts/11-invoice-print-agent-code.md` Part 0: `git fetch`, clean tree, fast-forward to the latest `origin/main`, confirm the commit running on **Cloud Run (100% traffic revision)** is contained in your code and production migrations all exist in the repo, work on a new branch, record the baseline of `pnpm typecheck / lint / test / build`. If branches diverged, the deployed code is not in git, or the tree is dirty: stop with `WAITING_FOR_HUMAN` and show the difference. Never reset, force-push or overwrite anyone's work. Review `git diff --stat` at the end and justify every changed file in `docs/memory.md`.

## STEP 1 — READ, MAP, BASELINE, HUMAN INPUTS
Read `CLAUDE.md`, `docs/memory.md`, `tasks.md`, `rules.md`, `design.md`, `prisma/schema.prisma`, the Shop POS and voucher grid, party selector, the shared item search (`searchItems`, `ItemSearchBox` from Prompt #16 if present), pricing/price-list code (`resolvePrice`, tiers A/B/C, MRP/rate/discount edit, order discount, role discount limits), billing/invoice services, invoice print and its template tabs, party ledger/credit code, payment mode and status code, the storefront search API and components, the Ctrl+K command palette, and `nav.config`. Record in `docs/memory.md`:
- **Search surface inventory:** every place a product or party is searched or filtered by text (POS, Van counter, Create Order, GRN/purchase, Invoice Edit, stock screens, catalogue, reports filters, dispatch, command palette, storefront header search, storefront category/brand search, any admin pickers), and how each is implemented today.
- **What each print tab means today** (Thermal 80mm, Demand Bill, A5 Invoice, GST A4, GST Thermal) and when each is used.
- **Baseline:** screenshots of POS, party dropdown, item dropdown, save dialog and the invoice print page; the existing feature inventory; golden billing fixtures (scripted bills with their totals); search latency.

Ask the human ONCE (one message, then continue; use the defaults below if there is no answer):
1. **GST bill numbering:** same invoice series for Retail and GST bills (default) or a separate GST series (for example `GST/26-27/000001`, gapless per series)? Build it as a setting `invoice.gstSeparateSeries` (default off).
2. **Stitch MCP** (for the redesigned dropdowns, preview dialog and credit/GST layouts): if it is not connected, ask the human to connect it (current official setup, key via environment/secret store, never the repo). If unavailable and the human says continue, use the existing design system and log it.
3. Confirm these defaults: show only the relevant bill format by payment mode; an admin-only "Other formats" menu keeps every other template reachable.

---

## PART A — PARTY SEARCH THAT WORKS
Build one shared `searchParties(query)` and one `PartySearchBox`, on the same token-search core as items.
- **Tokens and prefixes:** every space-separated token must match; a token matches by **prefix of any word** in the party name, or by phone digits (prefix or any contiguous digits from 3 characters), address/city/area words, GSTIN, short code. Order of tokens does not matter (`kirana aakash`).
- **Ranking:** exact name prefix > name word-prefix > phone/address match > substring; typed `sh` shows **Shahwaz, Shiv Traders, Shree...** before parties that only contain "sh" in the middle (`Aakash`). Within equal rank: recently billed parties first, then alphabetical. Typo tolerance of one edit for tokens of 4+ characters. **Walk-in / Counter Sale** appears only when the query is empty or actually matches (and is the default selection for a new bill), never pinned over real matches.
- **Result row:** name (bold), phone, type chip (Customer, Retailer, Wholesaler), area or address in muted text, current balance (Dr/Cr) on the right. Keyboard: ↑/↓, Enter, Esc, `Alt+P` to open; "+ New party" always last; recent parties listed when the box is empty.
- Used in POS, Create Order, Van counter, Invoice Edit, receipts/payments, party filters in reports; the old implementation is removed once all call sites use it.
**Gate A:** a table test (at least 40 cases: `sh`, `aak`, `aakash kir`, `9234`, `kirana`, `kirana aakash`, `aashirvad`, typos, no match, Walk-in behaviour, ranking, permissions on credit display) plus latency under 50 ms for 2,000 parties.

## PART B — ONE ITEM SEARCH EVERYWHERE, WITH PRICE
1. **Dropdown row = `Item name + weight` on the left, brand muted, and the price on the right**, for example `Bikaji Bhujia 400G · Bikaji · ₹93.00`. The price is the **price for the current context**: the selected tier and party in POS/Create Order/Van, list C on the public storefront for anonymous visitors, the buyer's list for logged-in approved buyers, purchase rate in GRN. Show the per-unit basis when it matters (for example `₹93 / pc`). Out-of-stock items stay last with a muted "Out" tag. Nothing else on the row.
2. **Replace every product search surface** found in the inventory with the shared `searchItems` core and `ItemSearchBox` (or its public variant). Contexts: POS, Create Order, Van counter, GRN, Invoice Edit, stock/catalogue/reports filters, dispatch, the Ctrl+K command palette (SKU results), and the **storefront** (header search and suggestions, search results page, category/brand in-page search). Keep each screen's own business behavior; only the search core and dropdown are shared. Delete the old search code once nothing uses it.
3. **Storefront variant:** the same matching engine behind `/api/store/v1` search/suggest; results show image, `name + weight`, price for that visitor, out-of-stock last; no stock figures or other buyers' prices leak; rate-limited; instant suggestions; no layout shift; noindex on search result URLs as before.
4. Pricing displayed must match billing exactly (use `resolvePrice`, never recompute in the UI).
**Gate B:** the inventory shows 100% of product-search surfaces use the shared core (a test scans for forbidden legacy search patterns); price in dropdown equals the price the bill will use (tests per tier and party type); storefront search returns correct results and prices; the Part A/#16 search cases still pass.

## PART C — A / B / C TIERS AND DISCOUNTS THAT WORK
1. **Reproduce first.** Press A, B, C in the POS with items in the bill and record what happens (no state change? no recalculation? prices missing so nothing changes?). Find the **root cause** (candidates: click handler or state not wired to line pricing, tier stored but not used by `resolvePrice`, A/B/C price lists empty for many products so the rate stays equal, caching, a stale closure) and write it in `docs/memory.md` before fixing.
2. **Required behaviour:**
   - Tier control: **Auto (X) / A / B / C** with a clear active state. `Auto` follows the party type (wholesaler A, retailer B, customer/walk-in C). Choosing A, B or C **immediately reprices every line** from that product's price list, recomputes discount % against MRP, totals and GST, and shows a small toast "Prices updated to list B (2 items have no B price)".
   - **No price in a list:** the line is flagged and uses the documented fallback (do not silently use ₹0): if the list price is missing show "Price not set" and keep the previous rate for that line until a price is entered (admin-only manual override with reason, as in earlier prompts).
   - Tier is stored on the invoice; reprint and edit respect it.
3. **Discount pipeline, documented and implemented in one place:** list price (tier price or MRP per the existing rule) → **line discount %** (editing it recomputes the rate; editing the rate recomputes the discount %) → **order discount %** applied on top → tax (GST-inclusive handling) → rounding. Enforce `role_discount_limits` per line and per order with clear messages and an audited admin override. Totals, savings and GST shown on screen, in the save dialog, on the bill and in the ledger must be **identical**.
4. Show the effective discount and tier in the Save dialog and on the bill where it already appears.
**Gate C:** golden tests covering every combination of party type, tier (Auto/A/B/C), line discount, order discount, MRP/rate edits, Pcs/Carton/Dozen/Bag, rounding and GST-inclusive math; a Playwright test that presses A, B, C with a three-line bill and checks the visible rates and totals; limit enforcement tests; all existing billing tests unchanged.

## PART D — "SAVE VOUCHER" SHOWS WHAT IS BEING BILLED
In the F2 confirmation dialog add a **scrollable item preview table**: `S.N., Item name + weight, Qty + unit (and pieces), Rate, Disc %, Amount`, then the existing summary (party, date, tier, payment mode and status, items and total pieces, discount, GST included note, grand total with amount in words). Highlight problems (zero rate, zero quantity, price not set, stock shortage). **Esc or "No, continue editing" returns to the grid with cursor and data intact** so more items can be added; Enter confirms. Arrow keys scroll the table without confirming. Works for POS, Create Order and Invoice Edit (the preview shows changed lines highlighted).
**Gate D:** component and Playwright tests: dialog lists every line, matches the grid, Esc returns with data intact, adding another item and saving works, keyboard-only.

## PART E — BILL FORMATS BY PAYMENT MODE, CREDIT TO THE PARTY, AND THE GST BILL OPTION
1. **Document type at billing:** add a **"GST Bill" option** next to the payment controls in POS and Create Order (button/toggle plus a key, shown in the function-key footer). Default is **Retail bill**. Store `Invoice.documentType` (RETAIL | GST) additively. Both types share one invoice record and, by default, one gapless series; `invoice.gstSeparateSeries` can give GST bills their own series.
2. **Format rules on the invoice print page (and reprints):** show **only** the relevant tab(s):
   - **Cash or UPI (paid or pending), Retail:** only **Thermal (80mm) cash bill**.
   - **Credit, Retail:** only the **Credit bill** (Thermal 80mm credit layout showing party name, phone, address, this bill amount, **previous balance, new outstanding**, a "goods received" signature line, payment terms/due date if set).
   - **GST Bill:** only the **GST formats** (GST A4 and GST Thermal), and the normal cash/credit formats are not offered for that invoice.
   - **Admin/Super admin only:** an "Other formats" menu keeps every other template reachable (Demand Bill, A5 Invoice, etc.), so no feature is lost. Inspect each existing template and preserve it.
3. **GST bill content and prerequisites:** seller GSTIN, FSSAI, buyer name, phone, address and **buyer GSTIN (validated format, optional for consumers)**, place of supply/state, **HSN on every line**, **CGST/SGST or IGST breakup by rate**, taxable value, discount, round-off, total in figures and words, "tax invoice" wording. If any line has a missing or `0000` HSN, block finishing the GST bill with a clear list and a one-click quick-edit to fix the item (permission respected). **Tax is computed and stored for every invoice regardless of document type**, so books and GST reports are always complete; the type only changes the document layout and required fields.
4. **Credit:** a Credit sale is allowed only for parties with credit enabled and within the limit (existing rules). On save, **add the amount to that party's ledger/outstanding exactly once** (idempotent), show it on the credit bill and in the party dashboard; the credit bill and the GST bill both print the party's name, phone and address.
5. **Changes after the fact** (Invoice Edit from Prompt #15, if present): changing payment mode or document type is admin-only, audited, and re-applies the format rules and the ledger consequence correctly.
6. **Small fix:** the print page breadcrumb shows the raw path (`/shop/invoices/<id>/print`); show "Invoice INV/26-27/000007 · Print" instead.
7. State in the final report that the owner should **confirm with the CA** that issuing a plain retail bill (GST included, no breakup) for some sales and a GST bill for others is acceptable for his registration, and which series rule to use.
**Gate E:** a matrix test (payment mode × status × document type × role) proves which formats are offered; the credit amount appears once in the party ledger and balance; GST bill blocks on missing HSN and prints correct breakup (paise-exact, CGST+SGST or IGST by state); documentType stored and respected on reprint; admin "Other formats" works; existing print, GST, ledger and numbering tests pass unchanged.

## PART F — VERIFICATION (multiple independent layers; none may be weakened)
1. **Parity:** the Step 1 inventory proves every previous POS/billing/print feature still exists (moved or gated, not deleted); API contract changes are additive.
2. **Search:** party and item tables, latency budget, the "one search everywhere" scan, price-in-dropdown equals billed price.
3. **Golden billing tests:** identical totals, GST, stock deduction, ledger and incentive effects between the old and new code for the same scripted bills (excluding the intended tier and discount fixes, which get their own expected values).
4. **Keyboard-only run:** pick party by fragment, add three items by fragment, change tier with the keyboard, apply discount, open the Save dialog, review the preview, Esc, add one more item, save, print the correct format.
5. **Accessibility** (axe zero serious/critical; combobox ARIA; focus order; contrast) and **responsive** at 360, 768, 1366, 1920 px and the Extra Large font preset.
6. **Different from before:** the party and item dropdowns, save dialog and print page differ from the baseline screenshots in the intended ways, and row content contains only the allowed fields.
7. **Data integrity:** stock never negative, `SUM(ledger) = balances`, numbering gapless (per series), GST paise-exact, party ledger consistent; existing suites pass unchanged (only legitimate selector updates).
8. **Stability:** run everything twice, then once after a clean install and fresh DB; results identical.

## PART G — DEPLOY, VERIFY, DOCS
1. Gate before deploy: Part F green, `git diff --stat` justified, migrations additive.
2. Run additive migrations via the existing migration job, deploy a new revision with the existing script (labelled with the commit SHA), run `scripts/smoke-prod.ts` (extend it for storefront search and the print-format rules), roll back automatically on failure.
3. Production checks without real transactions: party search by fragment returns the right parties (read-only), item search shows price and weight, tier buttons change prices in the POS preview using non-persisted state, sample-preview prints for cash, credit and GST formats, storefront search works. Re-run verification once more from a clean checkout of the deployed commit.
4. Update in place: `docs/architecture.md` (shared search core, pricing pipeline, documentType, format rules), `docs/rules.md` (one search core, no ₹0 silent prices, tax stored for every invoice, format rules by payment mode and document type), `docs/design.md`, `docs/tasks.md`, `docs/memory.md` (root causes, decisions, open items).

## LOOP (follow strictly)
```
Part 0 sync gate → Step 1 baseline → for each of Parts A to E:
  find root cause or define the invariant → write tests (failing first for bugs) → implement the smallest correct change
  → run: pnpm typecheck; pnpm lint; pnpm test; pnpm build → run the app, exercise it (keyboard and mouse), screenshot at 1366×768 and 360 px
  → if anything fails: root-cause it, fix, rerun from the top of the part
  → proceed only when the part's gate is green and demonstrated
Then Part F (twice) → Part G → re-verify everything once more end to end.
```
- Never claim success without running the check and reading the output; quote key results in `docs/memory.md`.
- Never weaken or delete a failing test, never remove an existing feature, never change business rules beyond what is written here, never rewrite stored data without a previewed and audited action, never force-push.
- Same failure 5 times: write hypotheses and evidence in `docs/memory.md`, try a different approach. Ask the human only after 3 different approaches fail, with the exact error.
- When blocked on a human action (series decision, Stitch key, diverged git), print `WAITING_FOR_HUMAN: <what>` with exact steps and keep working on whatever does not depend on it.
- Local tests use the isolated test DB. Never run destructive scripts against production.

## FINISH
Only when all gates pass, print exactly:

`PROMPT 17 COMPLETE — party search PASS — tiers/discounts PASS — one search + price PASS — save preview PASS — bill formats + GST bill PASS — parity PASS — production PASS`
