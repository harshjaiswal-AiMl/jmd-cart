# 02 Phase 2: Van sales, credit and collections (paste into Claude Code)

Prerequisite: Phase 1 demo done and `docs/tasks.md` Phase 1 ticked. Local-first; no third-party services.

## Step A: Read
`CLAUDE.md`, `docs/memory.md`, `docs/rules.md`, `docs/prd.md` (sections 5 and 7), `docs/architecture.md` (sections 3, 4, 7), `docs/design.md` (van app), `docs/tasks.md` (Phase 2). Summarise and list questions.

## Step B: Plan mode, no code
Plan tasks 2.1 to 2.12 with the same plan format as Phase 1 (files, verification, size, flags, rollback). Riskiest first: idempotent finalize with local drafts (2.4), Bluetooth printing (2.5), reconciliation maths (2.8). Flag migrations (`van_days`, `van_day_lines`, `cash_handovers`) for sign-off. Stop and wait for "go".

## Step C: Build one step per "go"
1. **Parties import**: Tally export (CSV) to parties with `credit_enabled`, `credit_limit_paise`, `credit_days`, opening outstanding as `OPENING` ledger entries. Re-runnable; row errors reported. Credit allowed only for imported credit parties.
2. **Van issue**: godown staff create an issue sheet per van; `VAN_ISSUE` movements; printable loading sheet.
3. **Van PWA shell**: installable, role routing, large touch targets, bottom tabs (Stock, Bill, Collect, Day).
4. **Van billing**: uses the same pricing, GST and invoice services as the shop. Finalization needs the server (it issues the invoice number). On network loss save a **local draft** (IndexedDB) and finalize on reconnect with a client-generated idempotency key. Tests: replayed finalize never double-posts; draft survives reload.
5. **Bluetooth ESC/POS printing** via Web Bluetooth (needs HTTPS or localhost; use `dev:lan`). Provide print-preview fallback and "share as PDF". State clearly what must be tested on the real printer and phones.
6. **Collections and party ledger**: receipts reduce outstanding; party statement.
7. **Credit enforcement**: block a credit bill when the limit or credit period is exceeded; owner override with reason; audit entry.
8. **Evening return and reconciliation**: issued minus sold equals expected; godown counts physically; shortage/excess recorded per van and date; unsold stock returned via `VAN_RETURN`.
9. **Cash handover**: van cash and UPI submitted; owner confirms receipt; differences recorded.
10. **Reports**: outstanding, ageing (0-30, 31-60, 61-90, 90+), collections, daily van report.
11. **Return to company**: company return with reason, stock-wise report, debit note, `RETURN_TO_COMPANY` movements.
12. E2E: full van day (issue, two bills incl. one credit, collection, return count, reconcile, handover). Update docs and demo script.

## Constraints
Van stock belongs to one user; only that user (and admin) can bill from it. No batch/expiry. Never let a van bill finalize without a server-issued invoice number. Show real test output at each step.

Begin with Step A.
