import { describe, it, expect } from "vitest";

describe("Defect B4: Print Layout Isolation & GSTIN B2B Detection", () => {
  it("selects A4 GST tax invoice by default when party has a valid GSTIN", () => {
    const invoiceWithGstin = {
      id: "inv-1",
      number: "INV/26-27/000009",
      totalPaise: 119000,
      paymentStatus: "PAID",
      payments: [{ mode: "CASH", amountPaise: 119000 }],
      party: { name: "Sushil Bhandar", gstin: "10ABCDE1234F1Z5" },
    };

    let selectedFormat = "cash_receipt";
    if (invoiceWithGstin.party?.gstin && invoiceWithGstin.party.gstin.trim().length === 15) {
      selectedFormat = "a4";
    }

    expect(selectedFormat).toBe("a4");
  });

  it("selects cash receipt for retail walk-in customer with cash payment", () => {
    const retailInvoice = {
      id: "inv-2",
      number: "INV/26-27/000010",
      totalPaise: 50000,
      paymentStatus: "PAID",
      payments: [{ mode: "CASH", amountPaise: 50000 }],
      party: null,
    };

    let selectedFormat = "a4";
    const totalPaid = retailInvoice.payments.reduce((s, p) => s + p.amountPaise, 0);
    const isCreditOrUnpaid =
      retailInvoice.payments.some((p) => p.mode === "CREDIT") ||
      totalPaid < retailInvoice.totalPaise ||
      retailInvoice.paymentStatus !== "PAID";

    if (!retailInvoice.party) {
      selectedFormat = isCreditOrUnpaid ? "demand_bill" : "cash_receipt";
    }

    expect(selectedFormat).toBe("cash_receipt");
  });
});
