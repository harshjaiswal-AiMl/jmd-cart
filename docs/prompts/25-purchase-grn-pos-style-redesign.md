<USER_REQUEST>
# PROMPT #24 — Incident: roll production back to `jmd-cart-00103-bpx`, find why `jmd-cart-00104-4sv` broke, remove everything that revision added (code and revision), and make sure it cannot happen again (looping, self-verifying)

Save as `docs/prompts/24-rollback-revision-00104-incident.md` and paste everything below the line to the agent. **Do not create new doc files.** Update existing `docs/*.md` in place. **Evidence first, rollback second, deletion last.** Never improvise on production.

---

## THE OWNER'S REQUEST
Cloud Run revision **`jmd-cart-00104-4sv`** caused a problem ("why did this happen?"). The owner wants it **deleted**, **every update that came with it removed**, and production **matched to `jmd-cart-00103-bpx`**, checked against it.

## ROLE
You are the incident engineer for JMD Cart (Next.js on Cloud Run service `jmd-cart` in `asia-south1`, Cloud SQL Postgres, global load balancer, Cloudflare R2, `scripts/deploy-gcp.ps1`, migration job). Restore the known-good state safely, find the **root cause**, remove the bad changes from the codebase without destroying history, and add guardrails. "Done" means production serves exactly the 00103 behaviour, the repo matches it, the cause is documented with evidence, and the verification passed several times.

Follow `CLAUDE.md` and `docs/rules.md`. **Never open, print or log `.env`, `.env.deploy` or any secret.** **Never delete or modify database data.** **Never delete `jmd-cart-00103-bpx`.** No force-push, no `reset --hard`.

## RULES OF ENGAGEMENT (in this order, always)
1. Capture evidence → 2. Shift traffic back and verify → 3. Revert code in git (history preserved) → 4. Confirm with the human → 5. Delete the revision. A revision that serves traffic cannot be deleted, and deleting loses its evidence, so deletion is **last**.

## PART 0 — SYNC AND ACCESS
`git fetch --all --prune`; show branch, `git status`, local `HEAD` and `origin/main`. Fast-forward only if the tree is clean; otherwise stop with `WAITING_FOR_HUMAN`. Confirm `gcloud` is logged in with the human's account and the right project (`gcloud auth list`, `gcloud config get-value project`); if not, print `WAITING_FOR_HUMAN: gcloud login`.

## PART 1 — EVIDENCE (read-only; save to `docs/incidents/` is NOT allowed, store in `docs/memory.md` and a local git-ignored folder `.incident/`)
1. `gcloud run services describe jmd-cart --region asia-south1` (current traffic split, latest created/ready revisions, ingress, template).
2. Export both revisions: `gcloud run revisions describe <rev> --region asia-south1 --format=export` for `jmd-cart-00103-bpx` and `jmd-cart-00104-4sv`; produce a **config diff** (image digest, env vars and secret references, CPU/memory/concurrency/min-max instances, timeout, service account, startup/liveness probes, Cloud SQL connection, volume mounts, labels). Never print secret values; compare references and names only.
3. For each revision: the **image digest**, the Cloud Build/Artifact Registry entry, and the **commit SHA label** if present (`metadata.labels.commit`). If the label is missing, derive the commit from the image build metadata or Cloud Build history and say how sure you are.
4. **Logs:** Cloud Logging for `jmd-cart-00104-4sv` from its creation to now: error and warning counts by type, the first errors after it received traffic, 5xx rate, latency, cold-start and crash messages, failed health checks. Compare with `00103-bpx` over a similar window.
5. **Migrations between the two deployments:** the migration job executions and, read-only, the migrations applied after 00103 went live (via the existing migration job in status mode). List each new migration and whether it is additive.
6. Smoke-test and deploy-script output from the 00104 deploy if available, and the deploy timestamp.
Write an **evidence summary** in `docs/memory.md`.

## PART 2 — WHAT 00104 CHANGED (change inventory)
With the two commit SHAs: `git log --oneline <sha103>..<sha104>`, the full diff stat, the list of **features/prompts** it shipped, new migrations, new environment variables or secrets, config changes, and new routes/jobs. Produce a table: change → files → migration? → risk. If the SHAs cannot be established, stop with `WAITING_FOR_HUMAN: cannot map revisions to commits` and show what you found.

