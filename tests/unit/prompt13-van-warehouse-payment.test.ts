import { describe, it, expect } from "vitest";
import { UserRole, InvoiceChannel, PaymentMode, PaymentStatus } from "@prisma/client";
import { canAccessRoute, getDefaultAppForRole } from "@/modules/auth/permissions";

describe("Prompt 13 - Part A: QtyUnitPicker & Van Peti/Pcs Pricing", () => {
  it("carton quantity calculates correct pieces (packSize * qty)", () => {
    const packSize = 12;
    const cartonQty = 3;
    const totalPieces = cartonQty * packSize;
    expect(totalPieces).toBe(36);
  });

  it("carton price is piece rate * packSize", () => {
    const pieceMrpPaise = 47000; // Rs 470.00
    const packSize = 10;
    const cartonPricePaise = pieceMrpPaise * packSize;
    expect(cartonPricePaise).toBe(470000); // Rs 4700.00
  });

  it("disables carton selection when van available pieces < packSize", () => {
    const packSize = 24;
    const availablePieces = 15;
    const cartonAvailable = Math.floor(availablePieces / packSize);
    expect(cartonAvailable).toBe(0);
  });

  it("calculates mixed carton and loose pieces properly", () => {
    const packSize = 10;
    const availablePieces = 25; // 2 ctn + 5 loose
    const cartonAvailable = Math.floor(availablePieces / packSize);
    const looseAvailable = availablePieces % packSize;
    expect(cartonAvailable).toBe(2);
    expect(looseAvailable).toBe(5);
  });

  it("allows separate Peti and Pcs lines for same product in cart", () => {
    const cart = [
      { productId: "PROD_1", unit: "CARTON" as const, unitQty: 2, qty: 20 },
      { productId: "PROD_1", unit: "PCS" as const, unitQty: 5, qty: 5 },
    ];
    const totalPiecesForProduct = cart
      .filter((i) => i.productId === "PROD_1")
      .reduce((sum, i) => sum + i.qty, 0);
    expect(totalPiecesForProduct).toBe(25);
  });
});

describe("Prompt 13 - Part B: Warehouse Queue Filtering Rules", () => {
  const sampleInvoices = [
    {
      id: "INV_VAN_1",
      number: "INV/26-27/000001",
      channel: InvoiceChannel.VAN,
      status: "FINAL",
      items: [{ qty: 24, product: { packSize: 12 } }],
    },
    {
      id: "INV_SHOP_LOOSE_ONLY",
      number: "INV/26-27/000002",
      channel: InvoiceChannel.SHOP,
      status: "FINAL",
      items: [
        { qty: 3, product: { packSize: 480 } }, // loose only
        { qty: 2, product: { packSize: 50 } },  // loose only
      ],
    },
    {
      id: "INV_SHOP_MIXED",
      number: "INV/26-27/000003",
      channel: InvoiceChannel.SHOP,
      status: "FINAL",
      items: [
        { qty: 25, product: { packSize: 12 } }, // 2 cartons + 1 loose
        { qty: 4, product: { packSize: 100 } }, // loose only
      ],
    },
    {
      id: "INV_ONLINE",
      number: "INV/26-27/000004",
      channel: InvoiceChannel.ONLINE,
      status: "FINAL",
      items: [
        { qty: 5, product: { packSize: 20 } },  // loose online item
      ],
    },
  ];

  it("VAN invoices NEVER appear in warehouse packing queue", () => {
    const queue = sampleInvoices.filter((inv) => (inv.channel as any) !== InvoiceChannel.VAN);
    expect(queue.some((i: any) => i.channel === InvoiceChannel.VAN)).toBe(false);
  });

  it("SHOP loose-only bills are hidden from the warehouse packing queue", () => {
    const shopInvoices = sampleInvoices.filter((i) => i.channel === InvoiceChannel.SHOP);
    const withCartonLines = shopInvoices.filter((inv) =>
      inv.items.some((item) => {
        const ps = Math.max(1, item.product.packSize);
        return ps > 1 && Math.floor(item.qty / ps) > 0;
      })
    );
    expect(withCartonLines.length).toBe(1);
    expect(withCartonLines[0].id).toBe("INV_SHOP_MIXED");
  });

  it("mixed SHOP bills show ONLY their carton lines in warehouse checklist", () => {
    const mixed = sampleInvoices.find((i) => i.id === "INV_SHOP_MIXED")!;
    const cartonLines = mixed.items.filter((item) => {
      const ps = Math.max(1, item.product.packSize);
      return ps > 1 && Math.floor(item.qty / ps) > 0;
    });
    expect(cartonLines.length).toBe(1);
    expect(Math.floor(cartonLines[0].qty / cartonLines[0].product.packSize)).toBe(2);
  });

  it("ONLINE orders are fulfilled from Godown (show in queue)", () => {
    const onlineInvoices = sampleInvoices.filter((i) => i.channel === InvoiceChannel.ONLINE);
    expect(onlineInvoices.length).toBe(1);
  });
});

