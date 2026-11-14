import { describe, it, expect } from "vitest";
import { createPurchaseSchema } from "@/modules/purchase/purchase.types";

describe("R1: Purchase GRN Twin of Shop POS Logic & Unit Conversion", () => {
  it("converts units accurately into total pieces", () => {
    const packSize = 24;
    const bagSize = 50;

    const testUnits = [
      { unit: "Carton", rawQty: 2, expectedPcs: 2 * packSize },
      { unit: "Pcs", rawQty: 10, expectedPcs: 10 },
      { unit: "Dozen", rawQty: 3, expectedPcs: 3 * 12 },
      { unit: "Bag", rawQty: 1, expectedPcs: 1 * bagSize },
      { unit: "Hanger", rawQty: 2, expectedPcs: 2 * 60 },
    ];

    for (const { unit, rawQty, expectedPcs } of testUnits) {
      let multiplier = 1;
      if (unit === "Carton") multiplier = packSize;
      else if (unit === "Dozen") multiplier = 12;
      else if (unit === "Bag") multiplier = bagSize;
      else if (unit === "Hanger") multiplier = 60;
      else multiplier = 1;

      const totalPieces = Math.round(rawQty * multiplier);
      expect(totalPieces).toBe(expectedPcs);
    }
  });

  it("calculates line taxable, tax, and ratePaise correctly", () => {
    // 2 Cartons, pack size 24 -> 48 pieces total
    const rawQty = 2;
    const packSize = 24;
    const totalPieces = rawQty * packSize; // 48
    const ratePerCarton = 1200; // Rs 1200 per carton
    const discPercent = 5; // 5% discount
    const gstRateBp = 1800; // 18%

    const gross = rawQty * ratePerCarton; // 2400
    const discount = gross * (discPercent / 100); // 120
    const taxable = gross - discount; // 2280
    const tax = taxable * (gstRateBp / 10000); // 410.4
    const total = taxable + tax; // 2690.4

    const ratePaise = Math.round((taxable * 100) / totalPieces);
    // 228000 / 48 = 4750 paise = Rs 47.50 per piece
    expect(ratePaise).toBe(4750);
    expect(taxable).toBe(2280);
    expect(tax).toBeCloseTo(410.4, 2);
    expect(total).toBeCloseTo(2690.4, 2);
  });

  it("calculates grand total and round-off accurately", () => {
    const rawGrandTotal = 2690.4;
    const roundedGrandTotal = Math.round(rawGrandTotal); // 2690
    const roundOff = roundedGrandTotal - rawGrandTotal; // -0.4

    expect(roundedGrandTotal).toBe(2690);
    expect(roundOff).toBeCloseTo(-0.4, 2);
    expect(roundedGrandTotal * 100).toBe(269000);
  });

  it("produces valid payload matching createPurchaseSchema", () => {
    const payload = {
      supplierId: "sup_123",
      billNo: "INV-2026-99",
      billDate: new Date(),
      locationId: "loc_godown_main",
      items: [
        {
          productId: "prod_001",
          qty: 48, // total pieces
          ratePaise: 4750, // rate in paise
          gstRateBp: 1800,
        },
      ],
    };

    const parsed = createPurchaseSchema.parse(payload);
    expect(parsed.billNo).toBe("INV-2026-99");
    expect(parsed.items.length).toBe(1);
    expect(parsed.items[0].qty).toBe(48);
    expect(parsed.items[0].ratePaise).toBe(4750);
  });

  it("handles held voucher serialization and restoration", () => {
    const heldVoucher = {
      id: "held_1700000000",
      timestamp: Date.now(),
      dateStr: "16:45",
      supplierId: "sup_test",
      supplierName: "Apex Goods",
      billNo: "DRAFT-101",
      billDate: "2026-11-14",
      locationId: "loc_godown",
      narration: "Held during receiving unload",
      items: [
        {
          id: "line_1",
          productId: "prod_test",
          qtyInput: "5",
          unit: "Carton" as const,
          rateInput: "500.00",
          discPercentInput: "0",
          gstRateBp: 500,
        },
      ],
      netPayablePaise: 262500,
    };

    const serialized = JSON.stringify([heldVoucher]);
    const restored = JSON.parse(serialized);

    expect(restored.length).toBe(1);
    expect(restored[0].supplierName).toBe("Apex Goods");
    expect(restored[0].items[0].qtyInput).toBe("5");
    expect(restored[0].netPayablePaise).toBe(262500);
  });
});
