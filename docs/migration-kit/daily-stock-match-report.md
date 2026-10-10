# Daily Parallel-Run Stock & Financial Match Report Protocol

**Purpose:** Daily reconciliation between IDMS, physical bill books, cash drawer, and Tally ERP during the 2–3 week parallel run.  
**Meeting Time:** Daily at 8:00 PM – 8:30 PM  
**Participants:** Business Owner (Super Admin), Godown Incharge, Shop Cashier, Accounts Head  

---

## 1. Daily Match Checklist

| Reconciliation Task | IDMS Source Screen | Physical / External Benchmark | Allowed Tolerance | Checked By |
|---|---|---|---|---|
| **Central Godown Stock** | `/godown/stock` | Physical bin / rack audit | 0 pieces | Godown & Owner |
| **Shop Loose Stock** | `/godown/stock` (Shop filter) | Shelf count | 0 pieces | Cashier |
| **Counter Sales Cash** | `/admin/reports?tab=cash` | Physical drawer count | ₹ 0.00 | Cashier & Owner |
| **Van Route Collections** | `/van/reconciliation` | Physical cash / UPI handover | ₹ 0.00 | Driver & Owner |
| **Route Stock Returns** | `/godown/van-issues` | Unsold vehicle goods count | 0 pieces | Godown Incharge |
| **Day's Tax Invoices** | `/admin/reports?tab=daybook` | Carbon-copy bill book slips | 100% count match | Accounts |
| **Customer Credit Balances**| `/admin/parties` | Tally Sundry Debtors ledger | ₹ 0.00 difference | Accounts |

---

## 2. Daily Discrepancy Log Table

Copy this markdown table into daily operational records if an anomaly occurs:

```markdown
| Date | Item / Party | System Qty/Amt | Physical Qty/Amt | Variance | Root Cause | Corrective Action | Owner Sign |
|---|---|---|---|---|---|---|---|
| 2026-10-15 | Bikaji Bhujia 400g | 48 pcs | 46 pcs | -2 pcs | Counter breakage not entered | Logged damage via Godown Ops | [Signed] |
| 2026-10-15 | Maa Durga Kirana | ₹ 12,450 | ₹ 12,000 | -₹ 450 | Unrecorded route collection | Issued Receipt REC/26-27/000014 | [Signed] |
```

---

## 3. Discrepancy Resolution Protocol
1. **Never alter ledger directly:** Double-entry stock movements and finalized invoices are immutable by database design.
2. **Missing Inward Goods:** Record GRN via `/godown/purchases` with exact supplier invoice timestamp.
3. **Carton Break Variance:** If loose pieces were taken from godown carton without entry, execute **Carton Break** in `/godown/operations`.
4. **Broken / Damaged Packets:** Log explicitly as `DAMAGE` in `/godown/operations` so stock variance reflects legitimate transit breakage.
5. **Customer Payment Discrepancy:** Record official route collection receipt via `/van/collections` or admin ledger entry.
