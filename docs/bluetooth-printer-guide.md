# Bluetooth Thermal ESC/POS Printing Guide: Van Handheld Operations

This operational guide details the setup, pairing, roll configuration, and testing procedures for mobile Bluetooth ESC/POS receipt printers used on JMD CART delivery vans in Saharsa, Bihar.

---

## 1. Supported Printer Hardware

The system implements standard ESC/POS command protocol compatible with portable battery-powered thermal printers (2-inch / 58mm and 3-inch / 80mm rolls):

| Printer Model | Roll Width | Connection | Battery Life | Notes |
|---|---|---|---|---|
| **Everycom EC-58 / POS-58** | 58mm (32 cols) | Bluetooth 4.0 / USB | ~8-10 hours | Most popular budget van printer in India; lightweight belt clip |
| **RETSOL BTP-58 / Mini** | 58mm (32 cols) | Bluetooth / USB | ~8 hours | Rugged casing; fast 70mm/s print speed |
| **TVS RP-3150 / Star** | 80mm (48 cols) | Bluetooth / USB | ~10 hours | Premium 3-inch roll; wider table format |
| **MPT-II / PT-210 / Xprinter** | 58mm (32 cols) | Bluetooth Low Energy | ~6-8 hours | Standard 203 DPI handheld receipt printer |

---

## 2. Browser & Security Requirements

Web Bluetooth is a standard W3C browser API that communicates directly with nearby Bluetooth GATT peripherals without needing native apps or third-party drivers.

### Requirements:
1. **Operating System:** Android 8.0+ on smartphones or Chrome on Desktop/Laptop with Bluetooth.
2. **Browser:** Google Chrome (recommended), Microsoft Edge, or Chromium-based browsers. *(Note: iOS Safari does not support Web Bluetooth; for iPhones, use the integrated &ldquo;Browser Thermal Print&rdquo; fallback).*
3. **Secure Context:** Web Bluetooth **only functions over HTTPS or `localhost`**.
   - In production: HTTPS with valid SSL certificate (`https://app.jmdcart.com`).
   - In local Wi-Fi testing: Use `localhost` on the device, or local HTTPS via `mkcert` (see Section 5).

---

## 3. Step-by-Step Bluetooth Pairing on Android

Follow this procedure when setting up a delivery salesperson's phone:

### Step 1: Prepare the Handheld Printer
1. Ensure the thermal paper roll is loaded correctly (thermal glossy side facing the print head; paper feeding from underneath).
2. Press and hold the power button for 2 seconds until the status LED lights up (blue blinking LED indicates Bluetooth advertising).

### Step 2: Android Phone Preparation
1. Open Android **Settings** -> Turn **Bluetooth** ON.
2. Ensure **Location (GPS)** is ON (Android requires location permission for Bluetooth Low Energy device discovery).
3. Open **Google Chrome** and navigate to `https://app.jmdcart.com/van` (or local development address).
4. Log in as Salesperson (`sales1` / `sales2`).

### Step 3: Connect in JMD CART Van PWA
1. In the top app bar, tap the **Printer** icon (shows gray dot when disconnected).
2. Tap **&ldquo;Pair Printer&rdquo;** in the Bluetooth modal.
3. Chrome will display the nearby Bluetooth devices list:
   - Select your printer (e.g. `Everycom POS-58`, `RPP02N`, `Bluetooth Printer`).
   - Tap **Pair**.
4. If Android asks for a pairing PIN code, enter `0000` or `1234` (standard factory defaults).
5. The status indicator in the top header turns **green** (`Connected: [Printer Name]`).

### Step 4: Run Hardware Diagnostic Test
1. Inside the Printer modal, tap **&ldquo;Print Test Slip via Bluetooth&rdquo;**.
2. The printer will immediately produce a test slip verifying:
   - JMD CART store title (Double height bold).
   - Date and IST time.
   - 32-column alignment (Left, Center, Right).
   - Clean paper tear clearance (4-line feed + cut command).

---

## 4. Route Sales Billing & Instant Printing

1. On `/van/billing`, enter the customer's items and select payment mode (**CASH** or **CREDIT**).
2. Tap **&ldquo;Finalize Sale&rdquo;**.
3. Upon invoice generation:
   - A success banner appears with invoice number (e.g. `#INV/26-27/000042`).
   - Tap **&ldquo;Print Receipt (Bluetooth)&rdquo;**.
   - The receipt prints instantly in ~1-2 seconds directly on the salesperson's belt printer!
4. **Offline Draft Replay:** If the van was out of network coverage and a bill was saved as a local draft, syncing it upon reconnection triggers the same one-click print option.
5. **Reprinting Past Bills:** The salesperson can visit `/van/bills` anytime during the round to search and reprint any invoice issued today.

---

## 5. Local Network Testing Over Wi-Fi (`mkcert`)

Since Web Bluetooth requires a secure origin:
1. When testing on desktop: use `http://localhost:3000`.
2. When testing with a physical Android phone over the Saharsa shop Wi-Fi:
   ```powershell
   # Install mkcert (if not present)
   choco install mkcert

   # Create local root CA
   mkcert -install

   # Generate certificate for local machine IP (e.g. 192.168.1.100)
   mkcert -key-file localhost-key.pem -cert-file localhost.pem localhost 127.0.0.1 192.168.1.100

   # Start Next.js with HTTPS
   pnpm dev --experimental-https
   ```
3. Transfer the generated root CA to the Android phone and install it under **Settings -> Security -> Install from storage -> CA certificate**.
4. Access `https://192.168.1.100:3000/van` directly from Chrome on the phone.

---

## 6. Handheld Thermal Printer Troubleshooting

| Symptom | Cause | Solution |
|---|---|---|
| **Device not found in Chrome list** | Printer in sleep mode or paired to another phone | Power cycle the printer. Ensure it is disconnected from any other phone. |
| **&ldquo;User cancelled the requestDevice()&rdquo;** | Dialog closed without selecting device | Tap &ldquo;Pair Printer&rdquo; again and select the device. |
| **Blank white paper prints with no text** | Thermal roll inserted upside down | Open paper compartment, flip the roll 180 degrees, and close firmly. |
| **Garbled characters or question marks** | Non-ASCII encoding or buffer overflow | JMD CART encoder converts `₹` to `Rs.` and chunks transmissions in 100-byte packets to prevent buffer overflow. |
| **Text cut off on the right** | Roll width set to 80mm on a 58mm printer | In the printer modal, tap **58mm (2-inch)** mode to format for 32 columns. |
| **Web Bluetooth unavailable error** | Unsupported browser (e.g. iOS Safari) | Use Chrome on Android, or tap the external link icon for standard browser thermal print preview. |

---

*Operational Sign-off:*
- Software Driver: `src/lib/escpos.ts` + `src/lib/bluetooth-printer.ts`
- Physical Hardware Verification: To be verified with client's physical printer in Saharsa before 15 Nov delivery.
