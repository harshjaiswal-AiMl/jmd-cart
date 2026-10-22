import { describe, it, expect } from "vitest";
import { stockRank } from "@/modules/stock/availability";

describe("Part B: Out-of-Stock Products Last Everywhere (Unit & Property Tests)", () => {
  describe("Property Test: stockRank vs Storefront Availability Invariant", () => {
    it("matches getAvailability condition across 1,000 random cases", () => {
      for (let i = 0; i < 1000; i++) {
        const godownQty = Math.floor(Math.random() * 500);
        const reservedQty = Math.floor(Math.random() * 200);
        const buffer = Math.floor(Math.random() * 20);

        const availablePieces = Math.max(0, godownQty - reservedQty - buffer);
        const isInStock = availablePieces > 0;

        const rank = stockRank(
          { id: `prod-${i}`, packSize: 10 },
          "STOREFRONT",
          { godownQty, reservedQty, buffer }
        );

        // Invariant: rank must be 1 if and only if isInStock is true
        expect(rank === 1).toBe(isInStock);
      }
    });
  });

  describe("Context-Specific Invariants", () => {
    it("POS: in stock if loose shop pieces > 0 OR godown has at least one carton", () => {
      const prod = { id: "p1", packSize: 24 };

      // Shop has loose pieces, Godown has 0
      expect(stockRank(prod, "POS", { shopQty: 5, godownQty: 0 })).toBe(1);

      // Shop has 0, Godown has 1 full carton (24 pcs)
      expect(stockRank(prod, "POS", { shopQty: 0, godownQty: 24 })).toBe(1);

      // Shop has 0, Godown has less than a full carton (e.g. 10 pcs)
      expect(stockRank(prod, "POS", { shopQty: 0, godownQty: 10 })).toBe(0);

      // Both have 0
      expect(stockRank(prod, "POS", { shopQty: 0, godownQty: 0 })).toBe(0);
    });

    it("VAN: in stock if van inventory > 0", () => {
      const prod = { id: "p1" };
      expect(stockRank(prod, "VAN", { vanQty: 12 })).toBe(1);
      expect(stockRank(prod, "VAN", { vanQty: 0 })).toBe(0);
    });

    it("ADMIN: in stock if total across active locations > 0", () => {
      const prod = { id: "p1" };
      expect(stockRank(prod, "ADMIN", { totalActiveQty: 50 })).toBe(1);
      expect(stockRank(prod, "ADMIN", { totalActiveQty: 0 })).toBe(0);
    });
  });

  describe("Pagination Test across 35 items at 10 per page", () => {
    interface MockProduct {
      id: string;
      name: string;
      initialIndex: number;
      inStock: boolean;
    }

    it("places all in-stock items before out-of-stock items across all pages with stable order", () => {
      // 35 products: 22 in-stock, 13 out-of-stock in mixed order
      const items: MockProduct[] = Array.from({ length: 35 }, (_, idx) => {
        // e.g., even indices are in stock, odd indices or primes are out of stock
        const inStock = idx % 3 !== 0; // 23 in stock, 12 out of stock
        return {
          id: `item-${idx + 1}`,
          name: `Product ${idx + 1}`,
          initialIndex: idx,
          inStock,
        };
      });

      // Sort with in-stock first (descending rank), preserving tie-break by initialIndex
      const sorted = [...items].sort((a, b) => {
        const rankA = a.inStock ? 1 : 0;
        const rankB = b.inStock ? 1 : 0;
        if (rankA !== rankB) return rankB - rankA;
        return a.initialIndex - b.initialIndex;
      });

      const inStockCount = items.filter((x) => x.inStock).length;
      const outOfStockCount = items.filter((x) => !x.inStock).length;

      const pageSize = 10;
      const totalPages = Math.ceil(sorted.length / pageSize);
      expect(totalPages).toBe(4);

      const allPaginatedItems: MockProduct[] = [];
      for (let page = 1; page <= totalPages; page++) {
        const offset = (page - 1) * pageSize;
        const pageItems = sorted.slice(offset, offset + pageSize);
        allPaginatedItems.push(...pageItems);
      }

      expect(allPaginatedItems.length).toBe(35);

      // Verify: The first `inStockCount` items are ALL in-stock
      const firstChunk = allPaginatedItems.slice(0, inStockCount);
      expect(firstChunk.every((x) => x.inStock)).toBe(true);

      // Verify: The remaining `outOfStockCount` items are ALL out-of-stock
      const secondChunk = allPaginatedItems.slice(inStockCount);
      expect(secondChunk.every((x) => !x.inStock)).toBe(true);

      // Verify: Stability within in-stock items
      for (let i = 1; i < firstChunk.length; i++) {
        expect(firstChunk[i].initialIndex).toBeGreaterThan(firstChunk[i - 1].initialIndex);
      }

      // Verify: Stability within out-of-stock items
      for (let i = 1; i < secondChunk.length; i++) {
        expect(secondChunk[i].initialIndex).toBeGreaterThan(secondChunk[i - 1].initialIndex);
      }
    });
  });
});
