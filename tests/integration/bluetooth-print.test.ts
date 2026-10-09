import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { billingService } from "@/modules/billing/billing.service";
import { settingsService } from "@/modules/settings/settings.service";
import { vanService } from "@/modules/van/van.service";
import { stockService } from "@/modules/stock/stock.service";
import { formatInvoiceForEscPos, formatTestPrintEscPos } from "@/lib/escpos-invoice";
import {
  UserRole,
  LocationType,
  InvoiceChannel,
  PaymentMode,
  MovementType,
} from "@prisma/client";

describe("Task 2.5: Van Bluetooth ESC/POS Print Integration", () => {
  let vanLoc: { id: string; name: string };
  let godownLoc: { id: string; name: string };
  let salesUser: { id: string; name: string; role: UserRole };
  let testProduct: { id: string; name: string; mrpPaise: number; packSize: number };
  let testParty: { id: string; name: string };

  beforeEach(async () => {
    godownLoc = await prisma.location.findFirstOrThrow({
      where: { type: LocationType.GODOWN, active: true },
    });

    salesUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.SALESPERSON },
    });

    vanLoc = await prisma.location.upsert({
      where: { id: "test-van-bt" },
      update: { assignedUserId: salesUser.id, active: true },
      create: {
        id: "test-van-bt",
        name: "Test Van BT (BR-19-T-5555)",
        type: LocationType.VAN,
        assignedUserId: salesUser.id,
        active: true,
      },
    });

    await prisma.vanDay.updateMany({
      where: { vanLocationId: vanLoc.id, status: "OPEN" },
      data: { status: "CLOSED" },
    });

    const runCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    testProduct = await prisma.product.create({
      data: {
        name: `Bluetooth Test Biscuits ${runCode}`,
        shortCode: `BT_${runCode}`,
        hsn: "19053100",
        gstRateBp: 1800, // 18%
        mrpPaise: 4000, // Rs 40
        packSize: 12,
        packLabel: "12 pcs / carton",
      },
    });

    // Provide stock in Central Godown
    await stockService.postMovement({
      type: MovementType.PURCHASE_RECEIPT,
      productId: testProduct.id,
      fromLocationId: null,
      toLocationId: godownLoc.id,
      qty: 600,
      referenceType: "TEST",
      idempotencyKey: `init_godown_bt_${Date.now()}_${Math.random()}`,
    });

    // Create party
    testParty = await prisma.party.create({
      data: {
        id: `test-party-bt-${runCode}`,
        name: `Saharsa Kirana Store ${runCode}`,
        phone: "9876543219",
        type: "RETAILER",
        creditEnabled: true,
        creditLimitPaise: 50000,
      },
    });

    // Load van stock: 5 cartons * 12 = 60 pieces
    await vanService.createVanIssueSheet(UserRole.SUPER_ADMIN, salesUser.id, {
      vanLocationId: vanLoc.id,
      notes: "Morning load for bluetooth print route test",
      items: [{ productId: testProduct.id, cartons: 5 }],
    });
  });

  it("should finalize van sale, load invoice details, and generate valid 58mm ESC/POS thermal bytes", async () => {
    // 1. Finalize van invoice for 6 pieces (6 * Rs 40 = Rs 240 = 24000 paise)
    const idempotencyKey = `bt_invoice_${Date.now()}`;
    const invoiceSummary = await billingService.finalizeInvoice(
      UserRole.SALESPERSON,
      {
        channel: InvoiceChannel.VAN,
        locationId: vanLoc.id,
        partyId: testParty.id,
        idempotencyKey,
        items: [{ productId: testProduct.id, qty: 6 }],
        payments: [{ mode: PaymentMode.CASH, amountPaise: 24000 }],
      },
      salesUser.id
    );

    expect(invoiceSummary.id).toBeDefined();

    // 2. Fetch full invoice with details and business settings
    const invoice = await billingService.getInvoiceById(invoiceSummary.id);
    expect(invoice).not.toBeNull();
    expect(invoice?.party?.name).toBe(testParty.name);

    const business = await settingsService.getBusinessDetails();
    expect(business.tradeName).toBeDefined();

    // 3. Format into 58mm ESC/POS bytes
    const escPos58 = formatInvoiceForEscPos(invoice!, business, { paperWidth: 58 });
    expect(escPos58).toBeInstanceOf(Uint8Array);
    expect(escPos58.length).toBeGreaterThan(200);

    // 4. Verify ESC/POS byte sequence characteristics
    // Must start with ESC @ (0x1B, 0x40)
    expect(escPos58[0]).toBe(0x1b);
    expect(escPos58[1]).toBe(0x40);

    // Must end with partial paper cut (0x1D, 0x56, 0x42, 0x00)
    const cutBytes = escPos58.slice(-4);
    expect(cutBytes).toEqual(new Uint8Array([0x1d, 0x56, 0x42, 0x00]));

    // Decoded string content verification
    const textContent = String.fromCharCode(...Array.from(escPos58));
    expect(textContent).toContain(business.tradeName);
    expect(textContent).toContain(invoice!.number);
    expect(textContent).toContain(testParty.name);
    expect(textContent).toContain("Bluetooth Test Biscuits");
    expect(textContent).toContain("6 pcs @ Rs.40.00");
    expect(textContent).toContain("TOTAL:");
    expect(textContent).toContain("Rs.240.00");
    expect(textContent).toContain("Paid (CASH):");
    expect(textContent).toContain("Thank You! Visit Again!");
  });

  it("should format valid 80mm ESC/POS thermal bytes for wider rolls", async () => {
    const idempotencyKey = `bt_invoice_80_${Date.now()}`;
    const invoiceSummary = await billingService.finalizeInvoice(
      UserRole.SALESPERSON,
      {
        channel: InvoiceChannel.VAN,
        locationId: vanLoc.id,
        partyId: testParty.id,
        idempotencyKey,
        items: [{ productId: testProduct.id, qty: 10 }],
        payments: [{ mode: PaymentMode.CASH, amountPaise: 36800 }], // 10 pcs @ 40 = 400 - 8% slab = 368
      },
      salesUser.id
    );

    const invoice = await billingService.getInvoiceById(invoiceSummary.id);
    const business = await settingsService.getBusinessDetails();

    const escPos80 = formatInvoiceForEscPos(invoice!, business, { paperWidth: 80 });
    expect(escPos80).toBeInstanceOf(Uint8Array);

    const textContent = String.fromCharCode(...Array.from(escPos80));
    expect(textContent).toContain("------------------------------------------------"); // 48 chars rule
    expect(textContent).toContain(invoice!.number);
  });

  it("should format valid diagnostic test slip with cut command", async () => {
    const business = await settingsService.getBusinessDetails();
    const testSlipBytes = formatTestPrintEscPos(business, { paperWidth: 58 });

    expect(testSlipBytes[0]).toBe(0x1b);
    expect(testSlipBytes[1]).toBe(0x40);

    const textContent = String.fromCharCode(...Array.from(testSlipBytes));
    expect(textContent).toContain("PRINTER TEST SLIP");
    expect(textContent).toContain("58mm Thermal Bluetooth Mode");
    expect(textContent).toContain("SUCCESS! READY FOR VAN SALES");

    const cutBytes = testSlipBytes.slice(-4);
    expect(cutBytes).toEqual(new Uint8Array([0x1d, 0x56, 0x42, 0x00]));
  });
});
