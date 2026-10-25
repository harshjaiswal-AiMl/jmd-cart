# Prompts: how to use

Run these in Claude Code at the repo root, in order. Each prompt reads the docs first, plans, then builds one step at a time and waits for your "go". Every prompt assumes **local-first development: no cloud account, no third-party service**.

| File | When | Output |
|---|---|---|
| `00-setup-local-environment.md` | Once, first | Repo scaffold, Docker Compose, scripts, hooks, CI, health, backup |
| `01-phase1-core.md` | After 00 | Auth, catalogue, stock ledger, godown, POS, invoices |
| `02-phase2-van-credit.md` | After Phase 1 demo | Van app, credit, collections, reconciliation |
| `03-phase3-storefront-delivery.md` | After Phase 2 demo | Quick-commerce storefront, live stock, orders, delivery |
| `04-phase4-polish-release.md` | After Phase 3 | Reports, Tally export, security, training, release candidate |
| `99-deploy-when-hosting-chosen.md` | Only when hosting is decided | Dockerized deploy to the chosen host |

Rules that apply to every prompt: follow `docs/rules.md`; plan first; app compiles after every step; run tests and show real output; update `docs/tasks.md` and `docs/memory.md`; conventional commits one at a time; ask before touching auth, data-dropping migrations, GST or numbering logic, or adding a dependency.

Handy extras from the 15-prompts pack when needed: Debug an Error (10), E2E tests (11), Find Security Gaps (09, used in Phase 4), Clean Up Dead Code (12), Clean Git Commits (13).
