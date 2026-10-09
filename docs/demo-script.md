# IDMS Phase 1 Client Demo Script

**Project:** Integrated Distribution Management System (IDMS)  
**Target Audience:** FMCG Business Owner (Harsh) & Operations Team, Saharsa, Bihar  
**System Target Date:** 24 Oct 2026 (Phase 1 Core)  
**Demo Duration:** ~25-30 Minutes

---

## 1. Demo Setup & Preparation

### Prerequisites
- Laptop running local IDMS server on shop Wi-Fi or local machine (`http://localhost:3000`).
- Database seeded with standard accounts, locations (Godown, Shop Counter, Vans), and initial FMCG catalog.
- Thermal receipt printer (optional for hardware test; browser print viewer available).

### Demo User Accounts
| Role | Phone | Password | Starting Dashboard |
|---|---|---|---|
| **Super Admin (Owner)** | `9876543210` | `admin123` | `/admin` |
| **Godown Manager** | `9876543211` | `godown123` | `/godown` |
| **Shop Cashier** | `9876543212` | `shop123` | `/shop/pos` |

---

## 2. Interactive Walkthrough Script

### Act 1: Owner Control & Business Settings (3 Mins)
* **Goal:** Show Harsh that his business identity, tax credentials, and staff rules are fully under his control.
1. Log in as **Super Admin** (`9876543210` / `admin123`).
2. Navigate to **Business Settings** (`/admin/settings`).
3. Point out:
   - **Business Details:** Distributor Legal Name, Saharsa Godown Address, GSTIN (`10AAAAA0000A1Z5`), FSSAI license (`10421000000000`).
   - **Staff Discount Limits:** Shop Cashier max discount (e.g., 5.00%), Salesperson max discount (e.g., 8.00%). Explain: *“Staff cannot arbitrarily give 15% discount behind your back; the system requires owner approval.”*
   - **Invoice Terms & UPI QR ID:** Bank remittance IFSC and UPI VPA printed automatically on invoices.

---

### Act 2: Instant Catalog Master & CSV Bulk Import (3 Mins)
* **Goal:** Show how 900+ FMCG products can be imported from Tally/Excel in less than a single second.
1. Navigate to **Catalog Master** (`/admin/catalog`).
2. Show fast multi-token search: type `Saloni`, `Parle`, or short code `PARLE-G-10`. Show instantaneous filtering.
3. Click **Import Products** (`/admin/catalog/import`).
4. Click **Paste CSV Text** tab, paste a batch of new products with HSN, GST rate, MRP, and carton pack sizes.
5. Click **Import Products**.
6. Highlight:
   - Green banner: *“100% Success — Processed in under 1 second.”*
   - Automatic category and company creation on the fly.
   - Row-level validation preventing bad GST slabs or invalid HSN codes.

---

### Act 3: Godown Stock Receipt (GRN) (3 Mins)
* **Goal:** Demonstrate receiving a shipment from FMCG manufacturers into the central Godown.
1. Log out or switch to **Godown Manager** (`9876543211` / `godown123`).
2. Navigate to **Purchase & GRN** (`/godown/purchases/new`).
3. Select Supplier (e.g., *ITC Distribution Ltd*), enter Supplier Invoice No (`SUP-2026-901`).
4. Add items:
   - *Aashirvaad Atta 10kg*: 50 bags @ ₹380.00.
   - *Fortune Mustard Oil 1L*: 100 bottles @ ₹135.00.
5. Click **Record Goods Receipt**.
6. Explain: *“The moment GRN is recorded, stock immediately enters the central Godown ledger, supplier ledger is credited, and an immutable audit trail is saved.”*

---

### Act 4: Godown Operations — Stock Transfer & Carton Breaking (4 Mins)
* **Goal:** Show stock movement between Godown and Shop, and converting wholesale cartons into retail units.
1. Navigate to **Godown Operations** (`/godown/operations`).
2. **Transfer to Shop Counter:**
   - Source: Central Godown -> Destination: Main Shop Counter.
   - Item: *Fortune Mustard Oil 1L*, Quantity: 24 pieces.
   - Submit transfer.
3. **Carton Breaking:**
   - Switch to **Carton Break** tab.
   - Select *Parle-G 100g* (Pack size: 24 pieces per carton).
   - Enter `2 cartons`. The system calculates: `2 × 24 = 48 pieces`.
   - Submit carton break.
   - Explain: *“Godown loses 2 cartons; Shop Counter automatically gains 48 individual retail pieces ready for counter sale.”*

---

### Act 5: Real-Time Stock Ledger & Movement History (3 Mins)
* **Goal:** Show complete stock transparency across all locations and proof of immutable ledger.
1. Navigate to **Stock by Location** (`/godown/stock`).
2. Show the inventory table:
   - Total inventory in pieces and carton breakdown (e.g., `4 cartons + 8 loose`).
   - Distinct columns showing stock in **Godown**, **Shop Counter**, and **Delivery Vans**.
   - Low stock warning badges highlighting items below reorder threshold.
