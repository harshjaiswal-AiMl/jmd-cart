# PRD: Integrated Distribution Management System (IDMS)

Status: v1.0 | Owner: Harsh Jaiswal | Client: Sachin Prakash, Saharsa, Bihar | Final delivery date: **15 Nov 2026**
Source of truth for WHAT we build. HOW lives in `architecture.md`. Rules in `rules.md`.

## 1. Problem
An FMCG distributor in Saharsa runs one shop and one godown with 900+ products (Bikaji, MDH, India Gate, Engine and more) and two vans that go out daily. Stock, billing and collections are tracked in Tally and on paper, so real stock is unclear, van returns are unreconciled, and the business has no online ordering. The owner wants one web system for stock, billing, van sales, credit, accounts support and an online store.

## 2. Goals and success metrics
- Stock at godown, shop and each van is correct within 1 working day, with every movement traceable.
- Every van day closes with a reconciliation (issued - sold = expected vs counted) and cash handover to the owner.
- A shop bill takes under 60 seconds for a 5-item sale without a barcode scanner.
- Credit is given only to approved parties, within limit.
- Retailers and wholesalers can order online; orders fulfil from shop (loose) and godown (packs) with one invoice.
- 2-3 week parallel run ends with daily system stock matching physical count.

## 3. Users and roles
| Role | Count | Device | Core jobs |
|---|---|---|---|
| Super Admin (owner) | 1 | PC/phone | Everything, approvals, settings, reports |
| Godown staff | 2 | PC | Receive stock, transfers, carton break, van issue/return, return to company, pick orders |
| Shop staff | 2 | PC | POS billing, daily cash close |
| Van salesperson | 2 | Android | Bill, print, collect, daily summary |
| Delivery staff | 2 | Android | Deliveries, collect payment |
| Accounts | 2 | PC | Ledgers, receipts/payments, GST reports, Tally export |
| Customer / Retailer / Wholesaler | online | phone/PC | Browse, order, track, reorder |

UI language: English. About 5 staff have Android phones; van and delivery staff need them.

## 4. Scope by phase
- **Phase 0** Setup: repo, accounts, data collection, schema.
- **Phase 1 Core**: auth + roles + audit log; product master + Excel import; stock ledger; locations; purchase/GRN; godown module; shop POS; GST invoice (A4 + 80mm print); basic stock and sales reports.
- **Phase 2 Van and credit**: van issue/return, mobile billing + Bluetooth print, collections, credit limits, outstanding/ageing, reconciliation, cash handover.
- **Phase 3 Ecommerce and delivery**: store, dynamic pricing, orders, split fulfilment, delivery zones and charges (Saharsa town), delivery module.
- **Phase 4 Polish**: reports, dashboard, Tally export, e-invoice connection, training, fixes, deploy.

## 5. Business rules (confirmed by client)
1. **Stock** is tracked by quantity only. No batch/expiry in v1 (schema stays batch-ready).
2. **Units**: every product has a pack size (pieces per carton/bag). Loose pieces are sold from the shop; cartons/bags from the godown. **Carton break** converts a carton into loose pieces at the shop.
3. **Pricing**: base = MRP. Retailer and wholesaler get a **percentage discount off MRP**. Price changes dynamically with order quantity (slabs). Buyer type (Customer/Retailer/Wholesaler) is **auto-tagged from quantity**. Admin can apply an additional % order discount. Slab values are set by admin, not hardcoded.
4. **Credit**: only for retailers/wholesalers already on the client's Tally credit list. Cash and credit both supported. Everyone else pays at sale.
5. **Invoices**: shop and van share **one invoice series**. GST invoices with HSN. Bill edit/cancel by **Admin only**, with reason and audit entry; cancellation of a finalized bill creates a credit note.
6. **Returns**: only stock returned **to companies** (stock-wise return report with reason). No market returns.
7. **Delivery** (online): own vans, Saharsa town first, district later. Default: town free above Rs 2,000; beyond 5 km free above Rs 5,000; charges below thresholds set by admin at any time.
8. **Van cash** is handed to the **owner** each evening and confirmed in the system.
9. **Accounting**: ledgers, cash/bank book, day book, registers, vouchers, GST reports, Tally export. P&L and Balance Sheet stay in Tally.
10. **Compliance**: client is GST registered with FSSAI. Turnover is high enough that e-invoice (IRN/QR) likely applies; integration happens once client supplies GSP credentials.
11. No barcode scanner. Billing is search-first, with images, favourites and recents.
12. Client owns hosting/domain/third-party accounts. Infrastructure costs are outside the project. **Development is local-first; hosting is chosen later** and must not require code changes (see architecture sections 9-10).
13. Verification is built in-house: staff accounts are admin-created; buyers sign in with phone + password; phone verification is by admin call by default, with SMS OTP available later through an adapter that is off by default.

