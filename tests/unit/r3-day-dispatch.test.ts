import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { dayDispatchService } from "@/modules/dispatch/day-dispatch.service";
import { UserRole, LocationType, MovementType, OrderStatus, VanDayStatus } from "@prisma/client";

describe("R3: Overall Day Dispatch View", () => {
  it("aggregates day dispatch across destinations, computes matrix and matches stock ledger out movements", async () => {
    // 1. Create or retrieve test locations
    const godown =
      (await prisma.location.findFirst({
        where: { type: LocationType.GODOWN, active: true },
      })) ||
      (await prisma.location.create({
        data: { name: "Main Godown Test", type: LocationType.GODOWN, active: true },
      }));

    const shop =
      (await prisma.location.findFirst({
        where: { type: LocationType.SHOP, active: true },
      })) ||
      (await prisma.location.create({
        data: { name: "Retail Shop Test", type: LocationType.SHOP, active: true },
      }));

    const van =
      (await prisma.location.findFirst({
        where: { type: LocationType.VAN, active: true },
      })) ||
      (await prisma.location.create({
        data: { name: "Van Alpha Test", type: LocationType.VAN, active: true },
      }));

    const company =
      (await prisma.company.findFirst()) ||
      (await prisma.company.create({
        data: { name: "Test Dispatch FMCG Co" },
      }));

    const product = await prisma.product.create({
      data: {
        name: `Dispatch Test Product ${Date.now()}`,
        shortCode: `DTP-${Date.now().toString().slice(-4)}`,
        companyId: company.id,
        mrpPaise: 4000,
        priceAPaise: 3500,
        packSize: 10,
        packLabel: "Carton",
        active: true,
      },
    });

    const targetDateStr = "2026-11-10";
    const baseTime = new Date(`${targetDateStr}T10:00:00.000+05:30`);

    // 2. Insert out movements from Godown for this IST day
    // Movement 1: Van issue of 30 pcs (3 cartons) to Van
    await prisma.stockMovement.create({
      data: {
        type: MovementType.VAN_ISSUE,
        productId: product.id,
        fromLocationId: godown.id,
        toLocationId: van.id,
        qty: 30,
        referenceType: "VAN",
        referenceId: "VAN-DAY-001",
        reason: "Morning van stock issue",
        idempotencyKey: `r3_test_mov1_${Date.now()}`,
        createdAt: baseTime,
      },
    });

    // Movement 2: Transfer 20 pcs (2 cartons) from Godown to Shop
    await prisma.stockMovement.create({
      data: {
        type: MovementType.TRANSFER,
        productId: product.id,
        fromLocationId: godown.id,
        toLocationId: shop.id,
        qty: 20,
        referenceType: "SHOP_REQUEST",
        referenceId: "SR-001",
        reason: "Counter stock replenishment",
        idempotencyKey: `r3_test_mov2_${Date.now()}`,
        createdAt: new Date(baseTime.getTime() + 60 * 60 * 1000),
      },
    });

    // Movement 3: Sale (Online Order dispatch) of 15 pcs
    await prisma.stockMovement.create({
      data: {
        type: MovementType.SALE,
        productId: product.id,
        fromLocationId: godown.id,
        qty: 15,
        referenceType: "ORDER",
        referenceId: "ORD-001",
        reason: "Dispatched online delivery order",
        idempotencyKey: `r3_test_mov3_${Date.now()}`,
        createdAt: new Date(baseTime.getTime() + 120 * 60 * 1000),
      },
    });

    // Movement 4: Return to company of 5 pcs
    await prisma.stockMovement.create({
      data: {
        type: MovementType.RETURN_TO_COMPANY,
        productId: product.id,
        fromLocationId: godown.id,
        qty: 5,
        referenceType: "DEBIT_NOTE",
        referenceId: "DN-001",
        reason: "Defective packaging returned",
        idempotencyKey: `r3_test_mov4_${Date.now()}`,
        createdAt: new Date(baseTime.getTime() + 180 * 60 * 1000),
      },
    });

    // 3. Query Day Dispatch for that date
    const summary = await dayDispatchService.getDayDispatchData(
      UserRole.WAREHOUSE_MANAGER,
      targetDateStr
    );

    // 4. Verify Integrity Check
    // Matrix total out for this product must equal ledger out movements (30 + 20 + 15 + 5 = 70)
    expect(summary.integrityCheck.matches).toBe(true);
    expect(summary.integrityCheck.difference).toBe(0);

    const productRow = summary.matrix.find((r) => r.productId === product.id);
    expect(productRow).toBeDefined();
    expect(productRow!.ordersPieces).toBe(15);
    expect(productRow!.shopPieces).toBe(20);
    expect(productRow!.companyPieces).toBe(5);
    expect(productRow!.totalOutPieces).toBe(70);
    expect(productRow!.totalOutCartons).toBe(7); // 70 / 10
    expect(productRow!.totalOutLoose).toBe(0);

    // 5. Verify Permissions: unauthorized role throws ForbiddenError
    await expect(
      dayDispatchService.getDayDispatchData(UserRole.CUSTOMER, targetDateStr)
    ).rejects.toThrow("You do not have permission to view day dispatch.");
  });

  it("handles empty day gracefully without errors", async () => {
    const emptyDate = "2026-01-01";
    const summary = await dayDispatchService.getDayDispatchData(
      UserRole.GODOWN,
      emptyDate
    );

    expect(summary.kpis.totalOutPieces).toBe(0);
    expect(summary.matrix).toEqual([]);
    expect(summary.integrityCheck.matches).toBe(true);
    expect(summary.exceptions.failedDeliveries).toEqual([]);
    expect(summary.exceptions.shortPicks).toEqual([]);
  });

  it("identifies exceptions such as failed deliveries and unreconciled vans", async () => {
    const testDate = "2026-11-12";
    const testTime = new Date(`${testDate}T14:00:00.000+05:30`);

    const party =
      (await prisma.party.findFirst()) ||
      (await prisma.party.create({
        data: { name: "Test Party For Exceptions", type: "RETAILER" },
      }));

    // Get or create user for order
    const user =
      (await prisma.user.findFirst()) ||
      (await prisma.user.create({
        data: {
          name: "Test Customer",
          email: `cust_${Date.now()}@example.com`,
          phone: `987${Date.now().toString().slice(-7)}`,
          passwordHash: "test_hash",
          role: UserRole.CUSTOMER,
        },
      }));

    // Create a failed order
    await prisma.order.create({
      data: {
        orderNumber: `TEST-FAIL-${Date.now().toString().slice(-4)}`,
        status: OrderStatus.FAILED,
        userId: user.id,
        partyId: party.id,
        deliveryZoneCode: "MAIN",
        deliveryZoneName: "Main Town",
        subtotalPaise: 50000,
        taxablePaise: 50000,
        totalPaise: 50000,
        deliveryAddress: "Shop 12, Main Market",
        contactPhone: "9876543210",
        customerNotes: "Customer shop closed",
        createdAt: testTime,
      },
    });

    // Create an open van day
    const van =
      (await prisma.location.findFirst({
        where: { type: LocationType.VAN, active: true },
      })) ||
      (await prisma.location.create({
        data: { name: "Van Beta Test", type: LocationType.VAN, active: true },
      }));

    const salesperson =
      (await prisma.user.findFirst({ where: { role: UserRole.SALESPERSON } })) ||
      (await prisma.user.create({
        data: {
          name: "Test Sales Rep",
          email: `rep_${Date.now()}@example.com`,
          phone: `988${Date.now().toString().slice(-7)}`,
          passwordHash: "test_hash",
          role: UserRole.SALESPERSON,
        },
      }));

    await prisma.vanDay.create({
      data: {
        issueSheetNo: `TEST-SHEET-${Date.now().toString().slice(-4)}`,
        vanLocationId: van.id,
        salespersonId: salesperson.id,
        date: testTime,
        status: VanDayStatus.OPEN,
        createdAt: testTime,
      },
    });

    const summary = await dayDispatchService.getDayDispatchData(
      UserRole.ADMIN,
      testDate
    );

    expect(summary.exceptions.failedDeliveries.length).toBeGreaterThan(0);
    expect(summary.exceptions.unreconciledVans.length).toBeGreaterThan(0);
  });
});
