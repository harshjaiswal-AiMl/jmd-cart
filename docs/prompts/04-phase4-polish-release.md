# 04 Phase 4: Polish and release candidate (paste into Claude Code)

Prerequisite: Phase 3 demo done. Local-first. Goal: a release candidate that can be deployed to any host once chosen.

## Step A: Read
`CLAUDE.md`, `docs/memory.md`, `docs/rules.md`, `docs/prd.md`, `docs/architecture.md`, `docs/tasks.md` (Phase 4). Summarise and list questions.

## Step B: Plan mode, no code
Plan tasks 4.1 to 4.9 with the standard plan format. Stop and wait for "go".

## Step C: Build one step per "go"
1. **Owner dashboard**: today's sales, cash/credit, van status, pending online orders, low stock, alerts.
2. **Accounting and GST**: party ledgers, cash/bank book, day book, sales/purchase registers, vouchers, GSTR-1 and GSTR-3B working data, HSN summary.
3. **Tally export**: vouchers and parties as XML/CSV; test with a sample import (document what the client's CA should verify).
4. **E-invoice adapter**: wire `EInvoiceProvider` end to end with the no-op provider and a mock GSP; ready for real credentials later.
5. **Security pass** (prompt 09 from my pack): secrets, injection, auth checks on every route/action, IDOR (user A cannot read user B's orders or ledger), upload validation, rate limiting on login and OTP, dependency audit, error/log leaks. Rank findings, fix critical now, ticket the rest.
6. **Backup and restore drill**: `db:backup` and `db:restore` on a realistic dataset; document the exact steps and time taken.
7. **Data migration kit**: import templates for products and parties, opening-stock count sheet, go-live checklist, parallel-run daily stock-match report.
8. **Performance and reliability**: query plans for hot paths (POS search, stock by location, availability), indexes, load test with 900 products and concurrent POS + van + storefront traffic.
9. **Docs**: one-page guide per role (English), admin manual, runbook (start/stop, backup, restore, common errors), update `docs/memory.md`.
10. **Release candidate**: version tag, Docker image builds, `/api/health` green, full E2E suite green, known-issues list.

## Constraints
No new features. Do not cut ledger tests or backups. Show real output for each step.

Begin with Step A.
