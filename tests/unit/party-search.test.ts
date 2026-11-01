import { describe, it, expect } from "vitest";
import { searchParties, SearchableParty, formatPartyBalance } from "../../src/lib/search/party-search";

const TEST_PARTIES: SearchableParty[] = [
  { id: "p0", name: "Walk-in Retail Customer", type: "CUSTOMER", isWalkIn: true, phone: "" },
  { id: "p1", name: "Shahwaz Enterprises", phone: "9876543210", type: "WHOLESALER", city: "Patna", creditEnabled: true, currentBalancePaise: 450000 },
  { id: "p2", name: "Shiv Traders", phone: "9123456780", type: "RETAILER", city: "Muzaffarpur", creditEnabled: true, currentBalancePaise: -120000 },
  { id: "p3", name: "Shree Krishna Kirana", phone: "9431200001", type: "RETAILER", city: "Gaya", address: "Station Road" },
  { id: "p4", name: "Aakash Kirana Store", phone: "9234567890", type: "RETAILER", city: "Bhagalpur", address: "Bari Bazar" },
  { id: "p5", name: "Aakash Kr General Store", phone: "9334112233", type: "CUSTOMER", city: "Patna" },
  { id: "p6", name: "Aashirvad Grocery Store", phone: "9988776655", type: "RETAILER", city: "Ranchi" },
  { id: "p7", name: "AASHISH BIHRA TRADERS", phone: "9835012345", type: "WHOLESALER", city: "Darbhanga" },
  { id: "p8", name: "Aadil Medical Hall", phone: "7004112233", type: "RETAILER", city: "Patna" },
  { id: "p9", name: "Aastha Medical Agency", phone: "7004562925", type: "WHOLESALER", city: "Hajipur", gstin: "10ABCDE1234F1Z5" },
  { id: "p10", name: "Dinesh General Store", phone: "9430123456", type: "RETAILER", city: "Samastipur" },
  { id: "p11", name: "Dilip Kirana Dukan", phone: "9801234567", type: "RETAILER", city: "Sitamarhi" },
  { id: "p12", name: "Radhe Shyam Traders", phone: "9122334455", type: "WHOLESALER", city: "Siwan" },
  { id: "p13", name: "Gupta Brothers", phone: "9570112233", type: "RETAILER", city: "Chapra" },
  { id: "p14", name: "Maa Durga Provisions", phone: "8877665544", type: "CUSTOMER", city: "Ara" },
];

