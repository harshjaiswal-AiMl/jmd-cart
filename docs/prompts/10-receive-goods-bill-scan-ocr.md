# PROMPT #10 — Receive goods by scanning the supplier bill (offline OCR) → draft list → warehouse count & verify → Done adds stock (looping, self-verifying)

Save as `docs/prompts/10-receive-goods-bill-scan-ocr.md` and paste everything below the line to the agent. **Do not create new doc files.** Update existing `docs/*.md` in place. Run this **after** Prompt #09.

---

## ROLE
You are the engineer adding a **"Receive Goods" flow** to JMD Cart (Next.js 14 App Router, Prisma, Postgres, Cloud Run + Cloud SQL, Cloudflare R2 storage). When a company's delivery arrives with its bill, the godown keeper **photographs the bill**, the system **reads it with offline OCR** and shows the products and quantities as a **draft list**, the keeper **counts the physical goods against that list**, and on **Done** the stock is added. OCR is never trusted blindly: **stock only ever changes from the keeper's confirmed counts.** "Done" means built, run with real-looking bills, measured, deployed and verified.

Follow `CLAUDE.md` and `docs/rules.md`. Migrations are **additive only**. **Never open, print or log `.env`, `.env.deploy` or any secret.** Management UI keeps its current look, mobile-first for the godown keeper's phone.

## NON-NEGOTIABLE RULES
1. **Offline OCR only.** No cloud OCR/AI API, no CDN, no runtime downloads. Language data is vendored in the repo/image. OCR sits behind an `OcrEngine` adapter so another engine could be plugged in later (not now).
2. **No silent errors.** Any value that is low-confidence, fails an arithmetic check, or has no confident product match is flagged for a human. Never auto-correct a number silently; offer suggestions.
3. **Stock changes only from confirmed counts**, through the **existing** purchase/GRN service (stock ledger, supplier ledger, audit). Do not re-implement accounting or stock logic.
4. **Posting is idempotent.** Double-click, retry or two devices must never add stock twice.
5. **Bills are private business documents.** Store them in R2 under a private prefix (`bills/…`) and serve only through an authenticated, role-checked route, never through the public `/media` route.
6. The feature must be **useful even if OCR is poor**: a manual-assist mode (bill image beside a fast line-entry form) must always work.

## STEP 0 — PREREQUISITES AND READING
Verify Prompt #09 is complete: R2 `StorageAdapter` + `mediaUrl`, brands linked as supplier parties (`Party.companyId`), `sharp` available. **If not, stop and print `PROMPT 10 BLOCKED: run Prompt #09 first`.**
Read `CLAUDE.md`, `docs/memory.md`, `tasks.md`, `rules.md`, `prisma/schema.prisma` (Purchase, PurchaseItem, Party, DebitNote, StockMovement, Product, Company), `src/modules/purchase/*`, `src/modules/stock/*`, `src/modules/party/*`, `src/app/godown/purchases/*`, `src/modules/storage/*`, `src/lib/nav.config.ts` (or the nav config), `src/modules/audit/*`, `Dockerfile`, `next.config.mjs`, `scripts/deploy-gcp.ps1`.

## STEP 1 — HUMAN INPUTS (ask ONCE in one message, then continue)
1. **Dependency approval (one batch):** `tesseract.js` (WASM OCR, no native binary), `pdfjs-dist` (read the text layer of digital PDFs), optionally `@napi-rs/canvas` (rasterize scanned PDFs), a small fuzzy-match helper (or write it in-house). `sharp` already approved in #09. Propose exact versions and sizes; if refused, propose the smallest alternative.
2. **Sample bills (the most important input):** 15 to 20 real supplier bills (photos taken the way the keeper will take them, plus any PDFs) from the real suppliers (Bikaji, MDH, India Gate, Engine, Saloni, Dawat…), saved in a **git-ignored** folder `ocr-samples/` (they contain business data). For at least 8 of them the owner provides the correct line items (name, qty, unit, rate) as a simple Excel/CSV so you can measure accuracy. Without real samples you may build synthetic bills for regression only; **accuracy claims must come from real bills.**
3. **Language:** English only, or English + Hindi (Hindi data adds size and time). Default English.
4. **Accounting default to confirm:** purchase value posted = **accepted (counted) qty × bill rate (+GST)**, with the supplier's printed bill total stored separately and the difference shown as shortage value. The owner/accountant may change this.

