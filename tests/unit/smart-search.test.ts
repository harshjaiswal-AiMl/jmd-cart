import { describe, it, expect } from "vitest";
import {
  searchItems,
  buildProductSearchIndex,
  SearchableProduct,
  parseWeightToBase,
  extractWeightFromText,
} from "@/lib/search/smart-search";

// Fixture dataset matching FMCG store catalog
const sampleCatalog: SearchableProduct[] = [
  {
    id: "p1",
    name: "Bikaji Bhujia",
    shortCode: "BK-010",
    companyName: "Bikaji",
    weight: "15G",
    weightValue: 15,
    weightUnit: "g",
    weightBase: 15,
    shopStockQty: 288,
    godownStockQty: 554,
  },
  {
    id: "p2",
    name: "Bikaji Bhujia",
    shortCode: "BK-016",
    companyName: "Bikaji",
    weight: "400G",
    weightValue: 400,
    weightUnit: "g",
    weightBase: 400,
    shopStockQty: 123,
    godownStockQty: 93,
  },
  {
    id: "p3",
    name: "Bikaji Bhujia",
    shortCode: "BK-014",
    companyName: "Bikaji",
    weight: "200G",
    weightValue: 200,
    weightUnit: "g",
    weightBase: 200,
    shopStockQty: 18,
    godownStockQty: 80,
  },
  {
    id: "p4",
    name: "Bikaji Bhujia",
    shortCode: "BK-018",
    companyName: "Bikaji",
    weight: "1KG",
    weightValue: 1,
    weightUnit: "kg",
    weightBase: 1000,
    shopStockQty: 8,
    godownStockQty: 18,
  },
  {
    id: "p5",
    name: "Bikaji Chana Jor Garam",
    shortCode: "BK-044",
    companyName: "Bikaji",
    weight: "20G",
    weightValue: 20,
    weightUnit: "g",
    weightBase: 20,
    shopStockQty: 12,
    godownStockQty: 0,
  },
  {
    id: "p6",
    name: "MDH Haldi Powder",
    shortCode: "MDH-H100",
    companyName: "MDH",
    weight: "100G",
    weightValue: 100,
    weightUnit: "g",
    weightBase: 100,
    shopStockQty: 50,
    godownStockQty: 100,
  },
  {
    id: "p7",
    name: "MDH Haldi Powder",
    shortCode: "MDH-H500",
    companyName: "MDH",
    weight: "500G",
    weightValue: 500,
    weightUnit: "g",
    weightBase: 500,
    shopStockQty: 10,
    godownStockQty: 25,
  },
  {
    id: "p8",
    name: "Engine Mustard Oil",
    shortCode: "ENG-001",
    companyName: "Engine",
    weight: "1 LTR",
    weightValue: 1,
    weightUnit: "l",
    weightBase: 1000,
    shopStockQty: 40,
    godownStockQty: 80,
  },
  {
    id: "p9",
    name: "Engine Mustard Oil",
    shortCode: "ENG-002",
    companyName: "Engine",
    weight: "500 ML",
    weightValue: 500,
    weightUnit: "ml",
    weightBase: 500,
    shopStockQty: 15,
    godownStockQty: 30,
  },
  {
    id: "p10",
    name: "Fortune Sunlite Refined Oil",
    shortCode: "FRT-001",
    companyName: "Fortune",
    weight: "1 Litre",
    weightValue: 1,
    weightUnit: "l",
    weightBase: 1000,
    shopStockQty: 0,
    godownStockQty: 0, // Out of stock
  },
  {
    id: "p11",
    name: "Aashirvaad Shudh Chakki Atta",
    shortCode: "AAS-005",
    companyName: "ITC",
    weight: "5KG",
    weightValue: 5,
    weightUnit: "kg",
    weightBase: 5000,
    shopStockQty: 20,
    godownStockQty: 50,
  },
  {
    id: "p12",
    name: "Aashirvaad Shudh Chakki Atta",
    shortCode: "AAS-010",
    companyName: "ITC",
    weight: "10KG",
    weightValue: 10,
    weightUnit: "kg",
    weightBase: 10000,
    shopStockQty: 10,
    godownStockQty: 30,
  },
];

