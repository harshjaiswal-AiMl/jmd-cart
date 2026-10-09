# IDMS Phase 1 Security Checklist & Audit Report

**Target Scope:** Phase 1 (Core Distribution Management System)  
**Location:** Saharsa, Bihar  
**Audit Date:** 2026-10-09  
**Status:** PASSED (Phase 1 Ready for Client Demo)

---

## 1. Authentication & Session Security

| Check Item | Status | Verification & Implementation Details |
|---|---|---|
| **Password Hashing** | PASS | Handled via `bcryptjs` with salt work factor of 10 (`src/modules/auth/auth.service.ts`). Passwords never stored in plaintext. |
| **Brute-Force Lockout** | PASS | Database-tracked login failures. Locks accounts for 15 minutes after 5 consecutive incorrect password attempts (`isAccountLocked`). |
| **First-Login Credential Rotation** | PASS | Enforces `mustChangePassword: true` on seeded/admin-created accounts. Blocks system operations until the password is changed. |
| **Session Integrity** | PASS | Auth.js (NextAuth v5) JWT strategy. Cookies configured with `httpOnly: true`, `sameSite: "lax"`, and signed with `AUTH_SECRET`. |
| **Session Invalidation** | PASS | Token expiration configured, server-side JWT verification in `src/middleware.ts`. |

---

## 2. Authorization & RBAC Boundary Enforcement

| Check Item | Status | Verification & Implementation Details |
|---|---|---|
| **Server-Side Route Protection** | PASS | `src/middleware.ts` enforces role prefixes (`/admin` -> `SUPER_ADMIN`, `/godown` -> `SUPER_ADMIN`, `GODOWN`, `/shop` -> `SUPER_ADMIN`, `SHOP`). Unauthorized requests immediately return `HTTP 403 Forbidden` (verified in E2E Test 3). |
| **Server-Side Action Guards** | PASS | Every service mutation calls `assertPermission(role, Permission.*)` (`src/modules/auth/permissions.ts`). UI button hiding is treated strictly as cosmetic. |
| **Discount Authorization Limits** | PASS | Cashiers and Salespersons are restricted to configurable discount thresholds (e.g. 500 bp / 5%). Overages require explicit `SUPER_ADMIN` authorization (`requiresDiscountApproval`). |
| **Financial & Master Master Guards** | PASS | Only `SUPER_ADMIN` can modify company settings, catalog pricing slabs, or cancel sales invoices. |

---

## 3. Stock Ledger Immutability & Concurrency Safeguards

| Check Item | Status | Verification & Implementation Details |
|---|---|---|
| **Database-Level Immutability Trigger** | PASS | PostgreSQL trigger `trg_stock_movements_immutable` actively rejects any SQL `UPDATE` or `DELETE` on `stock_movements` with error code `P0001`. Verified in integration tests. |
| **Non-Negative Stock DB Constraint** | PASS | PostgreSQL table constraint `CHECK (qty >= 0)` on `stock_balances`. Database engine rejects any transaction attempting to draw balance negative with error code `23514`. |
| **Atomic Ledger Posting** | PASS | All movements execute within an explicit `prisma.$transaction()`. Balance updates and immutable movement logs are posted atomically. |
| **Deadlock Prevention** | PASS | Deterministic alphabetical row-locking order (`FOR UPDATE`) across source and destination location IDs prevents concurrent deadlocks. |
| **Race Condition Serialization** | PASS | Verified with parallel race integration test (`tests/integration/stock-concurrency.test.ts`): two concurrent sales racing for the final piece cleanly result in 1 success and 1 rejected with `InsufficientStockError`. |
| **Idempotency Deduplication** | PASS | Unique index on `idempotency_key` ensures retried network calls or duplicate requests do not create duplicate ledger entries. |

---

## 4. Financial & Calculation Integrity

| Check Item | Status | Verification & Implementation Details |
|---|---|---|
| **Zero Float Arithmetic** | PASS | All monetary amounts stored strictly in integer paise (`*_paise`). Tax and discount rates stored in integer basis points (`*_bp`, where 100 bp = 1%). |
| **GST Engine Standardization** | PASS | Unified in `src/lib/gst.ts`. Tax extraction from inclusive MRP uses half-up integer rounding to paise, with CGST and SGST split evenly. Final invoice round-off balances within ±50 paise. |
| **Invoice Gapless Numbering** | PASS | Sequences generated from `sequences` table with pessimistic `SELECT ... FOR UPDATE`. Rollbacks do not burn invoice numbers, and concurrent sales serialize cleanly (`INV/26-27/XXXXXX`). |
| **Invoice Immutability & Cancellations** | PASS | Finalized invoices cannot be edited or deleted. Cancellations require admin action and reason, generating formal Credit Notes (`CN/26-27/XXXXXX`) and counter-movements (`SALE_CANCEL`). |

---

## 5. Input Validation & Injection Prevention

| Check Item | Status | Verification & Implementation Details |
|---|---|---|
| **Boundary Validation** | PASS | All API endpoints and Server Actions validate payloads against strict Zod schemas before processing (`z.string().regex()`, `z.number().int().min()`). |
| **SQL Injection Prevention** | PASS | 100% of queries use Prisma ORM parameterized queries or tagged templates (`Prisma.sql`). Zero string concatenation. |
| **CSV Parser Security** | PASS | Custom RFC 4180 CSV parser rejects malformed quotes, detects delimiters dynamically, and flags row-level validation errors without crashing. |

---

## 6. Audit Logging & Data Privacy

| Check Item | Status | Verification & Implementation Details |
|---|---|---|
| **Audit Trails** | PASS | `auditService.log()` captures actor ID, role, action, entity type, entity ID, metadata, and IP address for all sensitive mutations. |
| **Sensitive Data Masking** | PASS | Automatic recursive scrubbing in `maskSensitiveFields()` redacts passwords, new passwords, secrets, tokens, and authorization headers (`[REDACTED]`), and truncates phone numbers (`******3210`). |
| **Local Data Privacy** | PASS | Zero cloud telemetry, zero SaaS dependencies. All data resides in local PostgreSQL. |

---

## 7. Gaps & Items Deferred to Later Phases

1. **Real Thermal Hardware Verification (Phase 2):**
   - *Current state:* 80mm thermal receipt CSS and monospaced layout validated in browser print viewer (`/shop/invoices/[id]/print?format=thermal`).
   - *Action for Client:* Hardware line-spacing, cutter commands, and ESC/POS Bluetooth pairing require testing on physical printer in shop.
2. **Automated Scheduled Consistency Job (Phase 4):**
   - *Current state:* Nightly ledger audit function `runNightlyStockAudit()` is implemented, verified by test, and executable via CLI script.
   - *Action for Phase 4:* Hook into system cron or OS Task Scheduler when production server hosting is configured.
3. **Local HTTPS for Phone Testing (Phase 2):**
   - *Current state:* Desktop browser testing complete.
   - *Action for Phase 2:* `dev:lan` with `mkcert` root CA installation on Android phones for Van PWA testing.
