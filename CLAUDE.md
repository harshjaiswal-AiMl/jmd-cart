# CLAUDE.md

Distribution management system for an FMCG business in Saharsa (inventory, POS/GST billing, van sales, credit, ecommerce). Final delivery 15 Nov 2026. **Built local-first; hosting is decided later.**

## Read first, every session
1. `docs/memory.md` (context and decisions)
2. `docs/tasks.md` (what is done, what is next)
3. `docs/rules.md` (hard rules)
Then as needed: `docs/prd.md` (what), `docs/architecture.md` (how), `docs/design.md` (UI).
Phase prompts live in `docs/prompts/` and run in order (00 to 04, then 99 when hosting is chosen).

## Stack
Next.js (App Router) + TypeScript strict, PostgreSQL + Prisma, Tailwind + shadcn/ui, Zod, Auth.js, Vitest, Playwright, pnpm. Docker Compose for local Postgres and Mailpit.

## Commands
- `docker compose up -d` start Postgres + Mailpit | `pnpm dev` run app | `pnpm dev:lan` HTTPS for phone testing
- `pnpm build` | `pnpm test` | `pnpm e2e` | `pnpm lint` | `pnpm typecheck`
- `pnpm db:migrate` | `pnpm db:seed` | `pnpm db:reset` | `pnpm db:backup` | `pnpm db:restore`

## Hard rules (full list in docs/rules.md)
- Change stock only via `stock.postMovement()`. Never edit or delete movements.
- Money is integer paise. No floats.
- Finalized invoices are immutable; invoice numbers come only from the locked sequence.
- Check permissions on the server. Validate input with Zod. No secrets in code.
- No third-party SaaS or hosting-specific code. External capabilities go behind adapters with a local implementation.
- Config only via env vars; keep Dockerfile and `/api/health` working.
- Ask before touching auth, migrations that drop data, GST/numbering logic, or adding dependencies.
- Plan first; small steps; app compiles after every step; update `docs/tasks.md` and `docs/memory.md` after each step.
- Do not claim it works until you have run it. Show the output.
