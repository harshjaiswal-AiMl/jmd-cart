# 99 Deploy: only after hosting is chosen (paste into Claude Code)

Use this once the owner and client have picked a host and opened accounts in the client's name. Fill the brackets first.

Host: [VPS with Coolify / Railway Pro / DigitalOcean / Fly.io / other]. Region: [REGION]. Domain: [DOMAIN]. SMTP for email: [SMTP HOST/PORT, or none].

## Step A: Read
`CLAUDE.md`, `docs/memory.md`, `docs/architecture.md` (sections 8, 9, 10, 11), `docs/rules.md`, `docs/tasks.md` (Phase 4). Summarise the portability rules and list questions.

## Step B: Plan mode, no changes
Produce a deployment plan: environments (staging then prod), env var list, how migrations run (`pnpm db:migrate:deploy` as a separate step), jobs/cron for `job:release-reservations` and the nightly stock-consistency check, SMTP configuration, domain and SSL, backups with an off-site copy, monitoring/health checks, rollback. State clearly what only I can do (accounts, DNS, card payment). Flag any change to application code (there should be none). Stop and wait for "go".

## Step C: Execute one step per "go"
1. Provision and harden the server or project (firewall, SSH keys, non-root, automatic security updates) per the chosen host.
2. Deploy staging from the Docker image; run migrations; seed only reference data; check `/api/health`.
3. Configure SMTP, jobs, backups; run a restore drill on staging.
4. Smoke-test staging with the Playwright suite and a manual phone test (PWA install, Bluetooth printing needs HTTPS on the real domain).
5. Production deploy with the owner's approval; import real data only through the migration kit; run the parallel-run report daily.
6. Write the runbook: deploy, rollback, backup, restore, who to call.

## Constraints
Never use a platform-specific SDK. No secrets in git. No real client data outside the production host and the backup location the owner approved.

Begin with Step A.
