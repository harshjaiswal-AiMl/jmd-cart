# PROMPT #22 — Shop POS: enhance the whole look and layout (visual redesign only, every feature unchanged), designed with Stitch (looping, self-verifying)

Save as `docs/prompts/22-shop-pos-ui-redesign.md` and paste everything below the line to the agent. **Do not create new doc files.** Update existing `docs/*.md` in place. This is a **presentation-only** change: **no POS feature, shortcut, rule, calculation or data flow may change.**

---

## THE REQUEST
Redesign the full UI of **Shop POS** (`/shop/pos`, the Busy-style voucher screen from Prompts #16 to #19) so it looks and feels much better, while **keeping every feature exactly as it works today.**

## WHAT THE CURRENT SCREEN LOOKS LIKE (owner's screenshot, 1920 wide, 125% font)
- **Too many stacked bands before the grid**: top app bar, a dark navy POS header with six differently coloured buttons, the voucher strip (Date, Vch. No., Party, Narration), a party search bar, a customer row (name, phone, address, Save), a tier row (Auto/A/B/C, party chip, Clear Balance, Recent Bills, Full History), then the item search box. Roughly the top 380 px is chrome; the grid starts low and the page needs scrolling.
- **Inconsistent colour roles**: navy header and navy grand-total card, orange New, purple PRO Catalog, green + Item, blue Today, plain Dashboard, green Cash, navy Retail Bill. Colour does not tell the cashier what matters.
- **The right panel is long** (discount, subtotal, savings, round-off, grand total, tender mode, invoice format, payment status, bill date, remarks) so **Finalize & Print (F2) sits below the fold**.
- Tiny type in the voucher strip and tier row, heavy bordered input boxes in every grid cell, the active row shown as a dark selected bar, numbers not consistently aligned, and no visible shortcut hints.

## ROLE
You are the UI lead and engineer for JMD Cart (Next.js 14 App Router, management design system from Prompt #14, shared `VoucherGrid`). Redesign the **visual layer and layout** of Shop POS with **Stitch**, prove with tests that **nothing functional changed**, and deploy. "Done" means built, measured against a before baseline, tested in several independent ways, deployed and re-verified.

Follow `CLAUDE.md` and `docs/rules.md`. **Never open, print or log `.env`, `.env.deploy` or any secret.** No migrations are expected; if one seems needed, stop and justify it. **Never create real invoices in production**: verify with the test database, sample previews and read-only checks.

## PART 0 — SYNC GATE (nothing is edited until this passes)
Run exactly the sync gate from `docs/prompts/11-invoice-print-agent-code.md` Part 0: `git fetch`, clean tree, fast-forward to the latest `origin/main`, confirm the commit running on **Cloud Run (100% traffic revision)** is contained in your code and production migrations all exist in the repo, work on a new branch, record the baseline of `pnpm typecheck / lint / test / build`. If branches diverged, the deployed code is not in git, or the tree is dirty: stop with `WAITING_FOR_HUMAN` and show the difference. Never reset, force-push or overwrite anyone's work. Review `git diff --stat` at the end and justify every changed file in `docs/memory.md`.

## STEP 1 — BASELINE AND PARITY CHECKLIST (before any visual change)
1. **Feature inventory of the POS**, produced by a script and a Playwright crawl as ADMIN, SHOP (cashier) and ACCOUNTS: every control and its accessible name, every keyboard shortcut, every state. Known items to include at least: breadcrumb and global search `Ctrl+K`, location switcher, density (Comfortable/Compact), font-size controls, notifications, user menu; POS header: party chip, **New (F3), Hold (F4)**, Stock, **PRO Catalog**, **+ Item [F6]** (quick add), **Edit Master [Alt+M]**, **Today [F9]**, Dashboard, multiple-bill tabs (Bill 1…); voucher header: Date, Vch. No. preview, Party with current balance, Narration; party search and **+ Party**; customer name/phone/address and **Save**; **tier Auto (W/R/C), A, B, C**; **Clear Balance**, **Recent Bills**, **Full History**; item search box with the smart search; the grid columns **S.N., Item Description, Qty, Unit (Pcs/Carton/Dozen/Bag), List Price (MRP), Rate, Disc %, Amount, Act (edit, delete)** with all keyboard behaviour (Enter chain, arrows, F7 repeat, F9 delete line, F8 item info, Esc rules); status line for the highlighted item; **Order Discount %**; totals (subtotal MRP, savings, taxable, CGST/SGST, round-off); grand total with amount in words; **payment tender mode Cash/UPI/Credit**; **invoice format Retail/GST (Alt+G)**; **payment status Done/Pending**; **Bill Date (Admin/Accounts)** with future-date rules; remarks; **Finalize & Print (F2)**, the Save-voucher confirmation with item preview; send-bill-to-customer panel (WhatsApp/SMS); stock-short "Update stock now"; agent capture; edit-invoice mode; Esc-back rules; the help overlay.
2. **Golden billing fixtures** (scripted bills with their expected totals, GST, stock and ledger effects) and the existing POS Playwright suites: they must pass **unchanged** after the redesign.
3. **Visual baseline:** screenshots of every POS state at 1366×768, 1920×1080, 1024×768 (tablet landscape) and 360 px (the mobile fallback) at 100% and 125% font and in both densities: empty bill, 2-line bill, 15-line bill, dropdown open, party dropdown open, Save dialog, stock-short panel, quick-add drawer, edit-invoice mode, credit party with balance, GST mode, error states. Save under `tests/baseline/pos/` (never in `src/`).
4. **Interaction baseline:** keystroke/click counts for "bill 3 items for a party and print", and render/interaction timings (time to add a line, typing latency in search, re-render counts).

Ask the human ONCE (one message, then continue): connect the **Stitch MCP** if it is not connected (current official setup, key via environment/secret store, never the repo; verify by listing projects). If unavailable and the human says continue, design with the existing system and log it.

---

## PART A — DESIGN WITH STITCH
1. Use the management design system from Prompt #14 (tokens, density modes, font scale). Generate with **Stitch** the POS in these variants, and save HTML plus screenshots under `design/stitch-export/management/pos-redesign/`: desktop 1366×768, desktop 1920×1080, tablet landscape 1024×768, a mobile/stacked fallback, and the sub-states (item dropdown, party dropdown, Save dialog with item preview, stock-short panel, quick-add drawer, edit-invoice mode, credit/GST/pending states, empty bill, error states). Do not paste generated HTML wholesale: port to the shared components.
2. **Design goals the Stitch screens must meet:**
   - **A command header of at most ~140 px above the grid at 768 px height:** one slim top bar (breadcrumb, search, location, density, font, user) and **one POS toolbar row** that merges the voucher fields (Bill tab(s), Date, Vch. No., Party with balance and tier, Narration) into a clean, scannable strip. The party **search, customer details and tier** collapse into a compact **party card** (name, phone, address, balance, tier chips) that expands in place for edits; Clear Balance, Recent Bills and Full History live in that card.
   - **Colour with meaning (one primary, one accent, semantic colours only):** primary for the main action (Finalize), a restrained accent for selection and focus, success/warning/danger/info only for status (paid, pending, credit, short stock, errors). Toolbar buttons (New, Hold, Stock, PRO Catalog, + Item, Edit Master, Today, Dashboard) become **one consistent button family** (icon + label + shortcut key chip), grouped by purpose, with the destructive and secondary actions visually quieter.
   - **The grid is the hero:** a light, borderless "text until focused" cell style (Busy-like speed, modern look), sticky header, subtle row separators or zebra, tabular figures with right-aligned numbers, clear column widths, a clear **focus ring on the active cell**, a gentle highlight for the active row (not a heavy dark bar), inline unit selector and discount shown as compact chips, edit/delete actions visible on hover/focus, empty state with guidance ("Start typing an item, or press F6 to add a new product"), and a status line under the grid for the highlighted item (stock, pack, last rate).
   - **Right panel redesigned as a compact bill summary that never hides Finalize:** order discount, subtotal/savings/round-off as a tidy list, a **large grand total with amount in words**, payment mode, invoice format, payment status and bill date grouped as segmented controls with clear selected states, remarks collapsible, and a **sticky bottom action bar with Finalize & Print (F2)** (plus Hold and New) that is always visible at 1366×768. The whole bill (up to about 12 lines) fits without scrolling the page at 1366×768.
   - A slim **function-key footer** (F2 Save, F3 New, F4 Hold, F6 Add item, F7 Repeat, F8 Item info, F9 Today/Delete, Alt+M, Alt+G, Esc Back, `?` help), clickable, hideable in settings.
   - Typography with a clear hierarchy (larger totals, readable labels at least 12 px at 100% font, no 8 to 9 px text), generous but efficient spacing, consistent icon set, consistent corner radius and elevation, smooth micro-interactions using only `transform` and `opacity` (row add, panel expand, toast), `prefers-reduced-motion` respected, dark mode if the management theme supports it.
   - Accessibility: WCAG AA contrast using in-theme tokens, visible focus everywhere, grid/combobox ARIA, `aria-live` for totals and status line, 44 px touch targets in the tablet/mobile variants, works at 125% and 150% font.
3. Record the chosen layout and the Stitch decisions in `docs/design.md` with before/after screenshots.
**Gate A:** every sub-state has a Stitch reference, design goals above are demonstrably met in the screens, no new colour outside the token set.

## PART B — IMPLEMENTATION (presentation layer only)
1. Port the design into the existing POS components and the shared `VoucherGrid`; keep all props, state, handlers, API calls, keyboard handlers and business logic **untouched**. Where markup moves, keep every `data-testid`, accessible name, shortcut and focus order meaning intact (update only selectors that legitimately change position).
2. Keep **density and font-scale** working (Compact/Comfortable, A−/A+ up to the Extra Large preset); the layout must not break at 150%.
3. Responsive: desktop (1366 and 1920), tablet landscape (1024), and the existing mobile fallback stay functional and restyled.
4. Performance: no extra re-renders (memoise rows, stable callbacks), typing latency in search and time to add a line no worse than baseline, no layout shift when the dropdown, status line or panels open, bundle size no larger than baseline (justify any increase).
5. No change to printing, invoice formats, messaging, stock, pricing, GST, numbering or permissions.
**Gate B:** typecheck, lint, tests, build green; every parity-checklist control present with the same behaviour.

## PART C — VERIFICATION (multiple independent layers; none may be weakened)
1. **Parity:** the Step 1 inventory versus the new POS: every control, shortcut and state exists with the same accessible name and behaviour (moved, never removed); an automated diff of the two inventories must be empty except for recorded position changes.
2. **Golden billing:** the scripted bills produce identical totals, GST, rounding, stock deduction, ledger entries, payment status, incentive/agent capture and printed output as before (byte-for-byte for print output).
3. **Existing suites** (POS e2e, keyboard-only bill, search, tier and discount, Save-dialog preview, stock-short, quick-add, edit-in-POS, payment pending, GST bill, messaging panel) pass **unchanged**.
4. **Keyboard-only run** of a whole day: new bill, items by fragment, qty/unit, tier switch, discount, Save dialog, Esc, hold, resume, repeat line, delete line, finalize, print, new bill, edit an invoice: no mouse needed.
5. **Visual proof:** the after-screenshots (same matrix as the baseline) show the intended changes and meet the layout targets: at **1366×768** a 12-line bill fits with **Finalize visible without scrolling**, chrome above the grid at most about 140 px, no horizontal scroll; at 125% and 150% font nothing clips; before/after pixel difference is material on the main screen and sub-states.
6. **Accessibility** (axe zero serious/critical on the POS and each sub-state, contrast script over token pairs, focus order, screen-reader names) and **responsive** checks at 360, 768, 1024, 1366, 1920 px.
7. **Interaction metrics:** clicks/keystrokes for the baseline task equal or better; typing latency and add-line time no worse; re-render counts no worse.
8. **Cross-browser:** Chromium and WebKit for the main flows.
9. **Stability:** run everything twice, then once from a clean install and a fresh DB; results identical.

## PART D — DEPLOY AND VERIFY
1. Gate before deploy: Part C green, `git diff --stat` justified, no migration (or justified).
2. Deploy a new revision with the existing script (labelled with the commit SHA), run `scripts/smoke-prod.ts`, roll back automatically on failure.
3. Production checks without real transactions: POS loads for ADMIN, SHOP and ACCOUNTS roles, all controls present, search and tier controls respond on read-only data, sample-preview prints unchanged, screenshots attached. Re-run the verification once more from a clean checkout of the deployed commit.
4. Update in place: `docs/design.md` (POS design system usage, layout rules, shortcut footer), `docs/rules.md` (POS visual changes must keep the parity inventory empty-diff; no logic in presentation components), `docs/tasks.md`, `docs/memory.md` (baselines, decisions, open items).

## LOOP (follow strictly)
```
Part 0 sync gate → Step 1 baseline → Part A (Stitch) → Part B (implement)
  → run: pnpm typecheck; pnpm lint; pnpm test; pnpm build → open the POS, exercise it with keyboard and mouse, screenshot the full matrix
  → compare with the baseline and the parity inventory; if anything differs functionally or the layout targets are missed: fix, rerun
  → proceed only when green and demonstrated
Then Part C (twice) → Part D → re-verify once more end to end.
```
- Never claim success without running the check and reading the output; quote key results in `docs/memory.md`.
- Never weaken or delete a failing test, never remove or rename a feature, shortcut or accessible name, never touch business logic, never add a colour outside the token set, never force-push.
- Same failure 5 times: write hypotheses and evidence in `docs/memory.md`, try a different approach. Ask the human only after 3 different approaches fail, with the exact error.
- When blocked on a human action (Stitch key, diverged git), print `WAITING_FOR_HUMAN: <what>` with exact steps and keep working on whatever does not depend on it.
- Local tests use the isolated test DB. Never run destructive scripts against production.

## FINISH
Only when all gates pass, print exactly:

`PROMPT 22 COMPLETE — Stitch design PASS — parity PASS — golden billing PASS — keyboard-only PASS — visual targets PASS — production PASS`

then: the commit live before and after, before/after screenshots for the full matrix, the parity-inventory diff (empty except recorded moves), layout measurements (chrome height, Finalize visibility at 1366×768), interaction metrics, files changed with reasons, open items. If you cannot reach that state, print `PROMPT 22 BLOCKED` with the exact blocker.
