import { describe, it, expect } from "vitest";

// Stock routing determination function to test pure business logic
export interface StockRoutingInput {
  isShopLocation: boolean;
  isPartyJmdShop: boolean;
  packSize: number;
  qty: number;
  shopLocationId: string;
  godownLocationId: string;
}

export interface StockMovementPlan {
  fromLocationId: string;
  toLocationId: string | null;
  qty: number;
  type: "SALE" | "TRANSFER";
  reasonTag: "Cartons from Godown" | "Loose from Shop" | "Transfer Godown to Shop";
}

export function planStockMovements(input: StockRoutingInput): StockMovementPlan[] {
  const plans: StockMovementPlan[] = [];
  const { isShopLocation, isPartyJmdShop, packSize, qty, shopLocationId, godownLocationId } = input;

  if (isPartyJmdShop) {
    // When billed in the name of JMD Shop: stock leaves Godown and adds to Shop
    plans.push({
      fromLocationId: godownLocationId,
      toLocationId: shopLocationId,
      qty,
      type: "TRANSFER",
      reasonTag: "Transfer Godown to Shop",
    });
    return plans;
  }

  if (isShopLocation && godownLocationId) {
    if (packSize > 1) {
      const cartons = Math.floor(qty / packSize);
      const cartonPcs = cartons * packSize;
      const loosePcs = qty % packSize;

      // Cartons ALWAYS reduce Godown stock
      if (cartonPcs > 0) {
        plans.push({
          fromLocationId: godownLocationId,
          toLocationId: null,
          qty: cartonPcs,
          type: "SALE",
          reasonTag: "Cartons from Godown",
        });
      }

      // Loose pieces ALWAYS reduce Shop stock (NO silent fallback to Godown)
      if (loosePcs > 0) {
        plans.push({
          fromLocationId: shopLocationId,
          toLocationId: null,
          qty: loosePcs,
          type: "SALE",
          reasonTag: "Loose from Shop",
        });
      }
    } else {
      // packSize === 1: Retail sale from Shop always reduces Shop stock
      plans.push({
        fromLocationId: shopLocationId,
        toLocationId: null,
        qty,
        type: "SALE",
        reasonTag: "Loose from Shop",
      });
    }
  } else {
    // Other locations (e.g. Van)
    plans.push({
      fromLocationId: shopLocationId,
      toLocationId: null,
      qty,
      type: "SALE",
      reasonTag: "Loose from Shop",
    });
  }

  return plans;
}

describe("Prompt 27 - Part D: Stock Rules & Evidence Matrix", () => {
  const SHOP_ID = "loc-shop";
  const GODOWN_ID = "loc-godown";

  it("Rule 1: Cartons always reduce Godown stock, loose pieces always reduce Shop stock", () => {
    // 1 carton (24 pcs) + 5 loose pieces = 29 pieces
    const plans = planStockMovements({
      isShopLocation: true,
      isPartyJmdShop: false,
      packSize: 24,
      qty: 29,
      shopLocationId: SHOP_ID,
      godownLocationId: GODOWN_ID,
    });

    expect(plans).toHaveLength(2);

    // Cartons from Godown
    expect(plans[0].fromLocationId).toBe(GODOWN_ID);
    expect(plans[0].toLocationId).toBeNull();
    expect(plans[0].qty).toBe(24);
    expect(plans[0].type).toBe("SALE");
    expect(plans[0].reasonTag).toBe("Cartons from Godown");

    // Loose from Shop
    expect(plans[1].fromLocationId).toBe(SHOP_ID);
    expect(plans[1].toLocationId).toBeNull();
    expect(plans[1].qty).toBe(5);
    expect(plans[1].type).toBe("SALE");
    expect(plans[1].reasonTag).toBe("Loose from Shop");
  });

  it("Rule 2: When billed in the name of JMD Shop, item leaves Godown and adds to Shop", () => {
    const plans = planStockMovements({
      isShopLocation: true,
      isPartyJmdShop: true,
      packSize: 24,
      qty: 48,
      shopLocationId: SHOP_ID,
      godownLocationId: GODOWN_ID,
    });

    expect(plans).toHaveLength(1);
    expect(plans[0].fromLocationId).toBe(GODOWN_ID);
    expect(plans[0].toLocationId).toBe(SHOP_ID);
    expect(plans[0].qty).toBe(48);
    expect(plans[0].type).toBe("TRANSFER");
    expect(plans[0].reasonTag).toBe("Transfer Godown to Shop");
  });

  it("Rule 3: NO silent fallback from Shop to Godown for loose pieces", () => {
    // 3 loose pieces
    const plans = planStockMovements({
      isShopLocation: true,
      isPartyJmdShop: false,
      packSize: 24,
      qty: 3,
      shopLocationId: SHOP_ID,
      godownLocationId: GODOWN_ID,
    });

    expect(plans).toHaveLength(1);
    expect(plans[0].fromLocationId).toBe(SHOP_ID);
    expect(plans[0].toLocationId).toBeNull();
    expect(plans[0].qty).toBe(3);
    // Godown must NEVER receive loose pieces sale
    expect(plans.some((p) => p.fromLocationId === GODOWN_ID)).toBe(false);
  });
});