## 6. Phase 1 user stories and acceptance criteria
**US-1 Login and roles.** As staff I log in and see only my role's screens.
- Staff accounts are created by the Super Admin; first login forces a password change.
- Wrong password is rejected; repeated failures lock the account briefly; sessions expire; every role-restricted route and API returns 403 for other roles.

**US-2 Product master.** As admin I manage products and import them from Excel.
- Import accepts name, company, category, HSN, GST %, MRP, pack size; shows row-level errors; is re-runnable without duplicates; 900+ rows import in under 30 seconds.
- Product search finds by name, company or short code in under 300 ms.

**US-3 Receive stock.** As godown staff I record a purchase against a company.
- Stock appears in godown instantly; a purchase can be viewed with its movements.

**US-4 Transfer and carton break.** As godown staff I move stock godown to shop and break cartons.
- Quantities are stored in pieces; carton break converts cartons x pack size into loose pieces at shop; negative stock is impossible.

**US-5 Stock view.** As anyone with permission I see stock by location with a full movement history per product.

**US-6 Shop POS.** As shop staff I bill a walk-in or existing party.
- Search-first add-to-bill, quantity edit, price slab applied, GST computed, hold/resume, cash/UPI/split payment, finalize creates invoice, deducts shop stock, prints A4 or 80mm.
- Discount above the role's limit needs owner approval.

**US-7 Invoice integrity.** Finalized invoices are immutable. Numbers follow one gapless series per financial year. Admin cancel creates a credit note and returns stock.

**US-8 Audit.** Every price, discount, bill, stock and settings change is logged with who/when/before/after.

**US-9 Basic reports.** Stock by location, low stock, daily sales, day-end cash.

## 7. Later phases (summary stories)
- Van: morning issue sheet, offline-tolerant billing, evening count, shortage/excess, cash handover.
- Credit: limit and days per party, block on breach with owner override, collections, ageing, statements.
- Ecommerce: OTP signup, catalogue, live slab pricing, delivery zone check, order tracking, reorder, split pick lists, one invoice, delivery assignment and proof.
- Accounts: GST reports, Tally voucher export, day book, registers.

## 8. Non-goals (v1)
Batch/expiry, company scheme claims, P&L/Balance Sheet, GPS, native apps, barcode scanner, multi-branch operation (schema-ready only), district delivery, online payment gateway (build the switch, keep it off).

## 9. Open questions (see memory.md for status)
1. Online payment modes for orders (COD, UPI on delivery, gateway) and whether credit parties may order on credit online.
2. Slab thresholds and discount percentages for Customer/Retailer/Wholesaler. Is slab per line quantity or per order quantity? Default assumed: per line quantity; order tag = highest tier among lines.
3. Delivery charge below the free thresholds.
4. Invoice number format and prefix (default: `INV/26-27/000001`, resets each April).
5. Is MRP tax-inclusive for all items (assumed yes: tax extracted from inclusive price)? Confirm rounding with CA.
6. Store name and domain.
7. GSP choice and credentials for e-invoice/e-way bill.
8. Hosting: undecided. Decide before Phase 4 deployment (candidates in architecture section 10).
9. Phone verification mode for buyers: `admin` by default; confirm with client.
