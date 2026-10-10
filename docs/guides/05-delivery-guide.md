# IDMS Staff Training Guide: Delivery Staff (Order Dispatch & Proof of Delivery)

**Role:** Delivery Boy / Staff (`DELIVERY`)  
**Primary Users:** Delivery Drivers (2 Staff)  
**Primary Device:** Android Mobile Phone  
**Primary Workspace:** `/delivery`

---

## 1. Delivery App Workflow (`/delivery`)

```
Morning / Afternoon Dispatch
  ├── Open /delivery -> View Active Deliveries list assigned to your name.
  ├── Check destination address, customer phone, and order invoice number.
  └── Verify packages (Godown carton boxes + Shop loose bags) before leaving premises.

On the Road
  ├── Tap [Call Customer] (tel:) -> Immediate one-tap calling for directions.
  └── Tap [Google Maps] -> Opens turn-by-turn navigation directly to the customer's doorstep.

Doorstep Delivery & Payment Collection
  ├── Deliver items and let customer verify packages against invoice.
  ├── Open Order Card in app -> Tap "Collect & Complete Delivery".
  ├── Select Payment Method:
  │     ├── Cash (Enter physical amount received)
  │     └── UPI on Delivery (Scan QR, enter UPI Transaction ID / UTR number)
  └── Tap "Confirm Delivery & Payment".
        └── Order updates to DELIVERED; invoice paymentStatus updates to PAID instantly.
```

---

## 2. Step-by-Step Delivery Actions

### A. Viewing Your Assigned Deliveries
1. Log in with your assigned staff phone number and password.
2. The system automatically redirects you to **`/delivery`**.
3. Two tabs are available:
   - **Active Runs:** Orders assigned to you that are currently out for delivery.
   - **Completed:** Orders you successfully delivered today.

### B. Calling and Navigating
- On each active delivery card, tap:
  - **"Call Customer"**: Opens your phone dialer with the customer's phone pre-filled.
  - **"Open Maps"**: Opens Google Maps with the delivery address / landmark loaded.

### C. Collecting Payment & Proof of Delivery
1. Once at the location, verify payment mode agreed:
   - If customer pays **Cash**: Count currency notes. Enter amount in the prompt.
   - If customer pays **UPI**: Customer scans the distributor UPI QR code. Check transaction success on their screen and enter the UTR/Reference ID into the app.
   - If customer is an **Authorized Credit Party**: The system indicates *"On Account (Credit)"*; collect signature or confirmation.
2. Tap **"Confirm Delivery"**.
   - *Result:* Timestamped record is logged. Outstanding balance is automatically reduced if linked to a party ledger.

---

## 3. Key Rules for Delivery Staff
1. **Never Mark Delivered Without Payment:** If COD or UPI on delivery is required, confirm funds received before tapping confirm.
2. **Handle Damaged Goods Immediately:** If a customer rejects a damaged carton, contact the Godown In-Charge before completing the order.
3. **End of Shift Handover:** Hand all collected cash bundles and UPI receipt slips to the Owner or Accounts at the end of the run.
