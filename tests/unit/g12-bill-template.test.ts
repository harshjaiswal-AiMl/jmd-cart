import { describe, it, expect } from "vitest";
import { renderDirectPrintHtml } from "@/lib/printing/bill-html";
import { InvoiceStatus, InvoiceChannel, PaymentStatus, PaymentMode, LocationType, PartyType } from "@prisma/client";
import { InvoiceWithDetails } from "@/modules/billing/billing.types";
import { BusinessDetails } from "@/modules/settings/settings.types";

const mockBusiness: BusinessDetails = {
  legalName: "JMD Enterprises",
  tradeName: "JMD Cart",
  gstin: "10ABCDE1234F1Z5",
  fssai: "10019011000123",
  address: "Main Road, Saharsa, Bihar 852201",
  phone: "7979749009",
  email: "support@jmdcart.com",
  upiId: "jmdcart@icici",
  bankDetails: { bankName: "", accountNumber: "", ifsc: "", branch: "" },
};

const makeInvoice = (overrides: Partial<InvoiceWithDetails> = {}): InvoiceWithDetails => ({
  id: "inv-g12-1",
  branchId: 1,
  number: "INV/26-27/001001",
  fy: "26-27",
  status: InvoiceStatus.FINAL,
  channel: InvoiceChannel.SHOP,
  locationId: "loc-shop",
  partyId: "party-1",
  buyerType: "RETAILER",
  subtotalPaise: 50000,
  discountPaise: 0,
  taxablePaise: 47619,
  cgstPaise: 1190,
  sgstPaise: 1191,
  igstPaise: 0,
  roundOffPaise: 0,
  totalPaise: 50000,
  paymentStatus: PaymentStatus.PENDING,
  idempotencyKey: "k1",
  createdBy: "u1",
  creator: null,
  finalizedAt: new Date("2026-11-10T09:00:00Z"),
  irn: null,
  qr: null,
  notes: null,
  creditOverride: false,
  creditOverrideReason: null,
  creditOverrideBy: null,
  creditOverrideUser: null,
  customerName: "Gupta Kirana",
  customerPhone: "9876543210",
  customerAddress: "Saharsa",
  agentUserId: null,
  agentCodeSnapshot: null,
  documentType: "RETAIL",
  pricingTier: "B",
  invoiceDate: new Date("2026-11-10T09:00:00Z"),
  version: 1,
  isRevised: false,
  dateChangeReason: null,
  isPostDated: false,
  postDatedReason: null,
  createdAt: new Date("2026-11-10T09:00:00Z"),
  updatedAt: new Date("2026-11-10T09:00:00Z"),
  agentUser: null,
  creditNotes: [],
  revisions: [],
  location: {
    id: "loc-shop",
    name: "Main Shop",
    type: LocationType.SHOP,
    active: true,
    branchId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    assignedUserId: null,
  },
  party: {
    id: "party-1",
    branchId: 1,
    type: PartyType.RETAILER,
    name: "Gupta Kirana",
    nameHi: null,
    nameHiSource: null,
    phone: "9876543210",
    email: null,
    gstin: "10XXXXX1234X1Z5",
    address: "Saharsa",
    creditEnabled: true,
    creditLimitPaise: 500000,
    creditDays: 15,
    tallyRef: null,
    needsReview: false,
    bookedByProId: null,
    companyId: null,
    active: true,
    messagingPreference: "AUTO",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  items: [
    {
      id: "item-1",
      invoiceId: "inv-g12-1",
      productId: "p1",
      qty: 6,
      mrpPaise: 5000,
      discountBp: 0,
      unitPricePaise: 4500,
      taxablePaise: 25714,
      gstRateBp: 500,
      taxPaise: 1286,
      hsn: "2106",
      unitLabel: "Pcs",
      originalMrpPaise: 5000,
      mrpOverridden: false,
      rateOverridden: false,
      product: {
        id: "p1",
        name: "Bikaji Bhujia 200gm",
        shortCode: "BIK200",
        weight: "200g",
        packSize: 20,
        packLabel: "Carton",
      },
    },
    {
      id: "item-2",
      invoiceId: "inv-g12-1",
      productId: "p2",
      qty: 40,
      mrpPaise: 1000,
      discountBp: 0,
      unitPricePaise: 575,
      taxablePaise: 21905,
      gstRateBp: 500,
      taxPaise: 1095,
      hsn: "1905",
      unitLabel: "Carton",
      originalMrpPaise: 1000,
      mrpOverridden: false,
      rateOverridden: false,
      product: {
        id: "p2",
        name: "Marie Biscuit",
        shortCode: "MAR20",
        weight: null,
        packSize: 20,
        packLabel: "Carton",
      },
    },
  ],
  payments: [
    {
      id: "pay-1",
      branchId: 1,
      invoiceId: "inv-g12-1",
      partyId: "party-1",
      receiptNo: "RCP-1",
      mode: PaymentMode.CREDIT,
      amountPaise: 50000,
      notes: null,
      vanLocationId: null,
      receivedBy: "u1",
      effectiveDate: null,
      createdAt: new Date(),
    },
  ],
  ...overrides,
});

describe("G12: Busy-Style 2-Row Cash/UPI Thermal & Restored Credit Templates", () => {
  it("renders 4 headers (Sl | Product | Price | Amt.) with 2-row item display and pitch-black bold contrast for CASH/UPI", () => {
    const cashInvoice = makeInvoice({
      paymentStatus: PaymentStatus.PAID,
      payments: [
        {
          id: "pay-cash-1",
          branchId: 1,
          invoiceId: "inv-g12-1",
          partyId: "party-1",
          receiptNo: "RCP-2",
          mode: PaymentMode.CASH,
          amountPaise: 50000,
          notes: null,
          vanLocationId: null,
          receivedBy: "u1",
          effectiveDate: null,
          createdAt: new Date(),
        },
      ],
    });
    const html = renderDirectPrintHtml(cashInvoice, mockBusiness, "thermal");

    // Extract <thead> columns inside table.bill-table (R4 5-column Epson TM-T82 format)
    const theadMatch = html.match(/<table class="bill-table">[\s\S]*?<thead>([\s\S]*?)<\/thead>/);
    const thMatches = theadMatch?.[1].match(/<th[^>]*>.*?<\/th>/g) || [];
    expect(thMatches.length).toBe(5);
    expect(thMatches.join(" ")).toContain("Sl No");
    expect(thMatches.join(" ")).toContain("Product");
    expect(thMatches.join(" ")).toContain("Qty");
    expect(thMatches.join(" ")).toContain("Rate");
    expect(thMatches.join(" ")).toContain("Amount");

    expect(html).toContain("6 Pcs");
    expect(html).toContain("2 Crt");
    expect(html).toContain("45.00");
    expect(html).toContain("115.00");
    expect(html).not.toContain("Disc%");

    // Monochrome high-contrast typography & thermal rules (11px-17px)
    expect(html).toContain("#000000");
    expect(html).toContain("jmd-cart-logo-thermal.png");
    expect(html).toContain("font-size: 17px");
    expect(html).toContain("@page {");
    expect(html).toContain("margin: 0;");
    expect(html).toContain("THANK YOU! VISIT AGAIN!");
    expect(html).toContain("CALL US FOR FREE DOOR DELIVERY");
    expect(html).toContain("GST included");
  });

  it("renders R4 Credit Thermal (plain bold Amount Pending without DUES/stamp) & A5 Demand Bill templates", () => {
    const htmlThermal = renderDirectPrintHtml(makeInvoice(), mockBusiness, "thermal");
    const bodyOnly = htmlThermal.replace(/<style[\s\S]*?<\/style>/gi, "");
    expect(bodyOnly).not.toMatch(/\b(dues|outstanding|previous balance|credit limit|stamp)\b/i);
    expect(bodyOnly).toContain("CREDIT");
    expect(bodyOnly).toContain("Gupta Kirana");
    expect(bodyOnly).toContain("Amount Pending: ₹");

    const htmlA5 = renderDirectPrintHtml(makeInvoice(), mockBusiness, "a4");
    expect(htmlA5).toContain("size: A5 portrait");
    expect(htmlA5).toContain("Demand Bill");
    expect(htmlA5).toContain("Descriptions of Goods");
    expect(htmlA5).toContain("Receiver's Signature");
    expect(htmlA5).toContain("Authorised Signatory");
  });

  it("includes HSN summary below table for GST bills and CANCELLED watermark when voided", () => {
    const cashGst = makeInvoice({
      documentType: "GST",
      status: InvoiceStatus.CANCELLED,
      paymentStatus: PaymentStatus.PAID,
      payments: [
        {
          id: "pay-upi-1",
          branchId: 1,
          invoiceId: "inv-g12-1",
          partyId: "party-1",
          receiptNo: "RCP-3",
          mode: PaymentMode.UPI,
          amountPaise: 50000,
          notes: null,
          vanLocationId: null,
          receivedBy: "u1",
          effectiveDate: null,
          createdAt: new Date(),
        },
      ],
    });
    const html = renderDirectPrintHtml(cashGst, mockBusiness, "a4");
    expect(html).toContain("GST &amp; HSN TAX SUMMARY");
    expect(html).toContain("2106 (5%)");
    expect(html).toContain("CANCELLED");
    expect(html).toContain("font-size: 11.5pt");
    expect(html).toContain("font-size: 16pt");
  });
});
