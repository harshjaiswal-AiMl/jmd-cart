## ROLE
You are the engineer making a focused update to the invoice/receipt in JMD Cart (Next.js 14 App Router, Prisma, Postgres, Cloud Run + Cloud SQL, `management.jmdcart.com` / `jmdcart.com`). Change only what is listed here. Everything else stays exactly as it is. "Done" means built, run, measured against screenshots and deployed, not "it compiles".

Follow `CLAUDE.md` and `docs/rules.md`. **Never open, print or log `.env`, `.env.deploy` or any secret.**

## PART 0 — SYNC FIRST (hard gate, nothing is edited until this passes)
The owner requires that you start from the **latest code that is actually live** and that you **only update it, never overwrite or revert anyone's work.**
1. `git fetch --all --prune`. Show current branch, `git status`, local HEAD, `origin/main` HEAD. If the working tree has uncommitted changes, **stop** and report them; never stash/discard/reset them without the human's say-so.
2. If local is behind, fast-forward (`git pull --ff-only`). If it has diverged, **stop** with `WAITING_FOR_HUMAN: diverged branches` and show both sides. Never `reset --hard`, force-push, or rebase published history.
3. **Compare with Cloud Run.** With the human's existing `gcloud` login, read the revision currently receiving 100% of traffic (`gcloud run services describe …`) and find which git commit it was built from (revision labels/annotations, image tag, Cloud Build history). Confirm that commit is contained in the code you are about to edit (`git merge-base --is-ancestor <deployedSha> HEAD`). Also check the production database's applied migrations are all present in `prisma/migrations` (use the existing migration job in a read-only status mode; never run anything that changes production data in this step).
   - If the deployed commit cannot be identified, or is **not** in git history (for example a hot-fix deployed from a dirty folder), or production has migrations the repo lacks: **stop** with `WAITING_FOR_HUMAN: deployed code not in git` and say exactly what differs. Do not guess and do not "fix" it by overwriting.
   - If `scripts/deploy-gcp.ps1` does not already record the git commit SHA on each revision (label/annotation), add that single line and say so. This is the only deploy-script change allowed.
