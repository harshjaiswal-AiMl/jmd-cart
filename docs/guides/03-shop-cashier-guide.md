# IDMS Staff Training Guide: Shop Counter POS (Cashier)

**Role:** Shop Cashier / Counter Staff (`SHOP`)  
**Primary Users:** Counter Staff (2 Operators)  
**Primary Device:** Shop Counter Desktop PC  
**Primary Route:** `/shop/pos`  
**Speed Standard:** Complete a 5-item bill in **under 60 seconds** without a barcode scanner.

---

## 1. Shop POS Counter Workflow (`/shop/pos`)

```
Step 1: Search & Add Item
  └── Type 2-3 letters of product name (e.g. "bhu" -> Bikaji Bhujia) or Short Code -> Press Enter / Click (+).

Step 2: Edit Quantity & Pack Conversion
  └── Enter loose pieces or cartons. Quantity stepper auto-calculates cartons and pieces.
  └── Dynamic Wholesale Slab: Price automatically drops as quantity increases.

Step 3: Select Customer (Optional for Walk-In Retail)
  └── Retail Consumer: Leave party empty (Walk-in cash sale).
  └── Registered Retailer / Wholesaler: Search party name or phone number. Shows live credit balance and limit.

Step 4: Tender Payment (Split Tender Modal)
  └── Split amounts across Cash, UPI QR, Card, or Customer Credit.
  └── Instant quick-cash buttons: [₹100] [₹200] [₹500] [₹2,000] [Exact Amount].

Step 5: Finalize & Print
  └── Click "Finalize Bill" -> Gapless FY Invoice Number (INV/26-27/XXXXXX) generated in < 1 second.
  └── Select print format: Thermal 80mm Receipt or A4 GST Tax Invoice.
```

---

## 2. Essential Keyboard Shortcuts & Features

| Action | How to do it | Description |
|---|---|---|
| **Quick Search** | Click search box or press `Ctrl + K` | Searches name, short code, brand across 900+ SKUs in under 200ms. |
| **Filter by Brand** | Click brand chip (Bikaji, MDH, etc.) | Filters catalogue by manufacturer instantly. |
| **Hold Bill** | Click **"Hold Bill"** | Saves customer's cart to memory if they step aside to fetch more items. |
| **Resume Bill** | Click **"Held Bills (N)"** | Restores held cart with all line items and discounts intact. |
| **Order Discount** | Enter % discount in sidebar | Max limit: 5% (500 bp) for Cashier. Higher discounts flag Owner approval. |
| **Credit Block** | Warning alert triggers | If customer exceeded credit limit, prompt prompts Owner credentials override. |

---

## 3. End-of-Day Shop Cash Close

At the end of the shift:
1. Open **`/admin/reports`** -> Tab: **Day-End Cash**.
2. Review the expected cash total calculated from Shop counter finalized cash invoices.
3. Open the **Interactive Drawer Denomination Counter**:
   - Enter counts for ₹500, ₹200, ₹100, ₹50, ₹20, ₹10 notes and coins.
   - The drawer dynamically calculates total physical cash and highlights any variance (Shortage or Excess).
4. Hand the physical cash bundle to the Owner.

---

## 4. Key Rules for Cashiers
1. **No Barcode Scanner Needed:** Use the fast search-first interface with product short codes.
2. **Never Sell Out-of-Stock Items:** Items with 0 quantity at the Shop show an Out-of-Stock badge. Request a **Carton Break** from Godown if physical inventory exists in Godown.
3. **Bill Finalization is Permanent:** Once finalized, stock is deducted immediately. If a customer changes their mind, contact the Super Admin / Owner to cancel the bill and issue a Credit Note.