## PART 3 — ROOT CAUSE
Ask the human **once** (one message, then continue) what exactly they saw go wrong (screen, error text, which page or role, when it started) and to attach a screenshot if possible; continue with the log-based analysis in parallel. Reproduce on a local or test environment built from the 00104 commit versus the 00103 commit. State the **root cause** with evidence (log lines, failing test, diff hunk). Typical causes to rule in or out: a migration or data assumption not matching production data, a missing or changed environment variable/secret, a runtime or startup change, a changed cache/headers rule, a dependency change, a feature flag default, a role or route guard change, a regression in shared code. Record in `docs/memory.md`.

## PART 4 — ROLL BACK TRAFFIC (production safety)
1. **Compatibility check first (read-only):** 00103's code against the **current** database schema. Migrations must be additive, so 00103 should run, but prove it: compare 00103's Prisma schema with the live schema (via the migration job's status/diff mode, never `db push`), list columns/tables 00104 added that 00103 ignores, and flag anything not additive. If something is not compatible, stop with `WAITING_FOR_HUMAN` and explain.
2. Shift traffic: `gcloud run services update-traffic jmd-cart --region asia-south1 --to-revisions jmd-cart-00103-bpx=100`. Confirm with `describe` that 00103 has 100% and 00104 has 0%.
3. **Verify production on 00103:** run `scripts/smoke-prod.ts`; check the pages that broke; read-only checks for each role's home, search, storefront home and a product page; error rate in logs back to baseline; compare latency. Never create real orders or invoices.
4. Record the time of rollback and the observed recovery in `docs/memory.md`.

## PART 5 — REMOVE 00104's CHANGES FROM THE CODEBASE (history preserved)
1. Create a safety tag/branch that **keeps the removed work** (`archive/rev-00104-changes` pointing at the 00104 commit) so features can be re-applied later after the cause is fixed.
2. Create `revert/rev-00104` from the latest `main` and revert the commits that belong to 00104 (`git revert`, in reverse order; `-m 1` for merge commits). Resolve conflicts carefully; **do not** revert unrelated work done after 00104 unless it depends on it (list such cases for the human). Never rewrite published history.
3. **Prove the match with 00103:** `git diff <sha103> HEAD` must be empty for application code, migrations excluded from deletion (see 4), prompts/docs excepted; explain any difference file by file.
4. **Migrations:** do **not** delete or edit applied migrations. If 00104 added migrations that are already applied in production, keep their files in the repo (the schema in production includes them) and mark them in `docs/memory.md` as "applied, unused by the current code"; the Prisma schema must still describe the live database, so keep the schema models they added. If a new forward migration is needed to neutralise a data change, write it additively and explain.
5. Run the **full suite** on the reverted tree (`pnpm typecheck`, `lint`, `test`, `build`) and compare with the baseline recorded at 00103; they must match or improve. Open the revert for human review.
6. Build a **new revision from the reverted tree** with the existing deploy script, **without traffic**; compare its config and behaviour with 00103 (config diff empty except revision name and image digest; smoke tests pass; response parity on key pages). Only then (human OK) shift traffic to it; keep 00103 as the immediate fallback for 24 hours.

## PART 6 — DELETE `jmd-cart-00104-4sv` (last, with explicit confirmation)
Preconditions, all must be true and printed as a checklist: 00104 has **0% traffic**; evidence from Part 1 is saved; root cause written; reverted code verified; the human has typed **`CONFIRM DELETE 00104`**. Then `gcloud run revisions delete jmd-cart-00104-4sv --region asia-south1`. Confirm it is gone and that `jmd-cart-00103-bpx` and the new revision remain. **Never delete 00103.** The container image stays in Artifact Registry for forensics; do not delete it.

## PART 7 — PREVENT A REPEAT
1. **Regression test** that reproduces the root cause and fails on the 00104 commit.
2. **Safer deploy:** change `scripts/deploy-gcp.ps1` to deploy with no traffic, run smoke tests and key synthetic checks against the new revision (ingress is internal/load-balancer only, so use `gcloud run services proxy` or a tagged route reachable only to staff), then **canary 10% → 50% → 100%** with automatic rollback if the 5xx rate, latency or smoke checks cross thresholds; always record the previous serving revision.
3. **One-command rollback:** `scripts/rollback-gcp.ps1` that pins traffic to the previous revision and verifies; documented in `docs/architecture.md`.
4. **Alerting:** error-rate and latency alerts on the service; the perf/smoke gate from earlier prompts runs before traffic shifts.
5. Label every revision with its commit SHA (if not already done) so mapping is never a guess again.

## PART 8 — VERIFICATION (repeat; never trust one run)
Run the smoke suite and the key read-only checks **three times** at different moments after rollback; confirm error rate and latency match 00103's baseline; confirm no data was touched; confirm `git diff <sha103> HEAD` result; run the full test suite twice from a clean checkout; confirm the deploy script's new canary path on a dry run without real traffic changes beyond what the human approved.

## LOOP (follow strictly)
```
Part 0 → Part 1 evidence → Part 2 inventory → Part 3 root cause → Part 4 rollback → verify
  → Part 5 revert in git → verify match with 00103 → Part 6 delete (only after CONFIRM DELETE 00104) → Part 7 guardrails → Part 8 verification
at every step: run the check, read the real output, and stop on anything unexpected with WAITING_FOR_HUMAN
```
- Never claim success without running the check and reading the output; quote key results in `docs/memory.md`.
- Never delete data, never delete 00103, never print secrets, never force-push or reset, never delete 00104 before the confirmation, never revert work the human did not ask to remove without listing it first.
- If evidence contradicts the assumption that 00104 is the cause, say so and present the facts instead of forcing the rollback story.

## FINISH
Only when all steps pass, print exactly:

`PROMPT 24 COMPLETE — traffic on 00103 PASS — root cause documented PASS — code reverted and matches 00103 PASS — 00104 deleted PASS — guardrails PASS`

then: the evidence summary, the change inventory of 00104 (what was removed, with the archive branch name for re-applying later), the root cause, the config diff between 00103 and 00104, the verification table, files changed. If you cannot reach that state, print `PROMPT 24 BLOCKED` with the exact blockeD



# PROMPT #25 — Redesign the whole Purchase / GRN module like Shop POS, everything operable from the keyboard, designed with Stitch (looping, self-verifying)

Save as `docs/prompts/25-purchase-grn-pos-style-redesign.md` and paste everything below the line to the agent. **Do not create new doc files.** Update existing `docs/*.md` in place. This is a **redesign of presentation and keyboard interaction only**: every Purchase/GRN feature, rule and calculation stays exactly as it works today. **Run this only after Prompt #24 is complete** (production stable and the repo matched to `jmd-cart-00103-bpx`); build on that code, not on anything reverted.

---

## THE REQUEST
Redesign the **entire Purchase / GRN area** (purchases list, new GRN entry, view/print, Scan Bill receive-goods flow, supplier details) **the same way as Shop POS**: the same voucher look and feel, the same shared components, and **every action doable with the keyboard alone**.

## ROLE
You are the UI lead and engineer for JMD Cart (Next.js 14 App Router, management design system, shared `VoucherGrid` and search from the POS prompts, purchase/GRN services, stock ledger, supplier ledger). Redesign with **Stitch**, prove with tests that **nothing functional changed**, deploy, and re-verify. "Done" means built, measured against a before baseline, tested in several independent layers, deployed and re-verified.

Follow `CLAUDE.md` and `docs/rules.md`. **Never open, print or log `.env`, `.env.deploy` or any secret.** Migrations are not expected; if one seems necessary, stop and justify it (additive only). **Never create real GRNs or stock changes in production**: verify with the test database, sample previews and read-only checks.

## PART 0 — SYNC GATE (nothing is edited until this passes)
Run exactly the sync gate from `docs/prompts/11-invoice-print-agent-code.md` Part 0: `git fetch`, clean tree, fast-forward to the latest `origin/main`, confirm the commit running on **Cloud Run (100% traffic revision)** is contained in your code and production migrations all exist in the repo, work on a new branch, record the baseline of `pnpm typecheck / lint / test / build`. If branches diverged, the deployed code is not in git, or the tree is dirty: stop with `WAITING_FOR_HUMAN` and show the difference. Never reset, force-push or overwrite anyone's work. Review `git diff --stat` at the end and justify every changed file in `docs/memory.md`.

## STEP 1 — BASELINE AND PARITY CHECKLIST (before any change)
1. **Read** the purchase module (`src/modules/purchase/*`, `src/app/godown/purchases/*`), Receive Goods / Scan Bill (Prompt #10, if present), the stock and supplier ledger code, debit notes, the Shop POS screen and its `VoucherGrid`, shared search (`searchItems`, `ItemSearchBox`, `searchParties`), Quick Add, the unit picker, print templates, permissions and nav.
2. **Feature inventory of every Purchase/GRN screen**, via script and Playwright crawl as ADMIN, GODOWN, SHOP (cashier access from Prompt #18) and ACCOUNTS: every control, field, tab, filter, action, shortcut and accessible name. Known items to include at least: purchases list (filters, search, status, totals if present), **New GRN**: Supplier / Company (all brands as suppliers, "Direct / Unlisted"), Supplier Invoice / Bill No, Bill Date, Receiving Destination, **Received Product Line Items** (product, quantity, purchase rate, GST slab, line total, "+ Add Another Line"), Taxable Value, GST Total, Grand Total, **Cancel** and **Confirm & Post Stock Receipt**; Scan Bill flow (upload photos, OCR draft, matching, count and verify, variances, debit note draft, Done); view/print GRN; supplier ledger links; permissions per role; manual-date rules.
3. **Golden GRN fixtures:** scripted purchases (single and multi-line, different GST slabs, units, discounts, scan-bill with shortage) with expected taxable value, GST, totals, stock IN by location, supplier ledger entries and audit; plus the existing purchase, scan-bill and stock suites: they must pass **unchanged**.
4. **Visual and interaction baseline:** screenshots of every state at 1366×768, 1920×1080, 1024×768 and 360 px (100% and 125% font) and the keystroke/click counts for "receive a 5-line GRN" and "find and open a past GRN". Save under `tests/baseline/grn/` (never in `src/`).

Ask the human ONCE (one message, then continue): connect the **Stitch MCP** if it is not connected (current official setup, key via environment/secret store, never the repo; verify by listing projects). If unavailable and the human says continue, design with the existing system and log it.

---

## PART A — DESIGN WITH STITCH (same family as Shop POS)
Generate and save under `design/stitch-export/management/grn-redesign/` (desktop 1366×768 and 1920×1080, tablet 1024×768, mobile fallback), then port to shared components (never paste generated HTML wholesale):
1. **Purchase voucher entry (New GRN / edit mode where editing exists)**, built on the same `VoucherGrid` and visual language as Shop POS:
   - **Command header** (at most about 140 px above the grid at 768 px height): voucher type "Purchase (GRN)", **GRN No. preview (auto)**, **Date** (existing manual-date rules), **Supplier / Company** with the shared search and a compact **supplier card** (name, balance payable, last purchase date and amount), **Supplier Bill No.**, **Bill Date**, **Receiving destination**, Narration.
   - **Grid columns:** S.N., Item (shared smart search with weight, `bhuj 400`-style), Qty, **Unit** (Pcs, Carton, Dozen, Bag, and Jar/Hanger where those prompts exist), **Purchase Rate**, **GST %** (auto from the product, editable where it is today), Amount. Light, borderless "text until focused" cells, tabular right-aligned numbers, sticky header, clear focus ring, empty state ("Start typing an item, or press F6 to add a new product").
   - **Status line** for the highlighted item: current stock by location, last purchase rate, MRP, pack size, margin hint. **Item info panel** (`F8`).
   - **Bottom bill summary:** taxable value, GST total, round-off, **large grand total with amount in words**, supplier payable after this bill; a **sticky action bar** with **Confirm & Post (F2)**, Hold (F4), Cancel (Esc) always visible at 1366×768; a slim **function-key footer** (F2 Post, F3 New, F4 Hold, F6 Add new product, F7 Repeat line, F8 Item info, F9 Delete line, Alt+S Supplier, Esc Back, `?` help).
   - **Save confirmation** dialog "Post this goods receipt? Yes / No" with a scrollable **item preview** (same as the POS Save dialog).
2. **Purchases list** as a Busy-style register: dense table, filters (date range, supplier, status, amount), search, totals bar for the whole filtered result (count, taxable, GST, total), keyboard row navigation, open/print/view actions, empty state.
3. **Receive Goods (Scan Bill)** screens redesigned in the same family: scan/upload, review draft, **count & verify** (billed versus counted columns in the voucher grid, variance chips, reasons), Done; mobile layout for the godown phone app stays simple (large steppers), desktop uses the grid.
4. **Supplier details** panel (balance, recent purchases, ledger link) and **view/print GRN** page in the same style.
5. Rules for the design: management design tokens only, one primary and one accent, semantic colours only for status, toolbar buttons as one consistent family with shortcut chips, WCAG AA, 125%/150% font support, motion only on `transform`/`opacity` with `prefers-reduced-motion`, no text under 12 px at 100% font. Record the decisions with before/after screenshots in `docs/design.md`.
**Gate A:** every screen and sub-state (supplier dropdown, item dropdown, Save dialog, quick-add drawer, error states, count & verify) has a Stitch reference; no colour outside the token set.

## PART B — KEYBOARD MODEL (everything without the mouse)
Reuse the Shop POS behaviour and add the purchase-specific parts. Never hijack browser keys (F5, F11, F12, Ctrl+W/T/R); keep `Ctrl+K`.
| Where | Keys |
|---|---|
| Purchases list | ↑/↓ move rows, Enter open, `N` or F3 new GRN, `/` focus search, `F` open filters (arrow keys inside), `P` print, `Esc` back |
| Header | Tab/Shift+Tab through fields; `Alt+S` supplier search (type a fragment, ↑/↓, Enter); date fields accept typed `DD-MM-YYYY` |
| Item cell | type fragment → dropdown (↑/↓, Enter) → next cell |
| Grid | Enter = next cell: Item → Qty → Unit → Rate → GST % (skipped if not editable) → Amount (skipped) → **new row Item**; ↓ on last row adds a row; Shift+Enter previous cell |
| Unit cell | `P`, `C`, `D`, `B` (and `J`, `H` where those units exist) or ↑/↓ |
| Line actions | `F7` repeat previous line, `F9` delete line (confirm if filled), `F8` item info, `F6` quick add product (same drawer and Quick Save as POS; the new product is searchable instantly and added to the GRN line) |
| Finish | `F2` or `Ctrl+Enter` → "Post this goods receipt? Yes / No" → Enter = Yes |
| Hold / New | `F4` hold, `F3` new |
| Esc | closes dropdown → cancels cell edit → clears search → on a non-empty voucher asks before leaving, on an empty one goes back (same rules as POS and the global Esc-back) |
| Count & verify | Tab/Enter move through counted cartons and loose, `Space` or `=` fills "as per bill" (disabled in blind-count mode, logged), `V` toggles variance reason, `F2` Done |
Visible focus on the active cell, ARIA combobox/grid patterns, `aria-live` for totals and status line, a `?` help overlay listing every key.
**Gate B:** a keyboard-only Playwright run of an entire day: list → new GRN → supplier by fragment → six lines by fragment with units and rates → quick-add an unknown product → hold → resume → repeat line → delete line → post → find it in the list → print; then a Scan Bill receive with a shortage, counted and posted, all **without the mouse**; keystroke counts recorded against the baseline.

## PART C — IMPLEMENTATION RULES (presentation and interaction only)
1. Port the design into the existing purchase components using the shared `VoucherGrid`, search, unit picker and Quick Add; keep all server actions, services, validation, calculations, stock-ledger posting, supplier-ledger entries, GST handling, permissions, manual-date rules and audit **untouched**. Where markup moves, keep every `data-testid`, accessible name and focus meaning.
2. All existing GRN capabilities remain: supplier = brand or "Direct / Unlisted", bill number/date, destination, line items with rate and GST, totals, cancel/post, Scan Bill count/verify/variance/debit note draft, print/view, role access (including the cashier access from Prompt #18).
3. Responsive: desktop and tablet use the voucher layout; the existing mobile behaviour stays functional and restyled.
4. Performance: typing latency and time-to-add-line no worse than the baseline; no extra re-renders (memoised rows, stable callbacks); no layout shift when dropdowns, status line or panels open.
**Gate C:** typecheck, lint, tests, build green; every parity-checklist control present with the same behaviour.

## PART D — VERIFICATION (multiple independent layers; none may be weakened)
1. **Parity:** the Step 1 inventory versus the new screens: every control, field, shortcut and state exists (moved, never removed); an automated diff of the inventories is empty except recorded position changes; API changes additive.
2. **Golden GRN:** the scripted purchases produce identical taxable value, GST, rounding, totals, stock IN by location, supplier ledger entries and audit as before; Scan Bill scenarios (match, shortage, excess, debit note draft, idempotent Done) identical; print output identical.
3. **Existing suites** (purchase, GRN, scan bill, stock, supplier ledger, permissions, Quick Add, search, POS) pass **unchanged**.
4. **Keyboard-only suites** (Part B) plus a no-mouse run of the Purchases list and filters.
5. **Visual proof:** after-screenshots in the same matrix as the baseline: at **1366×768** a 12-line GRN fits with **Confirm & Post visible without scrolling**, chrome above the grid at most about 140 px, no horizontal scroll, nothing clips at 125% and 150% font; the before/after difference is material on the entry screen, the list and the count-and-verify screen.
6. **Accessibility** (axe zero serious/critical on every new screen and sub-state, contrast over token pairs, focus order, names) and **responsive** at 360, 768, 1024, 1366, 1920 px.
7. **Interaction metrics:** keystrokes/clicks for "receive a 5-line GRN" and "find and open a past GRN" equal or better than the baseline; typing latency and add-line time no worse.
8. **Data integrity:** stock never negative, `SUM(ledger) = balances`, supplier ledger consistent, GST paise-exact, item stock statement reconciles.
9. **Cross-browser:** Chromium and WebKit on the main flows.
10. **Stability:** run everything twice, then once from a clean install and a fresh DB; results identical.

## PART E — DEPLOY AND VERIFY
1. Gate before deploy: Part D green, `git diff --stat` justified, no migration (or justified).
2. Deploy with the safe path from Prompt #24 (no-traffic revision, smoke tests, canary 10% → 50% → 100%, automatic rollback), labelled with the commit SHA; run `scripts/smoke-prod.ts`.
3. Production checks without real transactions: Purchases list and New GRN load for ADMIN, GODOWN, SHOP and ACCOUNTS; all controls present; supplier and item searches respond on read-only data; Scan Bill screens load; sample previews and screenshots attached. Re-run the verification once more from a clean checkout of the deployed commit.
4. Update in place: `docs/design.md` (purchase voucher design, keyboard map), `docs/architecture.md` (shared `VoucherGrid` used by sales and purchase), `docs/rules.md` (purchase screens keep the parity inventory empty-diff; no logic in presentation components; keyboard map rules), `docs/tasks.md`, `docs/memory.md` (baselines, decisions, open items).

## LOOP (follow strictly)
```
Part 0 sync gate → Step 1 baseline → Part A (Stitch) → Part B (keyboard) → Part C (implement)
  → run: pnpm typecheck; pnpm lint; pnpm test; pnpm build → open every screen, exercise it with the keyboard only, screenshot the full matrix
  → compare with the baseline and the parity inventory; if anything differs functionally or a target is missed: fix, rerun
  → proceed only when green and demonstrated
Then Part D (twice) → Part E → re-verify once more end to end.
```
- Never claim success without running the check and reading the output; quote key results in `docs/memory.md`.
- Never weaken or delete a failing test, never remove or rename a feature, shortcut or accessible name, never touch business logic, never add a colour outside the token set, never force-push.
- Same failure 5 times: write hypotheses and evidence in `docs/memory.md`, try a different approach. Ask the human only after 3 different approaches fail, with the exact error.
- When blocked on a human action (Stitch key, diverged git, Prompt #24 not finished), print `WAITING_FOR_HUMAN: <what>` with exact steps and keep working on whatever does not depend on it.
- Local tests use the isolated test DB. Never run destructive scripts against production.

## FINISH
Only when all gates pass, print exactly:

`PROMPT 25 COMPLETE — Stitch design PASS — keyboard-only PASS — parity PASS — golden GRN PASS — visual targets PASS — production PASS`

then: the commit live before and after, before/after screenshots for the full matrix, the parity-inventory diff (empty except recorded moves), keystroke and latency tables, layout measurements (chrome height, Confirm & Post visibility at 1366×768), files changed with reasons, open items. If you cannot reach that state, print `PROMPT 25 BLOCKED` with the exact blocker.
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-11-14T07:31:33+05:30.

The user has uploaded 1 image(s):
- C:/Users/admin/.gemini/antigravity/brain/83cf013f-ce96-41ae-9b68-6dba3a33f37e/.user_uploaded/media_1794620979299_f2b2b747.png
You can embed this image in an artifact if you need the USER to review it.
</ADDITIONAL_METADATA>