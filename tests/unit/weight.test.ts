import { describe, it, expect } from "vitest";
import {
  normalizeWeight,
  extractWeightFromText,
  categorizeWeightBand,
} from "../../src/lib/weight";

describe("Prompt #15 Part 3: Weight Normalisation & Extraction", () => {
  it("normalises grams, kg, ml, and litres to base units", () => {
    const w1 = normalizeWeight(500, "g");
    expect(w1?.baseGramsOrMl).toBe(500);
    expect(w1?.display).toBe("500g");

    const w2 = normalizeWeight(1.5, "kg");
    expect(w2?.baseGramsOrMl).toBe(1500);
    expect(w2?.display).toBe("1.5kg");

    const w3 = normalizeWeight(250, "ml");
    expect(w3?.baseGramsOrMl).toBe(250);
    expect(w3?.display).toBe("250ml");

    const w4 = normalizeWeight(1, "l");
    expect(w4?.baseGramsOrMl).toBe(1000);
    expect(w4?.display).toBe("1l");
  });

  it("extracts conservative weight suggestions from product names", () => {
    expect(extractWeightFromText("Bikaji Bhujia 400g Pouch")).toEqual({
      value: 400,
      unit: "g",
    });
    expect(extractWeightFromText("Engine Mustard Oil 1 Ltr Bottle")).toEqual({
      value: 1,
      unit: "l",
    });
    expect(extractWeightFromText("Tata Salt 1kg Pack")).toEqual({
      value: 1,
      unit: "kg",
    });
    expect(extractWeightFromText("Parle-G 50gm")).toEqual({
      value: 50,
      unit: "g",
    });
    expect(extractWeightFromText("Generic Product Name No Weight")).toBeNull();
  });

  it("categorizes products into standard weight bands", () => {
    expect(categorizeWeightBand(50, "g")).toBe("50g");
    expect(categorizeWeightBand(100, "g")).toBe("100g");
    expect(categorizeWeightBand(200, "g")).toBe("200g");
    expect(categorizeWeightBand(250, "g")).toBe("250g");
    expect(categorizeWeightBand(500, "g")).toBe("500g");
    expect(categorizeWeightBand(1000, "g")).toBe("1kg");
    expect(categorizeWeightBand(5000, "g")).toBe("5kg+");
    expect(categorizeWeightBand(500, "ml")).toBe("liquid");
    expect(categorizeWeightBand(null, null)).toBe("none");
  });
});
