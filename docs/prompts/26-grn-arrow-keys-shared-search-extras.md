# PROMPT #26 — Purchase / GRN: up-down-left-right arrow-key control everywhere (no mouse), the Shop POS search inside GRN, a bigger Bill No., and every other useful GRN feature (looping, self-verifying)

Save as `docs/prompts/26-grn-arrow-keys-shared-search-extras.md` and paste everything below the line to the agent. **Do not create new doc files.** Update existing `docs/*.md` in place. This builds on the **current production GRN screen** (`/godown/purchases/new`, the POS-style voucher from Prompt #25). Existing features, calculations and posting logic must keep working exactly as they do today; new features that touch money or prices are **off by default or preview-only**.

---

## WHAT THE OWNER ASKED (from his screenshot of the GRN screen)
1. **Move up and down with the keyboard**: the supplier list in the "Select Supplier (Alt+P)" dialog (and every list) must be controlled with the arrow keys.
2. **Product search in GRN must be exactly the Shop POS search** (the shared smart search, `bhuj 400` finds Bhujia 400 g).
3. **Make the Bill No. field bigger.**
4. **Overall, nowhere should the mouse be needed**: everything must work with the **up, down, left and right arrow keys**.
5. **Add every other feature that makes sense** for a purchase screen.

## WHAT THE SCREENSHOT SHOWS (verify against the live screen)
Header band with tiny labels (DATE, GRN NO, SUPPLIER, BILL NO, DEST, NOTE at about 8 to 9 px), a small `BILL NO *` box with a faint `INV-9982` placeholder, tabs `PURCHASE GRN / GODOWN RECEIPT`, buttons New (F3), Hold (F4), Held (F5), + Product (Alt+N), Master (Alt+M), Purchases, Stock, Dashboard; an item box "Scan barcode or search product name / code (Ctrl+K / F1)" and an **All products (Alt+B)** button; a grid (ITEM DESCRIPTION, QTY, UNIT, MRP, PURCHASE RATE, DISC %, GST %, AMOUNT) with a native-looking unit select; a right panel (Bill Discount, subtotal, GST, **NET PAYABLE**, remarks) and a function-key footer. The supplier dialog lists suppliers with balances, and contains junk such as a lowercase supplier named `vbn` with no brand.

## ROLE
You are the UI lead and engineer for JMD Cart (Next.js 14 App Router, management design system, shared `VoucherGrid`, shared `searchItems` / `searchParties`, purchase service, stock and supplier ledgers). Implement and prove everything above. "Done" means built, run, tested by several independent layers (including a real **no-mouse** run), deployed and re-verified.

Follow `CLAUDE.md` and `docs/rules.md`. **Never open, print or log `.env`, `.env.deploy` or any secret.** Migrations are **additive only**. **Never create real GRNs or stock changes in production**: verify with the test database, sample previews and read-only checks.

## PART 0 — SYNC GATE (nothing is edited until this passes)
Run exactly the sync gate from `docs/prompts/11-invoice-print-agent-code.md` Part 0: `git fetch`, clean tree, fast-forward to the latest `origin/main`, confirm the commit running on **Cloud Run (100% traffic revision)** is contained in your code and production migrations all exist in the repo, work on a new branch, record the baseline of `pnpm typecheck / lint / test / build`. If branches diverged, the deployed code is not in git, or the tree is dirty: stop with `WAITING_FOR_HUMAN` and show the difference. Never reset, force-push or overwrite anyone's work. Review `git diff --stat` at the end and justify every changed file in `docs/memory.md`.

## STEP 1 — READ, MAP, BASELINE
Read `CLAUDE.md`, `docs/memory.md`, `tasks.md`, `rules.md`, `design.md`, the purchase module and screens, the supplier dialog, the item search box used in GRN today (and the shared `ItemSearchBox` used in Shop POS), `VoucherGrid`, the unit picker, shared dialog/dropdown/tab/toolbar/sidebar components, the DataTable, and the keyboard handling code (global Esc-back, shortcuts). Record in `docs/memory.md`:
- **GRN search today:** which component and matching it uses, and how it differs from the POS search (field list, weight handling, ranking, dropdown row format).
- **Keyboard map today:** for every control group on the GRN screen (header fields, supplier dialog, item box, grid cells, unit select, panels, toolbar, tabs, footer, sidebar) what ↑ ↓ ← → do and where the mouse is still required. Include native `<select>` and native `<input type="date">` behaviours (arrows change values instead of moving focus).
- **Feature inventory (parity checklist)** of the GRN screen and Purchases list, **golden GRN fixtures** (totals, GST, stock IN by location, supplier ledger) and the existing purchase, scan-bill, stock and keyboard suites: all must pass **unchanged** at the end.
- **Visual baseline** at 1366×768, 1920×1080, 1024×768 and 360 px (100% and 125% font): empty GRN, 6-line GRN, supplier dialog open, item dropdown open, error states. Save under `tests/baseline/grn2/` (never in `src/`).

## PART A — ARROW-KEY CONTROL EVERYWHERE (a shared system, GRN and POS first)
Build one shared keyboard-navigation layer (hooks plus components) and use it instead of per-screen code: `useRovingFocus`, `NavigableList`/listbox, `NavigableToolbar`, `NavigableGrid`, `NavigableSidebar`, and replace native `<select>` and native date/number steppers inside voucher screens with accessible equivalents so arrow keys behave predictably.

**Rules (document them in `docs/design.md` and show them in the `?` overlay):**
1. **Lists and dropdowns (supplier dialog, party/item dropdowns, All-products browser, any menu):** ↑/↓ move the highlighted option **while focus stays in the search input** (type to filter, arrows to choose), `Home`/`End`/`PageUp`/`PageDown` jump, `Enter` selects, `Esc` closes. The highlighted row scrolls into view and is clearly visible. Type-ahead keeps working. The first match is pre-highlighted so `Enter` selects it immediately.
2. **Toolbars, tab groups and segmented controls (New, Hold, Held, + Product, Master, Purchases, Stock, Dashboard; PURCHASE GRN / GODOWN RECEIPT; payment/format toggles):** roving tabindex, ←/→ move between buttons, `Enter` or `Space` activates, `Tab` leaves the group.
3. **Grid (voucher grid):** a **two-mode** model like a spreadsheet. *Navigate mode:* ↑ ↓ ← → move cell to cell, `Enter` or typing starts editing, `Esc` stays. *Edit mode:* ↑/↓ commit and move to the same column of the previous/next row (adding a new row at the end), ←/→ move the caret and, **at the caret boundary**, move to the previous/next cell; `Enter` commits and moves to the next editable cell (existing behaviour). Numeric cells select their content on focus; the native number stepper is disabled (arrows navigate) and `+` / `-` keys step the quantity. The Unit cell is a custom listbox: ↑/↓ change the unit, plus the existing letter keys.
4. **Header fields:** ↑/↓ and `Tab` move between fields in a logical, documented order (Date → Supplier → **Bill No.** → Bill Date → Destination → Note → item box); ←/→ move the caret and leave the field only at its boundary. Date fields accept typed `DD-MM-YYYY` and `+`/`-` to change the day; no mouse picker needed.
5. **Right panel and footer actions:** reachable by arrow keys from the grid (`→` from the last column moves into the summary panel, `↓` inside the panel moves between Bill Discount, remarks, Confirm & Post, Hold, New), `Enter` activates.
6. **Sidebar:** ↑/↓ items, → expands, ← collapses a group, `Enter` opens; a shortcut (`Alt+0`) focuses the sidebar and `Esc` returns focus to the page.
7. **Region jumps** (never use keys that browsers or Windows reserve): `Alt+1` header, `Alt+2` grid, `Alt+3` summary panel, `Alt+4` footer actions. Never hijack browser keys (F5, F11, F12, Ctrl+W/T/R, Alt+←/→); keep `Ctrl+K`.
8. Dialogs trap focus, open with the first control focused, close with `Esc`, restore focus to the trigger.
9. A visible **focus ring** everywhere, correct ARIA (combobox, listbox, grid, toolbar, tablist), `aria-activedescendant` for highlighted options, and `aria-live` for totals and the status line. A setting "Arrow navigation" (default on) can be turned off.
10. **Scope:** P0 = every GRN and Purchases-list control, the Shop POS screen, Create Order and Invoice Edit (they share the components), all dialogs and dropdowns through the shared components, the sidebar and the shared DataTable (row navigation). P1 = remaining management pages get a generic spatial-navigation fallback; record the **per-route coverage table** in `docs/memory.md`.
**Gate A:** a **reachability audit** script crawls each in-scope screen as ADMIN, GODOWN, SHOP and ACCOUNTS and proves that every interactive element is reachable by keyboard, none is a keyboard trap, and each control group follows the rules above; arrow-key unit tests per component; the audit report is committed.

## PART B — THE SHOP POS SEARCH INSIDE GRN
1. Replace the GRN item box with the shared **`ItemSearchBox` and `searchItems(context = 'purchase')`**: identical token-prefix matching, weight normalisation (`bhuj 400`, `0.4 kg`, `1 ltr`), typo tolerance, ranking, instant index refresh after Quick Add, the same dropdown row (`Name + weight` left, brand muted). In the **purchase context** the right side shows the **last purchase rate** (and last purchase date) instead of the selling price; out-of-stock items are **not** pushed last here (zero stock is normal when receiving goods).
2. The brand of the selected supplier is **boosted** (their items first) with `Alt+B` toggling "This supplier's items / All products"; the **All products** browser is a keyboard list with type-to-filter and arrow navigation.
3. **Barcode input:** a USB scanner typing into the box (fast keystrokes ending in Enter) matches an exact barcode/EAN and adds the line immediately; an unknown barcode opens a small keyboard-operable "Map barcode to product" dialog (additive `barcode` field on products, searchable everywhere).
4. The **supplier dialog** uses the shared party search for suppliers: token-prefix matching on name, brand and phone, balance shown, arrows to choose, `Enter` to select, `Alt+P` to open and `Alt+N`-style quick create of a supplier. Hide or flag junk suppliers (entries with no brand and a lowercase/test-like name such as `vbn`) in the Data Quality list; **never auto-delete**.
5. **Contract test:** for the same query and dataset, GRN and POS return the same matching items in the same order (except the intentional purchase-context differences).
**Gate B:** search parity tests, barcode tests, the 60-case search table passes on GRN, latency no worse than POS.

## PART C — BIGGER BILL NO. AND A READABLE HEADER
1. **Bill No. (supplier invoice number)** becomes a prominent field right next to Supplier: at least 220 px wide and 44 px tall, 16 px bold text, clear label and required marker, strong focus ring, placeholder removed or replaced by a hint. **Inline duplicate check** (same supplier and bill number) with a warning and a link to the existing GRN, a clear error state for empty, `Enter` moves on to Bill Date.
2. **Minimum text sizes:** header labels, field values, tab labels and the footer chips at least 12 px at 100% font (the current 8 to 9 px labels are too small); the supplier card shows name, brand, balance and last bill in readable sizes. Everything must still fit at **1366×768 without page scroll** with Confirm & Post visible, and work at 125% and 150% font.
**Gate C:** computed-style tests for Bill No. size and label sizes, screenshot comparison with the baseline, layout targets met.

## PART D — EXTRA FEATURES (researched; implement P0, record P1)
Every P0 item is keyboard-first, audited, covered by tests, and **does not change posting logic unless the user explicitly applies it**.
1. **Rate intelligence:** purchase rate pre-fills from the last purchase of this supplier and item (chip "last ₹X on DD-MM"); an alert chip when the new rate differs from the last by more than a setting (default 5%); warning when the rate is at or above MRP or the implied margin is below a setting.
2. **Selling-price update helper (`Alt+U`):** a preview table (MRP and A/B/C: current → suggested from target margin per tier) with per-row checkboxes; **off by default**; applying writes product revisions and price history (Prompt #15 mechanism), permission ADMIN/ACCOUNTS.
3. **Supplier bill total cross-check:** an optional "Supplier bill total" field with a live difference indicator against the computed payable; mismatch needs a reason to post (setting `purchase.requireBillTotalMatch`, default only a warning).
4. **Charges and discounts as explicit lines:** freight, loading and other charges, bill-level discount and round-off, each its own line in the summary (reuse existing fields where present); option to apportion charges into item cost (default off).
5. **Suggested reorder items (`Alt+R`):** items of the supplier's brand at or below reorder level with a suggested quantity; arrow keys to move, `Space` to tick, `Enter` adds the ticked items as lines.
6. **Load a previous GRN (`Alt+L`):** pick among the supplier's last five GRNs and copy their lines (quantities and rates editable).
7. **Draft autosave and recovery:** the voucher autosaves as a server draft every few seconds and on blur; after a crash, refresh or power cut the next visit offers "Resume draft", Held (F5) lists drafts; drafts are per user and expire after 30 days; no stock effect until posted.
8. **Totals:** lines, cartons, pieces and **total weight (kg/l)** from product weights, shown in the summary; supplier balance after this bill.
9. **Attach the supplier bill photo/PDF (`Alt+A`)** to the GRN (private storage, linked, visible in the GRN view); already attached when the GRN comes from Scan Bill.
10. **Inline math** in numeric cells (`12*5`, `=24/2`) evaluated by a safe parser (no `eval`).
11. **Tax clarity:** show "GST (CGST + SGST)" or "IGST" according to the supplier's state when known (additive supplier GSTIN/state fields), flag items with a missing HSN, keep GST paise-exact.
12. **Undo/redo** (`Ctrl+Z` / `Ctrl+Y`) over line edits, and a confirmation before leaving a non-empty voucher.
- **P1 (record in `docs/memory.md` with reasons; do only if time remains):** purchase orders with WhatsApp/SMS share, free-quantity/scheme lines, payment recording at purchase, landed-cost reports, barcode label printing, e-invoice/e-way details.
**Gate D:** unit and integration tests for each P0 item including its off-by-default behaviour, permission checks, audit entries, and golden GRN fixtures unchanged when the features are not used.

## PART E — VERIFICATION (multiple independent layers; none may be weakened)
1. **No-mouse proof:** a Playwright run of an entire working day with **mouse events forbidden** (any pointer click fails the test): purchases list → filters → new GRN → supplier by fragment with ↑/↓ → Bill No. → six lines by fragment (`bhuj 400` style) with units/rates → barcode scan → Quick Add an unknown product → Alt+R suggested items → Alt+L previous GRN → resume a draft → Alt+U preview → post → find it in the list → open, print; then a Scan Bill receive with a shortage; then POS and Create Order spot checks. Keystroke counts recorded against the baseline.
2. **Reachability and trap audit** (Part A) green for every in-scope screen and role; arrow-key matrix tests for every control group; focus order and ARIA verified with axe and role queries.
3. **Parity:** the inventory of controls and API contracts shows nothing removed; golden GRN fixtures (totals, GST, stock IN, supplier ledger, audit) identical; existing purchase, scan-bill, stock, POS and keyboard suites pass **unchanged**.
4. **Search parity** (Part B contract test) and the shared 60-case table.
5. **Visual and layout:** Bill No. size, label sizes, Confirm & Post visible without scrolling at 1366×768, nothing clipped at 125% and 150%, no horizontal scroll; before/after screenshots.
6. **Accessibility** (axe zero serious/critical on every new or changed screen and dialog), **responsive** at 360, 768, 1024, 1366, 1920 px, **cross-browser** (Chromium and WebKit).
7. **Data integrity:** stock never negative, `SUM(ledger) = balances`, supplier ledger consistent, GST paise-exact, item stock statement reconciles; drafts never affect stock.
8. **Performance:** typing latency, arrow-key response (under 16 ms per keypress handling) and render counts no worse than baseline.
9. **Stability:** run everything twice, then once from a clean install and a fresh DB; results identical.

## PART F — DEPLOY AND VERIFY
1. Gate before deploy: Part E green, `git diff --stat` justified, migrations additive (barcode, supplier GSTIN/state, drafts, settings).
2. Deploy with the safe path from Prompt #24 (no-traffic revision, smoke tests, canary 10% → 50% → 100%, automatic rollback), labelled with the commit SHA; run `scripts/smoke-prod.ts`.
3. Production checks without real transactions: GRN and Purchases list load for ADMIN, GODOWN, SHOP, ACCOUNTS; supplier dialog and item search respond on read-only data with arrow-key navigation; Bill No. field size verified; screenshots attached. Re-run the verification once more from a clean checkout of the deployed commit.
4. Update in place: `docs/design.md` (keyboard navigation rules, region keys, GRN header sizes), `docs/architecture.md` (shared navigation layer, purchase-context search, drafts), `docs/rules.md` (no feature on a voucher screen may require the mouse; arrow-key rules; keyboard traps are bugs; money-affecting helpers are off by default), `docs/tasks.md`, `docs/memory.md` (baselines, coverage table, decisions, open items).

## LOOP (follow strictly)
```
Part 0 sync gate → Step 1 baseline → for each of Parts A to D:
  define the invariant → write tests (failing first) → implement the smallest correct change
  → run: pnpm typecheck; pnpm lint; pnpm test; pnpm build → open the screens and use ONLY the keyboard, screenshot the matrix
  → if a control is unreachable, a trap exists, or a target is missed: fix, rerun
  → proceed only when the part's gate is green and demonstrated
Then Part E (twice) → Part F → re-verify once more end to end.
```
- Never claim success without running the check and reading the output; quote key results in `docs/memory.md`.
- Never weaken or delete a failing test, never remove or rename a feature, shortcut or accessible name, never change posting or accounting logic, never turn a money-affecting helper on by default, never hijack browser keys, never force-push.
- Same failure 5 times: write hypotheses and evidence in `docs/memory.md`, try a different approach. Ask the human only after 3 different approaches fail, with the exact error.
- When blocked on a human action (diverged git, Prompt #24/#25 state unclear), print `WAITING_FOR_HUMAN: <what>` with exact steps and keep working on whatever does not depend on it.
- Local tests use the isolated test DB. Never run destructive scripts against production.

## FINISH
Only when all gates pass, print exactly:

`PROMPT 26 COMPLETE — arrow-key control PASS — shared search PASS — Bill No. PASS — extra features PASS — no-mouse proof PASS — golden GRN PASS — production PASS`

then: the commit live before and after, the per-route keyboard coverage table, the reachability audit result, before/after screenshots, keystroke and latency tables, a list of P0 features delivered and P1 deferred, files changed with reasons, open items. If you cannot reach that state, print `PROMPT 26 BLOCKED` with the exact blocker.
