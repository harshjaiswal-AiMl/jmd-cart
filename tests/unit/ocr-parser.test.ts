import { describe, it, expect } from "vitest";
import { TableParser, parseCurrency, parseIndianDate, parseQuantity } from "@/modules/ocr/table-parser";
import { OcrResult } from "@/modules/ocr/ocr.types";

describe("Prompt 10: Table Parser Unit Tests", () => {
  const parser = new TableParser();

  describe("Indian Currency & Date Helpers", () => {
    it("parses Indian currency formats with commas and symbols", () => {
      expect(parseCurrency("1,03,529.47")).toBe(10352947);
      expect(parseCurrency("₹ 18,37,565.00")).toBe(183756500);
      expect(parseCurrency("8.4900")).toBe(849);
      expect(parseCurrency("0.00")).toBe(0);
      expect(parseCurrency(undefined)).toBe(0);
    });

    it("parses multiple Indian date formats", () => {
      const d1 = parseIndianDate("14-Oct-2026");
      expect(d1).toBeDefined();
      expect(d1?.getUTCFullYear()).toBe(2026);
      expect(d1?.getUTCMonth()).toBe(9); // Oct is index 9
      expect(d1?.getUTCDate()).toBe(14);

      const d2 = parseIndianDate("17/10/2026");
      expect(d2).toBeDefined();
      expect(d2?.getUTCFullYear()).toBe(2026);
      expect(d2?.getUTCDate()).toBe(17);

      const d3 = parseIndianDate("31.08.2026");
      expect(d3).toBeDefined();
      expect(d3?.getUTCMonth()).toBe(7); // Aug is index 7
    });

    it("parses quantity and packaging units", () => {
      expect(parseQuantity("20 crt")).toEqual({ qty: 20, unit: "CS" });
      expect(parseQuantity("1 CTN")).toEqual({ qty: 1, unit: "CS" });
      expect(parseQuantity("5 CS")).toEqual({ qty: 5, unit: "CS" });
      expect(parseQuantity("1080")).toEqual({ qty: 1080, unit: "PCS" });
    });
  });

  describe("Multi-Supplier Bill Parsing & Arithmetic Safety", () => {
    it("parses Vindhyawasini / Bikaji bill text with crt units and discounts", () => {
      const sampleText = `
ESTIMATE
vindhyawasini sales (Muz) 25-27
Invoice No. A4530
Dated 14-Oct-2026
Buyer: Saharsha,Ms Kishan Supplier
State Name: Bihar, Code: 10
Sl Description of Goods HSN/SAC Quantity Rate per Disc. % Amount
1 Papad B.C 200 Gm*20 20 crt 5,392.16 crt 4 % 1,03,529.47
2 Papad B.C. 400gm*20kg 21 crt 5,392.16 crt 4 % 1,08,705.95
3 Moong Dal 200gm*12 2 crt 3,064.57 crt 1 % 6,067.85
Total 778 crt ₹ 18,37,565.00
      `;

      const mockOcr: OcrResult = {
        engine: "PDF_TEXT",
        durationMs: 120,
        confidence: 98,
        pages: [
          {
            pageNumber: 1,
            text: sampleText,
            width: 800,
            height: 1000,
            words: [],
            lines: sampleText.split("\n").map((t) => ({
              text: t,
              words: [],
              bbox: { x0: 0, y0: 0, x1: 100, y1: 10 },
            })),
          },
        ],
      };

      const parsed = parser.parse(mockOcr);
      expect(parsed.billNo).toBe("A4530");
      expect(parsed.billTotalPaise).toBe(183756500);
      expect(parsed.items.length).toBe(3);

      const item1 = parsed.items[0];
      expect(item1.parsedName).toContain("Papad B.C 200 Gm*20");
      expect(item1.billedQty).toBe(20);
      expect(item1.billedUnit).toBe("CS");
      expect(item1.ratePaise).toBe(539216);
      expect(item1.amountPaise).toBe(10352947);
      expect(item1.flags).not.toContain("ARITHMETIC_MISMATCH");
    });

    it("parses Shubham Traders / Patanjali bill with HSN and pieces", () => {
      const sampleText = `
TAX INVOICE
SHUBHAM TRADERS
GSTIN : 10DNEPK7317C1ZK STATE : BIHAR CODE :10
INV.NO. : T-940 INV.DATE : 17/10/2026
SL.N. PARTICULARS HSN MRP CLD QTY RATE FREE DIS% GST% AMT NET AMOUNT
1 HALDI CHANDAN 45 GM 34011941 10.00 5.00 1080 8.4900 0.00 10.50 5% 9169.20 8616.75
2 DALIA MIX(PUSTAHAR)500GM 11031900 50.00 2.00 60 40.7300 0.00 2.00 5% 2443.80 2514.66
3 COW GHEE 200GM 04059020 183.00 1.00 60 161.0800 0.00 0.00 5% 9664.80 10148.04
TOTAL AMOUNT 34269.00
      `;

      const mockOcr: OcrResult = {
        engine: "TESSERACT_WASM",
        durationMs: 800,
        confidence: 90,
        pages: [
          {
            pageNumber: 1,
            text: sampleText,
            width: 800,
            height: 1000,
            words: [],
            lines: sampleText.split("\n").map((t) => ({
              text: t,
              words: [],
              bbox: { x0: 0, y0: 0, x1: 100, y1: 10 },
            })),
          },
        ],
      };

      const parsed = parser.parse(mockOcr);
      expect(parsed.supplierGstin).toBe("10DNEPK7317C1ZK");
      expect(parsed.billNo).toBe("T-940");
      expect(parsed.billTotalPaise).toBe(3426900);
      expect(parsed.items.length).toBe(3);

      expect(parsed.items[0].parsedName).toBe("HALDI CHANDAN 45 GM");
      expect(parsed.items[0].billedQty).toBe(1080);
      expect(parsed.items[0].billedUnit).toBe("PCS");

      expect(parsed.items[1].parsedName).toBe("DALIA MIX(PUSTAHAR)500GM");
      expect(parsed.items[1].billedQty).toBe(60);

      const ghee = parsed.items[2];
      expect(ghee.parsedName).toContain("COW GHEE 200GM");
      expect(ghee.billedQty).toBe(60);
      expect(ghee.hsn).toBe("04059020");
    });

    it("ignores noisy OCR tokens like 0.0q and skips discount footer lines", () => {
      const noisyText = `
1 HALDI CHANDAN 45 GM 34011941 10.00 5.00 1080 8.4900 0.0q 10.50 5% 9169.20 8616.75
2 DALIA MIX(PUSTAHAR)500GM 11031900 50.00 2.00 60 40.7300 0.0g 2.00 5% 2443.80 2514.66
6 Discount 1045.86 Other Adj. : 0.00 SGST2.5% si
TOTAL AMOUNT 34269.00
      `;

      const mockOcr: OcrResult = {
        engine: "TESSERACT_WASM",
        durationMs: 500,
        confidence: 88,
        pages: [
          {
            pageNumber: 1,
            text: noisyText,
            width: 800,
            height: 1000,
            words: [],
            lines: noisyText.split("\n").map((t) => ({
              text: t,
              words: [],
              bbox: { x0: 0, y0: 0, x1: 100, y1: 10 },
            })),
          },
        ],
      };

      const parsed = parser.parse(mockOcr);
      expect(parsed.items.length).toBe(2);
      expect(parsed.items[0].parsedName).toBe("HALDI CHANDAN 45 GM");
      expect(parsed.items[0].billedQty).toBe(1080);
      expect(parsed.items[1].parsedName).toBe("DALIA MIX(PUSTAHAR)500GM");
      expect(parsed.items[1].billedQty).toBe(60);
    });

    it("100% flags arithmetic discrepancies without silent errors", () => {
      const mismatchedText = `
1 Broken Item 10 100.00 5000.00
      `;

      const mockOcr: OcrResult = {
        engine: "TESSERACT_WASM",
        durationMs: 50,
        confidence: 85,
        pages: [
          {
            pageNumber: 1,
            text: mismatchedText,
            width: 500,
            height: 500,
            words: [],
            lines: [{ text: mismatchedText.trim(), words: [], bbox: { x0: 0, y0: 0, x1: 100, y1: 10 } }],
          },
        ],
      };

      const parsed = parser.parse(mockOcr);
      expect(parsed.items.length).toBe(1);
      // 10 * 100 = 1000, but amount is 5000 -> must flag ARITHMETIC_MISMATCH
      expect(parsed.items[0].flags).toContain("ARITHMETIC_MISMATCH");
    });
  });
});
