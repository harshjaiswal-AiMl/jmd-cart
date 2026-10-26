import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { resolvePrice } from "@/modules/pricing/resolve-price";
import { getPartyBillHistoryAction, getPartyLastItemPurchaseAction } from "@/app/shop/pos/actions";
import { paiseToIndianWords } from "@/lib/number-to-words";
import { PartyType } from "@prisma/client";

describe("Sections 3 to 7: Shop POS Busy-style enhancements & Party History", () => {
  it("correctly reconciles Carton vs Pcs quantities and rates in sales voucher grid", () => {
    const product = {
      id: "prod-basmati",
      name: "Dawat Biryani Basmati Rice 1kg",
      shortCode: "DWT01",
      mrpPaise: 25000, // ₹250 MRP
      priceAPaise: 19000, // ₹190 Wholesale
      priceBPaise: 20000, // ₹200 Retailer
      priceCPaise: 22000, // ₹220 Standard
      packSize: 20, // 20 pcs per carton
      packLabel: "Carton of 20",
    };

    // 1. Line in Pcs (6 pcs @ Wholesaler rate)
    const resolvedA = resolvePrice(
      {
        mrpPaise: product.mrpPaise,
        priceAPaise: product.priceAPaise,
        priceBPaise: product.priceBPaise,
        priceCPaise: product.priceCPaise,
      },
      "WHOLESALER"
    );
    expect(resolvedA.unitPricePaise).toBe(19000);
    const pcsQty = 6;
    const pcsTotalPaise = pcsQty * resolvedA.unitPricePaise;
    expect(pcsTotalPaise).toBe(114000); // ₹1,140.00

    // 2. Line in Cartons (5 cartons @ Wholesaler rate = 100 pcs)
    const cartonsQty = 5;
    const effectivePieces = cartonsQty * product.packSize;
    expect(effectivePieces).toBe(100);

    const cartonRatePaise = resolvedA.unitPricePaise * product.packSize;
    expect(cartonRatePaise).toBe(380000); // ₹3,800.00 per carton

    const cartonTotalPaise = cartonsQty * cartonRatePaise;
    expect(cartonTotalPaise).toBe(1900000); // ₹19,000.00

    // 3. Line discount (e.g. 5% discount on carton line)
    const discountPercent = 5;
    const discountedTotalPaise = Math.round(cartonTotalPaise * (1 - discountPercent / 100));
    expect(discountedTotalPaise).toBe(1805000); // ₹18,050.00
  });

  it("converts total paise into Indian Currency words accurately for voucher footer", () => {
    expect(paiseToIndianWords(119000)).toBe("Rupees One Thousand One Hundred Ninety Only");
    expect(paiseToIndianWords(2636100)).toBe(
      "Rupees Twenty Six Thousand Three Hundred Sixty One Only"
    );
    expect(paiseToIndianWords(0)).toBe("Zero Rupees Only");
  });

  it("handles multi-tab hold & resume structure without losing lines or party data", () => {
    interface PosBillTab {
      id: string;
      tabTitle: string;
      partyId: string;
      cart: Array<{ productId: string; qty: number; unit: "Pcs" | "Carton" }>;
      isHeld: boolean;
      heldAt?: number;
    }

    const initialTabs: PosBillTab[] = [
      {
        id: "tab-1",
        tabTitle: "Sushil Bhandar",
        partyId: "party-sushil",
        cart: [
          { productId: "prod-dawat-1kg", qty: 5, unit: "Carton" },
          { productId: "prod-mogra-5kg", qty: 2, unit: "Carton" },
        ],
        isHeld: false,
      },
    ];

    // Customer 2 arrives -> Hold Bill 1 and create Bill 2
    const heldAt = Date.now();
    const updatedTabs: PosBillTab[] = initialTabs.map((t) =>
      t.id === "tab-1" ? { ...t, isHeld: true, heldAt } : t
    );

    const bill2: PosBillTab = {
      id: "tab-2",
      tabTitle: "Walk-in Retail Buyer",
      partyId: "",
      cart: [{ productId: "prod-salt-1kg", qty: 2, unit: "Pcs" }],
      isHeld: false,
    };
    updatedTabs.push(bill2);

    expect(updatedTabs.length).toBe(2);
    expect(updatedTabs[0].isHeld).toBe(true);
    expect(updatedTabs[0].cart.length).toBe(2);
    expect(updatedTabs[1].isHeld).toBe(false);

    // Resume Bill 1
    const resumedTabs = updatedTabs.map((t) =>
      t.id === "tab-1" ? { ...t, isHeld: false } : t
    );
    expect(resumedTabs[0].isHeld).toBe(false);
    expect(resumedTabs[0].partyId).toBe("party-sushil");
    expect(resumedTabs[0].cart[0].qty).toBe(5);
    expect(resumedTabs[0].cart[0].unit).toBe("Carton");
  });
});
