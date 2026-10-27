import { describe, it, expect } from "vitest";
import { buildInvoiceViewModel } from "@/modules/billing/invoice-view-model";
import { formatInvoiceForEscPos } from "@/lib/escpos-invoice";
import { InvoiceStatus, InvoiceChannel, PaymentStatus, LocationType } from "@prisma/client";
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
  bankDetails: {
    bankName: "ICICI Bank",
    accountNumber: "1234567890",
    ifsc: "ICIC0001234",
    branch: "Saharsa",
  },
};

describe("Prompt #12 Part A: Receipt and Invoice Tweaks", () => {
  const baseInvoice: InvoiceWithDetails = {
    id: "inv-p12-001",
    branchId: 1,
    number: "INV/26-27/000999",
    fy: "26-27",
    status: InvoiceStatus.FINAL,
    channel: InvoiceChannel.SHOP,
    locationId: "loc-shop",
    partyId: "party-walkin",
    buyerType: "RETAIL",
    subtotalPaise: 24000,
    discountPaise: 0,
    taxablePaise: 22857,
    cgstPaise: 571,
    sgstPaise: 572,
    igstPaise: 0,
    roundOffPaise: 0,
    totalPaise: 24000,
    paymentStatus: PaymentStatus.PAID,
    idempotencyKey: "idemp_p12_001",
    createdBy: "user-cashier-1",
    customerName: "Ramesh Kumar",
    customerPhone: "9876543210",
    customerAddress: "Ward 12, Saharsa",
    agentUserId: "user-cashier-1",
    agentCodeSnapshot: "A001",
    agentUser: null,
    creditOverride: false,
    creditOverrideReason: null,
    creditOverrideBy: null,
    creditOverrideUser: null,
    notes: null,
    finalizedAt: new Date("2026-10-27T10:00:00Z"),
    irn: null,
    qr: null,
    createdAt: new Date("2026-10-27T10:00:00Z"),
    updatedAt: new Date("2026-10-27T10:00:00Z"),
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
    party: null,
    creator: null,
    payments: [],
    creditNotes: [],
    items: [
      {
        id: "item-1",
        invoiceId: "inv-p12-001",
        productId: "prod-1",
        qty: 6,
        mrpPaise: 4000,
        discountBp: 0,
        unitPricePaise: 4000,
        taxablePaise: 22857,
        gstRateBp: 500,
        taxPaise: 1143,
        hsn: "0000",
        product: {
          id: "prod-1",
          name: "Parle-G 250g",
          shortCode: "PG250",
          packSize: 1,
          packLabel: "1 Pcs",
        },
      },
    ],
  };

  it("adds Agent Code in Customer Details block right under Address", () => {
    const vm = buildInvoiceViewModel(baseInvoice, mockBusiness, {
      showAgentCode: true,
    });
    const agentRow = vm.customer.rows.find((r) => r.label === "Agent Code");
    expect(agentRow).toBeDefined();
    expect(agentRow?.value).toBe("A001");

    const addressIdx = vm.customer.rows.findIndex((r) => r.label === "Address");
    const agentIdx = vm.customer.rows.findIndex((r) => r.label === "Agent Code");
    expect(agentIdx).toBe(addressIdx + 1);
  });

  it("omits Agent Code row if invoice has no agent", () => {
    const noAgentInv = { ...baseInvoice, agentCodeSnapshot: null };
    const vm = buildInvoiceViewModel(noAgentInv, mockBusiness, {
      showAgentCode: true,
    });
    const agentRow = vm.customer.rows.find((r) => r.label === "Agent Code");
    expect(agentRow).toBeUndefined();
  });

  it("omits Agent Code on storefront view when showAgentCodeOnline is false", () => {
    const vm = buildInvoiceViewModel(baseInvoice, mockBusiness, {
      showAgentCode: true,
      showAgentCodeOnline: false,
      isStorefront: true,
    });
    const agentRow = vm.customer.rows.find((r) => r.label === "Agent Code");
    expect(agentRow).toBeUndefined();
  });

  it("labels quantity as 'Total Pcs : 6.00' on totals line", () => {
    const vm = buildInvoiceViewModel(baseInvoice, mockBusiness);
    expect(vm.totals.totalPiecesFormatted).toBe("6.00");
  });

  it("flags inclusive tax invoices as isGstIncluded", () => {
    const vm = buildInvoiceViewModel(baseInvoice, mockBusiness);
    expect(vm.totals.isGstIncluded).toBe(true);
  });

  it("hides (HSN: 0000) placeholder in item display", () => {
    const vm = buildInvoiceViewModel(baseInvoice, mockBusiness);
    expect(vm.items[0].hsn).toBe("");

    const realHsnInvoice: InvoiceWithDetails = {
      ...baseInvoice,
      items: [
        {
          ...baseInvoice.items[0],
          hsn: "151491",
        },
      ],
    };
    const vmReal = buildInvoiceViewModel(realHsnInvoice, mockBusiness);
    expect(vmReal.items[0].hsn).toBe("151491");
  });

  it("formats ESC/POS with Total Pcs : 6.00, GST included, and Agent Code", () => {
    const bytes = formatInvoiceForEscPos(baseInvoice, mockBusiness, { paperWidth: 80 });
    const decoded = String.fromCharCode(...Array.from(bytes));

    expect(decoded).toContain("Total Pcs : 6.00");
    expect(decoded).toContain("GST included");
    expect(decoded).toContain("Agent Code:");
    expect(decoded).toContain("A001");
  });
});
