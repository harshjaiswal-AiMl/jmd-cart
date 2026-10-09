import { describe, it, expect } from "vitest";
import {
  calculateLineGst,
  calculateInvoiceTotals,
  formatPaiseToRupees,
  formatBasisPoints,
} from "@/lib/gst";

describe("GST Calculation Engine: Unit Tests", () => {
  it("calculates tax-inclusive MRP accurately for standard 12% GST intra-state", () => {
    // ₹112 inclusive of 12% GST: Taxable should be ₹100 (10000 paise), Tax ₹12 (1200 paise)
    // CGST = ₹6 (600 paise), SGST = ₹6 (600 paise)
    const result = calculateLineGst({
      mrpPaise: 11200,
      qty: 1,
      gstRateBp: 1200, // 12%
    });

    expect(result.lineTotalPaise).toBe(11200);
    expect(result.taxablePaise).toBe(10000);
    expect(result.taxPaise).toBe(1200);
    expect(result.cgstPaise).toBe(600);
    expect(result.sgstPaise).toBe(600);
    expect(result.igstPaise).toBe(0);
  });

  it("handles odd tax paise without rounding drift (CGST + SGST === total tax)", () => {
    // Line total: 100 paise (₹1.00) at 18% GST (1800 bp)
    // Taxable = round(100 * 10000 / 11800) = round(84.745) = 85 paise
    // Tax = 100 - 85 = 15 paise
    // CGST = round(15 / 2) = 8 paise, SGST = 15 - 8 = 7 paise
    const result = calculateLineGst({
      mrpPaise: 100,
      qty: 1,
      gstRateBp: 1800,
    });

    expect(result.taxablePaise).toBe(85);
    expect(result.taxPaise).toBe(15);
    expect(result.cgstPaise).toBe(8);
    expect(result.sgstPaise).toBe(7);
    expect(result.cgstPaise + result.sgstPaise).toBe(result.taxPaise);
  });

  it("handles inter-state sales: IGST gets full tax, CGST and SGST are 0", () => {
    const result = calculateLineGst({
      mrpPaise: 10500, // ₹105
      qty: 2,
      gstRateBp: 500, // 5%
      isInterState: true,
    });

    // Total = 21000 paise. Taxable = round(21000 * 10000 / 10500) = 20000 paise.
    // Tax = 1000 paise (₹10).
    expect(result.lineTotalPaise).toBe(21000);
    expect(result.taxablePaise).toBe(20000);
    expect(result.taxPaise).toBe(1000);
    expect(result.igstPaise).toBe(1000);
    expect(result.cgstPaise).toBe(0);
    expect(result.sgstPaise).toBe(0);
  });

  it("applies line discount before calculating tax", () => {
    // MRP ₹100 (10000 paise), 10% discount (1000 bp) -> Unit price ₹90 (9000 paise)
    // 5% GST on ₹90: Taxable = round(9000 * 10000 / 10500) = 8571 paise
    // Tax = 9000 - 8571 = 429 paise
    const result = calculateLineGst({
      mrpPaise: 10000,
      qty: 1,
      discountBp: 1000,
      gstRateBp: 500,
    });

    expect(result.unitPricePaise).toBe(9000);
    expect(result.lineTotalPaise).toBe(9000);
    expect(result.taxablePaise).toBe(8571);
    expect(result.taxPaise).toBe(429);
  });

  it("aggregates invoice totals with multiple tax slabs and rounds off to nearest rupee", () => {
    const lines = [
      {
        mrpPaise: 10000, // ₹100 at 5%
        qty: 1,
        gstRateBp: 500,
      },
      {
        mrpPaise: 25000, // ₹250 at 12%
        qty: 2,
        gstRateBp: 1200,
      },
      {
        mrpPaise: 35000, // ₹350 at 18%
        qty: 1,
        gstRateBp: 1800,
      },
    ];

    const invoice = calculateInvoiceTotals(lines);

    // Subtotal = 10000 + 50000 + 35000 = 95000 paise (₹950.00)
    expect(invoice.rawTotalPaise).toBe(95000);
    expect(invoice.totalPaise).toBe(95000); // Already clean multiple of 100
    expect(invoice.roundOffPaise).toBe(0);
    expect(invoice.taxSummaryByRate).toHaveLength(3);
  });

  it("rounds invoice total up or down to nearest rupee and shows roundOffPaise", () => {
    // Single item of ₹100.40 (10040 paise) -> rounds down to ₹100.00 (10000 paise), roundOff = -40
    const invDown = calculateInvoiceTotals([
      { mrpPaise: 10040, qty: 1, gstRateBp: 0 },
    ]);
    expect(invDown.rawTotalPaise).toBe(10040);
    expect(invDown.totalPaise).toBe(10000);
    expect(invDown.roundOffPaise).toBe(-40);

    // Single item of ₹100.60 (10060 paise) -> rounds up to ₹101.00 (10100 paise), roundOff = +40
    const invUp = calculateInvoiceTotals([
      { mrpPaise: 10060, qty: 1, gstRateBp: 0 },
    ]);
    expect(invUp.rawTotalPaise).toBe(10060);
    expect(invUp.totalPaise).toBe(10100);
    expect(invUp.roundOffPaise).toBe(40);
  });

  it("formats paise to Indian Rupee string correctly", () => {
    expect(formatPaiseToRupees(10000)).toBe("₹100.00");
    expect(formatPaiseToRupees(12345678)).toBe("₹1,23,456.78");
    expect(formatPaiseToRupees(50)).toBe("₹0.50");
    expect(formatPaiseToRupees(0)).toBe("₹0.00");
    expect(formatPaiseToRupees(-2500)).toBe("-₹25.00");
  });

  it("formats basis points to percentage correctly", () => {
    expect(formatBasisPoints(1800)).toBe("18%");
    expect(formatBasisPoints(500)).toBe("5%");
    expect(formatBasisPoints(250)).toBe("2.50%");
    expect(formatBasisPoints(0)).toBe("0%");
  });
});
