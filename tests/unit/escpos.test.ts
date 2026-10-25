import { describe, it, expect } from "vitest";
import { EscPosBuilder } from "@/lib/escpos";
import { formatInvoiceForEscPos, formatTestPrintEscPos } from "@/lib/escpos-invoice";
import { InvoiceWithDetails } from "@/modules/billing/billing.types";
import { BusinessDetails } from "@/modules/settings/settings.types";
import { InvoiceStatus, InvoiceChannel, PaymentStatus } from "@prisma/client";

describe("Task 2.5: ESC/POS Command Encoder & Receipt Formatter", () => {
  describe("EscPosBuilder Core Commands", () => {
    it("should initialize printer with ESC @", () => {
      const builder = new EscPosBuilder();
      const bytes = builder.build();
      // First two bytes must be [0x1B, 0x40]
      expect(bytes[0]).toBe(0x1b);
      expect(bytes[1]).toBe(0x40);
    });

    it("should generate correct alignment commands", () => {
      const builder = new EscPosBuilder();
      builder.align("left");
      builder.align("center");
      builder.align("right");
      const bytes = builder.build();

      // [0x1B, 0x40] (init) + [0x1B, 0x61, 0] + [0x1B, 0x61, 1] + [0x1B, 0x61, 2]
      expect(bytes.slice(2, 5)).toEqual(new Uint8Array([0x1b, 0x61, 0]));
      expect(bytes.slice(5, 8)).toEqual(new Uint8Array([0x1b, 0x61, 1]));
      expect(bytes.slice(8, 11)).toEqual(new Uint8Array([0x1b, 0x61, 2]));
    });

    it("should toggle bold and character sizing", () => {
      const builder = new EscPosBuilder();
      builder.bold(true);
      builder.bold(false);
      builder.size("double-height");
      builder.size("double-size");
      builder.normal();
      const bytes = builder.build();

      // Bold on [0x1B, 0x45, 1], Bold off [0x1B, 0x45, 0]
      expect(bytes.slice(2, 5)).toEqual(new Uint8Array([0x1b, 0x45, 1]));
      expect(bytes.slice(5, 8)).toEqual(new Uint8Array([0x1b, 0x45, 0]));
      // Double height [0x1D, 0x21, 0x01]
      expect(bytes.slice(8, 11)).toEqual(new Uint8Array([0x1d, 0x21, 0x01]));
      // Double size [0x1D, 0x21, 0x11]
      expect(bytes.slice(11, 14)).toEqual(new Uint8Array([0x1d, 0x21, 0x11]));
    });

    it("should sanitize Indian Rupee symbol (₹) to Rs. to prevent corrupted characters", () => {
      const builder = new EscPosBuilder();
      builder.text("Total: ₹550.00");
      const bytes = builder.build();

      const text = String.fromCharCode(...Array.from(bytes.slice(2)));
      expect(text).toBe("Total: Rs.550.00");
      expect(text).not.toContain("₹");
    });

    it("should format two-column key-value lines with exact width padding", () => {
      const builder = new EscPosBuilder();
      builder.twoColumn("TOTAL:", "Rs.1,250.00", 32);
      const bytes = builder.build();

      // Slice after [0x1B, 0x40] init, remove trailing LF (0x0A)
      const lineBytes = bytes.slice(2, -1);
      const lineStr = String.fromCharCode(...Array.from(lineBytes));

      expect(lineStr.length).toBe(32);
      expect(lineStr.startsWith("TOTAL:")).toBe(true);
      expect(lineStr.endsWith("Rs.1,250.00")).toBe(true);
    });

    it("should format table columns with accurate widths and alignments", () => {
      const builder = new EscPosBuilder();
      builder.tableRow([
        { text: "Item Name", width: 16, align: "left" },
        { text: "5", width: 5, align: "right" },
        { text: "Rs.250.00", width: 11, align: "right" },
      ]);
      const bytes = builder.build();

      const lineBytes = bytes.slice(2, -1);
      const lineStr = String.fromCharCode(...Array.from(lineBytes));

      expect(lineStr.length).toBe(32);
      expect(lineStr.startsWith("Item Name       ")).toBe(true);
      expect(lineStr.endsWith("  Rs.250.00")).toBe(true);
    });

    it("should generate paper feed and cut commands", () => {
      const builder = new EscPosBuilder();
      builder.feed(4);
      builder.cut();
      const bytes = builder.build();

      // Feed 4: [0x1B, 0x64, 4]
      expect(bytes.slice(2, 5)).toEqual(new Uint8Array([0x1b, 0x64, 4]));
      // Partial cut: [0x1D, 0x56, 0x42, 0x00]
      expect(bytes.slice(5, 9)).toEqual(new Uint8Array([0x1d, 0x56, 0x42, 0x00]));
    });
  });

  describe("Invoice & Test Slip ESC/POS Formatting", () => {
    const mockBusiness: BusinessDetails = {
      legalName: "JMD Traders Private Limited",
      tradeName: "JMD CART",
      gstin: "10ABCDE1234F1Z5",
      fssai: "10422000000123",
      address: "Main Market, Station Road, Saharsa, Bihar - 852201",
      phone: "9876543210",
      email: "billing@jmdcart.com",
      upiId: "jmdcart@upi",
    };

    const mockInvoice: InvoiceWithDetails = {
      id: "inv-test-vb-01",
      branchId: 1,
      number: "INV/26-27/000042",
      fy: "26-27",
      status: InvoiceStatus.FINAL,
      channel: InvoiceChannel.VAN,
      locationId: "loc-van-01",
      partyId: "party-kirana-01",
      buyerType: "RETAIL",
      subtotalPaise: 60000,
      discountPaise: 4800,
      taxablePaise: 52571,
      cgstPaise: 1314,
      sgstPaise: 1315,
      igstPaise: 0,
      roundOffPaise: 0,
      totalPaise: 55200,
      paymentStatus: PaymentStatus.PAID,
      idempotencyKey: "test_key_123",
      createdBy: "user-sales",
      creditOverride: false,
      creditOverrideReason: null,
      creditOverrideBy: null,
      creditOverrideUser: null,
      notes: null,
      finalizedAt: new Date("2026-10-10T11:30:00Z"),
      irn: null,
      qr: null,
      createdAt: new Date("2026-10-10T11:30:00Z"),
      updatedAt: new Date("2026-10-10T11:30:00Z"),
      location: {
        id: "loc-van-01",
        name: "Van 1 (BR-19-T-1234)",
        type: "VAN",
        branchId: 1,
        assignedUserId: "user-sales",
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      party: {
        id: "party-kirana-01",
        branchId: 1,
        name: "Gupta Kirana Store",
        phone: "9876500001",
        email: null,
        type: "RETAILER",
        address: "Purab Bazar, Saharsa",
        gstin: null,
        companyId: null,
        creditEnabled: true,
        creditLimitPaise: 100000,
        creditDays: 7,
        tallyRef: null,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      creator: null,
      items: [
        {
          id: "item-1",
          invoiceId: "inv-test-vb-01",
          productId: "prod-1",
          qty: 12,
          mrpPaise: 5000,
          discountBp: 800,
          unitPricePaise: 4600,
          taxablePaise: 52571,
          gstRateBp: 500,
          taxPaise: 2629,
          hsn: "21069099",
          product: {
            id: "prod-1",
            name: "Bikaji Bhujia 400g Pouch",
            shortCode: "BIK_BHU_400",
            packSize: 10,
            packLabel: "10 pcs / box",
          },
        },
      ],
      payments: [
        {
          id: "pmt-1",
          invoiceId: "inv-test-vb-01",
          receiptNo: null,
          branchId: 1,
          partyId: "party-kirana-01",
          mode: "CASH",
          amountPaise: 55200,
          notes: null,
          vanLocationId: null,
          receivedBy: "user-sales",
          createdAt: new Date(),
        },
      ],
      creditNotes: [],
    };

    it("should format 58mm (32 chars) receipt with store header, item lines, and tear cut", () => {
      const bytes = formatInvoiceForEscPos(mockInvoice, mockBusiness, { paperWidth: 58 });
      expect(bytes.length).toBeGreaterThan(100);

      const decoded = String.fromCharCode(...Array.from(bytes));
      expect(decoded).toContain("JMD CART");
      expect(decoded).toContain("INV/26-27/000042");
      expect(decoded).toContain("Gupta Kirana Store");
      expect(decoded).toContain("Bikaji Bhujia 400g Pouch");
      expect(decoded).toContain("12 pcs @ Rs.46.00");
      expect(decoded).toContain("TOTAL:");
      expect(decoded).toContain("Rs.552.00");
      expect(decoded).toContain("Paid (CASH):");
      expect(decoded).toContain("Thank You! Visit Again!");

      // Verify trailing cut command [0x1D, 0x56, 0x42, 0x00]
      const lastFour = bytes.slice(-4);
      expect(lastFour).toEqual(new Uint8Array([0x1d, 0x56, 0x42, 0x00]));
    });

    it("should format 80mm (48 chars) receipt with wider columns", () => {
      const bytes = formatInvoiceForEscPos(mockInvoice, mockBusiness, { paperWidth: 80 });
      expect(bytes.length).toBeGreaterThan(100);

      const decoded = String.fromCharCode(...Array.from(bytes));
      expect(decoded).toContain("JMD CART");
      expect(decoded).toContain("INV/26-27/000042");
      expect(decoded).toContain("------------------------------------------------"); // 48 dashes
    });

    it("should format a clean diagnostics test slip", () => {
      const bytes = formatTestPrintEscPos(mockBusiness, { paperWidth: 58 });
      const decoded = String.fromCharCode(...Array.from(bytes));

      expect(decoded).toContain("JMD CART");
      expect(decoded).toContain("PRINTER TEST SLIP");
      expect(decoded).toContain("58mm Thermal Bluetooth Mode");
      expect(decoded).toContain("STATUS:");
      expect(decoded).toContain("SUCCESS! READY FOR VAN SALES");

      // Verify trailing cut command
      const lastFour = bytes.slice(-4);
      expect(lastFour).toEqual(new Uint8Array([0x1d, 0x56, 0x42, 0x00]));
    });
  });
});