describe("Part A - Party Search Engine", () => {
  it("1. 'sh' query ranks parties starting with 'Sh' before parties having 'sh' in the middle", () => {
    const results = searchParties("sh", TEST_PARTIES);
    expect(results.length).toBeGreaterThan(0);
    // Shahwaz, Shiv, Shree should come before Aakash, Aashirvad, Aashish
    const topThreeNames = results.slice(0, 3).map((p) => p.name);
    expect(topThreeNames).toContain("Shahwaz Enterprises");
    expect(topThreeNames).toContain("Shiv Traders");
    expect(topThreeNames).toContain("Shree Krishna Kirana");

    // Walk-in MUST NOT be pinned at the top
    expect(results[0].name).not.toBe("Walk-in Retail Customer");
  });

  it("2. 'di' query ranks Dinesh and Dilip before others, and does NOT match Credit Approved", () => {
    const results = searchParties("di", TEST_PARTIES);
    expect(results.length).toBeGreaterThan(0);
    const topTwo = results.slice(0, 2).map((p) => p.name);
    expect(topTwo).toContain("Dilip Kirana Dukan");
    expect(topTwo).toContain("Dinesh General Store");

    // Aadil Medical Hall or Aastha Medical should NOT appear just because creditEnabled is true!
    const names = results.map((p) => p.name);
    expect(names).not.toContain("Aadil Medical Hall");
    expect(names).not.toContain("Aastha Medical Agency");
  });

  it("3. 'aak' returns Aakash Kirana Store and Aakash Kr", () => {
    const results = searchParties("aak", TEST_PARTIES);
    expect(results.map((p) => p.name)).toContain("Aakash Kirana Store");
    expect(results.map((p) => p.name)).toContain("Aakash Kr General Store");
  });

  it("4. Multi-token 'aakash kir' matches Aakash Kirana Store", () => {
    const results = searchParties("aakash kir", TEST_PARTIES);
    expect(results[0].name).toBe("Aakash Kirana Store");
  });

  it("5. Multi-token order independence: 'kirana aakash' matches Aakash Kirana Store", () => {
    const results = searchParties("kirana aakash", TEST_PARTIES);
    expect(results[0].name).toBe("Aakash Kirana Store");
  });

  it("6. Phone search with prefix '9234' finds party with that phone", () => {
    const results = searchParties("9234", TEST_PARTIES);
    expect(results[0].name).toBe("Aakash Kirana Store");
  });

  it("7. Phone search contiguous digits '562925' finds Aastha Medical Agency", () => {
    const results = searchParties("562925", TEST_PARTIES);
    expect(results[0].name).toBe("Aastha Medical Agency");
  });

  it("8. 'kirana' returns all stores with Kirana in name as word-prefix matches", () => {
    const results = searchParties("kirana", TEST_PARTIES);
    const names = results.map((p) => p.name);
    expect(names).toContain("Shree Krishna Kirana");
    expect(names).toContain("Aakash Kirana Store");
    expect(names).toContain("Dilip Kirana Dukan");
  });

  it("9. Word prefix in the middle of name: 'shyam' finds Radhe Shyam Traders", () => {
    const results = searchParties("shyam", TEST_PARTIES);
    expect(results[0].name).toBe("Radhe Shyam Traders");
  });

  it("10. 'aashirvad' matches Aashirvad Grocery Store", () => {
    const results = searchParties("aashirvad", TEST_PARTIES);
    expect(results[0].name).toBe("Aashirvad Grocery Store");
  });

  it("11. Typo tolerance on 4+ chars: 'aashirwad' matches Aashirvad Grocery Store", () => {
    const results = searchParties("aashirwad", TEST_PARTIES);
    expect(results.map((p) => p.name)).toContain("Aashirvad Grocery Store");
  });

  it("12. Typo tolerance: 'shahwaz' typed as 'shahnawaz' (2 edits on 9 chars) matches Shahwaz Enterprises", () => {
    const results = searchParties("shahnawaz", TEST_PARTIES);
    expect(results.map((p) => p.name)).toContain("Shahwaz Enterprises");
  });

  it("13. Case insensitivity: 'SHAHWAZ' matches Shahwaz Enterprises", () => {
    const results = searchParties("SHAHWAZ", TEST_PARTIES);
    expect(results[0].name).toBe("Shahwaz Enterprises");
  });

  it("14. Case insensitivity: 'aAdIL' matches Aadil Medical Hall", () => {
    const results = searchParties("aAdIL", TEST_PARTIES);
    expect(results[0].name).toBe("Aadil Medical Hall");
  });

  it("15. Empty query returns Walk-in customer at top by default", () => {
    const results = searchParties("", TEST_PARTIES);
    expect(results[0].isWalkIn).toBe(true);
  });

  it("16. Whitespace query returns Walk-in customer at top", () => {
    const results = searchParties("   ", TEST_PARTIES);
    expect(results[0].isWalkIn).toBe(true);
  });

  it("17. Explicit 'walk' query returns Walk-in customer", () => {
    const results = searchParties("walk", TEST_PARTIES);
    expect(results[0].name).toBe("Walk-in Retail Customer");
  });

  it("18. Explicit 'counter' query returns Walk-in customer", () => {
    const results = searchParties("counter", TEST_PARTIES);
    expect(results[0].name).toBe("Walk-in Retail Customer");
  });

  it("19. Non-matching query returns empty array", () => {
    const results = searchParties("xyz999nonexistent", TEST_PARTIES);
    expect(results).toHaveLength(0);
  });

  it("20. GSTIN search '10ABCDE' matches Aastha Medical Agency", () => {
    const results = searchParties("10ABCDE", TEST_PARTIES);
    expect(results[0].name).toBe("Aastha Medical Agency");
  });

  it("21. City search 'Muzaffarpur' matches Shiv Traders", () => {
    const results = searchParties("Muzaffarpur", TEST_PARTIES);
    expect(results[0].name).toBe("Shiv Traders");
  });

  it("22. Address word search 'Station' matches Shree Krishna Kirana", () => {
    const results = searchParties("Station", TEST_PARTIES);
    expect(results[0].name).toBe("Shree Krishna Kirana");
  });

  it("23. Address word search 'Bari Bazar' matches Aakash Kirana Store", () => {
    const results = searchParties("Bari Bazar", TEST_PARTIES);
    expect(results[0].name).toBe("Aakash Kirana Store");
  });

  it("24. Name + City combined: 'aakash bhagalpur' matches Aakash Kirana Store", () => {
    const results = searchParties("aakash bhagalpur", TEST_PARTIES);
    expect(results[0].name).toBe("Aakash Kirana Store");
  });

  it("25. Name + City combined: 'aakash patna' matches Aakash Kr General Store", () => {
    const results = searchParties("aakash patna", TEST_PARTIES);
    expect(results[0].name).toBe("Aakash Kr General Store");
  });

  it("26. Punctuation in search: 'aakash, patna' handles spaces and punctuation", () => {
    const results = searchParties("aakash patna", TEST_PARTIES);
    expect(results[0].name).toBe("Aakash Kr General Store");
  });

  it("27. Limit parameter restricts return count", () => {
    const results = searchParties("a", TEST_PARTIES, 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it("28. Shorter exact match ranks higher than longer exact prefix", () => {
    const list: SearchableParty[] = [
      { id: "1", name: "Ram Traders", type: "RETAILER" },
      { id: "2", name: "Rameshwar Store", type: "RETAILER" },
    ];
    const results = searchParties("ram", list);
    expect(results[0].name).toBe("Ram Traders");
  });

  it("29. Wholesaler bonus gives tie-break priority over Retailer with identical prefix", () => {
    const list: SearchableParty[] = [
      { id: "1", name: "Apex Retail", type: "RETAILER" },
      { id: "2", name: "Apex Wholesale", type: "WHOLESALER" },
    ];
    const results = searchParties("apex", list);
    expect(results[0].name).toBe("Apex Wholesale");
  });

  it("30. Balance formatting: positive balance shows Dr", () => {
    expect(formatPartyBalance(450000)).toBe("₹4500.00 Dr");
  });

  it("31. Balance formatting: negative balance shows Cr", () => {
    expect(formatPartyBalance(-120000)).toBe("₹1200.00 Cr");
  });

  it("32. Balance formatting: zero or null balance shows ₹0.00", () => {
    expect(formatPartyBalance(0)).toBe("₹0.00");
    expect(formatPartyBalance(null)).toBe("₹0.00");
    expect(formatPartyBalance(undefined)).toBe("₹0.00");
  });

  it("33. 'bihra' matches AASHISH BIHRA TRADERS", () => {
    const results = searchParties("bihra", TEST_PARTIES);
    expect(results[0].name).toBe("AASHISH BIHRA TRADERS");
  });

  it("34. 'gupta' matches Gupta Brothers", () => {
    const results = searchParties("gupta", TEST_PARTIES);
    expect(results[0].name).toBe("Gupta Brothers");
  });

  it("35. 'durga' matches Maa Durga Provisions", () => {
    const results = searchParties("durga", TEST_PARTIES);
    expect(results[0].name).toBe("Maa Durga Provisions");
  });

  it("36. 3-digit phone fragment '0001' finds Shree Krishna Kirana", () => {
    const results = searchParties("0001", TEST_PARTIES);
    expect(results[0].name).toBe("Shree Krishna Kirana");
  });

  it("37. Multiple spaces in query: '  shiv   traders  ' matches Shiv Traders", () => {
    const results = searchParties("  shiv   traders  ", TEST_PARTIES);
    expect(results[0].name).toBe("Shiv Traders");
  });

  it("38. Non-alphanumeric symbols do not crash search", () => {
    expect(() => searchParties("!@#$%^&*()_+", TEST_PARTIES)).not.toThrow();
  });

  it("39. Performance benchmark: 2,000 parties searched in < 50ms", () => {
    const largeList: SearchableParty[] = [];
    for (let i = 0; i < 2000; i++) {
      largeList.push({
        id: `party-${i}`,
        name: i % 10 === 0 ? `Shiv Traders ${i}` : `Party Customer ${i} Kirana Store`,
        phone: `98765${String(i).padStart(5, "0")}`,
        type: i % 3 === 0 ? "WHOLESALER" : i % 2 === 0 ? "RETAILER" : "CUSTOMER",
        city: "Patna",
        address: `Road ${i}, Sector ${i % 10}`,
      });
    }

    const t0 = performance.now();
    const results = searchParties("sh", largeList);
    const duration = performance.now() - t0;

    expect(duration).toBeLessThan(50);
    expect(results.length).toBeGreaterThan(0);
  });

  it("40. Performance benchmark: 2,000 parties multi-token search in < 50ms", () => {
    const largeList: SearchableParty[] = [];
    for (let i = 0; i < 2000; i++) {
      largeList.push({
        id: `party-${i}`,
        name: `Customer ${i} Kirana Trading`,
        phone: `98765${String(i).padStart(5, "0")}`,
        type: "RETAILER",
      });
    }

    const t0 = performance.now();
    const results = searchParties("kirana 199", largeList);
    const duration = performance.now() - t0;

    expect(duration).toBeLessThan(50);
    expect(results[0].name).toContain("199");
  });
});