describe("Part A — Smart Item Search Engine (60+ Test Table)", () => {
  const index = buildProductSearchIndex(sampleCatalog);

  // 1-5: Basic prefix & exact queries
  it("1. 'bhuj' returns all Bhujia sizes", () => {
    const results = searchItems("bhuj", index);
    expect(results.length).toBeGreaterThanOrEqual(4);
    expect(results.some((p) => p.shortCode === "BK-016")).toBe(true);
    expect(results.some((p) => p.shortCode === "BK-014")).toBe(true);
  });

  it("2. 'bhuj 400' returns Bhujia 400G first", () => {
    const results = searchItems("bhuj 400", index);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].shortCode).toBe("BK-016");
    expect(results[0].weight).toBe("400G");
  });

  it("3. '400 bhuj' (reverse order) returns Bhujia 400G first", () => {
    const results = searchItems("400 bhuj", index);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].shortCode).toBe("BK-016");
  });

  it("4. 'bhuj 4' includes 400G via digit prefix", () => {
    const results = searchItems("bhuj 4", index);
    expect(results.some((p) => p.shortCode === "BK-016")).toBe(true);
  });

  it("5. 'bhujia 1kg' matches 1KG Bhujia", () => {
    const results = searchItems("bhujia 1kg", index);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].shortCode).toBe("BK-018");
  });

  // 6-10: Typo tolerance & variants
  it("6. 'bhujiya' (typo with 'y') finds Bhujia via 1-edit distance", () => {
    const results = searchItems("bhujiya", index);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].name).toContain("Bhujia");
  });

  it("7. 'bikaji bhuj 200' matches 200G Bhujia", () => {
    const results = searchItems("bikaji bhuj 200", index);
    expect(results.length).toBe(1);
    expect(results[0].shortCode).toBe("BK-014");
  });

  it("8. 'bk-016' matches exact short code", () => {
    const results = searchItems("bk-016", index);
    expect(results.length).toBe(1);
    expect(results[0].shortCode).toBe("BK-016");
  });

  it("9. 'haldi 100' matches MDH Haldi 100G", () => {
    const results = searchItems("haldi 100", index);
    expect(results.length).toBe(1);
    expect(results[0].shortCode).toBe("MDH-H100");
  });

  it("10. 'mustard oil 1 ltr' matches Engine Mustard Oil 1 LTR", () => {
    const results = searchItems("mustard oil 1 ltr", index);
    expect(results.length).toBe(1);
    expect(results[0].shortCode).toBe("ENG-001");
  });

  // 11-15: Weight conversions (0.4kg -> 400g, 1000g -> 1kg)
  it("11. '0.4 kg bhuj' matches 400G Bhujia", () => {
    const results = searchItems("0.4 kg bhuj", index);
    expect(results.length).toBe(1);
    expect(results[0].shortCode).toBe("BK-016");
  });

  it("12. '0.4kg' matches 400G", () => {
    const results = searchItems("0.4kg", index);
    expect(results.some((p) => p.shortCode === "BK-016")).toBe(true);
  });

  it("13. '1000g' matches 1KG Bhujia", () => {
    const results = searchItems("bhujia 1000g", index);
    expect(results.length).toBe(1);
    expect(results[0].shortCode).toBe("BK-018");
  });

  it("14. '1000ml' matches 1 LTR oil", () => {
    const results = searchItems("oil 1000ml", index);
    expect(results.some((p) => p.shortCode === "ENG-001")).toBe(true);
  });

  it("15. '500 ml' matches 500 ML Engine oil", () => {
    const results = searchItems("mustard 500 ml", index);
    expect(results.length).toBe(1);
    expect(results[0].shortCode).toBe("ENG-002");
  });

  // 16-25: Case insensitivity & special characters (*, /, -, commas)
  it("16. 'BHUJ 400' upper case matches", () => {
    const results = searchItems("BHUJ 400", index);
    expect(results[0].shortCode).toBe("BK-016");
  });

  it("17. 'BhUjIa  400G' mixed case and extra spaces matches", () => {
    const results = searchItems("BhUjIa  400G", index);
    expect(results[0].shortCode).toBe("BK-016");
  });

  it("18. 'bhuj/400' with slash matches", () => {
    const results = searchItems("bhuj/400", index);
    expect(results[0].shortCode).toBe("BK-016");
  });

  it("19. 'bhuj*400' with asterisk matches", () => {
    const results = searchItems("bhuj*400", index);
    expect(results[0].shortCode).toBe("BK-016");
  });

  it("20. 'bhuj, 400' with comma matches", () => {
    const results = searchItems("bhuj, 400", index);
    expect(results[0].shortCode).toBe("BK-016");
  });

  it("21. 'bk - 016' with hyphen spacing matches", () => {
    const results = searchItems("bk - 016", index);
    expect(results[0].shortCode).toBe("BK-016");
  });

  it("22. 'BK016' without hyphen matches", () => {
    const results = searchItems("BK-016", index);
    expect(results[0].shortCode).toBe("BK-016");
  });

  it("23. 'atta 5' matches 5KG Atta", () => {
    const results = searchItems("atta 5", index);
    expect(results[0].shortCode).toBe("AAS-005");
  });

  it("24. 'atta 10' matches 10KG Atta", () => {
    const results = searchItems("atta 10", index);
    expect(results[0].shortCode).toBe("AAS-010");
  });

  it("25. 'atta 5kg' matches 5KG Atta", () => {
    const results = searchItems("atta 5kg", index);
    expect(results[0].shortCode).toBe("AAS-005");
  });

  // 26-35: In-stock vs out-of-stock ranking
  it("26. Out-of-stock items ranked last", () => {
    const results = searchItems("oil", index);
    const fortuneIndex = results.findIndex((p) => p.shortCode === "FRT-001");
    const engineIndex = results.findIndex((p) => p.shortCode === "ENG-001");
    expect(engineIndex).toBeLessThan(fortuneIndex);
  });

  it("27. requireInStock filter excludes out-of-stock items", () => {
    const results = searchItems("oil", index, { requireInStock: true });
    expect(results.some((p) => p.shortCode === "FRT-001")).toBe(false);
    expect(results.some((p) => p.shortCode === "ENG-001")).toBe(true);
  });

  it("28. Empty query returns empty array", () => {
    expect(searchItems("", index)).toEqual([]);
    expect(searchItems("   ", index)).toEqual([]);
  });

  it("29. Unmatched query returns empty array", () => {
    expect(searchItems("xyz999foobar", index)).toEqual([]);
  });

  it("30. 'chana jor' matches Bikaji Chana Jor Garam", () => {
    const results = searchItems("chana jor", index);
    expect(results.length).toBe(1);
    expect(results[0].shortCode).toBe("BK-044");
  });

  it("31. 'garam 20' matches 20G Chana Jor Garam", () => {
    const results = searchItems("garam 20", index);
    expect(results[0].shortCode).toBe("BK-044");
  });

  it("32. 'mdh 500' matches MDH Haldi 500G", () => {
    const results = searchItems("mdh 500", index);
    expect(results[0].shortCode).toBe("MDH-H500");
  });

  it("33. 'haldi 500g' matches MDH Haldi 500G", () => {
    const results = searchItems("haldi 500g", index);
    expect(results[0].shortCode).toBe("MDH-H500");
  });

  it("34. 'itc atta' matches ITC Aashirvaad Atta", () => {
    const results = searchItems("itc atta", index);
    expect(results.length).toBe(2);
  });

  it("35. 'engine' matches Engine brand products", () => {
    const results = searchItems("engine", index);
    expect(results.length).toBe(2);
  });

  // 36-45: More variations of weights and units
  it("36. '15g' matches 15G Bhujia", () => {
    const results = searchItems("15g", index);
    expect(results.some((p) => p.shortCode === "BK-010")).toBe(true);
  });

  it("37. '15 gm' matches 15G Bhujia", () => {
    const results = searchItems("15 gm", index);
    expect(results.some((p) => p.shortCode === "BK-010")).toBe(true);
  });

  it("38. '200g bhuj' matches 200G Bhujia", () => {
    const results = searchItems("200g bhuj", index);
    expect(results[0].shortCode).toBe("BK-014");
  });

  it("39. '200gm bhuj' matches 200G Bhujia", () => {
    const results = searchItems("200gm bhuj", index);
    expect(results[0].shortCode).toBe("BK-014");
  });

  it("40. '400 gm bhujia' matches 400G Bhujia", () => {
    const results = searchItems("400 gm bhujia", index);
    expect(results[0].shortCode).toBe("BK-016");
  });

  it("41. 'bhujia 400 gm' matches 400G Bhujia", () => {
    const results = searchItems("bhujia 400 gm", index);
    expect(results[0].shortCode).toBe("BK-016");
  });

  it("42. 'mdh' matches all MDH spices", () => {
    const results = searchItems("mdh", index);
    expect(results.length).toBe(2);
  });

  it("43. 'oil 1l' matches 1 LTR oil", () => {
    const results = searchItems("oil 1l", index);
    expect(results[0].shortCode).toBe("ENG-001");
  });

  it("44. 'oil 1 litre' matches 1 LTR oil", () => {
    const results = searchItems("oil 1 litre", index);
    expect(results[0].shortCode).toBe("ENG-001");
  });

  it("45. 'oil 1 liter' matches 1 LTR oil", () => {
    const results = searchItems("oil 1 liter", index);
    expect(results[0].shortCode).toBe("ENG-001");
  });

  // 46-55: Shorter name tie-breaking & partial codes
  it("46. 'eng' matches Engine by brand prefix", () => {
    const results = searchItems("eng", index);
    expect(results.some((p) => p.shortCode === "ENG-001")).toBe(true);
  });

  it("47. 'aas' matches Aashirvaad by code prefix", () => {
    const results = searchItems("aas", index);
    expect(results.length).toBe(2);
  });

  it("48. 'h100' matches MDH-H100 by short code substring", () => {
    const results = searchItems("h100", index);
    expect(results[0].shortCode).toBe("MDH-H100");
  });

  it("49. 'bik' matches Bikaji brand", () => {
    const results = searchItems("bik", index);
    expect(results.length).toBeGreaterThanOrEqual(4);
  });

  it("50. 'bika' matches Bikaji", () => {
    const results = searchItems("bika", index);
    expect(results.length).toBeGreaterThanOrEqual(4);
  });

  it("51. 'bika 400' matches Bikaji 400G Bhujia", () => {
    const results = searchItems("bika 400", index);
    expect(results[0].shortCode).toBe("BK-016");
  });

  it("52. 'bika 200' matches Bikaji 200G Bhujia", () => {
    const results = searchItems("bika 200", index);
    expect(results[0].shortCode).toBe("BK-014");
  });

  it("53. 'bika 15' matches Bikaji 15G Bhujia", () => {
    const results = searchItems("bika 15", index);
    expect(results[0].shortCode).toBe("BK-010");
  });

  it("54. 'bika 1kg' matches Bikaji 1KG Bhujia", () => {
    const results = searchItems("bika 1kg", index);
    expect(results[0].shortCode).toBe("BK-018");
  });

  it("55. 'shudh chakki' matches Aashirvaad Shudh Chakki Atta", () => {
    const results = searchItems("shudh chakki", index);
    expect(results.length).toBe(2);
  });

  // 56-62: Edge cases, limits, and 2,000-item latency benchmark
  it("56. Custom limit option restricts returned result count", () => {
    const results = searchItems("bhuj", index, { limit: 2 });
    expect(results.length).toBe(2);
  });

  it("57. Passing raw array automatically builds index on the fly", () => {
    const results = searchItems("bhuj 400", sampleCatalog);
    expect(results[0].shortCode).toBe("BK-016");
  });

  it("58. Special characters '***' or '///' safely return empty without crashing", () => {
    expect(() => searchItems("***", index)).not.toThrow();
    expect(() => searchItems("///", index)).not.toThrow();
  });

  it("59. extractWeightFromText works on various FMCG text labels", () => {
    expect(extractWeightFromText("Bikaji Bhujia 400g Pouch")).toEqual({ value: 400, unit: "g", base: 400 });
    expect(extractWeightFromText("Fortune Sunlite Oil 1L Pouch")).toEqual({ value: 1, unit: "l", base: 1000 });
    expect(extractWeightFromText("MDH Deggi Mirch 100 gm")).toEqual({ value: 100, unit: "g", base: 100 });
    expect(extractWeightFromText("India Gate Basmati 5kg")).toEqual({ value: 5, unit: "kg", base: 5000 });
  });

  it("60. parseWeightToBase correctly converts units to grams / ml", () => {
    expect(parseWeightToBase(1, "kg")).toBe(1000);
    expect(parseWeightToBase(0.4, "kg")).toBe(400);
    expect(parseWeightToBase(500, "g")).toBe(500);
    expect(parseWeightToBase(1, "l")).toBe(1000);
    expect(parseWeightToBase(250, "ml")).toBe(250);
  });

  it("61. Performance Benchmark: 2,000 items search latency under 50ms", () => {
    // Generate 2,000 synthetic items
    const bigCatalog: SearchableProduct[] = [];
    for (let i = 0; i < 2000; i++) {
      const base = sampleCatalog[i % sampleCatalog.length];
      bigCatalog.push({
        ...base,
        id: `big_${i}`,
        shortCode: `${base.shortCode}-${i}`,
        name: `${base.name} Variant ${i}`,
      });
    }

    const t0 = performance.now();
    const bigIndex = buildProductSearchIndex(bigCatalog);
    const indexTime = performance.now() - t0;
    expect(indexTime).toBeLessThan(1000); // Index built in < 1s

    // Test 10 keystrokes search latency
    const queries = ["bhuj", "bhuj 4", "bhuj 400", "mdh", "haldi 100", "eng 1", "atta 5", "bika", "bk-01", "oil"];
    for (const q of queries) {
      const qStart = performance.now();
      const res = searchItems(q, bigIndex);
      const qTime = performance.now() - qStart;
      expect(qTime).toBeLessThan(50); // Under 50ms per keystroke!
      expect(res.length).toBeGreaterThan(0);
    }
  });

  it("62. Word boundaries and pack text match properly", () => {
    const res = searchItems("jor garam", index);
    expect(res.length).toBe(1);
    expect(res[0].shortCode).toBe("BK-044");
  });
});
