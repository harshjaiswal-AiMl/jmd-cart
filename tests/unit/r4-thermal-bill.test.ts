import { describe, it, expect } from "vitest";
import { renderDirectPrintHtml } from "@/lib/printing/bill-html";
import { settingsService, DEFAULT_INVOICE_PRINT_SETTINGS } from "@/modules/settings/settings.service";
import { InvoiceChannel, InvoiceStatus, PaymentMode, PaymentStatus } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const mockBusiness: any = {
  tradeName: "JMD CART",
  legalName: "JAI MATA DI",
  gstin: "10AAAAA0000A1Z5",
  fssai: "10020030040050",
  address: "Purab Bazar, Saharsa, Bihar",
  phone: "7979749009",
  email: "",
};

function makeSampleInvoice(overrides: Record<string, any> = {}): any {
  return {
    id: "inv-r4-1",
    branchId: 1,
    number: "INV/2026-27/000321",
    fy: "2026-27",
    status: InvoiceStatus.FINAL,
    channel: InvoiceChannel.SHOP,
    locationId: "loc-shop",
    partyId: "party-1",
    buyerType: "RETAILER",
    notes: null,
    subtotalPaise: 50000,
    discountPaise: 0,
    taxablePaise: 47619,
    cgstPaise: 1190,
    sgstPaise: 1191,
    igstPaise: 0,
    roundOffPaise: 0,
    totalPaise: 50000,
    paymentStatus: PaymentStatus.PAID,
    documentType: "RETAIL",
    customerName: "Gupta Kirana Store",
    customerPhone: "9876543210",
    customerAddress: "Saharsa",
    agentCodeSnapshot: null,
    createdBy: "u1",
    createdAt: new Date("2026-11-11T05:30:00Z"),
    updatedAt: new Date("2026-11-11T05:30:00Z"),
    finalizedAt: new Date("2026-11-11T05:30:00Z"),
    party: {
      id: "party-1",
      name: "Gupta Kirana Store",
      nameHi: "गुप्ता किराना स्टोर",
      phone: "9876543210",
      address: "Saharsa",
      gstin: "10XXXXX1234X1Z5",
    },
    items: [
      {
        id: "i1",
        productId: "p1",
        qty: 6,
        mrpPaise: 5000,
        discountBp: 0,
        unitPricePaise: 4500,
        taxablePaise: 25714,
        taxPaise: 1286,
        gstRateBp: 500,
        hsn: "2106",
        unitLabel: "Pcs",
        product: {
          id: "p1",
          name: "Bikaji Bhujia 200gm",
          nameHi: "बीकाजी भुजिया 200 ग्राम",
          shortCode: "BIK200",
          weight: "200g",
          packSize: 20,
          packLabel: "Carton",
        },
      },
      {
        id: "i2",
        productId: "p2",
        qty: 40,
        mrpPaise: 1000,
        discountBp: 0,
        unitPricePaise: 575,
        taxablePaise: 21905,
        taxPaise: 1095,
        gstRateBp: 500,
        hsn: "1905",
        unitLabel: "Carton",
        product: {
          id: "p2",
          name: "Saloni Mustard Oil 1Ltr Extra Virgin Pouch Long Pack",
          nameHi: "सलोनी सरसों तेल 1 लीटर",
          shortCode: "SAL1L",
          weight: "1Ltr",
          packSize: 20,
          packLabel: "Carton",
        },
      },
    ],
    payments: [
      {
        id: "pay-1",
        mode: PaymentMode.CASH,
        amountPaise: 50000,
      },
    ],
    creditNotes: [],
    ...overrides,
  };
}

