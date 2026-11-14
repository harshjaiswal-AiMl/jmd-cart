import { describe, it, expect } from "vitest";
import { searchItems, SearchableProduct } from "@/lib/search/smart-search";

const sampleProducts: SearchableProduct[] = [
  {
    id: "p1",
    name: "Bikaji Bhujia",
    shortCode: "BK01",
    companyId: "comp_bikaji",
    companyName: "Bikaji",
    weight: "400G",
    weightValue: 400,
    weightUnit: "g",
    weightBase: 400,
    shopStockQty: 0,
    godownStockQty: 0, // out of stock
  },
  {
    id: "p2",
    name: "Haldiram Bhujia",
    shortCode: "HL01",
    companyId: "comp_haldiram",
    companyName: "Haldiram",
    weight: "400G",
    weightValue: 400,
    weightUnit: "g",
    weightBase: 400,
    shopStockQty: 50,
    godownStockQty: 100, // in stock
  },
  {
    id: "p3",
    name: "Aashirvaad Atta",
    shortCode: "ASH01",
    companyId: "comp_itc",
    companyName: "ITC",
    weight: "5KG",
    weightValue: 5,
    weightUnit: "kg",
    weightBase: 5000,
    shopStockQty: 0,
    godownStockQty: 0,
  },
];

describe("Part B: Smart Search in Purchase Context", () => {
  it("matches 'bhuj 400' and finds both 400g bhujia products", () => {
    const results = searchItems("bhuj 400", sampleProducts, { context: "purchase" });
    expect(results.length).toBe(2);
    expect(results.map((r) => r.shortCode)).toContain("BK01");
    expect(results.map((r) => r.shortCode)).toContain("HL01");
  });

  it("does NOT penalize out-of-stock items when context is 'purchase'", () => {
    // In POS context, in-stock Haldiram (HL01) ranks before out-of-stock Bikaji (BK01)
    const posResults = searchItems("bhuj 400", sampleProducts, { context: "pos" });
    expect(posResults[0].shortCode).toBe("HL01");

    // In purchase context without brand filter, zero-stock item is not penalized to the bottom
    const purchaseResults = searchItems("bhuj 400", sampleProducts, { context: "purchase" });
    expect(purchaseResults.length).toBe(2);
  });

  it("boosts selected supplier company items to the top", () => {
    // When Bikaji supplier is selected, BK01 should rank first even though it has 0 stock
    const results = searchItems("bhuj 400", sampleProducts, {
      context: "purchase",
      supplierCompanyId: "comp_bikaji",
    });
    expect(results[0].shortCode).toBe("BK01");
  });
});
