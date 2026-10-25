import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { billingService } from "@/modules/billing/billing.service";
import { settingsService } from "@/modules/settings/settings.service";
import { paiseToIndianWords } from "@/lib/number-to-words";
import { formatISTDate, formatISTTime } from "@/lib/date";
import {
  UserRole,
  LocationType,
  PaymentMode,
  InvoiceChannel,
  InvoiceStatus,
} from "@prisma/client";

describe("Task 1.13: Print Templates & Invoice Retrieval", () => {
  let shopLocationId: string;
  let productId1: string;
  let productId2: string;
  let testInvoiceId: string;

  beforeAll(async () => {
    // 1. Fetch or create shop location
    let shopLoc = await prisma.location.findFirst({
      where: { type: LocationType.SHOP },
    });
    if (!shopLoc) {
      shopLoc = await prisma.location.create({
        data: { name: "Test Shop Location", type: LocationType.SHOP },
      });
    }
    shopLocationId = shopLoc.id;

    // 2. Create products with distinct GST rates (e.g. 5% and 18%)
    const timestamp = Date.now();
    const company = await prisma.company.create({
      data: { name: `Print Co ${timestamp}` },
    });
    const category = await prisma.category.create({
      data: { name: `Print Cat ${timestamp}` },
    });

    const p1 = await prisma.product.create({
      data: {
        company: { connect: { id: company.id } },
        category: { connect: { id: category.id } },
        name: `Print Item 5% ${timestamp}`,
        shortCode: `PR5_${timestamp}`.slice(0, 16),
        hsn: "21069099",
        gstRateBp: 500, // 5%
        mrpPaise: 10000, // ₹100.00
        packSize: 10,
        packLabel: "Pack of 10",
      },
    });
    productId1 = p1.id;

    const p2 = await prisma.product.create({
      data: {
        company: { connect: { id: company.id } },
        category: { connect: { id: category.id } },
        name: `Print Item 18% ${timestamp}`,
        shortCode: `PR18_${timestamp}`.slice(0, 16),
        hsn: "33051010",
        gstRateBp: 1800, // 18%
        mrpPaise: 25000, // ₹250.00
        packSize: 1,
        packLabel: "Piece",
      },
    });
    productId2 = p2.id;

    // Seed stock for these products at shop
    await prisma.stockBalance.upsert({
      where: {
        productId_locationId: { productId: p1.id, locationId: shopLocationId },
      },
      update: { qty: 200 },
      create: { productId: p1.id, locationId: shopLocationId, qty: 200 },
    });

    await prisma.stockBalance.upsert({
      where: {
        productId_locationId: { productId: p2.id, locationId: shopLocationId },
      },
      update: { qty: 100 },
      create: { productId: p2.id, locationId: shopLocationId, qty: 100 },
    });
  });

  it("finalizes an invoice and loads all relational details required by print templates", async () => {
    // Finalize invoice with multiple items
    const finalized = await billingService.finalizeInvoice(
      UserRole.SUPER_ADMIN,
      {
        channel: InvoiceChannel.SHOP,
        locationId: shopLocationId,
        idempotencyKey: `print_test_${Date.now()}`,
        items: [
          { productId: productId1, qty: 2 }, // ₹200.00 gross (5% GST)
          { productId: productId2, qty: 1 }, // ₹250.00 gross (18% GST)
        ],
        payments: [
          {
            mode: PaymentMode.CASH,
            amountPaise: 45000, // ₹450.00
          },
        ],
      }
    );


    testInvoiceId = finalized.id;

    // Verify invoice has all relations populated
    const invoice = await billingService.getInvoiceById(testInvoiceId);
    expect(invoice).not.toBeNull();
    if (!invoice) return;

    expect(invoice.number).toMatch(/^INV\/\d{2}-\d{2}\/\d{6}$/);
    expect(invoice.status).toBe(InvoiceStatus.FINAL);
    expect(invoice.location?.id).toBe(shopLocationId);
    expect(invoice.items).toHaveLength(2);
    expect(invoice.payments).toHaveLength(1);

    // Business details
    const business = await settingsService.getBusinessDetails();
    expect(business.legalName).toBeTruthy();
    expect(business.address).toBeTruthy();
    expect(business.phone).toBeTruthy();

    // Verify dates format without errors
    const istDate = formatISTDate(invoice.createdAt);
    const istTime = formatISTTime(invoice.createdAt);
    expect(istDate).toBeTruthy();
    expect(istTime).toBeTruthy();

    // Verify words conversion
    const words = paiseToIndianWords(invoice.totalPaise);
    expect(words).toContain("Rupees");
    expect(words).toContain("Only");
  });

  it("calculates accurate tax group breakdown matching invoice totals", async () => {
    const invoice = await billingService.getInvoiceById(testInvoiceId);
    expect(invoice).not.toBeNull();
    if (!invoice) return;

    // Replicate template tax grouping logic
    const taxMap = new Map<number, { taxable: number; tax: number; cgst: number; sgst: number }>();

    for (const item of invoice.items) {
      const existing = taxMap.get(item.gstRateBp) || { taxable: 0, tax: 0, cgst: 0, sgst: 0 };
      existing.taxable += item.taxablePaise;
      existing.tax += item.taxPaise;
      const cgst = Math.round(item.taxPaise / 2);
      existing.cgst += cgst;
      existing.sgst += item.taxPaise - cgst;
      taxMap.set(item.gstRateBp, existing);
    }

    // Must have 2 tax slabs: 500 bp (5%) and 1800 bp (18%)
    expect(taxMap.has(500)).toBe(true);
    expect(taxMap.has(1800)).toBe(true);

    const totalCalculatedTax = Array.from(taxMap.values()).reduce((s, g) => s + g.tax, 0);
    expect(totalCalculatedTax).toBe(invoice.cgstPaise + invoice.sgstPaise);
  });

  it("displays credit note details when an invoice is cancelled", async () => {
    const cancelRes = await billingService.cancelInvoice(
      UserRole.SUPER_ADMIN,
      {
        invoiceId: testInvoiceId,
        reason: "Customer cancelled goods at POS counter",
      }
    );

    expect(cancelRes.creditNoteId).toBeTruthy();

    const cancelledInvoice = await billingService.getInvoiceById(testInvoiceId);
    expect(cancelledInvoice).not.toBeNull();
    if (!cancelledInvoice) return;

    expect(cancelledInvoice.status).toBe(InvoiceStatus.CANCELLED);
    expect(cancelledInvoice.creditNotes).toHaveLength(1);
    expect(cancelledInvoice.creditNotes[0].number).toMatch(/^CN\/\d{2}-\d{2}\/\d{6}$/);
    expect(cancelledInvoice.creditNotes[0].reason).toBe("Customer cancelled goods at POS counter");
  });
});
