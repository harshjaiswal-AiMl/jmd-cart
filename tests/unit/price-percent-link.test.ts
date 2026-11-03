import { describe, it, expect } from "vitest";
import {
  calculatePercentFromPrice,
  calculatePriceFromPercent,
  paiseToRupeesString,
  rupeesStringToPaise,
  validatePriceAgainstMrp,
} from "@/modules/pricing/price-percent-link";

describe("Price ↔ Percent Linked Calculation (Task 3)", () => {
  describe("Exact Rounding Specifications", () => {
    it("calculates exact price for Rs 100 MRP @ 15% discount = Rs 85.00 (8500 paise)", () => {
      const mrpPaise = 10000; // Rs 100
      const pricePaise = calculatePriceFromPercent(mrpPaise, 15);
      expect(pricePaise).toBe(8500);
      expect(paiseToRupeesString(pricePaise)).toBe("85.00");

      const pct = calculatePercentFromPrice(mrpPaise, pricePaise);
      expect(pct).toBe("15.00");
    });

    it("calculates exact price for Rs 65 MRP @ 12.5% discount = Rs 56.88 (5688 paise)", () => {
      const mrpPaise = 6500; // Rs 65
      const pricePaise = calculatePriceFromPercent(mrpPaise, 12.5);
      // 6500 * (1 - 0.125) = 6500 * 0.875 = 5687.5 -> rounded to nearest paisa = 5688
      expect(pricePaise).toBe(5688);
      expect(paiseToRupeesString(pricePaise)).toBe("56.88");

      // Reverse check: ((6500 - 5688) / 6500) * 100 = (812 / 6500) * 100 = 12.4923% -> "12.49"
      const pct = calculatePercentFromPrice(mrpPaise, pricePaise);
      expect(pct).toBe("12.49");
    });

    it("maintains stable round-trip stability for clean discounts", () => {
      const mrpPaise = 20000; // Rs 200
      for (const discount of [5, 10, 20, 25, 30, 50]) {
        const price = calculatePriceFromPercent(mrpPaise, discount);
        const derivedPct = calculatePercentFromPrice(mrpPaise, price);
        expect(parseFloat(derivedPct)).toBeCloseTo(discount, 1);
      }
    });
  });

  describe("Edge Cases", () => {
    it("handles MRP = 0 or null by returning null / empty string", () => {
      expect(calculatePercentFromPrice(0, 1000)).toBe("");
      expect(calculatePercentFromPrice(null, 1000)).toBe("");
      expect(calculatePriceFromPercent(0, 20)).toBeNull();
      expect(calculatePriceFromPercent(null, 20)).toBeNull();
    });

    it("handles 0% discount (Price = MRP)", () => {
      const mrpPaise = 5000;
      const pricePaise = calculatePriceFromPercent(mrpPaise, 0);
      expect(pricePaise).toBe(5000);
      expect(calculatePercentFromPrice(mrpPaise, 5000)).toBe("0.00");
    });

    it("handles invalid or out-of-range percent (>= 100% or < 0%)", () => {
      const mrpPaise = 5000;
      expect(calculatePriceFromPercent(mrpPaise, 100)).toBeNull();
      expect(calculatePriceFromPercent(mrpPaise, 105)).toBeNull();
      expect(calculatePriceFromPercent(mrpPaise, -5)).toBeNull();
      expect(calculatePriceFromPercent(mrpPaise, "invalid")).toBeNull();
    });

    it("validates Legal Metrology warning when price > MRP", () => {
      const validation1 = validatePriceAgainstMrp(11000, 10000);
      expect(validation1.isValid).toBe(false);
      expect(validation1.warning).toContain("Legal Metrology");

      const validation2 = validatePriceAgainstMrp(9000, 10000);
      expect(validation2.isValid).toBe(true);
      expect(validation2.warning).toBeUndefined();
    });
  });

  describe("String conversions", () => {
    it("converts rupees string to paise accurately", () => {
      expect(rupeesStringToPaise("100")).toBe(10000);
      expect(rupeesStringToPaise("56.88")).toBe(5688);
      expect(rupeesStringToPaise("0")).toBe(0);
      expect(rupeesStringToPaise("")).toBeNull();
      expect(rupeesStringToPaise("abc")).toBeNull();
    });

    it("formats paise to 2-decimal rupees string", () => {
      expect(paiseToRupeesString(10000)).toBe("100.00");
      expect(paiseToRupeesString(5688)).toBe("56.88");
      expect(paiseToRupeesString(0)).toBe("0.00");
      expect(paiseToRupeesString(null)).toBe("");
    });
  });
});
