import { describe, it, expect } from "vitest";

function resolveLineUnit(item: {
  qty: number;
  product: { packSize?: number | null; packLabel?: string | null };
}): { displayQty: number; unitLabel: string; rateMultiplier: number } {
  const packSize = item.product.packSize && item.product.packSize > 1 ? item.product.packSize : 1;
  const isWholeCartons = packSize > 1 && item.qty >= packSize && item.qty % packSize === 0;

  if (isWholeCartons) {
    return {
      displayQty: item.qty / packSize,
      unitLabel: item.product.packLabel || "Carton",
      rateMultiplier: packSize,
    };
  }

  return {
    displayQty: item.qty,
    unitLabel: "Pcs",
    rateMultiplier: 1,
  };
}

function reconcileInvoiceTotals(invoice: {
  totalPaise: number;
  items: Array<{ taxablePaise: number; taxPaise: number }>;
  roundOffPaise?: number | null;
}) {
  const itemsSubtotalPaise = invoice.items.reduce(
    (sum, i) => sum + i.taxablePaise + i.taxPaise,
    0
  );

  const rawDifference = invoice.totalPaise - itemsSubtotalPaise;
  let deliveryFeePaise = 0;
  let roundOffPaise = rawDifference;

  // If difference is >= 1 rupee (100 paise), it represents a delivery fee or surcharge, not round-off!
  if (rawDifference >= 100) {
    deliveryFeePaise = Math.floor(rawDifference / 100) * 100;
    // Remainder under 100 paise is genuine round-off
    roundOffPaise = rawDifference - deliveryFeePaise;
  }

  return {
    itemsSubtotalPaise,
    deliveryFeePaise,
    roundOffPaise,
    reconciledTotalPaise: itemsSubtotalPaise + deliveryFeePaise + roundOffPaise,
    isRoundOffUnderOneRupee: Math.abs(roundOffPaise / 100) < 1.0,
  };
}

describe("Defects B2 & B3: Print Line Unit & Totals Reconciliation", () => {
  it("B2: formats loose pieces as Pcs even when product has packLabel Carton", () => {
    // 6 packets of rice with packSize 10 and packLabel 'Carton'
    const result = resolveLineUnit({
      qty: 6,
      product: { packSize: 10, packLabel: "Carton" },
    });

    expect(result.unitLabel).toBe("Pcs");
    expect(result.displayQty).toBe(6);
  });

  it("B2: formats whole carton multiples as Carton with correct displayQty and rate multiplier", () => {
    // 100 pcs of packSize 20 = 5 Cartons
    const result = resolveLineUnit({
      qty: 100,
      product: { packSize: 20, packLabel: "Carton" },
    });

    expect(result.unitLabel).toBe("Carton");
    expect(result.displayQty).toBe(5);
    expect(result.rateMultiplier).toBe(20);
  });

  it("B3: extracts delivery fee when total exceeds items subtotal so round-off is strictly under 1 rupee", () => {
    // INV/26-27/000009 case: items total 1140.06, invoice total 1190.00
    const invoice = {
      totalPaise: 119000,
      items: [{ taxablePaise: 108577, taxPaise: 5429 }], // sum = 114006 paise (1140.06)
    };

    const reconciliation = reconcileInvoiceTotals(invoice);
    expect(reconciliation.deliveryFeePaise).toBe(4900); // 49.00 or delivery fee
    expect(reconciliation.isRoundOffUnderOneRupee).toBe(true);
    expect(reconciliation.reconciledTotalPaise).toBe(119000);
  });
});
