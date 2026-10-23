import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { UserRole, LocationType, MovementType, PartyType, PaymentMode, OrderStatus, DispatchRunStatus } from "@prisma/client";
import { allocationService } from "@/modules/stock/allocation.service";
import { manualOrderService } from "@/modules/order/manual-order.service";
import { dispatchService } from "@/modules/dispatch/dispatch.service";
import { stockService } from "@/modules/stock/stock.service";

describe("Prompt 06: Shared Shop+Godown Fulfilment & Dispatch Board", () => {
  let shopLoc: { id: string };
  let godownLoc: { id: string };
  let testProduct: { id: string };
  let testParty: { id: string };
  let managerUser: { id: string; role: UserRole; name: string };

  beforeEach(async () => {
    // 1. Ensure Shop & Godown locations exist
    shopLoc = await prisma.location.upsert({
      where: { id: "test-loc-shop" },
      update: { active: true },
      create: {
        id: "test-loc-shop",
        branchId: 1,
        type: LocationType.SHOP,
        name: "Test Shop Counter",
        active: true,
      },
    });

    godownLoc = await prisma.location.upsert({
      where: { id: "test-loc-godown" },
      update: { active: true },
      create: {
        id: "test-loc-godown",
        branchId: 1,
        type: LocationType.GODOWN,
        name: "Test Main Godown",
        active: true,
      },
    });

    // 2. Create test company, category and product with packSize 10 (carton = 10 pcs)
    const company = await prisma.company.upsert({
      where: { name: "Test Spices Co" },
      update: {},
      create: { name: "Test Spices Co" },
    });
    const category = await prisma.category.upsert({
      where: { name: "Test Spices" },
      update: {},
      create: { name: "Test Spices" },
    });

    testProduct = await prisma.product.upsert({
      where: { shortCode: "DISP-PROD-01" },
      update: {
        companyId: company.id,
        categoryId: category.id,
        mrpPaise: 10000, // Rs 100
        priceAPaise: 7500, // Rs 75 (Wholesaler)
        priceBPaise: 8000, // Rs 80 (Retailer)
        priceCPaise: 9000, // Rs 90 (Customer)
        packSize: 10,
        active: true,
      },
      create: {
        shortCode: "DISP-PROD-01",
        name: "Dispatch Test Spices 100g",
        companyId: company.id,
        categoryId: category.id,
        mrpPaise: 10000,
        priceAPaise: 7500,
        priceBPaise: 8000,
        priceCPaise: 9000,
        packSize: 10,
        hsn: "0910",
        active: true,
      },
    });

    // 3. Reset balances
    await prisma.stockBalance.deleteMany({
      where: { productId: testProduct.id },
    });
    await prisma.stockReservation.deleteMany({
      where: { productId: testProduct.id },
    });

    // Set stock: Shop has 5 loose pieces, Godown has 50 pieces (5 cartons)
    await stockService.postMovement({
      toLocationId: shopLoc.id,
      productId: testProduct.id,
      qty: 5,
      type: MovementType.PURCHASE_RECEIPT,
      idempotencyKey: `init-shop-${Date.now()}-${Math.random()}`,
    });

    await stockService.postMovement({
      toLocationId: godownLoc.id,
      productId: testProduct.id,
      qty: 50,
      type: MovementType.PURCHASE_RECEIPT,
      idempotencyKey: `init-godown-${Date.now()}-${Math.random()}`,
    });

    // 4. Create party & manager user
    testParty = await prisma.party.upsert({
      where: { id: "test-retailer-party" },
      update: { active: true },
      create: {
        id: "test-retailer-party",
        name: "Maa Durga Kirana Store",
        type: PartyType.RETAILER,
        creditEnabled: true,
        creditLimitPaise: 5000000, // Rs 50,000
        active: true,
      },
    });

    const user = await prisma.user.upsert({
      where: { phone: "9988776655" },
      update: { role: UserRole.WAREHOUSE_MANAGER },
      create: {
        id: "test-wh-manager",
        name: "Ramesh Sharma",
        phone: "9988776655",
        passwordHash: "dummyhash",
        role: UserRole.WAREHOUSE_MANAGER,
      },
    });

    managerUser = {
      id: user.id,
      role: UserRole.WAREHOUSE_MANAGER,
      name: user.name,
    };
  });

  it("Section 5a: Shop POS sale larger than shop stock splits and flags counter pickup", async () => {
    // POS counter sale wants 12 pieces: Shop has 5, Godown has 50.
    const allocations = await allocationService.computeAllocation("SHOP", [
      { productId: testProduct.id, requestedPieces: 12, packSize: 10 },
    ]);

    expect(allocations).toHaveLength(1);
    const alloc = allocations[0];
    expect(alloc.fromShopPieces).toBe(5);
    expect(alloc.fromGodownPieces).toBe(7);
    expect(alloc.requiresCounterPickup).toBe(true);
  });

  it("Section 5a: Online / Manual order allocates whole cartons from Godown first, loose from Shop first", async () => {
    // Order wants 23 pieces (2 whole cartons of 10 = 20 pcs, plus 3 loose pcs)
    // Godown has 50 pcs (5 cartons), Shop has 5 loose pcs.
    const allocations = await allocationService.computeAllocation("ONLINE", [
      { productId: testProduct.id, requestedPieces: 23, packSize: 10 },
    ]);

    expect(allocations).toHaveLength(1);
    const alloc = allocations[0];
    // 2 whole cartons (20 pcs) from Godown
    // 3 loose pieces from Shop
    expect(alloc.fromGodownPieces).toBe(20);
    expect(alloc.fromShopPieces).toBe(3);
    expect(alloc.requiresCounterPickup).toBe(false);
  });

  it("Section 5b: Warehouse Manager creates manual order, reserves stock, and handsover trip", async () => {
    // Create manual order for 15 pieces
    const res = await manualOrderService.createManualOrder(
      {
        partyId: testParty.id,
        lines: [{ productId: testProduct.id, cartons: 1, loose: 5 }], // 10 + 5 = 15 pcs
        deliveryAddress: "Purab Bazar, Saharsa",
        contactPhone: "9876543210",
        paymentMode: PaymentMode.CASH,
      },
      managerUser
    );

    expect(res.order).toBeDefined();
    expect(res.order.channel).toBe("MANUAL");
    expect(res.order.status).toBe(OrderStatus.CONFIRMED);

    // Verify reservations were created immediately
    const reservations = await prisma.stockReservation.findMany({
      where: { orderId: res.order.id, active: true },
    });
    expect(reservations.length).toBeGreaterThan(0);
    const totalReserved = reservations.reduce((s, r) => s + r.qty, 0);
    expect(totalReserved).toBe(15);

    // Build dispatch run
    const run = await dispatchService.createDispatchRun(
      {
        orderIds: [res.order.id],
        slot: "Morning",
        notes: "Test Trip 1",
      },
      managerUser
    );

    expect(run.status).toBe(DispatchRunStatus.DRAFT);

    // Hand over run: finalizes invoice and converts reservations to SALE movements
    const handoverRes = await dispatchService.handoverDispatchRun(run.id, managerUser);
    expect(handoverRes.success).toBe(true);

    // Order should now be OUT_FOR_DELIVERY
    const updatedOrder = await prisma.order.findUnique({
      where: { id: res.order.id },
    });
    expect(updatedOrder?.status).toBe(OrderStatus.OUT_FOR_DELIVERY);

    // Reservations should now be inactive (converted to SALE movements)
    const activeRes = await prisma.stockReservation.findMany({
      where: { orderId: res.order.id, active: true },
    });
    expect(activeRes).toHaveLength(0);
  });

  it("handles failed delivery by returning goods to godown via counter-movement", async () => {
    // Create manual order
    const res = await manualOrderService.createManualOrder(
      {
        partyId: testParty.id,
        lines: [{ productId: testProduct.id, cartons: 0, loose: 4 }],
        deliveryAddress: "Purab Bazar, Saharsa",
        contactPhone: "9876543210",
        paymentMode: PaymentMode.CASH,
      },
      managerUser
    );

    const run = await dispatchService.createDispatchRun(
      { orderIds: [res.order.id] },
      managerUser
    );
    await dispatchService.handoverDispatchRun(run.id, managerUser);

    const godownBefore = await prisma.stockBalance.findUnique({
      where: {
        productId_locationId: {
          productId: testProduct.id,
          locationId: godownLoc.id,
        },
      },
    });

    // Mark delivery failed
    const failRes = await dispatchService.handleFailedDelivery(
      res.order.id,
      "Customer out of town",
      managerUser,
      godownLoc.id
    );
    expect(failRes.success).toBe(true);

    const failedOrder = await prisma.order.findUnique({
      where: { id: res.order.id },
    });
    expect(failedOrder?.status).toBe(OrderStatus.FAILED);

    // Stock should have been restored to Godown
    const godownAfter = await prisma.stockBalance.findUnique({
      where: {
        productId_locationId: {
          productId: testProduct.id,
          locationId: godownLoc.id,
        },
      },
    });

    expect((godownAfter?.qty ?? 0) - (godownBefore?.qty ?? 0)).toBe(4);
  });
});
