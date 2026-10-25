# IDMS Staff Training Guide: Accounts & Chartered Accountant (CA)

**Role:** Accounts Staff & CA (`ACCOUNTS`)  
**Primary Users:** In-house Accountant & CA Office  
**Primary Device:** Office Desktop PC  
**Primary Workspace:** `/admin/reports` & `/admin/parties`

---

## 1. Accounting & Statutory Reports Hub (`/admin/reports`)

```
Monthly GST Filing (GSTR-1)
  └── /admin/reports (Tab: GSTR-1) -> Select IST Month/Year -> Table 4A (B2B), Table 7 (B2CS), Table 12 (HSN).
      └── One-click RFC 4180 CSV Export formatted for the GST Portal / ClearTax.

TallyPrime & Tally ERP 9 Synchronization
  └── /admin/reports (Tab: Tally Export) -> Select Date Range -> Voucher Types: Sales / Receipts / All.
      └── Download Tally XML (native <ENVELOPE> format) or Tally CSV for one-click Tally ledger import.

Receivables & FIFO Debt Ageing
  └── /admin/reports (Tab: Ageing) -> Receivables breakdown across 0-15, 16-30, 31-60, 60+ days.
      └── Identifies over-limit breaches, overdue days, and oldest unpaid invoice date.

Chronological Day Book & Sales Register
  └── /admin/reports (Tab: Day Book) -> Unified ledger combining Sales, Purchases, Receipts, Debit Notes.
  └── /admin/reports (Tab: Sales Register) -> Taxable, CGST, SGST, IGST breakdown per invoice with CSV download.
```

---

## 2. Step-by-Step Instructions

### A. Exporting GSTR-1 for Monthly GST Return
1. Navigate to **`/admin/reports`** and switch to the **"GSTR-1"** tab.
2. Select the filing month and financial year (e.g. October 2026).
3. The report automatically categorizes:
   - **Table 4A (B2B Taxable Supplies):** Invoices with registered buyer GSTINs (party GSTIN, POS: 10-Bihar, tax rates).
   - **Table 7 (B2CS Small / Consumer Supplies):** Shop walk-in consumer invoices grouped by tax slab (0%, 5%, 12%, 18%, 28%).
   - **Table 12 (HSN-Wise Summary):** Aggregated piece quantities, taxable values, and split tax amounts per HSN code.
4. Click **"Download GSTR-1 CSV"** to export files for direct CA filing.

### B. Exporting Vouchers to TallyPrime / Tally ERP 9
1. Navigate to **`/admin/reports`** and click the **"Tally Export"** tab.
2. Select the date range (e.g., `2026-10-01` to `2026-10-10`).
3. Choose **Voucher Type**: *Sales Invoices*, *Customer Receipts*, or *All Vouchers*.
4. Click **"Export Tally XML"**:
   - Downloads standard Tally `<ENVELOPE>` containing ledger allocations, party ledgers, tax accounts (`Output CGST`, `Output SGST`), and inventory item allocations.
   - In TallyPrime: Go to **Import > Transactions > Select File** -> Vouchers post cleanly into company books.
5. Click **"Export Tally CSV"** for Excel/spreadsheet cross-reconciliation.

### C. Party Master & Live Outstanding Ledgers (`/admin/parties`)
1. View party ledger statements with running balance: `/admin/parties/[id]/ledger`.
2. Review opening balance, date-filtered debits (sales invoices), credits (receipts, credit notes), and net balance.
3. Print or download running account statements for customer reconciliation.

---

## 3. Financial Integrity & Invariants
- **Zero Float Invariant:** All amounts inside IDMS are calculated and stored in integer paise (`*_paise`). There are zero floating-point rounding drifts.
- **P&L and Balance Sheet:** Maintained in Tally via the daily/monthly Tally XML voucher export per PRD Section 5.9.
- **Credit Limit & Terms Enforcement:** Overdue status and credit limits are computed in real-time (`sum(debits) - sum(credits)`).
