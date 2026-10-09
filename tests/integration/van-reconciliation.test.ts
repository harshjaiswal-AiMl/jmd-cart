import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { vanService } from "@/modules/van/van.service";
import { billingService } from "@/modules/billing/billing.service";
import { partyService } from "@/modules/party/party.service";
import {
  UserRole,
  PartyType,
  InvoiceChannel,
  LocationType,
  VanDayStatus,
  MovementType,
} from "@prisma/client";
import { ForbiddenError } from "@/modules/auth/permissions";

describe("Task 2.8 Integration Tests: Van Evening Return, Reconciliation & Variance Tracking", () => {
  const testPrefix = "TEST-VANREC-";

  let adminUser: { id: string; role: UserRole; name: string };
  let godownUser: { id: string; role: UserRole; name: string };
  let salesUser: { id: string; role: UserRole; name: string };
  let shopUser: { id: string; role: UserRole; name: string };
  let centralGodown: { id: string; name: string };
  let testVan: { id: string; name: string };
  let testProduct1: { id: string; name: string; mrpPaise: number; packSize: number };
  let testProduct2: { id: string; name: string; mrpPaise: number; packSize: number };

  const cleanup = async () => {
    // 1. Clean up payments & invoices on test van
    const vanInvoices = await prisma.invoice.findMany({
      where: { locationId: testVan?.id },
    });
    const invIds = vanInvoices.map((i) => i.id);

    if (invIds.length > 0) {
      await prisma.payment.deleteMany({
        where: { invoiceId: { in: invIds } },
      });
      await prisma.invoiceItem.deleteMany({
        where: { invoiceId: { in: invIds } },
      });
      await prisma.invoice.deleteMany({
        where: { id: { in: invIds } },
      });
    }

    // 2. Clean up route collection payments
    if (testVan?.id) {
      await prisma.payment.deleteMany({
        where: { vanLocationId: testVan.id },
      });
    }

    // 3. Clean up van day lines and van days on test van
    if (testVan?.id) {
      const vds = await prisma.vanDay.findMany({
        where: { vanLocationId: testVan.id },
      });
      const vdIds = vds.map((v) => v.id);
      if (vdIds.length > 0) {
        await prisma.vanDayLine.deleteMany({
          where: { vanDayId: { in: vdIds } },
        });
        await prisma.vanDay.deleteMany({
          where: { id: { in: vdIds } },
        });
      }
    }

    // 4. Clean up test parties
    const testParties = await prisma.party.findMany({
      where: { name: { startsWith: testPrefix } },
    });
    if (testParties.length > 0) {
      const pids = testParties.map((p) => p.id);
      await prisma.ledgerEntry.deleteMany({ where: { partyId: { in: pids } } });
      await prisma.party.deleteMany({ where: { id: { in: pids } } });
    }
  };

  beforeEach(async () => {
    adminUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.SUPER_ADMIN },
      select: { id: true, role: true, name: true },
    });

    godownUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.GODOWN },
      select: { id: true, role: true, name: true },
    });

    salesUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.SALESPERSON },
      select: { id: true, role: true, name: true },
    });

    shopUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.SHOP },
      select: { id: true, role: true, name: true },
    });

    centralGodown = await prisma.location.findFirstOrThrow({
      where: { type: LocationType.GODOWN, active: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    });

    // Upsert isolated test van location
    testVan = await prisma.location.upsert({
      where: { id: "test-van-reconcile-loc" },
      update: { assignedUserId: salesUser.id, active: true },
      create: {
        id: "test-van-reconcile-loc",
        name: "Test Reconcile Van (BR-19-T-8888)",
        type: LocationType.VAN,
        assignedUserId: salesUser.id,
        active: true,
      },
    });

    await cleanup();

    // Upsert persistent test products
    testProduct1 = await prisma.product.upsert({
      where: { id: "test-vanrec-prod-1" },
      update: { mrpPaise: 5000, packSize: 10, active: true },
      create: {
        id: "test-vanrec-prod-1",
        name: `${testPrefix}Bikaji Bhujia 200g`,
        shortCode: "VR_BHUJ_200",
        hsn: "21069099",
        gstRateBp: 1200, // 12%
        mrpPaise: 5000, // ₹50
        packSize: 10,
        packLabel: "10 pcs / ctn",
        active: true,
      },
    });

    testProduct2 = await prisma.product.upsert({
      where: { id: "test-vanrec-prod-2" },
      update: { mrpPaise: 10000, packSize: 5, active: true },
      create: {
        id: "test-vanrec-prod-2",
        name: `${testPrefix}MDH Garam Masala 100g`,
        shortCode: "VR_MDH_100",
        hsn: "09109100",
        gstRateBp: 500, // 5%
        mrpPaise: 10000, // ₹100
        packSize: 5,
        packLabel: "5 pcs / box",
        active: true,
      },
    });

    // Ensure central godown has abundant stock for both products
    await prisma.stockBalance.upsert({
      where: {
        productId_locationId: {
          productId: testProduct1.id,
          locationId: centralGodown.id,
        },
      },
      update: { qty: 10000 },
      create: {
        productId: testProduct1.id,
        locationId: centralGodown.id,
        qty: 10000,
      },
    });

    await prisma.stockBalance.upsert({
      where: {
        productId_locationId: {
          productId: testProduct2.id,
          locationId: centralGodown.id,
        },
      },
      update: { qty: 10000 },
      create: {
        productId: testProduct2.id,
        locationId: centralGodown.id,
        qty: 10000,
      },
    });

    // Reset van stock balance to 0 before each test
    await prisma.stockBalance.upsert({
      where: {
        productId_locationId: {
          productId: testProduct1.id,
          locationId: testVan.id,
        },
      },
      update: { qty: 0 },
      create: {
        productId: testProduct1.id,
        locationId: testVan.id,
        qty: 0,
      },
    });

    await prisma.stockBalance.upsert({
      where: {
        productId_locationId: {
          productId: testProduct2.id,
          locationId: testVan.id,
        },
      },
      update: { qty: 0 },
      create: {
        productId: testProduct2.id,
        locationId: testVan.id,
        qty: 0,
      },
    });
  });

  afterEach(async () => {
    await cleanup();
  });

  it("should complete full van lifecycle with 100% exact return match", async () => {
    // 1. Morning dispatch: issue 3 cartons (30 pcs) of P1 and 4 cartons (20 pcs) of P2 to van
    const morningSheet = await vanService.createVanIssueSheet(
      UserRole.GODOWN,
      godownUser.id,
      {
        vanLocationId: testVan.id,
        items: [
          { productId: testProduct1.id, cartons: 3, pieces: 0 }, // 30 pcs
          { productId: testProduct2.id, cartons: 4, pieces: 0 }, // 20 pcs
        ],
        notes: "Morning load for Saharsa Town route",
      }
    );

    expect(morningSheet.status).toBe(VanDayStatus.OPEN);

    // Verify stock was transferred to Van
    const vanBal1 = await prisma.stockBalance.findUniqueOrThrow({
      where: { productId_locationId: { productId: testProduct1.id, locationId: testVan.id } },
    });
    expect(vanBal1.qty).toBe(30);

    // 2. Salesperson bills on route: sell 12 pcs of P1 (1 ctn + 2 pcs) and 8 pcs of P2
    const retailer = await partyService.createParty(UserRole.SUPER_ADMIN, adminUser.id, {
      name: `${testPrefix}Kisan Kirana`,
      type: PartyType.CUSTOMER,
      creditEnabled: true,
      creditLimitPaise: 500000, // ₹5,000 credit limit
      creditDays: 15,
      active: true,
    });

    await billingService.finalizeInvoice(
      UserRole.SALESPERSON,
      {
        channel: InvoiceChannel.VAN,
        locationId: testVan.id,
        partyId: retailer.id,
        idempotencyKey: `van_sale_life_${Date.now()}`,
        items: [
          { productId: testProduct1.id, qty: 12 },
          { productId: testProduct2.id, qty: 8 },
        ],
        payments: [
          { mode: "CASH", amountPaise: 100000 }, // partial cash
        ],
      },
      salesUser.id
    );

    // 3. Check expected unsold returns:
    // P1: 30 - 12 = 18 pcs (1 ctn + 8 pcs)
    // P2: 20 - 8 = 12 pcs (2 ctn + 2 pcs)
    const preview = await vanService.getVanReconciliation(
      UserRole.SALESPERSON,
      morningSheet.id
    );

    expect(preview.isReconciled).toBe(false);
    const lineP1 = preview.lines.find((l) => l.productId === testProduct1.id);
    const lineP2 = preview.lines.find((l) => l.productId === testProduct2.id);

    expect(lineP1?.soldQty).toBe(12);
    expect(lineP1?.expectedQty).toBe(18);
    expect(lineP2?.soldQty).toBe(8);
    expect(lineP2?.expectedQty).toBe(12);

    // 4. Physical return in evening matches 100%:
    // P1: 1 carton + 8 pieces = 18 pieces
    // P2: 2 cartons + 2 pieces = 12 pieces
    const result = await vanService.reconcileVanDay(
      UserRole.GODOWN,
      godownUser.id,
      {
        vanDayId: morningSheet.id,
        items: [
          { productId: testProduct1.id, cartons: 1, pieces: 8 },
          { productId: testProduct2.id, cartons: 2, pieces: 2 },
        ],
        notes: "Evening return verified at Central Godown dock",
      }
    );

    expect(result.vanDay.status).toBe(VanDayStatus.RECONCILED);
    expect(result.vanDay.reconciledBy).toBe(godownUser.id);
    expect(result.financials.totalShortageValuationPaise).toBe(0);
    expect(result.financials.totalExcessValuationPaise).toBe(0);

    // 5. Invariant: Van inventory balance is cleanly 0 after returning to Godown!
    const endBal1 = await prisma.stockBalance.findUniqueOrThrow({
      where: { productId_locationId: { productId: testProduct1.id, locationId: testVan.id } },
    });
    const endBal2 = await prisma.stockBalance.findUniqueOrThrow({
      where: { productId_locationId: { productId: testProduct2.id, locationId: testVan.id } },
    });
    expect(endBal1.qty).toBe(0);
    expect(endBal2.qty).toBe(0);

    // 6. Verify VAN_RETURN movements were recorded in stock ledger
    const returnMvm = await prisma.stockMovement.findFirst({
      where: {
        type: MovementType.VAN_RETURN,
        referenceId: morningSheet.id,
        productId: testProduct1.id,
      },
    });
    expect(returnMvm).toBeDefined();
    expect(returnMvm?.qty).toBe(18);
    expect(returnMvm?.fromLocationId).toBe(testVan.id);
    expect(returnMvm?.toLocationId).toBe(centralGodown.id);
  });

  it("should calculate shortage and post ledger adjustments when driver returns less than expected", async () => {
    // 1. Issue 20 pieces of P1 (2 cartons)
    const morningSheet = await vanService.createVanIssueSheet(
      UserRole.GODOWN,
      godownUser.id,
      {
        vanLocationId: testVan.id,
        items: [{ productId: testProduct1.id, cartons: 2, pieces: 0 }],
      }
    );

    // 2. Sell 5 pieces
    await billingService.finalizeInvoice(
      UserRole.SALESPERSON,
      {
        channel: InvoiceChannel.VAN,
        locationId: testVan.id,
        idempotencyKey: `van_sale_shortage_${Date.now()}`,
        items: [{ productId: testProduct1.id, qty: 5 }],
        payments: [{ mode: "CASH", amountPaise: 25000 }],
      },
      salesUser.id
    );

    // Expected: 20 - 5 = 15 pieces.
    // Driver physically returns only 1 carton + 2 pieces = 12 pieces (shortage of 3 pieces!)
    const result = await vanService.reconcileVanDay(
      UserRole.SALESPERSON,
      salesUser.id,
      {
        vanDayId: morningSheet.id,
        items: [{ productId: testProduct1.id, cartons: 1, pieces: 2 }],
        notes: "3 packets lost/broken during transit",
      }
    );

    expect(result.vanDay.status).toBe(VanDayStatus.RECONCILED);
    const line = result.lines.find((l) => l.productId === testProduct1.id);
    expect(line?.returnedQty).toBe(12);
    expect(line?.shortageQty).toBe(3);
    expect(line?.excessQty).toBe(0);
    expect(line?.shortageValuationPaise).toBe(3 * 5000); // 3 * ₹50 = ₹150 (15000 paise)

    expect(result.financials.totalShortageValuationPaise).toBe(15000);

    // Invariant: Van inventory balance is 0 (shortage was deducted from van balance)
    const endBal = await prisma.stockBalance.findUniqueOrThrow({
      where: { productId_locationId: { productId: testProduct1.id, locationId: testVan.id } },
    });
    expect(endBal.qty).toBe(0);

    // Verify shortage ADJUSTMENT movement
    const shortageMvm = await prisma.stockMovement.findFirst({
      where: {
        type: MovementType.ADJUSTMENT,
        fromLocationId: testVan.id,
        productId: testProduct1.id,
        referenceId: morningSheet.id,
      },
    });
    expect(shortageMvm).toBeDefined();
    expect(shortageMvm?.qty).toBe(3);
  });

  it("should calculate excess and post adjustments when driver returns more than expected", async () => {
    // 1. Issue 20 pieces of P1
    const morningSheet = await vanService.createVanIssueSheet(
      UserRole.GODOWN,
      godownUser.id,
      {
        vanLocationId: testVan.id,
        items: [{ productId: testProduct1.id, cartons: 2, pieces: 0 }],
      }
    );

    // 2. Sell 5 pieces. Expected return = 15 pieces.
    await billingService.finalizeInvoice(
      UserRole.SALESPERSON,
      {
        channel: InvoiceChannel.VAN,
        locationId: testVan.id,
        idempotencyKey: `van_sale_excess_${Date.now()}`,
        items: [{ productId: testProduct1.id, qty: 5 }],
        payments: [{ mode: "CASH", amountPaise: 25000 }],
      },
      salesUser.id
    );

    // Driver returns 17 pieces (1 carton + 7 loose pieces = 17 pcs -> excess of 2 pieces!)
    const result = await vanService.reconcileVanDay(
      UserRole.GODOWN,
      godownUser.id,
      {
        vanDayId: morningSheet.id,
        items: [{ productId: testProduct1.id, cartons: 1, pieces: 7 }],
        notes: "2 extra pieces found in bottom crate",
      }
    );

    expect(result.vanDay.status).toBe(VanDayStatus.RECONCILED);
    const line = result.lines.find((l) => l.productId === testProduct1.id);
    expect(line?.returnedQty).toBe(17);
    expect(line?.shortageQty).toBe(0);
    expect(line?.excessQty).toBe(2);
    expect(line?.excessValuationPaise).toBe(2 * 5000); // 2 * ₹50 = ₹100 (10000 paise)

    // Van balance should still be 0 after returning all 17 pieces
    const endBal = await prisma.stockBalance.findUniqueOrThrow({
      where: { productId_locationId: { productId: testProduct1.id, locationId: testVan.id } },
    });
    expect(endBal.qty).toBe(0);
  });

  it("should block reconciling an already reconciled or closed van day", async () => {
    const morningSheet = await vanService.createVanIssueSheet(
      UserRole.GODOWN,
      godownUser.id,
      {
        vanLocationId: testVan.id,
        items: [{ productId: testProduct1.id, cartons: 1, pieces: 0 }],
      }
    );

    // First reconciliation succeeds
    await vanService.reconcileVanDay(
      UserRole.GODOWN,
      godownUser.id,
      {
        vanDayId: morningSheet.id,
        items: [{ productId: testProduct1.id, cartons: 1, pieces: 0 }],
      }
    );

    // Second reconciliation attempt must throw
    await expect(
      vanService.reconcileVanDay(
        UserRole.GODOWN,
        godownUser.id,
        {
          vanDayId: morningSheet.id,
          items: [{ productId: testProduct1.id, cartons: 1, pieces: 0 }],
        }
      )
    ).rejects.toThrow(/already RECONCILED/i);
  });

  it("should reject reconciliation attempt by unauthorized role", async () => {
    const morningSheet = await vanService.createVanIssueSheet(
      UserRole.GODOWN,
      godownUser.id,
      {
        vanLocationId: testVan.id,
        items: [{ productId: testProduct1.id, cartons: 1, pieces: 0 }],
      }
    );

    // Cashier role (SHOP) lacks VAN_RECONCILE permission
    await expect(
      vanService.reconcileVanDay(
        UserRole.SHOP,
        shopUser.id,
        {
          vanDayId: morningSheet.id,
          items: [{ productId: testProduct1.id, cartons: 1, pieces: 0 }],
        }
      )
    ).rejects.toThrow(ForbiddenError);
  });

  it("should accurately aggregate cash in hand across invoices and route collections", async () => {
    const morningSheet = await vanService.createVanIssueSheet(
      UserRole.GODOWN,
      godownUser.id,
      {
        vanLocationId: testVan.id,
        items: [{ productId: testProduct1.id, cartons: 3, pieces: 0 }],
      }
    );

    // Invoice 1: Cash ₹150 + UPI ₹100
    await billingService.finalizeInvoice(
      UserRole.SALESPERSON,
      {
        channel: InvoiceChannel.VAN,
        locationId: testVan.id,
        idempotencyKey: `van_fin_inv1_${Date.now()}`,
        items: [{ productId: testProduct1.id, qty: 5 }],
        payments: [
          { mode: "CASH", amountPaise: 15000 },
          { mode: "UPI", amountPaise: 10000 },
        ],
      },
      salesUser.id
    );

    // Route Collection: Cash ₹300 from previous debt
    const party = await partyService.createParty(UserRole.SUPER_ADMIN, adminUser.id, {
      name: `${testPrefix}Route Collection Debtor`,
      type: PartyType.CUSTOMER,
      openingOutstandingPaise: 50000,
      active: true,
    });

    await partyService.recordCollection(
      UserRole.SALESPERSON,
      salesUser.id,
      {
        partyId: party.id,
        amountPaise: 30000,
        mode: "CASH",
        vanLocationId: testVan.id,
        notes: "Route collection in cash",
      }
    );

    const report = await vanService.getVanReconciliation(
      UserRole.SALESPERSON,
      morningSheet.id
    );

    // Cash in Hand = Invoice Cash (₹150) + Route Collection Cash (₹300) = ₹450 (45000 paise)
    expect(report.financials.invoiceCashPaise).toBe(15000);
    expect(report.financials.routeCollectionCashPaise).toBe(30000);
    expect(report.financials.totalCashInHandPaise).toBe(45000);

    // Total UPI = ₹100 (10000 paise)
    expect(report.financials.totalUpiReceivedPaise).toBe(10000);
  });
});
