# PROMPT #16 — Rebuild Shop Billing (POS) like Busy software: smart item search ("bhuj 400" finds Bhujia 400 g), minimal item rows, weight bar removed, Busy-style keyboard voucher entry designed with Stitch (looping, self-verifying)

Save as `docs/prompts/16-pos-busy-style-search-redesign.md` and paste everything below the line to the agent. **Do not create new doc files.** Update existing `docs/*.md` in place. Put the owner's reference video `WhatsApp_Video_2026-10-31_at_15_05_09__1_.mp4` in `design/reference/busy/` (it is a phone recording of Busy 21, Sales - Add); the written spec below is the primary reference, the video is the backup. This is an **update of the live system**: every existing POS feature must keep working.

---

## ROLE
You are the engineer and UI lead updating JMD Cart (Next.js 14 App Router, Prisma, Postgres, Cloud Run + Cloud SQL, `management.jmdcart.com`). Deliver: **(A)** a search that understands a name fragment plus a weight, **(B)** consistent weight data, **(C)** minimal product rows, **(D)** a Busy-style keyboard-first voucher entry screen designed through Stitch and used by Shop POS, Create Order, Purchase/GRN lines and Invoice Edit, **(E)** fixes found in the owner's screenshots. "Done" means built, run, measured against a **before** baseline, tested in several independent ways, deployed and re-verified.

Follow `CLAUDE.md` and `docs/rules.md`. **Never open, print or log `.env`, `.env.deploy` or any secret.** Migrations are **additive only**. **Never create or edit real invoices in production** (gapless numbers, real money): verify with automated tests and the test database; in production do read-only checks and sample-preview prints.

## PART 0 — SYNC GATE (nothing is edited until this passes)
Run exactly the sync gate from `docs/prompts/11-invoice-print-agent-code.md` Part 0: `git fetch`, clean tree, fast-forward to the latest `origin/main`, confirm the commit running on **Cloud Run (100% traffic revision)** is contained in your code and production migrations all exist in the repo, work on a new branch, record the baseline of `pnpm typecheck / lint / test / build`. If branches diverged, the deployed code is not in git, or the tree is dirty: stop with `WAITING_FOR_HUMAN` and show the difference. Never reset, force-push or overwrite anyone's work. Review `git diff --stat` at the end and justify every changed file in `docs/memory.md`. Minimal diffs outside the POS family.