4. Create a branch from the latest `main` (for example `feat/invoice-print-agent-code`). Run the **full baseline** (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`) and record the pass counts in `docs/memory.md`. A red baseline is reported, not hidden.
5. **Minimal-diff discipline for the whole task:** no refactors, no renames, no reformatting of untouched code, no dependency changes unless unavoidable (ask first), no changes to unrelated screens. Migrations are **additive only**. Management UI keeps its look; add only the fields/screens this prompt needs. Before opening the final PR/commit set, review `git diff --stat` and justify every touched file in `docs/memory.md`.

## STEP 1 — READ, THEN MAP EVERY PLACE THE INVOICE IS RENDERED
Read `CLAUDE.md`, `docs/memory.md`, `tasks.md`, `rules.md`, `design.md`, `prisma/schema.prisma` (Invoice, InvoiceLine, Party, User, Business details/settings), `src/modules/billing/*`, `src/modules/invoice/*` (or wherever invoices live), `src/app/shop/pos/*`, van billing, `src/components/**/bluetooth-printer-modal.tsx`, every invoice view/print/reprint/share path, `src/modules/store/*` (storefront invoice view), and settings/business-details code.
**List every render path** in `docs/memory.md` before editing: HTML thermal print view, Bluetooth/ESC-POS output, A4/PDF if any, reprint, van invoice, admin invoice detail, storefront customer invoice view, any share/WhatsApp text. All of them must be driven by **one shared invoice view-model builder** so the printed bill, Bluetooth bill and on-screen bill can never drift apart. If several builders exist, route them through one without changing their outputs for unaffected fields.

## STEP 2 — THE CHANGES

### 2.1 Thermal receipt (80 mm and 58 mm; follow the existing layout, change only this)
1. **Header:** keep the logo. **Remove the payment-mode heading** (the big "CASH") and **remove the owner's mobile number from the header.** For non-cash sales (credit etc.) show a small "CREDIT SALE" (or the mode) row inside the meta block instead, so no information is lost; cash prints nothing extra.
2. **Meta block:** Date/Time and Invoice No. stay. **Remove the Cashier row** and do not highlight any staff name.
3. **Customer block** replaces "Customer Name" with three rows: **Name, Mobile, Address** (address wraps to several lines). Omit any row that is empty. A walk-in with no details prints a clean "Walk-in" line or nothing, never blank labels.
4. **Totals:** keep Total, Rounded Off, grand total and total quantity. Add the **amount in words** under the grand total.
5. **GST text:** replace "ALL GST INCLUDED" with **"GST included"** (the word "ALL" removed), printed in a **small font on the side of the grand total**, not as a centered banner. Print it only when the invoice prices are GST-inclusive per settings/data. For GST-exclusive invoices print the real tax lines instead; never print a false "included".
6. **Footer:** keep the thank-you line and the "call us for free door delivery" line. The phone number there must come from **business settings**, never hard-coded. Add editable settings for both footer lines if they are not already editable.
7. Fonts, widths, logo, item table (Sl, Product, Qty/Unit, MRP, Disc%, Rate, Amt) stay as they are.

### 2.2 New A5 invoice template
Add an **A5 portrait (148 × 210 mm)** template next to the thermal ones, selectable at print/reprint time ("Thermal 80", "Thermal 58", "A5") with a per-channel default setting (POS default stays thermal). Layout approved by the owner (a PDF preview is in the repo hand-off; match it, replacing the placeholder text with real data):
- Header: logo left; right side "INVOICE" title, business name/unit, address, **GSTIN and FSSAI from Business Details** (omit when empty), thin orange rule under the header.
- Meta row: Invoice No., Date/Time.
- **Customer Details box:** Name, Mobile, Address (GSTIN too for B2B parties when present).
- Item table (maroon header, white text): Sl, Product, Qty/Unit, MRP, Disc%, Rate, Amount; discounts in green. Add HSN and an HSN-wise GST summary **when the invoice data supports it** (needed for B2B/tax invoices).
- Totals: Total, Rounded off, a highlighted **Payable** bar; "GST included" in small font to the side of it (same rule as thermal); **Amount in words** below.
- Footer: thank-you, free-door-delivery line with phone from settings, "This is a computer-generated invoice.", tagline.
- Uses the existing JMD Cart theme tokens (maroon, orange, cream) and fonts already in the project, `@page { size: A5; margin: … }`, correct print CSS, no page overflow. **Multi-page:** more than about 14 lines must paginate with repeated table header, and totals/amount-in-words/footer only on the last page.
- Print preview modal on the invoice detail screen plus "Download PDF" using the browser print pipeline already in use.

### 2.3 Amount in words
One shared function `amountInWords(paise)` in shared code: Indian numbering (thousand, lakh, crore), "Rupees … Only", paise as "and … Paise" when non-zero, uses the **final payable (rounded) amount**. English. Tests for 0, 1, 11, 99, 100, 101, 999, 1,000, 12,345, 1,00,000, 12,34,567, 1,00,00,000, and values with paise (for example 435.50 and 0.99).

### 2.4 Customer address and mobile on the invoice
- Additive nullable invoice snapshot fields: `customerName`, `customerPhone`, `customerAddress`. Snapshots are written at invoice creation so later edits to a party never change old invoices.
- POS and van billing: add Name, Mobile, Address inputs for walk-in customers (follow the existing POS look). Typing a mobile looks up an existing customer and auto-fills; a registered party auto-fills from its record. Normalize Indian mobiles (10 digits, optional +91), light validation, address optional (required only for delivery orders if the business rule exists).
- When a walk-in gives a valid mobile and name, create or update a customer party (dedupe by normalized mobile) so repeat customers are recognized. This must not change their price list (walk-in stays list C) and must not duplicate existing parties.
- Online orders and existing invoices: the print path falls back to the party/order address when no snapshot exists. **No backfill that invents data.**

### 2.5 Agent code, auto-saved for incentives
1. Additive: `User.agentCode` (nullable, unique, upper-case alphanumeric, 3 to 8 characters), editable by ADMIN/SUPER_ADMIN in the existing user CRUD (add the field via the existing registry/kit, with a "generate next code" helper and uniqueness validation). Staff without a code show a small warning in the user list; billing is never blocked by a missing code.
2. Additive invoice fields: `agentUserId` (FK) and `agentCodeSnapshot`. **Set automatically at invoice creation** from the logged-in staff member (POS, van, admin-created orders) in the same transaction as the invoice. No extra typing by the cashier. An ADMIN/SUPER_ADMIN may reassign the agent on an invoice (permission checked, reason required, audit logged); cancellations keep the record but are excluded from totals.
3. **Not shown outside.** The agent code is **not printed on the customer bill by default**, and is **never exposed** in the storefront/customer invoice views, storefront APIs, or any customer-facing response. Add a setting `invoice.showAgentCode` (default **off**) that lets the owner print it small on the bill if he decides to. The cashier name no longer prints.
4. Backfill idempotently `agentUserId` for existing invoices from the staff member who created them, where that information already exists. Do not invent codes.
5. **Agent Sales (Incentive Record)** report in the admin Reports area (additive nav entry, existing styling): filters (date range, agent, location, channel), per agent: invoice count, gross sales, cancelled/returns excluded, net sales; drill-down to invoices; CSV export; read-only. Do **not** compute incentive percentages or payouts (the owner has not defined rules); leave a clearly marked extension point and list it as an open question.

## STEP 3 — TESTS (must pass; none may be weakened)
- **View-model/print tests (thermal and A5):** no payment heading for cash, no owner phone in the header, no cashier row, customer block rows appear only when filled, address wraps, amount in words correct, "GST included" (never "ALL GST INCLUDED") only for inclusive invoices, footer phone from settings, A5 has `@page size: A5`, multi-page pagination with repeated header and last-page-only totals.
- Bluetooth/ESC-POS output carries the same content as the HTML thermal view (compare text lines).
- Agent code: auto-captured on POS, van and admin-created invoices; uniqueness; admin reassignment audited; cancelled excluded from report; backfill idempotent.
- **Leak test:** storefront invoice views/APIs and customer DTOs contain no `agentCode`, `agentUserId`, or cashier name; staff views can show them; `showAgentCode` setting prints it only when on.
- Walk-in customer upsert: dedupe by mobile, no price-list change, no duplicate parties, old invoices unchanged after party edits.
- `amountInWords` table tests above.
- All existing tests (invoice numbering gapless, GST paise-exact, stock ledger, cancel restores stock, role matrix, empty-start guard) still pass. Visual: Playwright screenshots of the thermal receipt (80 mm width) and the A5 invoice for a fixed fixture saved to `docs/screenshots/`; thermal compared with the previous layout so only the intended differences appear.

## STEP 4 — DEPLOY AND VERIFY ON PRODUCTION
1. Gate before deploy: baseline-equal-or-better test counts, `git diff --stat` reviewed, migrations additive.
2. Run the additive migrations with the existing migration job, deploy a new revision with the existing script (revision labeled with the commit SHA), run `scripts/smoke-prod.ts`. Roll back automatically if smoke fails.
3. **Never create test invoices in production** (the invoice series is gapless and each number is permanent). Verify print output with a **staff-only sample-preview route** that renders the templates from fixture data and never touches the database. Check the thermal and A5 previews on production and attach screenshots.
4. Confirm: storefront invoice view has no agent fields; Agent Sales report loads; users list shows the agent code field; the old invoices still print correctly (open a real existing invoice in preview only).

## STEP 5 — DOCS
Update in place: `docs/architecture.md` (shared invoice view-model, templates, snapshot fields, agent capture), `docs/rules.md` (agent code never customer-visible; no test invoices in production; sync-before-edit rule), `docs/design.md`, `docs/tasks.md`, `docs/memory.md` (render-path list, decisions, open items: incentive rules, whether to print agent code, GSTIN/FSSAI fields filled).

## LOOP (follow strictly)
```
Part 0 sync gate → for each STEP (2.1 → 2.5 → 3 → 4 → 5):
  plan → write tests → implement the smallest change → run: pnpm typecheck; pnpm lint; pnpm test; pnpm build
  → render the receipt/invoice, screenshot it, compare with the requirements above
  → if anything fails: root-cause it, fix, rerun from the top
  → proceed only when green and demonstrated
```
- Never claim success without running the check and reading the output; quote key results in `docs/memory.md`.
- Never weaken or delete a failing test; never overwrite, revert or reformat code you were not asked to touch; never force-push or reset.
- Same failure 5 times: write hypotheses and evidence in `docs/memory.md`, then try a different approach. Ask the human only after 3 different approaches fail, with the exact error.
- When blocked on a human action (diverged branches, undeployed hot-fix, gcloud login), print `WAITING_FOR_HUMAN: <what>` with exact steps and keep working on whatever does not depend on it.
- Local tests use the isolated test DB. Never run destructive scripts against production.

## FINISH
Only when all gates pass, print exactly:

`INVOICE UPDATE COMPLETE — synced with git + Cloud Run PASS — thermal PASS — A5 PASS — agent code PASS — production PASS`

then: the commit SHA that was live before and the new one, files changed with one-line reasons, screenshots (thermal and A5), new migrations, settings added, open items (incentive rules, show-agent-code-on-bill decision, GSTIN/FSSAI entered, payment-mode wording for credit). If you cannot reach that state, print `INVOICE UPDATE BLOCKED` with the exact blocker.
