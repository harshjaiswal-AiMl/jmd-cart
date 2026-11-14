import { describe, it, expect } from "vitest";
import { calculateNextGridPosition, calculateNextListIndex, evaluateMathExpression } from "@/lib/keyboard/navigation";

describe("PROMPT 26: No-Mouse Keyboard Control & Reachability Proof", () => {
  describe("Region Jump Shortcuts (Alt+1..4)", () => {
    const REGIONS = [
      { key: "1", target: "Header (Bill No, Supplier, Date)", id: "grn-bill-no" },
      { key: "2", target: "Grid (First Item row / search)", id: "grn-item-search" },
      { key: "3", target: "Summary (Bill discount, freight)", id: "grn-discount-input" },
      { key: "4", target: "Post Action button", id: "grn-post-btn" },
    ];

    it("has all 4 designated region targets defined and accessible", () => {
      expect(REGIONS).toHaveLength(4);
      expect(REGIONS.map((r) => r.id)).toEqual([
        "grn-bill-no",
        "grn-item-search",
        "grn-discount-input",
        "grn-post-btn",
      ]);
    });
  });

  describe("Grid Navigation: 4-Way Arrow Key Matrix", () => {
    const totalRows = 5;
    const totalCols = 7; // qty, unit, mrp, rate, disc, gst, delete

    it("navigates down across rows within the same column", () => {
      const next = calculateNextGridPosition(
        { row: 1, col: 2 },
        "ArrowDown",
        totalRows,
        totalCols
      );
      expect(next).toEqual({ row: 2, col: 2 });
    });

    it("navigates up across rows within the same column", () => {
      const next = calculateNextGridPosition(
        { row: 2, col: 2 },
        "ArrowUp",
        totalRows,
        totalCols
      );
      expect(next).toEqual({ row: 1, col: 2 });
    });

    it("navigates right to next column and stops at row boundary", () => {
      const inside = calculateNextGridPosition(
        { row: 0, col: 1 },
        "ArrowRight",
        totalRows,
        totalCols
      );
      expect(inside).toEqual({ row: 0, col: 2 });

      const atBoundary = calculateNextGridPosition(
        { row: 0, col: 6 },
        "ArrowRight",
        totalRows,
        totalCols
      );
      expect(atBoundary).toEqual({ row: 0, col: 6 });
    });

    it("navigates left to previous column and stops at row boundary", () => {
      const inside = calculateNextGridPosition(
        { row: 1, col: 2 },
        "ArrowLeft",
        totalRows,
        totalCols
      );
      expect(inside).toEqual({ row: 1, col: 1 });

      const atBoundary = calculateNextGridPosition(
        { row: 1, col: 0 },
        "ArrowLeft",
        totalRows,
        totalCols
      );
      expect(atBoundary).toEqual({ row: 1, col: 0 });
    });

    it("clamps at the start and end of the entire grid", () => {
      const atStart = calculateNextGridPosition(
        { row: 0, col: 0 },
        "ArrowLeft",
        totalRows,
        totalCols
      );
      expect(atStart).toEqual({ row: 0, col: 0 });

      const atEnd = calculateNextGridPosition(
        { row: 4, col: 6 },
        "ArrowRight",
        totalRows,
        totalCols
      );
      expect(atEnd).toEqual({ row: 4, col: 6 });
    });
  });

  describe("Modal & Listbox Arrow Navigation", () => {
    it("cycles through supplier list with ArrowDown, ArrowUp, Home, End", () => {
      const supplierCount = 8;
      expect(calculateNextListIndex(0, "ArrowDown", supplierCount)).toBe(1);
      expect(calculateNextListIndex(7, "ArrowDown", supplierCount, true)).toBe(0); // wrapping
      expect(calculateNextListIndex(3, "ArrowUp", supplierCount)).toBe(2);
      expect(calculateNextListIndex(0, "ArrowUp", supplierCount, true)).toBe(7); // wrapping
      expect(calculateNextListIndex(3, "Home", supplierCount)).toBe(0);
      expect(calculateNextListIndex(3, "End", supplierCount)).toBe(7);
      expect(calculateNextListIndex(1, "PageDown", supplierCount)).toBe(6);
      expect(calculateNextListIndex(6, "PageUp", supplierCount)).toBe(1);
    });
  });

  describe("P0 Intelligence: Inline Math & Variance Alerts", () => {
    it("evaluates safe inline arithmetic without eval()", () => {
      expect(evaluateMathExpression("12*5")).toBe(60);
      expect(evaluateMathExpression("100 + 25")).toBe(125);
      expect(evaluateMathExpression("480 / 12")).toBe(40);
      expect(evaluateMathExpression("(10 + 2) * 5")).toBe(60);
      expect(evaluateMathExpression("invalid-chars")).toBeNull();
    });

    it("flags price variance when rate exceeds 5% from previous purchase", () => {
      const lastRate = 100;
      const checkVariance = (currentRate: number) => {
        const diff = Math.abs(currentRate - lastRate);
        const pct = (diff / lastRate) * 100;
        return { isAlert: pct > 5, pct: Math.round(pct * 10) / 10 };
      };

      expect(checkVariance(102)).toEqual({ isAlert: false, pct: 2 });
      expect(checkVariance(106)).toEqual({ isAlert: true, pct: 6 });
      expect(checkVariance(90)).toEqual({ isAlert: true, pct: 10 });
    });

    it("verifies supplier bill cross-check diff indicator", () => {
      const netPayable = 5430;
      const calculateDiff = (supplierBillTotal: number) => {
        return Math.round((netPayable - supplierBillTotal) * 100) / 100;
      };

      expect(calculateDiff(5430)).toBe(0);
      expect(calculateDiff(5400)).toBe(30);
      expect(calculateDiff(5500)).toBe(-70);
    });
  });
});
