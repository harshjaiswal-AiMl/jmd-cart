# IDMS Go-Live Cutover Pre-Flight Checklist

**Target:** Primary Production Cutover  
**Location:** Central Godown & Main Shop Counter, Saharsa, Bihar  
**Audience:** Super Admin (Owner), Accounts/CA, Godown Manager, Technical Lead  

---

## 1. T-Minus 48 Hours: Data Preparation & Backup
- [ ] **Tally Data Freeze:** Inform accounts to complete all pending supplier receipts and debtor vouchers in Tally.
- [ ] **Parties CSV Export:** Export all Sundry Debtors and Creditors from Tally with closing balance.
- [ ] **Run Tally Party Import Drill:** Import parties CSV into IDMS staging (`/admin/parties/import`); verify closing balance matching.
- [ ] **Catalog Master Audit:** Check that all active FMCG lines have valid HSN, GST rate, MRP, and pack size.
- [ ] **Run Baseline Backup:** Execute `pnpm db:validate-backup` to generate SHA256 verified clean backup.

---

## 2. T-Minus 24 Hours: Physical Stocktake
- [ ] **Freeze Physical Operations:** Cease stock movement at 7:00 PM on cutover eve.
- [ ] **Count Central Godown:** Count unopened cartons and loose packages across racks using `opening-stock-count-sheet.csv`.
- [ ] **Count Shop Counter:** Count all front-counter shelf stock.
- [ ] **Count Van Inventories:** Audit remaining stock in Van 1 and Van 2.
- [ ] **Stock Audit Inward in IDMS:** Navigate to `/godown/operations?tab=audit` and record verified quantities.
- [ ] **Owner Approval:** Super Admin reviews stock variance report and approves ledger adjustments.

---

## 3. T-Minus 2 Hours: System & Hardware Verification
- [ ] **Sequence Series Reset / Verification:** Verify locked FY sequence counters (`INV/26-27/000001`, `VIS/26-27/000001`, `REC/26-27/000001`, `ORD/26-27/000001`, `DN/26-27/000001`).
- [ ] **Thermal Printer Test:** Test 80mm ESC/POS USB printer on Shop Counter POS (`/shop/invoices`).
- [ ] **Bluetooth Printer Pairing:** Pair 58mm/80mm handheld Bluetooth thermal printers with Android phones for Van 1 and Van 2.
- [ ] **PWA Offline Check:** Verify Van PWA launches on Android and saves offline draft bills when airplane mode is toggled.
- [ ] **Delivery App Run:** Ensure Delivery personnel (`delivery@idms.local`) can view assigned test route.

---

## 4. Go-Live Day 1: Operation Monitoring
- [ ] **Morning Van Load Sheets:** Godown generates and prints morning load sheets (`VIS/26-27/000001`) with driver sign-off.
- [ ] **Shop Counter POS:** Cashier issues all walk-in retail sales through `/shop/pos`.
- [ ] **Evening Van Reconciliation:** At 6:30 PM, godown audits returns and Owner confirms cash handover (`/van/reconciliation`).
- [ ] **Day-End Cash Reconciliation:** Cashier tallies physical cash drawer denominations against `/admin/reports?tab=cash`.
- [ ] **Nightly Automated Backup:** Ensure nightly scheduled backup completes with `.sha256` checksum.