describe("R4: 3-inch Thermal Bill (Epson TM-T82) & Normalized Typography", () => {
  it("defaults print.paperWidthMm = 80 and print.contentWidthMm = 72", async () => {
    expect(DEFAULT_INVOICE_PRINT_SETTINGS.paperWidthMm).toBe(80);
    expect(DEFAULT_INVOICE_PRINT_SETTINGS.contentWidthMm).toBe(72);
    const settings = await settingsService.getInvoicePrintSettings();
    expect(settings.paperWidthMm).toBe(80);
    expect(settings.contentWidthMm).toBe(72);
  });

  it("includes master logo in design/brand/ and 480px thermal logo in public/brand/", () => {
    const master = path.resolve(process.cwd(), "design/brand/jmd-cart-logo.jpg");
    const thermal = path.resolve(process.cwd(), "public/brand/jmd-cart-logo-thermal.png");
    expect(fs.existsSync(master)).toBe(true);
    expect(fs.existsSync(thermal)).toBe(true);
    // Verify PNG header IHDR width bytes === 480
    const buf = fs.readFileSync(thermal);
    expect(buf.readUInt32BE(16)).toBe(480);
  });

  it("Cash thermal bill has 480px logo first, Date/Bill/Party/Mobile/Mode header, 5 columns, 11-17px typography, NO Pending line or DUES", () => {
    const html = renderDirectPrintHtml(makeSampleInvoice(), mockBusiness, "thermal");
    expect(html).toContain("/brand/jmd-cart-logo-thermal.png");
    expect(html).toContain(`width="480"`);
    expect(html).toContain("image-rendering: pixelated");

    // Header order: logo before meta, meta before 5-column table, totals after table
    const logoIdx = html.indexOf("jmd-cart-logo-thermal.png");
    const metaIdx = html.indexOf(`class="meta-block"`);
    const tableIdx = html.indexOf(`<table class="bill-table">`);
    const grandIdx = html.indexOf(`Grand Total:`);
    expect(logoIdx).toBeGreaterThan(-1);
    expect(metaIdx).toBeGreaterThan(logoIdx);
    expect(tableIdx).toBeGreaterThan(metaIdx);
    expect(grandIdx).toBeGreaterThan(tableIdx);

    // Exact 5 table headers: Sl No | Product | Qty | Rate | Amount
    const thead = html.match(/<thead>([\s\S]*?)<\/thead>/)?.[1] || "";
    const ths = thead.match(/<th[^>]*>.*?<\/th>/g) || [];
    expect(ths.length).toBe(5);
    expect(thead).toContain("Sl No");
    expect(thead).toContain("Product");
    expect(thead).toContain("Qty");
    expect(thead).toContain("Rate");
    expect(thead).toContain("Amount");

    // Font sizes strictly within compact 8px..11px on thermal (safe against TM-T82 edge clipping)
    const pxSizes = Array.from(html.matchAll(/font-size:\s*([0-9.]+)px/g)).map((m) => Number(m[1]));
    expect(pxSizes.length).toBeGreaterThan(0);
    for (const s of pxSizes) {
      expect(s).toBeGreaterThanOrEqual(8);
      expect(s).toBeLessThanOrEqual(11);
    }

    // No Devanagari, no Amount Pending on Cash bill, no forbidden credit buzzwords, no top Ph: under logo, no tax amount prefix before "GST included"
    const body = html.replace(/<style[\s\S]*?<\/style>/gi, "");
    expect(body).not.toMatch(/[\u0900-\u097F]/);
    expect(body).not.toContain("Amount Pending:");
    expect(body).not.toMatch(/\b(DUES|OUTSTANDING|BALANCE|STAMP)\b/i);
    expect(body).not.toContain("Ph:");
    expect(body).toContain("GST included");
    expect(body).not.toMatch(/\d+(?:\.\d+)?\s+GST included/);
  });

  it("Credit thermal bill (Full Credit payments=[] PENDING and Partial Credit PARTIAL) prints Mode CREDIT and plain bold 'Amount Pending: ₹X' below Grand Total", () => {
    const fullCreditHtml = renderDirectPrintHtml(
      makeSampleInvoice({
        paymentStatus: PaymentStatus.PENDING,
        payments: [],
      }),
      mockBusiness,
      "thermal"
    );
    const fullBody = fullCreditHtml.replace(/<style[\s\S]*?<\/style>/gi, "");
    expect(fullBody).toContain("CREDIT");
    expect(fullBody).not.toContain(">CASH<");
    expect(fullBody).toContain("Amount Pending: ₹500.00");
    expect(fullBody.indexOf("Amount Pending:")).toBeGreaterThan(fullBody.indexOf("Grand Total:"));
    expect(fullBody).not.toMatch(/\b(DUES|OUTSTANDING|BALANCE|STAMP)\b/i);
    expect(fullCreditHtml).not.toMatch(/[\u0900-\u097F]/);

    const partialCreditHtml = renderDirectPrintHtml(
      makeSampleInvoice({
        paymentStatus: PaymentStatus.PARTIAL,
        payments: [{ id: "pay-cash-part", mode: PaymentMode.CASH, amountPaise: 20000 }],
      }),
      mockBusiness,
      "thermal"
    );
    const partialBody = partialCreditHtml.replace(/<style[\s\S]*?<\/style>/gi, "");
    expect(partialBody).toContain("CREDIT");
    expect(partialBody).not.toContain(">CASH<");
    expect(partialBody).toContain("Amount Pending: ₹300.00");
    expect(partialBody.indexOf("Amount Pending:")).toBeGreaterThan(partialBody.indexOf("Grand Total:"));
  });

  it("Voided thermal bill prints CANCELLED cleanly", () => {
    const html = renderDirectPrintHtml(
      makeSampleInvoice({ status: InvoiceStatus.CANCELLED }),
      mockBusiness,
      "thermal"
    );
    expect(html).toContain("CANCELLED");
    expect(html).not.toMatch(/[\u0900-\u097F]/);
  });
});
