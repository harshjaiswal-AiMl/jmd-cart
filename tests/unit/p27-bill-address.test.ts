import { describe, it, expect } from "vitest";
import { buildInvoiceViewModel } from "@/modules/billing/invoice-view-model";
import { renderDirectPrintHtml } from "@/lib/printing/bill-html";
import { InvoiceWithDetails } from "@/modules/billing/billing.types";
import { BusinessDetails } from "@/modules/settings/settings.types";

const mockBusiness: BusinessDetails = {
  legalName: "JAI MATA DI ENTERPRISES",
  tradeName: "JMD CART",
  address: "Station Road, Saharsa, Bihar - 852201",
  phone: "7979749009",
  gstin: "10ABCDE1234F1Z5",
  fssai: "12345678901234",
  email: "support@jmdcart.com",
  upiId: "jmd@upi",
};

function createMockInvoice(overrides: Partial<InvoiceWithDetails> = {}): InvoiceWithDetails {
  return {
    id: "inv-test-1",
    number: "INV/26-27/000100",
    orderId: null,
    partyId: null,
    channel: "SHOP",
    status: "FINAL",
    documentType: "TAX_INVOICE",
    buyerType: "RETAIL",
    customerName: "Ramesh Kumar",
    customerPhone: "9876543210",
    customerAddress: null,
    agentCodeSnapshot: null,
    subtotalPaise: 10000,
    discountPaise: 0,
    taxablePaise: 9500,
    cgstPaise: 250,
    sgstPaise: 250,
    igstPaise: 0,
    roundOffPaise: 0,
    totalPaise: 10000,
    paymentStatus: "PAID",
    invoiceDate: new Date("2026-11-18T10:00:00Z"),
    createdAt: new Date("2026-11-18T10:00:00Z"),
    updatedAt: new Date("2026-11-18T10:00:00Z"),
    version: 1,
    isRevised: false,
    items: [
      {
        id: "item-1",
        invoiceId: "inv-test-1",
        productId: "prod-1",
        qty: 1,
        mrpPaise: 10000,
        unitPricePaise: 9500,
        discountPaise: 0,
        taxablePaise: 9500,
        gstRateBp: 500,
        taxPaise: 500,
        cgstPaise: 250,
        sgstPaise: 250,
        igstPaise: 0,
        unitLabel: "Pcs",
        product: {
          id: "prod-1",
          name: "Haldiram Bhujia",
          weight: "400g",
          packSize: 1,
          packLabel: "Pcs",
        },
      } as any,
    ],
    payments: [{ id: "pay-1", invoiceId: "inv-test-1", mode: "CASH", amountPaise: 10000, reference: null, createdAt: new Date() } as any],
    party: null,
    ...overrides,
  } as InvoiceWithDetails;
}

describe("Prompt 27 - Part B: Customer Address on Bills", () => {
  it("prefers customerAddress snapshot when present", () => {
    const inv = createMockInvoice({
      customerAddress: "Ward 5, Main Road, Supaul, Bihar",
      party: {
        id: "p1",
        name: "Ramesh Party",
        phone: "9876543210",
        address: "Old Party Address, Saharsa",
      } as any,
    });

    const vm = buildInvoiceViewModel(inv, mockBusiness);
    expect(vm.customer.address).toBe("Ward 5, Main Road, Supaul, Bihar");
  });

  it("falls back to party address when snapshot is empty", () => {
    const inv = createMockInvoice({
      customerAddress: null,
      party: {
        id: "p1",
        name: "Ramesh Party",
        phone: "9876543210",
        address: "Old Party Address, Saharsa",
      } as any,
    });

    const vm = buildInvoiceViewModel(inv, mockBusiness);
    expect(vm.customer.address).toBe("Old Party Address, Saharsa");
  });

  it("omits address when both snapshot and party address are empty", () => {
    const inv = createMockInvoice({
      customerAddress: null,
      party: null,
    });

    const vm = buildInvoiceViewModel(inv, mockBusiness);
    expect(vm.customer.address).toBeNull();
  });

  it("renders address directly under Mobile in 80mm thermal bill HTML", () => {
    const inv = createMockInvoice({
      customerAddress: "Ward 5, Main Road, Supaul, Bihar",
    });

    const html = renderDirectPrintHtml(inv, mockBusiness, "thermal");

    // Must contain Party, Mobile, Address in order
    const partyIdx = html.indexOf("Party");
    const mobileIdx = html.indexOf("Mobile");
    const addressIdx = html.indexOf("Address");
    const modeIdx = html.indexOf("Mode");

    expect(partyIdx).toBeGreaterThan(-1);
    expect(mobileIdx).toBeGreaterThan(partyIdx);
    expect(addressIdx).toBeGreaterThan(mobileIdx);
    expect(modeIdx).toBeGreaterThan(addressIdx);
    expect(html).toContain("Ward 5, Main Road, Supaul, Bihar");
  });

  it("does not render empty Address label when address is absent", () => {
    const inv = createMockInvoice({
      customerAddress: null,
      party: null,
    });

    const html = renderDirectPrintHtml(inv, mockBusiness, "thermal");
    expect(html).not.toContain("Address");
  });
});
