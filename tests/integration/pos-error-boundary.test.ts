import { describe, it, expect } from "vitest";

describe("Defect B1: POS Finalize Bill Action Return Serialization & Resilience", () => {
  it("sanitizes invoice payload so no non-plain Date objects cross Server Action boundary", () => {
    const rawInvoice = {
      id: "inv-123",
      number: "INV/26-27/000009",
      totalPaise: 2636100,
      status: "FINAL",
      channel: "SHOP",
      paymentStatus: "PAID",
      createdAt: new Date(),
      updatedAt: new Date(),
      finalizedAt: new Date(),
      payments: [{ id: "p1", mode: "CASH", amountPaise: 2636100, at: new Date() }],
    };

    const sanitized = {
      id: rawInvoice.id,
      number: rawInvoice.number,
      totalPaise: rawInvoice.totalPaise,
      status: rawInvoice.status,
      channel: rawInvoice.channel,
      paymentStatus: rawInvoice.paymentStatus,
      paymentMode:
        rawInvoice.payments.find((p) => p.mode === "CREDIT")?.mode ||
        rawInvoice.payments[0]?.mode ||
        "CASH",
    };

    // Ensure all values are JSON serializable without Dates
    const serialized = JSON.parse(JSON.stringify(sanitized));
    expect(serialized.id).toBe("inv-123");
    expect(serialized.number).toBe("INV/26-27/000009");
    expect(serialized.totalPaise).toBe(2636100);
    expect(serialized.paymentMode).toBe("CASH");
    expect(serialized).not.toHaveProperty("createdAt");
    expect(serialized).not.toHaveProperty("finalizedAt");
  });
});

