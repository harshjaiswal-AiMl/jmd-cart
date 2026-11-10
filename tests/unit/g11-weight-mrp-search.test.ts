import { describe, it, expect } from "vitest";
import {
  buildProductSearchIndex,
  searchItems,
  SearchableProduct,
} from "@/lib/search/smart-search";

const fixtures: SearchableProduct[] = [
  {
    id: "p1",
    name: "Himalaya Natural Glow Kesar Face Gel 100ml",
    shortCode: "HIM-109",
    companyName: "Himalaya",
    weight: "100ml",
    mrpPaise: 9500,
    packSize: 48,
    shopStockQty: 12,
    godownStockQty: 48,
  },
  {
    id: "p2",
    name: "MDH Meat Masala",
    shortCode: "MDH-MM100",
    companyName: "MDH",
    weight: "100gm",
    mrpPaise: 9500,
    packSize: 100,
    shopStockQty: 20,
    godownStockQty: 200,
  },
  {
    id: "p3",
    name: "MDH Meat Masala",
    shortCode: "MDH-MM50",
    companyName: "MDH",
    weight: "50g",
    mrpPaise: 4700,
    packSize: 180,
    shopStockQty: 10,
    godownStockQty: 180,
  },
  {
    id: "p4",
    name: "Bikaji Navratan Mixture 400g",
    shortCode: "BIK-400",
    companyName: "Bikaji",
    weight: "400g",
    mrpPaise: 13500,
    packSize: 50,
    shopStockQty: 5,
    godownStockQty: 50,
  },
  {
    id: "p5",
    name: "Everest Haldi Powder 500gm",
    shortCode: "EVE-H500",
    companyName: "Everest",
    weight: "500gm",
    mrpPaise: 13500,
    packSize: 40,
    shopStockQty: 8,
    godownStockQty: 40,
  },
  {
    id: "p6",
    name: "Saloni Mustard Oil 1 Ltr",
    shortCode: "SAL-1L",
    companyName: "Saloni",
    weight: "1 Ltr",
    mrpPaise: 18500,
    packSize: 12,
    shopStockQty: 15,
    godownStockQty: 120,
  },
];

describe("G11: Product search by weight, MRP, and normalized units", () => {
  const index = buildProductSearchIndex(fixtures);

  it("matches '100 gm 95' to 100g products with MRP 95", () => {
    const res = searchItems("100 gm 95", index);
    expect(res.map((p) => p.id)).toContain("p2");
    expect(res.map((p) => p.id)).toContain("p1");
    expect(res.map((p) => p.id)).not.toContain("p3"); // 50g MRP 47
    expect(res.map((p) => p.id)).not.toContain("p4"); // 400g MRP 135
  });

  it("matches '135' to every MRP-135 item", () => {
    const res = searchItems("135", index);
    expect(res.map((p) => p.id)).toContain("p4");
    expect(res.map((p) => p.id)).toContain("p5");
    expect(res.length).toBe(2);
  });

  it("matches '50g' to 50g items", () => {
    const res = searchItems("50g", index);
    expect(res.map((p) => p.id)).toEqual(["p3"]);
  });

  it("matches 'meat 100' to Meat Masala 100g", () => {
    const res = searchItems("meat 100", index);
    expect(res.map((p) => p.id)).toEqual(["p2"]);
  });

  it("normalizes 0.5kg -> 500g and 1000ml -> 1 Ltr", () => {
    const resKg = searchItems("0.5kg", index);
    expect(resKg.map((p) => p.id)).toEqual(["p5"]);

    const resMl = searchItems("1000ml", index);
    expect(resMl.map((p) => p.id)).toEqual(["p6"]);
  });

  it("returns empty array when no items match", () => {
    const res = searchItems("nonexistent 9999", index);
    expect(res).toEqual([]);
  });

  it("searches 1,000 products in well under 150ms", () => {
    const largeSet: SearchableProduct[] = Array.from({ length: 1000 }, (_, i) => ({
      id: `prod-${i}`,
      name: `Sample Item ${i} ${(i % 5 === 0 ? "100gm" : "50g")}`,
      shortCode: `CODE-${i}`,
      companyName: i % 2 === 0 ? "BrandA" : "BrandB",
      weight: i % 5 === 0 ? "100gm" : "50g",
      mrpPaise: i % 3 === 0 ? 9500 : 13500,
      packSize: 24,
      shopStockQty: 10,
      godownStockQty: 50,
    }));
    const largeIndex = buildProductSearchIndex(largeSet);
    const t0 = performance.now();
    const hits = searchItems("100 gm 95", largeIndex, { limit: 50 });
    const elapsed = performance.now() - t0;
    expect(hits.length).toBe(50);
    expect(elapsed).toBeLessThan(150);
  });
});
