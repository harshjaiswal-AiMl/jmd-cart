# IDMS Phase 2 Client Demo Script: Van Distribution & Credit Control

**Project:** Integrated Distribution Management System (IDMS)  
**Target Audience:** FMCG Business Owner (Harsh), Accounts & Route Sales Team, Saharsa, Bihar  
**System Target Date:** 3 Nov 2026 (Phase 2 Delivery Milestone)  
**Demo Duration:** ~30-35 Minutes

---

## 1. Demo Setup & Preparation

### Prerequisites
- Laptop / Tablet running IDMS server (`http://localhost:3000` or local network IP).
- Android Mobile Phone running Chrome with PWA installed or navigated to `/van`.
- Handheld Bluetooth Thermal Printer (58mm or 80mm) paired or ready for pairing via Web Bluetooth.
- Seeded test data: Central Godown inventory, Van vehicle `BR-19-V-1234`, and active retail debtor accounts (*Maa Durga Kirana Store*, *Gupta Ji General Store*).

### Demo User Accounts
| Role | Phone | Password | Starting Workspace |
|---|---|---|---|
| **Super Admin (Owner - Harsh)** | `9876543210` | `admin123` | `/admin` |
| **Godown Manager** | `9876543211` | `godown123` | `/godown/van-issues` |
| **Van Salesperson (Ramesh)** | `9876543213` | `van123` | `/van` |
| **Accounts / Cashier** | `9876543214` | `accounts123` | `/admin/reports?tab=ageing` |

---

## 2. Interactive Walkthrough Script

### Act 1: Tally Debtor Import & Live Credit Balances (3 Mins)
* **Goal:** Demonstrate seamless migration of existing retailer ledger balances from Tally into IDMS with strict credit rules.
1. Log in as **Super Admin** (`9876543210` / `admin123`).
2. Navigate to **Party Master** (`/admin/parties`).
3. Show Party List with live calculated outstanding balance (`sum(debit) - sum(credit)`), credit limit, credit days, and credit active toggle.
4. Click **Import Parties from Tally** (`/admin/parties/import`).
5. Demonstrate pasting standard Tally CSV ledger rows (`Ledger Name`, `Parent`, `Credit Limit`, `Credit Period`, `Opening Balance Dr/Cr`).
6. Click **Import Parties**:
   - Highlight instant row-level parsing and validation.
   - Show automatic opening balance ledger entries (`LedgerKind.OPENING_BALANCE`).
   - Confirm debtor *Maa Durga Kirana* now has credit limit ₹50,000, 15 days credit, and ₹12,500 opening debit.

---

### Act 2: Morning Van Dispatch & Gapless Load Sheet (4 Mins)
* **Goal:** Show Godown supervisor loading a van with cartons and printing a formal dispatch sheet with dual sign-off.
1. Switch to **Godown Manager** (`9876543211` / `godown123`).
2. Navigate to **Van Dispatch & Load Sheets** (`/godown/van-issues`).
3. Click **Issue Stock to Van** (`/godown/van-issues/new`).
4. Select Vehicle (`Van 1 - BR-19-V-1234`) and Salesperson (`Ramesh Kumar`).
5. Add items to dispatch:
   - *Parle-G 100g*: 5 cartons (720 packs).
   - *Tata Tea Premium 250g*: 2 cartons (96 packs).
   - *Saloni Mustard Oil 1L*: 4 cartons (48 bottles).
6. Click **Dispatch Van**:
   - Sequential load sheet number generated atomically: `VIS/26-27/000001`.
   - Inventory deducted from Central Godown and transferred directly to Van 1 location (`MovementType.VAN_ISSUE`).
7. Open **A4 Print Load Sheet** (`/godown/van-issues/[id]/print`):
   - Review formal warehouse dispatch layout with Carton and Loose Unit breakdowns, MRP valuation, and dual signature blocks for **Godown In-Charge** and **Driver / Salesperson**.

---

### Act 3: Van PWA Handheld Experience & Offline Drafts (4 Mins)
* **Goal:** Show the mobile-first salesperson experience on phone, including zero network disruption during rural route sales.
1. Log in on mobile or mobile-viewport browser as **Salesperson** (`9876543213` / `van123`).
2. Automatic redirection lands directly on `/van`.
3. Highlight mobile app shell:
   - PWA Install prompt and offline Service Worker caching.
   - Live **Online / Offline** status pill in the header.
   - Fixed thumb navigation tabs: **Van Stock**, **New Bill**, **Invoices**, **Collections**, **Day End**.
