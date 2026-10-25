# IDMS Staff Training Guide: Godown Staff

**Role:** Godown Manager / Staff (`GODOWN`)  
**Primary Users:** Godown Operators (2 Staff)  
**Primary Device:** Godown Desktop PC  
**Primary Dashboard:** `/godown`

---

## 1. Core Godown Workflows

```
Receive Supplier Stock (GRN)
  └── /godown/purchases/new -> Select Supplier (e.g. Bikaji) -> Enter Purchase Bill No -> Add items -> Save GRN.
      └── Stock appears in Central Godown immediately; accounts ledger is updated.

Morning Van Load Out (08:00 - 09:00 AM)
  └── /godown/van-issues/new -> Select Van (Van 1 / Van 2) -> Add cartons/pieces -> Create Load Sheet.
      └── Stock transfers automatically from Godown to Van. Print A4 Load Sheet (/print) for driver signature.

Transfer to Shop & Carton Breaking
  └── /godown/operations (Tab: Carton Break) -> Select Product -> Enter Cartons to break.
      └── Converts unopened cartons into loose pieces at Shop counter (e.g., 2 cartons x 24 = 48 pcs).

Order Split Picking for Online Store
  └── /admin/orders/[id]/pick-list -> Print Godown Pick Sheet.
      └── Godown picks full carton cases; Shop counter picks loose pieces.

Evening Van Return & Physical Count
  └── /godown/van-issues/[id]/reconcile -> Physical count verification of returned stock.
      └── Returned pieces transfer automatically back from Van to Central Godown.
```

---

## 2. Step-by-Step Instructions

### A. Recording a Purchase (Goods Receipt Note - GRN)
1. Go to **`/godown/purchases`** and click **"+ New Purchase Receipt"**.
2. Select Company / Supplier from the dropdown (e.g., MDH, Bikaji, Engine).
3. Enter the Supplier Invoice Number and Invoice Date.
4. Add line items: type product name or short code. Enter Quantity (pieces) and Cost Price per unit.
5. Click **"Save Purchase Receipt"**.
   - *Result:* Stock balances increase immediately in Central Godown (`MovementType.PURCHASE_RECEIPT`).

### B. Morning Van Dispatch (Load Sheet)
1. Go to **`/godown/van-issues`** and click **"+ Create Van Issue"**.
2. Select vehicle (e.g. `Van 1 - BR-19-1234`) and Salesperson.
3. Add products: enter quantity in full cartons or loose pieces. Live stock in Godown is displayed.
4. Click **"Dispatch Van Issue Sheet"**.
5. Click **"Print A4 Sheet"**: Hand the sheet to the driver. Both Godown In-Charge and Driver sign physical copies.

### C. Carton Break for Shop Counter
1. When the Shop counter needs loose pieces: go to **`/godown/operations`** -> **Carton Break**.
2. Search SKU (e.g., *Bikaji Bhujia 200g*, Pack Size: 24).
3. Enter Number of Cartons to break (e.g., `2`).
4. Click **"Break Cartons"**.
   - *Result:* 2 cartons (48 pcs) deducted from Godown, 48 loose pieces added to Shop counter stock.

### D. Return to Manufacturer (Company Returns & Debit Note)
1. Go to **`/godown/returns/new`**.
2. Select Manufacturer (Company) and Return Reason (Damaged packaging, near expiry, company recall).
3. Add affected products and piece counts.
4. Click **"Issue Return & Debit Note"**.
5. Print formal A4 Debit Note (`DN/26-27/XXXXXX`) with authorized sign-off. Stock is deducted permanently.

---

## 3. Critical Rules for Godown
- **No Negative Stock:** The database prevents any transfer that exceeds available Godown inventory. Always ensure GRN is entered before dispatching goods.
- **Physical Count Audits:** Perform weekly cycle counts in `/godown/operations` (Tab: Stock Audit). Variances require Owner approval before stock adjustments take effect.
