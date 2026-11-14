import { describe, it, expect } from "vitest";
import { searchItems, SearchableProduct } from "@/lib/search/smart-search";

const catalog: SearchableProduct[] = [
  {
    id: "p1",
    name: "Bikaji Bhujia Sev",
    shortCode: "BK01",
    companyId: "comp_bikaji",
    companyName: "Bikaji",
    weight: "400G",
    weightValue: 400,
    weightUnit: "g",
    weightBase: 400,
    shopStockQty: 20,
    godownStockQty: 40,
    mrpPaise: 11000,
  },
  {
    id: "p2",
    name: "Haldiram Bhujia Sev",
    shortCode: "HL01",
    companyId: "comp_haldiram",
    companyName: "Haldiram",
    weight: "400G",
    weightValue: 400,
    weightUnit: "g",
    weightBase: 400,
    shopStockQty: 10,
    godownStockQty: 20,
    mrpPaise: 12000,
  },
  {
    id: "p3",
    name: "Aashirvaad Shudh Chakki Atta",
    shortCode: "ASH01",
    companyId: "comp_itc",
    companyName: "ITC",
    weight: "5KG",
    weightValue: 5,
    weightUnit: "kg",
    weightBase: 5000,
    shopStockQty: 0,
    godownStockQty: 0,
    mrpPaise: 24000,
  },
];

describe("Part B: Search Parity Contract between POS and GRN", () => {
  it("returns identical matching sets for multi-token search in POS and GRN", () => {
    const posMatches = searchItems("bhuj 400", catalog, { context: "pos" });
    const grnMatches = searchItems("bhuj 400", catalog, { context: "purchase" });

    const posIds = new Set(posMatches.map((p) => p.id));
    const grnIds = new Set(grnMatches.map((p) => p.id));

    expect(posIds).toEqual(grnIds);
    expect(posIds.has("p1")).toBe(true);
    expect(posIds.has("p2")).toBe(true);
    expect(posIds.has("p3")).toBe(false);
  });

  it("handles typo tolerance identically across both contexts", () => {
    // "bhuja" should match "Bhujia" via 1 edit distance
    const posMatches = searchItems("bhuja", catalog, { context: "pos" });
    const grnMatches = searchItems("bhuja", catalog, { context: "purchase" });

    expect(posMatches.length).toBeGreaterThanOrEqual(2);
    expect(grnMatches.length).toBeGreaterThanOrEqual(2);
  });
});
