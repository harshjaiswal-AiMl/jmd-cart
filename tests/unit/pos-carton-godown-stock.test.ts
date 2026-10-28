import { describe, it, expect } from "vitest";

describe("Shop POS - Carton from Godown & Loose from Shop Stock Validation", () => {
  it("evaluates Carton lines against Godown stock even when Shop stock is zero", () => {
    const product = {
      id: "prod_bhujia",
      name: "Bikaji Bhujia 400G",
      packSize: 10,
      shopStockQty: 0, // Shop has 0 loose pieces
      godownStockQty: 100, // Godown has 10 cartons (100 pcs)
      godownCartons: 10,
    };

    const cartLineCarton = {
      productId: product.id,
      unit: "Carton" as const,
      qty: 2, // 2 cartons = 20 pcs
      product,
    };

    const isCarton = cartLineCarton.unit === "Carton";
    const requestedPieces = isCarton ? cartLineCarton.qty * product.packSize : cartLineCarton.qty;
    const availablePieces = isCarton ? product.godownStockQty : product.shopStockQty;
    const availableCartons = product.godownCartons ?? Math.floor(product.godownStockQty / product.packSize);

    const isStockSufficient = isCarton
      ? (cartLineCarton.qty <= availableCartons || requestedPieces <= availablePieces)
      : (requestedPieces <= availablePieces);

    // Must be sufficient because Godown has 10 cartons and user requested 2 cartons
    expect(isStockSufficient).toBe(true);
    expect(availableCartons).toBe(10);
    expect(requestedPieces).toBe(20);
  });

  it("evaluates Loose Pcs lines against Shop stock", () => {
    const product = {
      id: "prod_bhujia",
      name: "Bikaji Bhujia 400G",
      packSize: 10,
      shopStockQty: 5, // Shop has 5 pcs
      godownStockQty: 100,
      godownCartons: 10,
    };

    const cartLinePcs = {
      productId: product.id,
      unit: "Pcs" as const,
      qty: 8, // Requesting 8 loose pieces, shop only has 5
      product,
    };

    const isCarton = (cartLinePcs.unit as string) === "Carton";
    const requestedPieces = isCarton ? cartLinePcs.qty * product.packSize : cartLinePcs.qty;
    const availablePieces = isCarton ? product.godownStockQty : product.shopStockQty;

    const isStockSufficient = requestedPieces <= availablePieces;

    expect(isStockSufficient).toBe(false);
    expect(requestedPieces).toBe(8);
    expect(availablePieces).toBe(5);
  });

  it("warehouse packing queue filters out loose items for Shop sales", () => {
    const shopInvoice = {
      channel: "SHOP",
      items: [
        {
          id: "item_1",
          qty: 20, // 2 full cartons of packSize 10
          product: { packSize: 10, packLabel: "Carton" },
        },
        {
          id: "item_2",
          qty: 3, // 3 loose pieces of packSize 10
          product: { packSize: 10, packLabel: "Carton" },
        },
      ],
    };

    // Filter only carton lines for warehouse packing
    const cartonItems = shopInvoice.items
      .filter((item) => {
        const packSize = Math.max(1, item.product?.packSize || 1);
        return packSize > 1 && Math.floor(item.qty / packSize) > 0;
      })
      .map((item) => {
        const packSize = Math.max(1, item.product?.packSize || 1);
        const cartons = Math.floor(item.qty / packSize);
        return {
          ...item,
          qty: cartons * packSize,
        };
      });

    // Only item_1 should be in the warehouse queue, item_2 (loose) is packed at shop counter
    expect(cartonItems.length).toBe(1);
    expect(cartonItems[0].id).toBe("item_1");
    expect(cartonItems[0].qty).toBe(20);
  });
});
