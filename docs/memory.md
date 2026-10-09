# Memory: IDMS project context

Read this first in every session. Keep it current: add decisions and gotchas as they happen.

## Project
- **What**: Web-based distribution system for an FMCG business in Saharsa, Bihar: inventory (godown, shop, 2 vans), shop POS and GST billing, van sales, credit, accounts support, and an online store for customers, retailers and wholesalers. Super admin has full access.
- **Client**: Sachin Prakash, Saharsa. **Developer**: Harsh Jaiswal (solo, using AI agents).
- **Final delivery date**: 15 Nov 2026, then a 2-3 week parallel run. Contract: development + 12-month AMC; infrastructure costs are the client's.
- **Scale**: 900+ products (Bikaji, MDH, India Gate, Engine and more), about 10 staff (2 each: godown, shop, van, delivery, accounts), 2 vans, 1 shop, 1 godown.

## Confirmed decisions
- Quantity-only stock; no batch/expiry in v1 (schema batch-ready).
- Every product has a pack size; loose stock lives in the shop, packs in the godown; carton break moves godown -> shop.
- Prices = % discount off MRP by quantity slab; buyer type auto-tagged by quantity; admin adds % order discount.
- Credit only for parties already in client's Tally; cash and credit both allowed.
- One invoice series for shop and van. Bill edit/cancel Admin-only.
- Returns only to companies (stock-wise report). No market returns.
- Delivery by own vans, Saharsa town first; free above Rs 2,000 in town, above Rs 5,000 beyond 5 km; charges below those set by admin, editable anytime.
- Van cash goes to the owner and is confirmed in-system.
- UI in English; thermal printer exists; no barcode scanner; web app only (PWA for van/delivery).
- Accounting: everything except P&L and Balance Sheet; Tally stays for final accounts; system exports to Tally.
- Client is GST registered with FSSAI; turnover likely requires e-invoice. GSP credentials pending.

## Technical decisions
- Next.js + TypeScript + PostgreSQL + Prisma + Tailwind/shadcn; Auth.js credentials; Vitest + Playwright; pnpm.
- **Local-first**: build and demo everything locally (Docker Compose: Postgres + Mailpit). Hosting is undecided and will be chosen before Phase 4. No Vercel.
- **No third-party dependencies to build**: email via SMTP adapter (Mailpit locally), SMS via console adapter (real gateway later, off by default), auth and verification logic written in-house.
- Hosting candidates: Indian VPS + Coolify (Hostinger Mumbai KVM 2: 2 vCPU, 8 GB, Rs 799/mo intro, Rs 1,199/mo renewal), Railway Pro (USD billing, Singapore), DigitalOcean Bangalore, Fly.io Mumbai. Regular shared hosting would force MySQL, so it is not planned.
- Stock in integer pieces; immutable movements; balances maintained in same transaction.
- Money in integer paise; percentages in basis points; MRP tax-inclusive (verify with CA).
- Van billing needs data to finalize (server issues invoice number); local drafts on network loss.

## Assumptions to confirm with client
1. Slab applies per line quantity; order buyer tag = highest tier among lines.
2. Online payment modes and whether credit parties may order on credit online (answer was unclear: "both nope").
3. Delivery charge below thresholds.
4. Invoice format `INV/26-27/000001`, FY reset in April.
5. Store name and domain.

## Inputs still needed from client
- [ ] Product list: name, company, HSN, GST %, MRP, pack size (+ photos if any)
- [ ] Credit parties + opening outstanding (Tally export)
- [ ] GSTIN, FSSAI, legal name, address, logo, bank details
- [ ] Hosting + domain accounts in client's name (only after hosting is chosen; not needed to build)
- [ ] GSP credentials (via CA)
- [ ] Slab values and discount percentages

## Gotchas
- Tally credit list is the allow-list for credit; do not auto-grant credit to new parties.
- Shop and van share one invoice series, so numbering must be server-assigned and gapless.
- Online orders can need loose stock from the shop AND packs from the godown in one order.
- Real printer and Android testing is mandatory; AI cannot do it.
- PWA and Web Bluetooth need HTTPS or localhost. Testing on a phone over Wi-Fi needs local HTTPS (mkcert) and the root CA installed on the phone.
- Never use public tunnel services for demos; use the shop Wi-Fi.

## Session notes
- 2026-10-09: Scaffolding completed. Node.js v24 LTS and pnpm v12 configured in user scope. Portable PostgreSQL 16.4 cluster initialized and running on localhost:5432 with database `idms` and user `postgres`. Created `/api/health`, `src/lib/env.ts` with Zod validation, multi-stage Dockerfile, `docker-compose.yml`, backup/restore PowerShell scripts, Tailwind design tokens, and Vitest test harness. All typecheck, lint, and unit tests passing green.
