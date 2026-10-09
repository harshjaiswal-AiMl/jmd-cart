import { describe, it, expect } from "vitest";
import { paiseToIndianWords, rupeesToWords } from "@/lib/number-to-words";

describe("Indian Number to Words Conversion", () => {
  it("converts basic rupee integers to words", () => {
    expect(rupeesToWords(0)).toBe("Zero");
    expect(rupeesToWords(5)).toBe("Five");
    expect(rupeesToWords(18)).toBe("Eighteen");
    expect(rupeesToWords(45)).toBe("Forty Five");
    expect(rupeesToWords(100)).toBe("One Hundred");
    expect(rupeesToWords(350)).toBe("Three Hundred Fifty");
    expect(rupeesToWords(1000)).toBe("One Thousand");
    expect(rupeesToWords(4250)).toBe("Four Thousand Two Hundred Fifty");
  });

  it("converts Lakhs and Crores accurately", () => {
    expect(rupeesToWords(100000)).toBe("One Lakh");
    expect(rupeesToWords(2500000)).toBe("Twenty Five Lakh");
    expect(rupeesToWords(10000000)).toBe("One Crore");
    expect(rupeesToWords(15234567)).toBe(
      "One Crore Fifty Two Lakh Thirty Four Thousand Five Hundred Sixty Seven"
    );
  });

  it("converts integer paise amounts to Indian currency words format", () => {
    expect(paiseToIndianWords(0)).toBe("Zero Rupees Only");
    // ₹10.00
    expect(paiseToIndianWords(1000)).toBe("Rupees Ten Only");
    // ₹4,250.00
    expect(paiseToIndianWords(425000)).toBe("Rupees Four Thousand Two Hundred Fifty Only");
    // ₹4,250.50
    expect(paiseToIndianWords(425050)).toBe(
      "Rupees Four Thousand Two Hundred Fifty and Fifty Paise Only"
    );
    // ₹0.75
    expect(paiseToIndianWords(75)).toBe("Seventy Five Paise Only");
    // ₹1,00,000.00
    expect(paiseToIndianWords(10000000)).toBe("Rupees One Lakh Only");
  });
});