## STEP 1 — READ, MAP, BASELINE, HUMAN INPUTS
Read `CLAUDE.md`, `docs/memory.md`, `tasks.md`, `rules.md`, `design.md`, `prisma/schema.prisma`, the Shop POS (`src/app/shop/pos/*`), the item search code and API, the product dropdown/row components, Create Order, Purchase/GRN lines, Invoice Edit (if Prompt #15 exists), `src/modules/billing/*`, `src/modules/stock/availability.ts`, the shared `QtyUnitPicker`/unit logic, the datetime module, settings, and `nav.config`. Record in `docs/memory.md`:
- how search works today (find why a multi-word query like "bhuj 400" returns nothing while "bhuj" works; the likely cause is that the whole phrase is matched as one string against name/code, and weight is not part of the searchable text),
- **where the weight chip text ("400G", "15G") shown in rows comes from**, and why the filter bar reports "No Weight (876)" for every item (two different sources of weight are in use),
- the **complete list of existing POS features and controls** (hold, new bill F3, finalize and print F2, tier Auto/A/B/C, party selector and "+ Party", walk-in name/mobile/address, party card with balance, recent bills, full history, clear balance, order discount %, payment mode Cash/UPI/Credit, payment status Done/Pending, admin bill date, narration/remarks, font size controls, compact mode, agent code, unit options Pcs/Carton/Dozen/Bag, MRP and rate edit with limits, stock and dashboard links, Ctrl+K). This list becomes the **parity checklist**: nothing on it may disappear, it only moves.
- **Baseline:** screenshots of POS, Create Order, GRN and Invoice Edit at 1366×768, 1920×1080 and 360 px (also at 125% font), a feature inventory JSON, the click/keystroke count for "bill 3 items for a party and print", and keystroke-to-results latency of item search. Save under `tests/baseline/` (never in `src/`).

Ask the human ONCE (one message, then continue):
1. **Stitch MCP:** if it is not connected, ask the human to connect it (look up the current official setup, the human provides the key via environment/secret store, never the repo) and verify by listing projects. If Stitch is unavailable and the human says continue, design with the existing system and log it.
2. **Defaults (all are settings):** "Save this voucher? Yes / No" confirmation **on** (Enter = Yes, Esc or N = No); function-key footer visible; item dropdown shows brand only on the right.

---

## PART A — SMART ITEM SEARCH (one shared function and one shared search box)
Owner's requirement: if staff type part of a product name and then its weight, **exactly that product must appear**. Busy example: typing `BHUJ 4` lists `Bhujia 400 gm`, `G Aloo Bhujia 400 Gm`, `G Bhujia 400 Gm`.

**Behaviour**
1. **Token search:** split the query on spaces into tokens; an item matches when **every token** matches something in its searchable text. A word token matches by **prefix of any word** in the name, the brand, or the short code/SKU (`bhuj` matches Bhujia; `bk-01` matches `BK-010`). Order of tokens does not matter (`400 bhuj` works).
2. **Weight-aware tokens:** parse numeric tokens and weights with units. `400`, `400g`, `400gm`, `400 gm`, `0.4kg` all match a 400 g item; `1kg`, `1 kg`, `1000g` match 1 kg; `1l`, `1ltr`, `1 litre`, `1000ml` match 1 litre; a bare number such as `4` matches any item whose name words or weight value **start with** that number (like Busy's `BHUJ 4`). Normalise to a base (grams, millilitres, pieces) in the index so `0.4 kg` equals `400 g`. Also support pack-style tokens in the name (`45gm*216`).
3. **Typo and transliteration tolerance:** one edit on tokens of 4 or more characters (`bhujiya` finds Bhujia). Optional P1: an admin-managed synonym list (`bhujiya` → `bhujia`).
4. **Ranking:** exact full-name-prefix first, then word-prefix matches, then contains; brand and short-code hits count; **in-stock items before out-of-stock items** (existing rule, out-of-stock last); then recently or frequently sold items for this counter; ties by shorter name. Limit about 12 visible results, scrollable, keyboard navigable.
5. **Index source:** searchable text = name + brand + short code + SKU + normalised weight + pack text. Build it once, not per keystroke. Prefer an in-memory client index of all active items (a few thousand rows load in one request, cached with an ETag and refreshed when products change), with live stock fetched for the highlighted item. If the dataset or constraints make that wrong, use a server query with `pg_trgm` and proper indexes. **Target: results in 50 ms or less per keystroke on the shop PC for 2,000 items (record before and after).**
6. One function `searchItems(query, context)` and one `ItemSearchBox` component used by POS, Create Order, GRN, Invoice Edit and the Van counter, so every screen behaves the same.

**Test table (fixtures only under `tests/`, at least 60 cases):** `bhuj` returns all Bhujia sizes; `bhuj 400` returns Bhujia 400G first; `bhuj 4` includes 400G; `400 bhuj`; `bhujia 1kg`; `bhujiya` (typo); `bikaji bhuj 200`; `bk-016`; `haldi 100`; `mustard oil 1 ltr`; `0.4 kg bhuj`; unit variants; queries with `*`, `/`, `-`, extra spaces and upper/lower case; no result; many matches; out-of-stock sorting; performance on 2,000 items.
**Gate A:** all search tests green, latency recorded, the same function demonstrably used on every screen.

## PART B — WEIGHT DATA MADE CONSISTENT
1. Find the two weight sources (Step 1) and make **one source of truth**: `weightValue`, `weightUnit`, normalised `weightBase` (additive, nullable). The row label, the search index and any weight logic read only from it.
2. Run the **suggestion backfill with preview** (conservative parsing from names, SKUs and the existing chip source such as `Bikaji Bhujia 400G`); an admin reviews and approves in bulk; never overwrite silently; items it cannot parse stay "no weight" and appear in the Data Quality report. The Excel import maps a WEIGHT column.
3. **Remove the "WEIGHT: All / No Weight / Weight View" filter bar from the POS** (the owner asked for it to go). Keep the weight data, the search and the label. Do not remove weight filters from other screens unless they show the same empty state; note any such decision in `docs/memory.md`.
**Gate B:** one weight source, backfill preview and apply tested and idempotent, POS bar gone, search by weight works for backfilled and non-backfilled items.

## PART C — MINIMAL ITEM ROWS (Busy-style)
Owner: "do not show so many details under a product; make it like Busy."
- **Grid row:** one line only: **`Item name + weight`** as plain text (for example `Bikaji Bhujia 400G`). No chips for brand, weight, short code, pack or stock. No second line.
- **Search dropdown row:** left: `Item name + weight`; right: **brand** in muted text (as Busy shows the company); out-of-stock items show a small muted "Out" tag and are listed last. No stock figures, no code, no pack, no "+1 Ctn / +1 Pc" buttons (units are chosen in the grid's Unit cell, see Part D).
- **Status line** under the grid shows the details of the **highlighted** item in one line, like Busy's `Cur. Stock = …`: `Shop: 288 pcs  |  Godown: 554 ctn  |  Pack: 24  |  Last rate: ₹…`.
- **Item info panel** (key `F8`, closes with Esc): brand, short code, pack size, weight, stock by location, last purchase rate, last sale rate to this party, image if available. Nothing is lost; it just no longer clutters every row.
**Gate C:** component tests and screenshot checks prove rows and dropdown contain only the allowed fields, the status line updates on highlight, the info panel shows the full details.

## PART D — BUSY-STYLE VOUCHER ENTRY, DESIGNED WITH STITCH
**Reference (from the owner's video of Busy 21, Sales - Add):** header with Date, Vch. No., Party (with "Cur. Bal."), Narration; a dense grid with S.N., Item, Qty, Unit, List Price, Disc., Price, Amount; item type-ahead where the list shows item name on the left and company on the right; after Item the cursor moves along Qty, Unit and price cells with Enter and drops to the next row automatically; a status line under the grid with the highlighted item's current stock; lower panels "Bill Sundry Detail" and "Settlement" (payment mode); a large **Total Amount**; a function-key footer (`Esc Quit`, `F2 Done`, `F4 Std. Narration`, `F7 Repeat`, `F9 Delete Line`, `Ctrl+Alt+S Search`) plus Hold Vch / Update Discount / Check Scheme buttons; **"Save this voucher? Yes / No"** on saving; tabs "Vch Detail / Master Detail / Party Dash Board / Item Image"; a bottom bar with company, financial year, user and state. Copy the **workflow and density**, not the old-fashioned look.

**Design with Stitch** (mobile fallback too): generate the voucher-entry screen for desktop 1366×768 and 1920×1080, and a tablet/phone variant (stacked cards, same logic), plus the item dropdown, the Save-voucher dialog, the Item Info panel and the Party Dashboard panel; use the reference frames from the video if Stitch accepts images, otherwise the written spec above. Save HTML and screenshots under `design/stitch-export/management/pos-voucher/`. Use the management design system from Prompt #14 (tokens, density modes, font scale); port to a shared React **`VoucherGrid`** component rather than pasting generated HTML. If Stitch cannot be used, log `WAITING_FOR_HUMAN: Stitch` and continue with the existing design system.

**Layout:** top **voucher header** (Series/type, **Date** with the existing manual-date rules, **Vch. No.**, **Party** selector showing name, phone, address and current balance, **Narration**); the main **grid**; the **status line**; bottom **Bill Sundry** (order discount %, delivery charge, round-off, GST included note) and **Settlement** (Cash / UPI / Credit, Payment Done / Pending, bill date for admins, remarks); a prominent **Total Amount** with quantity total; the **function-key footer** (clickable too); the walk-in name/mobile/address fields appear in the header only when the party is a walk-in; tier Auto/A/B/C and Recent Bills / Full History / Clear Balance move into a compact **Party Dashboard** side panel opened with a key (and shown inline on wide screens). Compact density by default on shop PCs, comfortable available.

**Keyboard model (no mouse needed):**
| Key | Action |
|---|---|
| Type in Item cell | live dropdown (Part A); ↑/↓ choose, Enter selects |
| Enter | next cell: Item → Qty → Unit → List Price (if allowed) → Disc % → Rate → Amount (non-editable cells are skipped); after the last editable cell Enter moves to the **Item cell of a new row** |
| ↓ on the last row | adds a new row; ↑/↓ otherwise move between rows |
| Shift+Enter | previous cell |
| Unit cell | `P` Pcs, `C` Carton, `D` Dozen, `B` Bag (only options available for the item) or ↑/↓; status line shows "2 Ctn = 48 pcs" |
| `F7` | repeat previous line | 
| `F9` | delete current line (confirm if it has data) |
| `F8` | item info panel |
| `F2` / `Ctrl+Enter` | finish: "Save this voucher? Yes / No" → Enter = Yes, then print dialog |
| `F3` / `F4` | new voucher / hold voucher (existing keys kept) |
| `Alt+P` | party search; `Alt+D` order discount |
| `Esc` | close dropdown / cancel cell edit / on an empty voucher ask to leave |
Never hijack browser keys that staff need (F5 reload, F11, F12, Ctrl+W/T/R); do not break `Ctrl+K`. Visible focus ring on the active cell, `aria` combobox/grid patterns, screen-reader labels, `aria-live` for the status line and totals. All shortcuts listed in a help overlay (`?`).

**Shared use:** the same `VoucherGrid` powers **Shop POS (sales voucher)**, **Create Order**, **Purchase/GRN lines (purchase voucher: Item, Qty, Unit, Rate, GST)** and **Invoice Edit** (Prompt #15, if it exists). Each keeps its own business logic; only entry, layout and keyboard behaviour are shared.
**Gate D:** keyboard-only Playwright test completes a whole bill (party, three items found by fragments like `bhuj 400`, qty and units, discount, Save Yes, print dialog) with **no mouse**, and the keystroke count is recorded against the baseline; golden tests show identical totals, GST, stock deduction, ledger and invoice content versus the old POS for the same inputs; touch/mobile fallback works at 360 px.

## PART E — FIXES FROM THE OWNER'S SCREENSHOTS
1. **"VCH. NO." field shows the party name** (for example "Aakash kirana Store"). Show the **next invoice number preview** (for example `INV/26-27/000007`, marked "auto"); never reserve a number before saving; the final number is assigned at save, gapless as before.
2. The POS header contains a **second, faded "A− 100% A+" control** inside the dark bar next to the top-bar one. Keep a single clear font-size control.
3. The "Search items" box shows `Ctrl+K` twice (inside the box and as a hint); keep one hint.
4. Anything else you see while comparing the screenshots with the new layout that is inconsistent, list it in `docs/memory.md` and fix only if it is within the POS family and risk-free.

## PART F — VERIFICATION (multiple independent layers; none may be weakened)
1. **Parity:** the Step 1 checklist and feature inventory prove every existing POS feature, API contract and visible action still exists (moved, not removed); additive changes only.
2. **Search:** the 60-case table, latency budget, and the same-function-everywhere check.
3. **Golden billing tests:** identical totals, GST, rounding, stock deduction, ledger entries, payment status, incentive and agent capture between the old and new entry UI for the same scripted bills (including Pcs, Carton, Dozen, Bag, discounts, MRP edit, credit and cash, pending payment, manual date).
4. **Keyboard-only suites** for POS, Create Order and GRN, and a **no-mouse** run of the whole day: new bill, hold, resume, repeat line, delete line, finish, print.
5. **Different from before:** after-screenshots versus the baseline show a material change (for example ≥ 40% changed pixels on POS and ≥ 25% on GRN/Create Order) and the product row and dropdown contain only the allowed fields.
6. **Accessibility** (axe zero serious/critical, combobox and grid ARIA, focus order, contrast) and **responsive** checks at 360, 768, 1366, 1920 px and at the Extra Large font preset.
7. **Performance:** keystroke-to-results, first paint of POS, JS size no worse than baseline (or justified).
8. **Data integrity:** stock never negative, `SUM(ledger) = balances`, invoice numbering gapless, GST paise-exact; existing suites pass unchanged (only legitimate selector updates).
9. **Stability:** run everything twice, then once after a clean install and a fresh DB; results identical.

## PART G — DEPLOY, VERIFY, DOCS
1. Gate before deploy: Part F green, `git diff --stat` justified, migrations additive, backfill idempotent and previewed.
2. Run additive migrations via the existing migration job, deploy a new revision with the existing script (labelled with the commit SHA), run `scripts/smoke-prod.ts`, roll back automatically on failure.
3. Production checks without real transactions: the new POS loads for each allowed role, search returns Bhujia 400G for `bhuj 400` using read-only data, the weight bar is gone, VCH. NO shows a preview, sample-preview prints are correct. Re-run verification once more from a clean checkout of the deployed commit.
4. Update in place: `docs/design.md` (voucher-entry design, keyboard map, Stitch outputs), `docs/architecture.md` (search index, weight source of truth, shared VoucherGrid), `docs/rules.md` (one shared search; item rows show name + weight only; shortcuts must not hijack browser keys), `docs/tasks.md`, `docs/memory.md` (root causes, baselines, decisions, open items).

## LOOP (follow strictly)
```
Part 0 sync gate → Step 1 baseline → for each of Parts A to E:
  find root cause or define the invariant → write tests (failing first for bugs) → implement the smallest correct change
  → run: pnpm typecheck; pnpm lint; pnpm test; pnpm build → run the app, exercise it with the keyboard only, screenshot at 1366×768 and 360 px
  → if anything fails: root-cause it, fix, rerun from the top of the part
  → proceed only when the part's gate is green and demonstrated
Then Part F (twice) → Part G → re-verify everything once more end to end.
```
- Never claim success without running the check and reading the output; quote key results in `docs/memory.md`.
- Never weaken or delete a failing test, never remove an existing feature, never change business rules, never rewrite stored data without a previewed and audited action, never force-push.
- Same failure 5 times: write hypotheses and evidence in `docs/memory.md`, try a different approach. Ask the human only after 3 different approaches fail, with the exact error.
- When blocked on a human action (Stitch key, approvals, diverged git), print `WAITING_FOR_HUMAN: <what>` with exact steps and keep working on whatever does not depend on it.
- Local tests use the isolated test DB. Never run destructive scripts against production.

## FINISH
Only when all gates pass, print exactly:

`PROMPT 16 COMPLETE — search PASS — weight data PASS — minimal rows PASS — Busy-style voucher PASS — parity PASS — golden billing PASS — production PASS`

then: the commit live before and after, the root causes found (search and weight sources), before/after screenshots, keystroke and latency tables, the keyboard map, the parity checklist result, files changed with reasons, open items (synonym list, items still without weight, Van counter keeping its simple 3-step flow). If you cannot reach that state, print `PROMPT 16 BLOCKED` with the exact blocker.
