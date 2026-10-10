# IDMS Staff Training Guide: Super Admin (Business Owner)

**Role:** Super Admin / Owner (`SUPER_ADMIN`)  
**Primary Users:** Sachin Prakash  
**Primary Devices:** Laptop / PC & Mobile Phone  
**Primary Dashboard:** `/admin`

---

## 1. Daily Core Responsibilities

```
Morning (08:30 - 09:30 AM)
  ├── Review Executive Dashboard (/admin) for critical stock alerts & pending orders.
  ├── Review morning van load requests (/godown/van-issues) before vehicles depart.
  └── Review online B2B store orders (/admin/orders) and trigger split pick lists.

During Business Hours (10:00 AM - 07:00 PM)
  ├── Authorize credit limit overrides for trusted retailers if billing exceeds terms.
  ├── Approve manual stock variance adjustments from physical godown audits.
  └── Monitor real-time sales channels across Shop, Van 1, Van 2, and Online Store.

Evening Route Close (07:30 - 08:30 PM)
  ├── Physical count verification of returned stock with godown staff.
  ├── Review Salesperson day reconciliation summary (/van/reconciliation).
  └── Perform formal two-stage Cash Handover Confirmation:
      └── Input physical cash received -> System computes variance (Shortage/Excess) -> Confirm & Seal Day.
```

---

## 2. Key Screen Walkthroughs

### A. Executive Dashboard (`/admin`)
- **Key Metrics:** Live Today's Net Sales, Total Cash & UPI in Hand, Receivables Outstanding, Godown/Shop Stock Valuation in ₹.
- **Critical Alerts:** Highlights out-of-stock SKUs, parties with overdue credit exceeding 30/60 days, and pending split pick lists.

### B. Credit Limit Override (Remote Approval)
- When a cashier or salesperson attempts a credit sale exceeding a retailer's sanctioned limit or credit days:
  1. The system blocks the transaction and renders the **Credit Override Prompt**.
  2. The Owner provides approval by entering their verified owner credentials and reason.
  3. Every override is logged permanently in the immutable audit trail (`CREDIT_LIMIT_OVERRIDE`).

### C. Evening Van Cash Handover (`/godown/van-issues/[id]/reconcile` or `/van/reconciliation`)
- **Step 1:** The salesperson finalizes evening return stock and taps "Submit Reconciliation".
- **Step 2:** The Owner inspects physical cash collected and inputs the count into the **Owner Cash Handover** card.
- **Step 3:** System computes exact variance (`Physical Cash - Expected Cash`).
- **Step 4:** Owner clicks **"Confirm Cash Handover & Close Van Day"**. The van day is sealed (`CLOSED`) and cannot be reopened.

### D. System Configuration & Security (`/admin/settings`)
- **Business Details:** Legal Entity Name, GSTIN (`10AAAAA0000A1Z5`), FSSAI License, Bank NEFT details, UPI QR handle.
- **Delivery Zones & Thresholds:** Set minimum order size and free delivery cut-offs (Saharsa Town default ₹2,000; Outstation ₹5,000).
- **Payment Switches & E-Invoice:** Payment gateway toggle (off by default) and GSP credentials adapter.

---

## 3. Important Rules to Remember
1. **Invoices are Immutable:** Finalized invoices cannot be edited. If an error occurred, only the Owner can cancel the invoice (`/shop/invoices/[id]`), which automatically generates a formal Credit Note (`CN/26-27/XXXXXX`) and restores physical stock.
2. **Never Share Super Admin Password:** Staff accounts must be created with individual roles (`GODOWN`, `SHOP`, `SALESPERSON`, `DELIVERY`, `ACCOUNTS`). First login forces them to change their default password.
3. **Backup Check:** Run `pnpm db:validate-backup` regularly or check automated backups in `./backups/`.
