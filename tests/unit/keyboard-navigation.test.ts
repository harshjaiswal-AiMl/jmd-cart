import { describe, it, expect } from "vitest";
import {
  evaluateMathExpression,
  calculateNextListIndex,
  calculateNextGridPosition,
  isAtCaretBoundary,
} from "@/lib/keyboard/navigation";

describe("Part A: Safe Inline Math Parser", () => {
  it("evaluates simple multiplication, division, addition, and subtraction", () => {
    expect(evaluateMathExpression("12*5")).toBe(60);
    expect(evaluateMathExpression("24/2")).toBe(12);
    expect(evaluateMathExpression("100+25")).toBe(125);
    expect(evaluateMathExpression("80-15")).toBe(65);
    expect(evaluateMathExpression("=50*2")).toBe(100);
    expect(evaluateMathExpression("12.5*4")).toBe(50);
  });

  it("evaluates compound expressions respecting standard precedence", () => {
    expect(evaluateMathExpression("10+2*5")).toBe(20);
    expect(evaluateMathExpression("100-20/2")).toBe(90);
    expect(evaluateMathExpression("(10+2)*5")).toBe(60);
  });

  it("safely rejects non-numeric or dangerous expressions without throwing", () => {
    expect(evaluateMathExpression("alert(1)")).toBeNull();
    expect(evaluateMathExpression("console.log()")).toBeNull();
    expect(evaluateMathExpression("abc")).toBeNull();
    expect(evaluateMathExpression("12++5")).toBeNull();
    expect(evaluateMathExpression("")).toBeNull();
    expect(evaluateMathExpression("   ")).toBeNull();
  });
});

describe("Part A: Listbox / Dropdown Keyboard Navigation", () => {
  it("navigates down and wraps or bounds correctly", () => {
    const total = 5;
    expect(calculateNextListIndex(0, "ArrowDown", total)).toBe(1);
    expect(calculateNextListIndex(4, "ArrowDown", total)).toBe(0); // wrap to 0
  });

  it("navigates up and wraps correctly", () => {
    const total = 5;
    expect(calculateNextListIndex(2, "ArrowUp", total)).toBe(1);
    expect(calculateNextListIndex(0, "ArrowUp", total)).toBe(4); // wrap to last
  });

  it("handles Home, End, PageDown, PageUp", () => {
    const total = 20;
    expect(calculateNextListIndex(10, "Home", total)).toBe(0);
    expect(calculateNextListIndex(10, "End", total)).toBe(19);
    expect(calculateNextListIndex(2, "PageDown", total, 5)).toBe(7);
    expect(calculateNextListIndex(18, "PageDown", total, 5)).toBe(19);
    expect(calculateNextListIndex(7, "PageUp", total, 5)).toBe(2);
    expect(calculateNextListIndex(2, "PageUp", total, 5)).toBe(0);
  });
});

describe("Part A: Two-Mode Spreadsheet Grid Navigation", () => {
  const numRows = 12;
  const numCols = 6; // e.g. 0: Qty, 1: Unit, 2: Rate, 3: Disc, 4: GST, 5: Del

  it("moves active cell in navigate mode with arrow keys", () => {
    const current = { row: 2, col: 1 };
    expect(calculateNextGridPosition(current, "ArrowRight", numRows, numCols)).toEqual({ row: 2, col: 2 });
    expect(calculateNextGridPosition(current, "ArrowLeft", numRows, numCols)).toEqual({ row: 2, col: 0 });
    expect(calculateNextGridPosition(current, "ArrowDown", numRows, numCols)).toEqual({ row: 3, col: 1 });
    expect(calculateNextGridPosition(current, "ArrowUp", numRows, numCols)).toEqual({ row: 1, col: 1 });
  });

  it("respects grid boundaries in navigate mode", () => {
    expect(calculateNextGridPosition({ row: 0, col: 0 }, "ArrowLeft", numRows, numCols)).toEqual({ row: 0, col: 0 });
    expect(calculateNextGridPosition({ row: 0, col: 0 }, "ArrowUp", numRows, numCols)).toEqual({ row: 0, col: 0 });
    expect(calculateNextGridPosition({ row: 11, col: 5 }, "ArrowRight", numRows, numCols)).toEqual({ row: 11, col: 5 });
    expect(calculateNextGridPosition({ row: 11, col: 5 }, "ArrowDown", numRows, numCols)).toEqual({ row: 11, col: 5 });
  });

  it("detects caret boundary conditions accurately for exiting edit mode", () => {
    // Caret at start (offset 0)
    expect(isAtCaretBoundary("123", 0, 0, "ArrowLeft")).toBe(true);
    expect(isAtCaretBoundary("123", 0, 0, "ArrowRight")).toBe(false);

    // Caret at end (offset 3 for length 3)
    expect(isAtCaretBoundary("123", 3, 3, "ArrowRight")).toBe(true);
    expect(isAtCaretBoundary("123", 3, 3, "ArrowLeft")).toBe(false);

    // Caret in middle (offset 1)
    expect(isAtCaretBoundary("123", 1, 1, "ArrowLeft")).toBe(false);
    expect(isAtCaretBoundary("123", 1, 1, "ArrowRight")).toBe(false);

    // Selection range (not collapsed)
    expect(isAtCaretBoundary("123", 0, 2, "ArrowLeft")).toBe(false);
    expect(isAtCaretBoundary("123", 1, 3, "ArrowRight")).toBe(false);
  });
});