4. Open **Van Stock** tab:
   - Live stock loaded on vehicle with instant carton + loose piece conversions and total on-van MRP valuation.
5. Demonstrate Offline Draft Resilience:
   - In Chrome DevTools, toggle network to **Offline** (simulating rural bad coverage in Simri Bakhtiarpur).
   - Tap **New Bill** (`/van/billing`), add 20 packs of *Parle-G* for *Gupta Ji General Store*.
   - Tap **Save Draft / Finalize**:
     - System safely queues the order locally in IndexedDB (`idempotency_key` preserved).
     - Network indicator shows amber "Offline - Draft Saved".
   - Toggle network back to **Online**:
     - System auto-syncs the bill without duplicate numbering or stock loss.

---

### Act 4: On-Route Spot Billing & Bluetooth Thermal Receipt (4 Mins)
* **Goal:** Execute on-the-spot invoice generation and physical Bluetooth ESC/POS printing for a shopkeeper.
1. On `/van/billing`, select retailer *Maa Durga Kirana*.
2. Add items:
   - *Parle-G 100g*: 24 pcs.
   - *Tata Tea Premium 250g*: 12 pcs.
3. Review dynamic quantity slab pricing and auto-applied wholesale discount.
4. Choose Payment Mode: **Cash** (₹1,500).
5. Click **Finalize Invoice**:
   - Locked FY invoice generated: `INV/26-27/000015`.
   - Van inventory deducted immediately (`MovementType.SALE`).
6. Click **Print via Bluetooth Printer**:
   - Web Bluetooth modal discovers handheld printer (e.g., *MPT-II / POS-58*).
   - Encodes binary ESC/POS stream with clean Hindi/English text formatting, ₹ amounts, and tear feed.
   - Hand the printed 58mm/80mm thermal slip to the retailer.

---

### Act 5: Credit Limit Enforcement & Owner Remote Override (4 Mins)
* **Goal:** Demonstrate hard financial controls preventing salespersons from giving unauthorized credit to defaulting shops.
1. In `/van/billing`, select debtor *Maa Durga Kirana*.
2. Add high-value items (e.g., 10 cartons of Mustard Oil = ₹45,000).
3. Toggle payment mode to **Customer Credit**.
4. Tap **Finalize Invoice**:
   - System **BLOCKS** the transaction with red modal:
     - *“Credit Limit Exceeded: Current Outstanding ₹48,000 + Bill ₹45,000 exceeds ₹50,000 Limit.”*
5. Salesperson calls Owner (Harsh) for approval:
   - Tap **Request Owner Override**.
   - Owner enters credentials (`9876543210` / `admin123`) and mandatory reason: *“Seasonal Diwali advance approved by Harsh.”*
   - Invoice successfully finalized with audit badge `CREDIT_OVERRIDE` and owner user ID recorded permanently in database.

---

### Act 6: Route Cash & UPI Payment Collections (3 Mins)
* **Goal:** Collect pending debt payments on route, update debtor ledger immediately, and print collection receipts.
1. Tap **Collections** tab (`/van/collections`).
2. Search for *Gupta Ji General Store* (Outstanding: ₹14,200).
3. Click **Collect Payment**:
   - Enter Amount: ₹5,000 Cash.
   - Enter Notes: *“Part payment for Invoice #INV/26-27/000008”*.
4. Tap **Record Collection**:
   - Sequential receipt generated: `REC/26-27/000005`.
   - Ledger entry posted (`LedgerKind.RECEIPT`).
   - Outstanding immediately drops to ₹9,200.
5. Print compact 58mm Collection Slip via Bluetooth printer for shopkeeper's records.

---

### Act 7: Evening Van Return & Variance Reconciliation (4 Mins)
* **Goal:** Van returns to Central Godown; supervisor counts remaining stock; system detects exact physical variance.
1. Switch to **Salesperson** or **Godown Supervisor** on Day-End Closing (`/van/reconciliation` or `/godown/van-issues/[id]/reconcile`).
2. View theoretical calculated metrics:
   - Morning Issued Stock vs Invoiced Sales = Expected Physical Return.
   - Total Cash Collected on Route = Expected Cash Handover.
3. Enter Physical Count for returned goods:
   - Enter exact counts for *Tata Tea* and *Mustard Oil*.
   - Intentionally report 1 pack shortage on *Parle-G* (e.g., physical 11 instead of 12).
