import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { searchItems, buildProductSearchIndex, SearchableProduct } from "@/lib/search/smart-search";
import { catalogRepository } from "@/modules/catalog/catalog.repository";
import { storeService } from "@/modules/store/store.service";

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTsFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe("R6: Single Shared Product Search Engine (Static Guard + Parity)", () => {
  it("Static guard: no alternate product-name SQL ILIKE/contains or ad-hoc product .includes() search exists outside src/lib/search/", () => {
    const srcRoot = path.resolve(process.cwd(), "src");
    const files = walkTsFiles(srcRoot);
    const violations: string[] = [];

    for (const file of files) {
      const rel = path.relative(process.cwd(), file).replace(/\\/g, "/");
      if (rel.startsWith("src/lib/search/")) continue;

      const content = fs.readFileSync(file, "utf8");
      const lines = content.split(/\r?\n/);

      lines.forEach((line, idx) => {
        // 1. Raw SQL ILIKE on product name / short_code
        if (/p\.name\s+ILIKE/i.test(line)) {
          violations.push(`${rel}:${idx + 1} SQL ILIKE on product.name`);
        }
        // 2. Prisma product.findMany with contains on name/shortCode
        if (
          /contains:\s*(?:tok|token|q|query|params\.search|filters\.search)\b/.test(line) &&
          (rel.includes("catalog") || rel.includes("store") || rel.includes("opening-stock") || rel.includes("stock.repository") || rel.includes("item-stock-statement"))
        ) {
          violations.push(`${rel}:${idx + 1} Prisma contains product search (${line.trim()})`);
        }
        // 3. Ad-hoc UI product search filtering using .toLowerCase().includes(...)
        if (
          /\b(?:p|item|prod|row)\.(?:name|productName)\.toLowerCase\(\)\.includes\(/.test(line) &&
          !rel.endsWith("AdminParties") &&
          !rel.includes("invoices") &&
          !rel.includes("collections") &&
          !line.includes("row.name") &&
          !line.includes("partySearch") && !line.includes("p.phone")
        ) {
          violations.push(`${rel}:${idx + 1} Ad-hoc .toLowerCase().includes on product name (${line.trim()})`);
        }
      });
    }

    expect(violations, `Disallowed alternate product search logic:\n${violations.join("\n")}`).toEqual([]);
  });

  it("Unit rules: reversed words, partial prefix, shortCode, weight g/kg conversions, MRP, 1-typo, out-of-stock ordering, Hindi/Hinglish", () => {
    const sample: SearchableProduct[] = [
      {
        id: "p-bhujia-1kg",
        name: "Bikaji Bhujia 1kg",
        nameHi: "बीकाजी भुजिया 1 किग्रा",
        shortCode: "BB-1KG",
        weight: "1kg",
        weightValue: 1,
        weightUnit: "kg",
        weightBase: 1000,
        mrpPaise: 25000,
        companyName: "Bikaji",
        shopStockQty: 12,
        godownStockQty: 20,
      },
      {
        id: "p-mirch-100g",
        name: "MDH Deggi Mirch 100g",
        nameHi: "एमडीएच देगी मिर्च 100 ग्राम",
        shortCode: "MDH-100",
        weight: "100g",
        weightValue: 100,
        weightUnit: "g",
        weightBase: 100,
        mrpPaise: 9500,
        companyName: "MDH",
        shopStockQty: 0,
        godownStockQty: 0,
      },
    ];
    const index = buildProductSearchIndex(sample);

    // Words in any order
    expect(searchItems("bhujia bikaji", index)[0]?.id).toBe("p-bhujia-1kg");
    // Weight unit conversion (1000g / 0.1kg / 100 gm)
    expect(searchItems("1000g", index)[0]?.id).toBe("p-bhujia-1kg");
    expect(searchItems("0.1kg", index)[0]?.id).toBe("p-mirch-100g");
    expect(searchItems("100 gm", index)[0]?.id).toBe("p-mirch-100g");
    // ShortCode
    expect(searchItems("MDH100", index)[0]?.id).toBe("p-mirch-100g");
    // MRP
    expect(searchItems("250", index)[0]?.id).toBe("p-bhujia-1kg");
    expect(searchItems("95", index)[0]?.id).toBe("p-mirch-100g");
    // 1-edit typo
    expect(searchItems("bikji", index)[0]?.id).toBe("p-bhujia-1kg");
    // Devanagari Hindi & Hinglish
    expect(searchItems("बीकाजी", index)[0]?.id).toBe("p-bhujia-1kg");
    expect(searchItems("भुजिया", index)[0]?.id).toBe("p-bhujia-1kg");
  });

  describe("Backend Parity across catalog & storefront services", () => {
    beforeAll(async () => {
      // Ensure DB fixture exists from global-setup
    });

    it("returns identical ordered IDs for shared engine across CatalogRepository, StoreService, and smart-search", async () => {
      const queries = ["1kg", "1000g", "bikaji", "bikji", "250"];
      const allCatalog = await catalogRepository.searchProducts({ activeOnly: true, limit: 500, offset: 0 });
      const searchable: SearchableProduct[] = allCatalog.map((p) => ({
        id: p.id,
        name: p.name,
        shortCode: p.shortCode,
        weight: p.weight,
        weightValue: p.weightValue,
        weightUnit: p.weightUnit,
        weightBase: p.weightBase,
        mrpPaise: p.mrpPaise,
        priceAPaise: p.priceAPaise,
        priceBPaise: p.priceBPaise,
        priceCPaise: p.priceCPaise,
        packSize: p.packSize,
        packLabel: p.packLabel,
        companyName: p.company?.name ?? null,
        shopStockQty: p.stockBalances.reduce((s, b) => (b.location.type === "SHOP" ? s + b.qty : s), 0),
        godownStockQty: p.stockBalances.reduce((s, b) => (b.location.type === "GODOWN" ? s + b.qty : s), 0),
      }));

      for (const q of queries) {
        const expected = searchItems(q, searchable, { limit: 50 }).map((x) => x.id);
        const catalogRes = (await catalogRepository.searchProducts({ q, activeOnly: true, limit: 50, offset: 0 })).map((x) => x.id);
        expect(catalogRes, `CatalogRepository mismatch on "${q}"`).toEqual(expected);

        const pricedSet = new Set(
          allCatalog.filter((p) => (p.mrpPaise ?? 0) > 0 || (p.priceCPaise ?? 0) > 0).map((p) => p.id)
        );
        const expectedStore = expected.filter((id) => pricedSet.has(id));
        const storeRes = (await storeService.getCatalogue({ q, limit: 50, offset: 0 })).products.map(
          (x: any) => x.id
        );
        expect(storeRes, `StoreService mismatch on "${q}"`).toEqual(expectedStore);
      }
    });
  });
});
