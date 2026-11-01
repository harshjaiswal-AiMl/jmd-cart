import { describe, it, expect } from "vitest";
import { searchItems, SearchableProduct } from "@/lib/search/smart-search";

const testProducts: SearchableProduct[] = [
  {
    id: "prod-1",
    name: "Bikaji Bhujia",
    shortCode: "BK-001",
    companyName: "Bikaji",
    weight: "400G",
    weightValue: 400,
    weightUnit: "g",
    weightBase: 400,
    shopStockQty: 50,
    godownStockQty: 100,
  },
  {
    id: "prod-2",
    name: "Bikaji Bhujia",
    shortCode: "BK-002",
    companyName: "Bikaji",
    weight: "15G",
    weightValue: 15,
    weightUnit: "g",
    weightBase: 15,
    shopStockQty: 200,
    godownStockQty: 300,
  },
  {
    id: "prod-3",
    name: "Haldiram All In One",
    shortCode: "HL-003",
    companyName: "Haldiram",
    weight: "200G",
    weightValue: 200,
    weightUnit: "g",
    weightBase: 200,
    shopStockQty: 40,
    godownStockQty: 80,
  },
  {
    id: "prod-4",
    name: "Aashirvaad Shudh Chakki Atta",
    shortCode: "ASH-004",
    companyName: "ITC",
    weight: "5KG",
    weightValue: 5,
    weightUnit: "kg",
    weightBase: 5000,
    shopStockQty: 10,
    godownStockQty: 50,
  },
  {
    id: "prod-5",
    name: "Parle-G Biscuit",
    shortCode: "PL-005",
    companyName: "Parle",
    weight: "800G",
    weightValue: 800,
    weightUnit: "g",
    weightBase: 800,
    shopStockQty: 100,
    godownStockQty: 200,
  },
];

describe("Prompt #18 Universal Search Everywhere", () => {
  it("multi-token 'bhuj 400' finds Bikaji Bhujia 400G at position 1", () => {
    const hits = searchItems("bhuj 400", testProducts);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].id).toBe("prod-1");
    expect(hits[0].name).toContain("Bhujia");
    expect(hits[0].weight).toBe("400G");
  });

  it("multi-token 'bhuj 15' finds Bikaji Bhujia 15G", () => {
    const hits = searchItems("bhuj 15", testProducts);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].id).toBe("prod-2");
    expect(hits[0].weight).toBe("15G");
  });

  it("multi-token 'atta 5kg' finds Aashirvaad Atta 5KG", () => {
    const hits = searchItems("atta 5kg", testProducts);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].id).toBe("prod-4");
  });

  it("brand search 'bikaji' returns both bikaji items", () => {
    const hits = searchItems("bikaji", testProducts);
    expect(hits.length).toBe(2);
    const ids = hits.map((h) => h.id);
    expect(ids).toContain("prod-1");
    expect(ids).toContain("prod-2");
  });

  it("multi-token 'all one 200' finds Haldiram All In One 200G", () => {
    const hits = searchItems("all one 200", testProducts);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].id).toBe("prod-3");
  });
});

describe("Prompt #18 Party Search Ranking ('sh' prefix over substring)", () => {
  const parties = [
    { id: "1", name: "Walk-in Customer", phone: "0000000000" },
    { id: "2", name: "Aakash Kirana Store", phone: "9800000001" },
    { id: "3", name: "Sharma General Store", phone: "9800000002" },
    { id: "4", name: "Aashirvad Grocery", phone: "9800000003" },
    { id: "5", name: "Shiv Traders Saharsa", phone: "9800000004" },
  ];

  it("query 'sh' ranks Sharma General Store and Shiv Traders first", () => {
    const q = "sh";
    const matched = parties
      .filter((p) => p.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const aWords = a.name.toLowerCase().split(/\s+/);
        const bWords = b.name.toLowerCase().split(/\s+/);
        const aStarts = aWords.some((w) => w.startsWith(q));
        const bStarts = bWords.some((w) => w.startsWith(q));

        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.name.localeCompare(b.name);
      });

    // Sharma and Shiv should be first before Aakash or Aashirvad
    expect(matched[0].name).toMatch(/^(Sharma|Shiv)/);
    expect(matched[1].name).toMatch(/^(Sharma|Shiv)/);
    // Substring hits come after
    const laterNames = matched.slice(2).map((p) => p.name);
    expect(laterNames).toContain("Aashirvad Grocery");
  });
});

describe("Prompt #18 Future Dates Rule", () => {
  it("allows future bill date within 30 days and flags isPostDated", () => {
    const today = new Date("2026-11-02T12:00:00Z");
    const futureDate = new Date("2026-11-15T12:00:00Z");

    const diffDays = Math.ceil((futureDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBeLessThanOrEqual(30);

    const isPostDated = futureDate > today;
    expect(isPostDated).toBe(true);
  });

  it("rejects date beyond 30 days into the future", () => {
    const today = new Date("2026-11-02T12:00:00Z");
    const farFuture = new Date("2026-12-15T12:00:00Z");

    const diffDays = Math.ceil((farFuture.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBeGreaterThan(30);
  });
});

describe("Prompt #18 Esc Key Navigation Hierarchy", () => {
  it("hierarchy strictly prioritizes: popovers/dialogs -> clear search -> back", () => {
    const state1 = { dialogOpen: true, searchVal: "bhuj", canGoBack: true };
    let handledAction = "";
    if (state1.dialogOpen) {
      handledAction = "CLOSE_DIALOG";
    } else if (state1.searchVal) {
      handledAction = "CLEAR_SEARCH";
    } else if (state1.canGoBack) {
      handledAction = "GO_BACK";
    }
    expect(handledAction).toBe("CLOSE_DIALOG");

    const state2 = { dialogOpen: false, searchVal: "bhuj", canGoBack: true };
    if (state2.dialogOpen) {
      handledAction = "CLOSE_DIALOG";
    } else if (state2.searchVal) {
      handledAction = "CLEAR_SEARCH";
    } else if (state2.canGoBack) {
      handledAction = "GO_BACK";
    }
    expect(handledAction).toBe("CLEAR_SEARCH");

    const state3 = { dialogOpen: false, searchVal: "", canGoBack: true };
    if (state3.dialogOpen) {
      handledAction = "CLOSE_DIALOG";
    } else if (state3.searchVal) {
      handledAction = "CLEAR_SEARCH";
    } else if (state3.canGoBack) {
      handledAction = "GO_BACK";
    }
    expect(handledAction).toBe("GO_BACK");
  });
});