## STEP 2 — DATA MODEL (additive migrations)
- `BillScan(id, supplierPartyId?, companyId?, locationId, status DRAFT|COUNTING|READY|POSTED|CANCELLED, imageKeys[], sourceType IMAGE|PDF_TEXT|PDF_SCAN|MANUAL, ocrEngine, ocrDurationMs, ocrConfidence, billNo, billDate, billTotalPaise, parsedJson, createdBy, createdAt, postedAt, purchaseId?, idempotencyKey)`
- `BillScanLine(id, scanId, lineNo, rawText, parsedName, hsn, billedQty, billedUnit CS|PCS|…, billedQtyPieces, ratePaise, gstRateBp, amountPaise, productId?, matchConfidence, matchStatus SUGGESTED|CONFIRMED|UNMATCHED|EXTRA, countedCartons, countedLoose, countedPieces, variance NONE|SHORT|EXCESS|DAMAGED|NOT_RECEIVED|EXTRA, varianceReason, flags[], confirmedAsBilled)`
- `SupplierItemAlias(companyId, normalizedBillText, productId, timesConfirmed, lastUsedAt)` unique on (companyId, normalizedBillText).
- Additive columns on `Purchase`/`PurchaseItem` for `billScanId`, `billedQty`, `acceptedQty`, `varianceReason`, `billTotalPaise` as needed.
- Settings keys: `receiving.blindCount` (default off), `receiving.approvalThresholdPaise` (default off), `receiving.ocrLanguages`.

## PART A — Ingestion, storage, private access
1. Upload endpoint for 1 to 10 images or one PDF per bill: magic-byte validation, max size, max pixel dimensions, rate limit, roles ADMIN/SUPER_ADMIN/GODOWN only. Client side: camera capture (`<input accept="image/*" capture="environment">`), multi-photo, downscale/compress before upload (long edge about 2000 px, about 1.5 MB), keep EXIF orientation.
2. Store originals as re-encoded WebP/JPEG under `bills/<hash>/<page>.webp` in R2 via the existing adapter (private). Serve through `GET /api/bills/[scanId]/image/[page]` with auth + role check + audit; never public, never cached publicly. Retention: no auto-delete; document that retention follows the owner's/accountant's policy.
3. Resumable: a scan survives page reloads and can be continued on another device. Lock so two people cannot count the same scan at once (soft lock with takeover for admin).

**Gate A:** unauthenticated and SHOP-role requests to bill images are rejected, SVG/spoofed files rejected, storage works with the in-memory adapter in tests and R2 in production config.

## PART B — OCR engine
1. **PDF with a text layer:** extract text and word positions with `pdfjs-dist` (no OCR needed, highest accuracy). **Scanned PDF or image:** preprocess with `sharp` (orientation, grayscale, normalize, resize to a bounded size, adaptive threshold, simple deskew via projection profile), then run `tesseract.js` with vendored `eng` (and `hin` if chosen) data and page segmentation suited to tables. Capture **word boxes with confidences** (TSV/HOCR), not just plain text.
2. Never download language data at runtime. Vendor the files with checksums, and make sure they are included in the Next standalone output (`outputFileTracingIncludes`) and the Docker image; add a startup self-check.
3. Resource safety: one OCR at a time per instance (semaphore), bounded image size, a hard timeout with a clear error, worker threads so the web server stays responsive. Run it as a status-tracked job (`QUEUED → PROCESSING → READY|FAILED`) so the phone UI shows progress and survives reloads. Size the Cloud Run service for it if needed (memory ≥ 2 GiB, 2 vCPU, request timeout ≥ 300 s, CPU boost) and **measure real timings** (record p50/p95 per page in `docs/memory.md`).
4. Failure never blocks the user: on OCR failure or very low confidence, drop straight into **manual-assist mode**.

**Gate B:** unit tests with recorded OCR fixtures; integration tests with real `tesseract.js` on synthetic bill images (marked slow); text-layer PDF path tested; timeouts and failure fall back to manual-assist.

