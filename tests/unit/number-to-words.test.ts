import { describe, it, expect } from "vitest";
import { amountInWords, paiseToIndianWords, rupeesToWords } from "@/lib/number-to-words";

describe("Indian Number to Words Conversion (Prompt #11 Step 2.3)", () => {
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

  it("converts exact required table values from Prompt #11: 0, 1, 11, 99, 100, 101, 999, 1,000, 12,345, 1,00,000, 12,34,567, 1,00,00,000", () => {
    // 0
    expect(amountInWords(0)).toBe("Rupees Zero Only");
    // 1 rupee (100 paise)
    expect(amountInWords(100)).toBe("Rupees One Only");
    // 11 rupees (1100 paise)
    expect(amountInWords(1100)).toBe("Rupees Eleven Only");
    // 99 rupees (9900 paise)
    expect(amountInWords(9900)).toBe("Rupees Ninety Nine Only");
    // 100 rupees (10000 paise)
    expect(amountInWords(10000)).toBe("Rupees One Hundred Only");
    // 101 rupees (10100 paise)
    expect(amountInWords(10100)).toBe("Rupees One Hundred One Only");
    // 999 rupees (99900 paise)
    expect(amountInWords(99900)).toBe("Rupees Nine Hundred Ninety Nine Only");
    // 1,000 rupees (100000 paise)
    expect(amountInWords(100000)).toBe("Rupees One Thousand Only");
    // 12,345 rupees (1234500 paise)
    expect(amountInWords(1234500)).toBe("Rupees Twelve Thousand Three Hundred Forty Five Only");
    // 1,00,000 rupees (10000000 paise)
    expect(amountInWords(10000000)).toBe("Rupees One Lakh Only");
    // 12,34,567 rupees (123456700 paise)
    expect(amountInWords(123456700)).toBe("Rupees Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Only");
    // 1,00,00,000 rupees (1000000000 paise)
    expect(amountInWords(1000000000)).toBe("Rupees One Crore Only");
  });

  it("converts values with paise: 435.50 and 0.99", () => {
    // 435.50 (43550 paise)
    expect(amountInWords(43550)).toBe(
      "Rupees Four Hundred Thirty Five and Fifty Paise Only"
    );
    // 0.99 (99 paise)
    expect(amountInWords(99)).toBe("Ninety Nine Paise Only");
    // Backward compatibility alias paiseToIndianWords
    expect(paiseToIndianWords(43550)).toBe(
      "Rupees Four Hundred Thirty Five and Fifty Paise Only"
    );
  });
});