4. Tap **Submit Evening Stock Return**:
   - System updates Van Day status to `RECONCILED`.
   - Stock transferred back from Van to Central Godown (`MovementType.VAN_RETURN`).
   - Discrepancy logged as Shortage (-1 pc).

---

### Act 8: Owner Two-Stage Cash Handover & Final Day Closing (3 Mins)
* **Goal:** Owner verifies cash envelope from driver before van day is officially closed.
1. Switch to **Super Admin (Harsh)** (`9876543210`).
2. Open `/godown/van-issues/[id]/reconcile`.
3. Review **Owner Cash Handover Verification Card**:
   - Expected Cash: ₹6,500.
   - Physical Cash Envelope Count: enter ₹6,500.
   - Discrepancy: ₹0.00 (Exact Match).
4. Click **Confirm Cash Received & Close Van Day**:
   - Van Day status permanently moves to `CLOSED`.
   - Immutable audit trail created with `confirmedById` and timestamp.
   - Van is now cleared and unlocked for next morning's dispatch.

---

### Act 9: FIFO Debtors Outstanding & Ageing Report (3 Mins)
* **Goal:** Review credit risk and collect overdue money using 0-15, 16-30, 31-60, 60+ days FIFO bucketing.
1. Navigate to **Reports & Analytics** (`/admin/reports?tab=ageing`).
2. Review **Receivables & Ageing Dashboard**:
   - 6 KPI summary cards: Total Receivables (₹), Current (0-15 Days), Due (16-30 Days), Overdue (31-60 Days), Critical (60+ Days), Over-Limit Parties.
3. Demonstrate Filters:
   - Filter by **Overdue Only** or **Over Credit Limit Only**.
4. Click on *Maa Durga Kirana* row:
   - Direct link opens Party Detailed Ledger (`/admin/parties/[id]/ledger`) showing chronological debits, payments, and running balance.
5. Click **Export CSV** for accounts team follow-ups.

---

### Act 10: Supplier Return to Company & GST Debit Note (3 Mins)
* **Goal:** Return damaged or expired stock back to FMCG company depot and generate formal GST Debit Note.
1. Navigate to **Godown Operations > Company Returns** (`/godown/returns`).
2. Review **Stock-Wise Company Return Report** displaying return reasons breakdown (*DAMAGE*, *EXPIRY*, *SLOW_MOVING*).
3. Click **New Return to Company** (`/godown/returns/new`).
4. Select Supplier (e.g., *ITC Distribution Ltd*), Reason: *DAMAGE*, Notes: *“Water damage in transit from Patna depot”*.
5. Add items:
   - *Aashirvaad Atta 10kg*: 10 bags @ ₹380.00.
6. Click **Generate Debit Note**:
   - Gapless sequential number generated: `DN/26-27/000001`.
   - Central Godown stock deducted permanently (`MovementType.RETURN_TO_COMPANY`).
   - Supplier ledger debited (`LedgerKind.DEBIT_NOTE`), reducing payables owed to ITC.
7. Click **Print A4 Debit Note** (`/godown/returns/[id]/print`):
   - Review formal document with GST tax calculation, supplier details, transporter block, and authorized signatory.

---

## 3. Client Q&A & Sign-Off Form

| Feature Area | Acceptance Criteria | Client Review |
|---|---|---|
| **Tally Debtor Import** | Seamlessly imports retailer balances & credit limits without duplicates. | [ ] Approved [ ] Feedback |
| **Van Morning Dispatch** | Formal dual-signed load sheet with carton and piece counts. | [ ] Approved [ ] Feedback |
| **Handheld Van PWA** | Works smoothly on mobile; offline drafts protect against network drops. | [ ] Approved [ ] Feedback |
| **Bluetooth Thermal Print**| Instant 58mm/80mm receipt generation on handheld battery printer. | [ ] Approved [ ] Feedback |
| **Credit Control** | Hard block on over-limit credit sales unless owner overrides with password. | [ ] Approved [ ] Feedback |
| **Evening Reconciliation**| Van return stock & cash counted with transparent variance tracking. | [ ] Approved [ ] Feedback |
| **FIFO Ageing Report** | 0-15, 16-30, 31-60, 60+ days breakdown reflects true market receivables. | [ ] Approved [ ] Feedback |
| **Debit Notes & Returns** | Return to manufacturer deducts stock and reduces supplier payables. | [ ] Approved [ ] Feedback |

**Sign-off:**  
Client Signature / OK: _______________________  
Date: _______________________