## PART C — Table parser (the hard part; geometry first, text second)
1. Rebuild rows and columns from **word-box geometry** (cluster by y for rows, by x for columns). Detect the item table by header keywords and variants: `Description|Item|Particulars|Product`, `HSN`, `Qty|Quantity|Cases|CS|Pcs`, `Unit|UOM`, `Rate|Price|MRP`, `Amount|Value|Total`, `GST|CGST|SGST|IGST`. Tolerate multi-line item names, wrapped rows, merged cells, tilted pages, multi-page bills with repeated headers, and the totals block.
2. Extract header fields: supplier/brand name (cross-checked against the Company list), GSTIN, bill number, bill date (multiple Indian formats), bill total, tax totals.
3. **Units:** detect whether quantity is in cases/cartons or pieces (column header, unit column, patterns like `10 CS`, `10 CTN`, `10 Pc`). Convert to pieces using the product's pack size. If ambiguous, flag the line and default to the unit shown on the bill.
4. **Arithmetic validation:** per line `qty × rate ≈ amount` (tolerance for rounding/discount columns), `sum(lines) ≈ taxable total`, GST per line vs HSN master. Failures set flags; suggestions may be offered ("did you mean 10?") but are never applied silently.
5. Output a structured `parsedJson` with a confidence per field and per line.
6. **Accuracy harness** `scripts/ocr-eval.ts`: runs the real samples against the owner's ground-truth files and prints per-supplier line-detection rate, quantity-exact rate, unit accuracy, header-field accuracy, and the share of wrong values that were **flagged** (this last number is the safety metric and must be 100% on the evaluation set). Targets on real bills: ≥ 90% of bill lines detected, ≥ 90% exact quantities on detected lines, 100% of wrong values flagged. Tune the parser per supplier layout using **generic rules plus optional per-supplier parsing hints** (stored in settings), not hard-coded hacks. Report honest numbers; if a target is missed, say so and show which suppliers/layouts fail.

**Gate C:** parser unit tests (header variants, column geometry, multi-page, units, arithmetic flags, date formats), accuracy report committed to `docs/memory.md`.

## PART D — Product matching and learning
1. Candidates are limited to the **supplier brand's products** (large accuracy gain). Score by normalized token-set similarity on name + parsed weight/pack size (`110gm*180pc`, `50g`, `1 LTR`) + HSN + previous rate proximity.
2. `SupplierItemAlias` first: an exact alias hit pre-selects the product (`SUGGESTED`). ≥ 0.9 similarity = suggested, 0.6 to 0.9 = shortlist of top 3, below 0.6 = `UNMATCHED`. **Nothing is auto-confirmed.** Confirming a match (explicitly or by completing the receipt) upserts the alias so the same text matches next time.
3. Unmatched line options: pick a product from a searchable list (brand-filtered, with "all products"), or **create a new product** via a quick form (name, pack size, HSN, GST) that follows the existing product rules, or mark "not for stock".
4. Detect duplicates: same supplier + same bill number already posted/in progress → block with a link to the existing receipt.

**Gate D:** matching tests on realistic names (abbreviations, `*` pack notation, spelling variants), alias learning across two receipts, brand filtering, duplicate-bill block.

## PART E — Screens (mobile-first, existing management look)
Sidebar item **Inventory → Receive Goods (Scan Bill)** plus a list of receipts (In progress / Posted / Cancelled) with filters.
1. **Scan:** camera capture, multi-page thumbnails, retake/reorder, supplier auto-detected (editable), "Upload" → progress → draft.
2. **Review draft:** split view (zoomable bill image + parsed lines). Each line shows flags (low confidence, arithmetic mismatch, unit unclear, unmatched). Edit name/qty/unit/rate, fix match, add missed lines, delete junk lines. Totals panel compares parsed total with the bill total.
3. **Count & verify:** per line: billed qty (hidden when `receiving.blindCount` is on), counted **cartons + loose** with steppers (no barcode scanner needed), live piece total, status chip (MATCH / SHORT / EXCESS), "All as per bill" shortcut (disabled in blind mode, logged as `confirmedAsBilled`), progress "7 of 12 lines counted". Extra items not on the bill can be added.
4. **Done rules:** enabled only when every line has a count (zero allowed with a reason) and every variance has a reason. If every line matches, Done posts immediately. If there are variances, show a summary (short/excess/damaged values) and post the **accepted counted quantities**; optionally create a **debit note draft** for shortages using the existing `DebitNote` flow (inspect it; do not invent accounting). If `approvalThresholdPaise` is exceeded, posting waits for an admin approval.
5. **Posting:** one transaction through the existing purchase service: stock IN at the godown for **accepted pieces**, supplier ledger entry, purchase record linked to the scan, audit log, bill images attached. Idempotency key + status check so repeats are harmless. Purchase value = accepted qty × bill rate (+GST) unless the owner changed the default; printed bill total and shortage value stored and shown. Never change selling prices automatically; flag purchase-rate jumps versus the last purchase.
6. **Manual-assist mode:** bill image on one side, fast keyboard line entry (product search by name/short code/brand, qty, unit, rate) on the other, then the same Count & verify and Done.
7. Receipts list shows who scanned, who counted, timings, variances. Everything audit-logged.