3. Click on a product to open its **Ledger History** (`/godown/stock/[productId]`).
4. Point out the chronological ledger:
   - `PURCHASE_RECEIPT` (+100)
   - `TRANSFER` (-24 from Godown, +24 to Shop)
   - Explain: *“Every movement has an IST timestamp and staff name. Nobody can edit or delete an entry; the database physically blocks it.”*

---

### Act 6: Fast Shop Counter POS Sale (5 Mins)
* **Goal:** Experience the 2-minute retail billing workflow with slab discounts and split payments.
1. Log in as **Shop Cashier** (`9876543212` / `shop123`) at `/shop/pos`.
2. Demonstrate search-first workflow:
   - Search `Parle` or click quick category chips.
   - Click to add 12 pieces. Notice live price calculation.
   - Add 50 pieces. Point out how slab pricing triggers automatic discount:
     - *Tier: Wholesale Slab applied!*
     - *Buyer Tag: Automatically tagged as RETAILER.*
3. Add a customer name (`Rajesh Kumar - Saharsa Bazar`) and phone (`9431000000`).
4. Click **Pay & Finalize (F4)**.
5. Demonstrate **Split Payment Tender**:
   - Total bill: ₹1,500.
   - Cash: ₹1,000 (click quick ₹500 note buttons).
   - UPI: ₹500.
   - Balance due: ₹0.
6. Click **Confirm & Generate Tax Invoice**.

---

### Act 7: Invoice & Print Templates (3 Mins)
* **Goal:** Review GST compliance on printed bills.
1. The post-sale modal appears:
   - Invoice generated: `INV/26-27/000001` (Gapless FY sequence).
2. Click **Print 80mm Thermal Receipt**:
   - Show receipt preview: 72mm width, itemized lines, net payable, split payment details, thank-you note.
3. Click **Print A4 Tax Invoice**:
   - Show standard GST Tax Invoice under Section 31 of CGST Act.
   - Point out HSN tax computation table (Taxable, CGST 2.5%, SGST 2.5%, Total Tax).
   - Point out amount in words (*“Rupees One Thousand Five Hundred Only”*).
   - Point out Bank details and Authorized Signatory stamp.

---

### Act 8: Invoice Cancellation & Credit Note Workflow (2 Mins)
* **Goal:** Show how mistakes are corrected without breaking accounting or stock rules.
1. Log back in as **Super Admin** (`9876543210`).
2. Go to **Sales Invoices** (`/shop/invoices`).
3. Click into invoice `INV/26-27/000001`.
4. Click **Cancel Invoice (Issue Credit Note)**.
5. Enter cancellation reason: *“Customer cancelled order before delivery.”*
6. Confirm cancellation.
7. Show results:
   - Invoice status changes to `CANCELLED`.
   - Credit Note generated: `CN/26-27/000001`.
   - Counter-movement `SALE_CANCEL` automatically added back to Shop inventory.
   - Customer ledger reversed.

---

### Act 9: Day-End Cash Register & Business Reports (3 Mins)
* **Goal:** Close the day with reconciliation and executive reports.
1. Navigate to **Reports & Analytics** (`/admin/reports`).
2. Open **Daily Sales Summary**:
   - View total sales for today, total tax collected, split tender breakdown (Cash vs UPI vs Card).
   - View GST slab distribution (5%, 12%, 18%).
3. Open **Day-End Cash Register**:
   - System recorded cash: e.g. ₹10,000.
   - Use the **Physical Denomination Counter**: enter counts of ₹500, ₹200, ₹100, ₹50 notes.
   - Show live calculation and cash drawer variance indicator (Zero discrepancy = Green).
4. Open **Low Stock Alerts**:
   - Show deficit table for reordering with distributors before tomorrow.

---

## 3. Client Q&A & Feedback Collection Form

| Feature Area | Client Feedback / Notes | Status |
|---|---|---|
| **Catalog & Brands** | Are all Saharsa brand categories represented? | [ ] Approved [ ] Changes requested |
| **POS Counter Speed** | Is search and keyboard navigation fast enough for peak hours? | [ ] Approved [ ] Changes requested |
| **Bill Printing** | Does the 80mm thermal receipt format meet shop requirements? | [ ] Approved [ ] Changes requested |
| **Staff Roles** | Are the permission boundaries between Admin, Godown, and Shop acceptable? | [ ] Approved [ ] Changes requested |
| **Day-End Closing** | Does the cash denomination counter match daily physical cash counting? | [ ] Approved [ ] Changes requested |

**Sign-off:**  
Client Signature / OK: _______________________  
Date: _______________________