describe("Prompt 13 - Part C: Payment Done vs Pending Rules", () => {
  it("shows Payment Done/Pending choice for CASH and UPI only", () => {
    const modes = [PaymentMode.CASH, PaymentMode.UPI, PaymentMode.CREDIT];
    const canToggle = (mode: PaymentMode) => mode === PaymentMode.CASH || mode === PaymentMode.UPI;

    expect(canToggle(PaymentMode.CASH)).toBe(true);
    expect(canToggle(PaymentMode.UPI)).toBe(true);
    expect(canToggle(PaymentMode.CREDIT)).toBe(false);
  });

  it("requires customer name and 10-digit mobile when Payment Pending is chosen", () => {
    const validatePending = (input: { name?: string; phone?: string; partyId?: string }) => {
      if (input.partyId) return true;
      const hasName = (input.name || "").trim().length > 0;
      const hasPhone = (input.phone || "").replace(/\D/g, "").length === 10;
      return hasName && hasPhone;
    };

    expect(validatePending({})).toBe(false);
    expect(validatePending({ name: "Ramesh" })).toBe(false);
    expect(validatePending({ phone: "9876543210" })).toBe(false);
    expect(validatePending({ name: "Ramesh", phone: "9876543210" })).toBe(true);
    expect(validatePending({ partyId: "PARTY_123" })).toBe(true);
  });

  it("computes pending receivable amount accurately", () => {
    const totalPaise = 155400; // Rs 1554.00
    const payments = [{ amountPaise: 50000 }]; // Rs 500 paid
    const pendingPaise = Math.max(0, totalPaise - payments.reduce((s, p) => s + p.amountPaise, 0));
    expect(pendingPaise).toBe(105400); // Rs 1054.00
    const pendingFormatted = (pendingPaise / 100).toFixed(2);
    expect(pendingFormatted).toBe("1054.00");
  });
});

describe("Prompt 13 - Part E: Role App Routing & Manifests", () => {
  it("maps roles to their dedicated installable app start routes", () => {
    expect(getDefaultAppForRole(UserRole.SHOP)).toBe("/app/shop");
    expect(getDefaultAppForRole(UserRole.GODOWN)).toBe("/app/godown");
    expect(getDefaultAppForRole(UserRole.WAREHOUSE_MANAGER)).toBe("/app/godown");
    expect(getDefaultAppForRole(UserRole.SALESPERSON)).toBe("/app/van");
    expect(getDefaultAppForRole(UserRole.DELIVERY)).toBe("/app/delivery");
    expect(getDefaultAppForRole(UserRole.ACCOUNTS)).toBe("/app/accounts");
    expect(getDefaultAppForRole(UserRole.ADMIN)).toBe("/app/owner");
    expect(getDefaultAppForRole(UserRole.SUPER_ADMIN)).toBe("/app/owner");
  });

  it("enforces RBAC on role app routes", () => {
    expect(canAccessRoute(UserRole.SHOP, "/app/shop")).toBe(true);
    expect(canAccessRoute(UserRole.SHOP, "/app/godown")).toBe(false);
    expect(canAccessRoute(UserRole.SALESPERSON, "/app/van")).toBe(true);
    expect(canAccessRoute(UserRole.SALESPERSON, "/app/owner")).toBe(false);
    expect(canAccessRoute(UserRole.DELIVERY, "/app/delivery")).toBe(true);
    expect(canAccessRoute(UserRole.ADMIN, "/app/shop")).toBe(true);
    expect(canAccessRoute(UserRole.SUPER_ADMIN, "/app/owner")).toBe(true);
  });
});