**Gate E:** Playwright e2e on a 360 px viewport and desktop: scan synthetic bill → draft → fix an unmatched line → count with one shortage → Done → stock in godown equals accepted pieces, supplier ledger correct, debit note draft created, images private; second Done click adds nothing; blind mode hides billed qty; manual-assist works with OCR forced to fail.

## PART F — Tests that must stay green
Idempotent posting under concurrent Done requests; stock ledger invariants unchanged (never negative, ledger sum = balances); posted purchase identical in effect to the existing GRN for the same accepted quantities; role matrix (SHOP and storefront roles cannot access; GODOWN, ADMIN, SUPER_ADMIN can); private image access; state machine transitions; resumable and locked scans; alias uniqueness; no network calls to any external host during OCR or matching; existing `purchase-grn` and stock tests still pass.

## PART G — Deploy and verify on production
1. Include OCR assets in the build, set Cloud Run resources/timeout as measured, run the additive migration through the existing migration job, deploy with `scripts/deploy-gcp.ps1`, extend `scripts/smoke-prod.ts` (OCR self-check endpoint for staff only, bill-image route returns 401/403 unauthenticated).
2. With the owner's go-ahead, run one real bill through production end to end on a test supplier/product set, confirm the timings, confirm stock and ledger, then cancel/reverse the test receipt through the proper flow. Roll back automatically on smoke failure.
3. Report p50/p95 OCR seconds per page in production and the accuracy table from real bills.

## PART H — Docs
Update in place: `docs/architecture.md` (OCR pipeline, adapter, private bill storage, resources), `docs/rules.md` (offline OCR rule, bills private, idempotent posting, no silent corrections), `docs/design.md`, `docs/tasks.md`, `docs/memory.md` (accuracy numbers, timings, decisions, open items, per-supplier hints).

## LOOP (follow strictly)
```
for each PART (A → H):
  plan → write tests → build → run: pnpm typecheck; pnpm lint; pnpm test; pnpm build
  → run the app on a 360px viewport and desktop, exercise the flow with real sample bills, screenshot
  → if anything fails: root-cause it, fix, rerun from the top
  → proceed only when the gate is fully green and demonstrated
```
- Never claim success without running the check and reading its output; quote key results in `docs/memory.md`.
- Never weaken or delete a failing test, never loosen the "100% of wrong values flagged" bar, never auto-apply OCR output to stock, never expose bill images publicly.
- Same failure 5 times: write hypotheses and evidence in `docs/memory.md`, then try a different approach. Ask the human only after 3 different approaches fail, with the exact error.
- When blocked on a human action (sample bills, approvals, ground-truth files), print `WAITING_FOR_HUMAN: <what>` with exact steps and keep working on everything that does not depend on it.
- Local tests use the isolated test DB. Never run destructive scripts against production.

## FINISH
Only when all gates pass, print exactly:

`PROMPT 10 COMPLETE — OCR PASS — verify/count PASS — idempotent posting PASS — production PASS`

then: accuracy table from real bills (per supplier), flagged-error coverage, OCR timings p50/p95, suppliers or layouts that still need manual-assist, new tables/routes, settings added, open items (accounting default confirmation, retention policy, Hindi data, per-supplier hints). If you cannot reach that state, print `PROMPT 10 BLOCKED` with the exact blocker.
