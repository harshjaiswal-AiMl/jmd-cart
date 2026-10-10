# 00 Setup: local environment (paste into Claude Code)

Goal: a clean repo where everything runs locally with no cloud account and no third-party service. Do not build features yet.

## Step A: Read
Read `CLAUDE.md`, `docs/memory.md`, `docs/rules.md`, `docs/architecture.md` (sections 1, 2, 9, 10, 11, 12) and `docs/tasks.md` (Phase 0). Summarise each in 2 lines and list any question. Do not invent decisions.

## Step B: Plan mode, no code yet
Produce a step-by-step plan for the items below. Each step: files touched, how I verify it (exact command and expected result), size S/M/L. Flag every new dependency for my approval. Then STOP and wait for "go".

## Step C: Build, one step per "go"
1. **Scaffold**: pnpm, Next.js (App Router), TypeScript strict, Tailwind, shadcn/ui, ESLint, Prettier. Pin exact versions. Folder layout from `docs/architecture.md` section 2.
2. **Docker Compose**: `postgres` (named volume, healthcheck) and `mailpit` (SMTP on 1025, UI on 8025). `.env.example` complete; `src/lib/env.ts` validates all env vars with Zod and fails fast.
3. **Prisma** wired to `DATABASE_URL`; one empty baseline migration; `db:migrate`, `db:seed`, `db:reset`.
4. **Scripts**: `db:up`, `db:down`, `db:backup` (pg_dump to `./backups`, gitignored), `db:restore`, `dev`, `dev:lan`, `typecheck`, `lint`, `test`, `e2e`.
5. **Local HTTPS for phone testing**: `dev:lan` binds `0.0.0.0` with local HTTPS via mkcert (verify the current Next.js flag). Document how to install the mkcert root CA on an Android test phone. Never use a public tunnel.
6. **Dockerfile** (multi-stage, non-root, Next.js standalone output) and `/api/health` returning app and DB status. Prove it: build the image, run it against the compose Postgres, hit `/api/health`.
7. **Adapters skeleton** per `docs/architecture.md` section 11: `MailProvider` (SMTP to Mailpit), `SmsProvider` (`ConsoleSmsProvider` that logs and stores to a dev-only table), `FileStorage` (local disk), `EInvoiceProvider` (no-op). Interfaces plus local implementations plus one test each.
8. **Testing setup**: Vitest (unit + integration against a throwaway test database) and Playwright (one smoke test: home page loads).
9. **Quality gates**: Husky or Claude Code hooks per prompt 14 in my pack: after file edits run lint + typecheck; block edits to `.env` and applied migrations; run tests before a session ends. Conventional commit rules from `docs/rules.md`.
10. **CI file** (GitHub Actions or equivalent, optional to run): typecheck, lint, test.
11. Update `docs/tasks.md` Phase 0 boxes and add gotchas to `docs/memory.md`.

## Done when
`docker compose up -d && pnpm install && pnpm db:reset && pnpm dev` works from a fresh clone; `pnpm typecheck && pnpm lint && pnpm test` pass; the Docker image builds and `/api/health` returns OK; a test email appears in Mailpit. Show the real output of each.
