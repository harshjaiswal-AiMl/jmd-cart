# IDMS Staff Training Guide: Van Salesperson (Handheld PWA)

**Role:** Van Salesperson (`SALESPERSON`)  
**Primary Users:** Route Salesmen (2 Staff)  
**Primary Device:** Android Handheld Phone / Tablet  
**Primary Workspace:** `/van` (Mobile PWA Shell)  
**Hardware:** Handheld Bluetooth ESC/POS 58mm/80mm Thermal Printer

---

## 1. Handheld PWA Home Screen Installation

1. Open Chrome on Android phone and visit the store URL: `https://<ip>:3000/van`
2. Tap the browser menu (⋮) -> **"Add to Home screen"** or tap the **"Install Van App"** banner.
3. The **JMD Cart Van** app icon appears on your home screen. Open directly like a native Android app.

---

## 2. Daily Route Cycle

```
Morning (08:30 AM)
  ├── Receive vehicle from Godown. Confirm physical stock matches Godown Load Sheet.
  ├── Pair portable Bluetooth printer via Web Bluetooth.
  └── Open /van -> Live van inventory displays on screen with pack conversions.

On-Route Route Sales (10:00 AM - 06:30 PM)
  ├── Tap "New Bill" (/van/billing) -> Select Retailer -> Add cartons/pieces -> Live slab pricing applies.
  ├── Toggle Cash vs Customer Credit.
  ├── Tap "Finalize & Print" -> Bluetooth thermal receipt prints in 3 seconds. Hand slip to retailer.
  └── Offline Network Drop: If network drops in rural routes, bill saves automatically to Local Drafts.
      └── Drafts queue safely and auto-sync as soon as mobile connectivity returns.

On-Route Collections (/van/collections)
  ├── Tap "Record Collection" -> Select Retailer -> Enter cash/UPI collected towards previous balance.
  └── Prints instant signed route payment receipt (REC/26-27/XXXXXX).

Evening Route Closing (07:30 PM)
  ├── Return to Central Godown with unsold stock and cash pouch.
  ├── Open /van/reconciliation -> System displays Expected Stock, Total Route Sales, and Cash in Hand.
  ├── Godown verifies physical return pieces. Tap "Submit Reconciliation".
  └── Hand physical cash pouch to the Owner -> Owner verifies and confirms day closing.
```

---

## 3. Bluetooth Thermal Printer Setup (ESC/POS)

1. Turn ON the handheld thermal printer (blue LED blinking).
2. On the Van screen, tap the **Bluetooth icon** (Printer Status pill in header).
3. Tap **"Pair Printer"** -> Select your Bluetooth printer from the device list (e.g. `MTP-II` or `RPP02N`).
4. Tap **"Print Test Slip"** -> Verifies connection with a test voucher.
5. Printer stays connected automatically across route stops. If Bluetooth drops, the app offers browser print fallback.

---

## 4. Key Rules for Salespersons
1. **Never depart without an active Load Sheet:** Van billing requires an active morning Load Sheet issued by Godown.
2. **Credit Limit Blocks:** If a retailer is over their credit limit, the bill cannot be finalized on credit. Request Owner approval or collect payment in cash.
3. **Draft Sync:** Before shutting off phone at evening reconciliation, ensure all local drafts show "Synced".
