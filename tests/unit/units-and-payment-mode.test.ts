import { describe, it, expect } from "vitest";
import {
  normalizeUnitCode,
  getUnitMultiplier,
  formatUnitTotals,
} from "@/modules/catalog/units";
import { resolveBillModeLabel } from "@/lib/printing/bill-format";

describe("Shared Units System (Prompt #23 & Prompt #10 R5)", () => {
  it("correctly identifies all 6 units", () => {
    expect(normalizeUnitCode("Pcs")).toBe("Pcs");
    expect(normalizeUnitCode("Carton")).toBe("Carton");
    expect(normalizeUnitCode("Crt")).toBe("Carton");
    expect(normalizeUnitCode("Dozen")).toBe("Dozen");
    expect(normalizeUnitCode("Bag")).toBe("Bag");
    expect(normalizeUnitCode("Jar")).toBe("Jar");
    expect(normalizeUnitCode("Hanger")).toBe("Hanger");
    expect(normalizeUnitCode("hgr")).toBe("Hanger");
  });

  it("calculates accurate multipliers per unit", () => {
    const product = { packSize: 24, bagSize: 48 };
    expect(getUnitMultiplier("Pcs", product)).toBe(1);
    expect(getUnitMultiplier("Carton", product)).toBe(24);
    expect(getUnitMultiplier("Bag", product)).toBe(48);
    expect(getUnitMultiplier("Dozen", product)).toBe(12);
    expect(getUnitMultiplier("Hanger", product)).toBe(60); // 1 Hanger = 60 pcs
  });

  it("formats unit totals accurately summing by sold unit (R5)", () => {
    // Pure Cartons (matches Invoice 000280 scenario)
    const cartonLines = [
      { qty: 22, unitLabel: "Carton" },
      { qty: 25, unitLabel: "Carton" },
      { qty: 30, unitLabel: "Carton" },
      { qty: 10, unitLabel: "Carton" },
      { qty: 8, unitLabel: "Carton" },
      { qty: 1, unitLabel: "Carton" },
      { qty: 2, unitLabel: "Carton" },
      { qty: 6, unitLabel: "Carton" },
    ];
    expect(formatUnitTotals(cartonLines)).toBe("104.00 Carton");

    // Pure Pcs
    const pcsLines = [
      { qty: 5, unitLabel: "Pcs" },
      { qty: 7, unitLabel: "Pcs" },
    ];
    expect(formatUnitTotals(pcsLines)).toBe("12 Pcs");

    // Mixed Units
    const mixedLines = [
      { qty: 10, unitLabel: "Carton" },
      { qty: 15, unitLabel: "Pcs" },
    ];
    expect(formatUnitTotals(mixedLines)).toBe("10.00 Carton + 15 Pcs");

    // Hanger + Carton
    const hangerLines = [
      { qty: 2, unitLabel: "Hanger" },
      { qty: 5, unitLabel: "Carton" },
    ];
    expect(formatUnitTotals(hangerLines)).toBe("5.00 Carton + 2 Hanger");
  });
});

describe("Payment Mode Resolution (Prompt #10 R4)", () => {
  it("resolves UPI correctly without falling back to CREDIT", () => {
    const invoice: any = {
      totalPaise: 678400,
      paymentStatus: "PARTIAL", // Historical drift
      payments: [{ mode: "UPI", amountPaise: 678200 }],
    };
    expect(resolveBillModeLabel(invoice)).toBe("UPI");
  });

  it("resolves CASH correctly without falling back to CREDIT", () => {
    const invoice: any = {
      totalPaise: 159900,
      paymentStatus: "PARTIAL",
      payments: [{ mode: "CASH", amountPaise: 159800 }],
    };
    expect(resolveBillModeLabel(invoice)).toBe("CASH");
  });

  it("resolves CREDIT when explicitly credit or unpaid with no payments", () => {
    const invoice: any = {
      totalPaise: 500000,
      paymentStatus: "PENDING",
      payments: [{ mode: "CREDIT", amountPaise: 500000 }],
    };
    expect(resolveBillModeLabel(invoice)).toBe("CREDIT");
  });
});
