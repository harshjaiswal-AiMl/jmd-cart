import { describe, it, expect } from "vitest";

describe("Part D: Prompt #26 Extra Features & Calculations", () => {
  it("calculates rate variance accurately and triggers alert when > 5%", () => {
    const lastRate = 100;
    const currentRate1 = 104; // 4% difference
    const currentRate2 = 108; // 8% difference
    const currentRate3 = 92; // -8% difference

    const getDiffPercent = (curr: number, prev: number) => {
      if (prev <= 0) return 0;
      return Math.round(((curr - prev) / prev) * 100);
    };

    expect(Math.abs(getDiffPercent(currentRate1, lastRate))).toBe(4);
    expect(Math.abs(getDiffPercent(currentRate1, lastRate)) > 5).toBe(false);

    expect(getDiffPercent(currentRate2, lastRate)).toBe(8);
    expect(Math.abs(getDiffPercent(currentRate2, lastRate)) > 5).toBe(true);

    expect(getDiffPercent(currentRate3, lastRate)).toBe(-8);
    expect(Math.abs(getDiffPercent(currentRate3, lastRate)) > 5).toBe(true);
  });

  it("calculates total weight from product weight attributes accurately", () => {
    const lines = [
      { totalPieces: 60, weightBase: 400 }, // 60 * 400g = 24,000g = 24.0 kg
      { totalPieces: 10, weightBase: 5000 }, // 10 * 5kg = 50,000g = 50.0 kg
      { totalPieces: 100, weightBase: null }, // unweighted item
    ];

    const totalGrams = lines.reduce((sum, l) => sum + (l.totalPieces * (l.weightBase || 0)), 0);
    const totalKg = totalGrams / 1000;

    expect(totalGrams).toBe(74000);
    expect(totalKg).toBe(74);
  });

  it("calculates suggested selling prices given purchase rate and target margins", () => {
    const ratePerPiece = 80; // ₹80 purchase cost
    const targetMargins = {
      mrp: 20, // 20% margin on MRP => cost / (1 - 0.20) = 80 / 0.8 = 100
      tierA: 15, // 15% margin => 80 / 0.85 = 94.12
      tierB: 10, // 10% margin => 80 / 0.90 = 88.89
      tierC: 5,  // 5% margin => 80 / 0.95 = 84.21
    };

    const calcPrice = (cost: number, marginPct: number) => {
      const margin = marginPct / 100;
      if (margin >= 1) return cost;
      return Math.round((cost / (1 - margin)) * 100) / 100;
    };

    expect(calcPrice(ratePerPiece, targetMargins.mrp)).toBe(100);
    expect(calcPrice(ratePerPiece, targetMargins.tierA)).toBeCloseTo(94.12, 2);
    expect(calcPrice(ratePerPiece, targetMargins.tierB)).toBeCloseTo(88.89, 2);
    expect(calcPrice(ratePerPiece, targetMargins.tierC)).toBeCloseTo(84.21, 2);
  });
});
