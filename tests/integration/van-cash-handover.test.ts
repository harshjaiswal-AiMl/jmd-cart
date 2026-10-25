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
  PaymentMode,
} from "@prisma/client";
import { ForbiddenError } from "@/modules/auth/permissions";

describe("Task 2.9 Integration Tests: Owner Cash Handover Confirmation & Day Closing", () => {
  const testPrefix = "TEST-CASHHO-";

  let adminUser: { id: string; role: UserRole; name: string };
  let accountsUser: { id: string; role: UserRole; name: string };
  let godownUser: { id: string; role: UserRole; name: string };
  let salesUser: { id: string; role: UserRole; name: string };
  let shopUser: { id: string; role: UserRole; name: string };
  let centralGodown: { id: string; name: string };
  let testVan: { id: string; name: string };
  let testProduct: { id: string; name: string; mrpPaise: number | null; packSize: number };

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

    // 3. Clean up cash handovers and van days
    if (testVan?.id) {
      const vds = await prisma.vanDay.findMany({
        where: { vanLocationId: testVan.id },
      });
      const vdIds = vds.map((v) => v.id);
      if (vdIds.length > 0) {
        await prisma.cashHandover.deleteMany({
          where: { vanDayId: { in: vdIds } },
        });
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

    accountsUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.ACCOUNTS },
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
      where: { id: "test-van-cashho-loc" },
      update: { assignedUserId: salesUser.id, active: true },
      create: {
        id: "test-van-cashho-loc",
        name: "Test Cash Handover Van (BR-19-T-9999)",
        type: LocationType.VAN,
        assignedUserId: salesUser.id,
        active: true,
      },
    });

    await cleanup();

    // Upsert persistent test product
    testProduct = await prisma.product.upsert({
      where: { id: "test-vancashho-prod-1" },
      update: { mrpPaise: 5000, packSize: 10, active: true },
      create: {
        id: "test-vancashho-prod-1",
        name: `${testPrefix}Parle-G 250g`,
        shortCode: "VCH_PARLE_250",
        hsn: "19053100",
        gstRateBp: 1800, // 18%
        mrpPaise: 5000, // ₹50
        packSize: 10,
        packLabel: "10 pcs / ctn",
        active: true,
      },
    });

    // Ensure central godown has stock
    await prisma.stockBalance.upsert({
      where: {
        productId_locationId: {
          productId: testProduct.id,
          locationId: centralGodown.id,
        },
      },
      update: { qty: 10000 },
      create: {
        productId: testProduct.id,
        locationId: centralGodown.id,
        qty: 10000,
      },
    });

    // Reset van stock balance to 0 before each test
    await prisma.stockBalance.upsert({
      where: {
        productId_locationId: {
          productId: testProduct.id,
          locationId: testVan.id,
        },
      },
      update: { qty: 0 },
      create: {
        productId: testProduct.id,
        locationId: testVan.id,
        qty: 0,
      },
    });
  });

  afterEach(async () => {
    await cleanup();
  });

  // Helper to setup a reconciled van day with specific cash collected
  async function setupReconciledVanDay(options?: {
    cashInvoiceAmountPaise?: number;
    routeCollectionAmountPaise?: number;
  }) {
    const cashInvoiceAmountPaise = options?.cashInvoiceAmountPaise ?? 20000; // ₹200 default
    const routeCollectionAmountPaise = options?.routeCollectionAmountPaise ?? 10000; // ₹100 default

    // 1. Create a customer party
    const party = await partyService.createParty(UserRole.SUPER_ADMIN, adminUser.id, {
      name: `${testPrefix}Shree Kirana`,
      type: PartyType.CUSTOMER,
      phone: "9876543999",
      address: "Bangaon Road, Saharsa",
      creditEnabled: true,
      creditLimitPaise: 500000,
      creditDays: 15,
      active: true,
    });

    // 2. Open van day and issue stock (5 cartons = 50 pcs)
    const morningSheet = await vanService.createVanIssueSheet(
      UserRole.GODOWN,
      godownUser.id,
      {
        vanLocationId: testVan.id,
        items: [
          {
            productId: testProduct.id,
            cartons: 5,
            pieces: 0,
          },
        ],
        notes: "Morning issue for test route",
      }
    );

    // 3. Van invoice with cash payment (sell 4 pcs)
    if (cashInvoiceAmountPaise > 0) {
      await billingService.finalizeInvoice(
        UserRole.SALESPERSON,
        {
          channel: InvoiceChannel.VAN,
          locationId: testVan.id,
          partyId: party.id,
          idempotencyKey: `vch_inv_${Date.now()}_${Math.random()}`,
          items: [
            {
              productId: testProduct.id,
              qty: 4,
            },
          ],
          payments: [
            {
              mode: "CASH",
              amountPaise: cashInvoiceAmountPaise,
            },
          ],
        },
        salesUser.id
      );
    }

    // 4. Route collection cash payment
    if (routeCollectionAmountPaise > 0) {
      await prisma.payment.create({
        data: {
          partyId: party.id,
          vanLocationId: testVan.id,
          mode: PaymentMode.CASH,
          amountPaise: routeCollectionAmountPaise,
          receiptNo: `RC-CASHHO-${Date.now()}`,
          createdAt: new Date(),
        },
      });
    }

    // 5. Reconcile van day: return 46 pcs (4 cartons + 6 pcs)
    const reconciled = await vanService.reconcileVanDay(
      UserRole.GODOWN,
      godownUser.id,
      {
        vanDayId: morningSheet.id,
        items: [
          {
            productId: testProduct.id,
            cartons: 4,
            pieces: 6, // 46 pcs returned (4 sold + 46 returned = 50)
          },
        ],
        notes: "Stock returned and counted",
      }
    );

    expect(reconciled.vanDay.status).toBe(VanDayStatus.RECONCILED);

    const totalExpectedCashPaise =
      cashInvoiceAmountPaise + routeCollectionAmountPaise;
    expect(reconciled.financials.totalCashInHandPaise).toBe(totalExpectedCashPaise);

    return {
      vanDayId: morningSheet.id,
      totalExpectedCashPaise,
      reconciled,
    };
  }

  it("confirms exact cash handover and officially closes van day", async () => {
    const { vanDayId, totalExpectedCashPaise } = await setupReconciledVanDay({
      cashInvoiceAmountPaise: 30000, // ₹300
      routeCollectionAmountPaise: 20000, // ₹200
    });
    expect(totalExpectedCashPaise).toBe(50000); // ₹500 total cash

    // Owner (SUPER_ADMIN) confirms exact cash handover
    const handover = await vanService.confirmCashHandover(
      adminUser.role,
      adminUser.id,
      {
        vanDayId,
        receivedCashPaise: 50000,
        notes: "Exact cash counted and placed in safe.",
      }
    );

    // Verify CashHandover record
    expect(handover.id).toBeDefined();
    expect(handover.vanDayId).toBe(vanDayId);
    expect(handover.receivedById).toBe(adminUser.id);
    expect(handover.receivedBy.name).toBe(adminUser.name);
    expect(handover.expectedCashPaise).toBe(50000);
    expect(handover.receivedCashPaise).toBe(50000);
    expect(handover.shortagePaise).toBe(0);
    expect(handover.excessPaise).toBe(0);
    expect(handover.notes).toBe("Exact cash counted and placed in safe.");

    // Verify VanDay status transitioned to CLOSED
    const updatedVanDay = await prisma.vanDay.findUniqueOrThrow({
      where: { id: vanDayId },
    });
    expect(updatedVanDay.status).toBe(VanDayStatus.CLOSED);
    expect(updatedVanDay.closedBy).toBe(adminUser.id);

    // Verify query via getCashHandoverByVanDay
    const queriedHandover = await vanService.getCashHandoverByVanDay(
      adminUser.role,
      vanDayId
    );
    expect(queriedHandover).not.toBeNull();
    expect(queriedHandover?.id).toBe(handover.id);
    expect(queriedHandover?.receivedCashPaise).toBe(50000);
  });

  it("handles cash shortage during handover", async () => {
    const { vanDayId, totalExpectedCashPaise } = await setupReconciledVanDay({
      cashInvoiceAmountPaise: 25000,
      routeCollectionAmountPaise: 15000,
    });
    expect(totalExpectedCashPaise).toBe(40000); // ₹400 expected

    // Physical cash received is ₹350 (₹50 shortage)
    const receivedCashPaise = 35000;
    const handover = await vanService.confirmCashHandover(
      adminUser.role,
      adminUser.id,
      {
        vanDayId,
        receivedCashPaise,
        notes: "Short by ₹50 due to minor driver discrepancy.",
      }
    );

    expect(handover.expectedCashPaise).toBe(40000);
    expect(handover.receivedCashPaise).toBe(35000);
    expect(handover.shortagePaise).toBe(5000); // ₹50 short
    expect(handover.excessPaise).toBe(0);

    const updatedVanDay = await prisma.vanDay.findUniqueOrThrow({
      where: { id: vanDayId },
    });
    expect(updatedVanDay.status).toBe(VanDayStatus.CLOSED);
  });

  it("handles cash excess during handover", async () => {
    const { vanDayId, totalExpectedCashPaise } = await setupReconciledVanDay({
      cashInvoiceAmountPaise: 20000,
      routeCollectionAmountPaise: 10000,
    });
    expect(totalExpectedCashPaise).toBe(30000); // ₹300 expected

    // Physical cash received is ₹320 (₹20 excess)
    const receivedCashPaise = 32000;
    const handover = await vanService.confirmCashHandover(
      adminUser.role,
      adminUser.id,
      {
        vanDayId,
        receivedCashPaise,
        notes: "Salesperson collected ₹20 extra tip / change rounded.",
      }
    );

    expect(handover.expectedCashPaise).toBe(30000);
    expect(handover.receivedCashPaise).toBe(32000);
    expect(handover.shortagePaise).toBe(0);
    expect(handover.excessPaise).toBe(2000); // ₹20 excess

    const updatedVanDay = await prisma.vanDay.findUniqueOrThrow({
      where: { id: vanDayId },
    });
    expect(updatedVanDay.status).toBe(VanDayStatus.CLOSED);
  });

  it("allows ACCOUNTS role to confirm cash handover", async () => {
    const { vanDayId } = await setupReconciledVanDay({
      cashInvoiceAmountPaise: 10000,
      routeCollectionAmountPaise: 0,
    });

    const handover = await vanService.confirmCashHandover(
      accountsUser.role,
      accountsUser.id,
      {
        vanDayId,
        receivedCashPaise: 10000,
        notes: "Accounts officer confirmed cash handover.",
      }
    );

    expect(handover.receivedById).toBe(accountsUser.id);
    expect(handover.receivedBy.name).toBe(accountsUser.name);

    const updatedVanDay = await prisma.vanDay.findUniqueOrThrow({
      where: { id: vanDayId },
    });
    expect(updatedVanDay.status).toBe(VanDayStatus.CLOSED);
    expect(updatedVanDay.closedBy).toBe(accountsUser.id);
  });

  it("rejects confirmation if van day is still OPEN (unreconciled)", async () => {
    // Issue stock to create an OPEN van day
    const morningSheet = await vanService.createVanIssueSheet(
      UserRole.GODOWN,
      godownUser.id,
      {
        vanLocationId: testVan.id,
        items: [
          {
            productId: testProduct.id,
            cartons: 2,
            pieces: 0,
          },
        ],
        notes: "Unreconciled test issue",
      }
    );

    expect(morningSheet.status).toBe(VanDayStatus.OPEN);

    // Attempting cash handover before reconciliation must throw
    await expect(
      vanService.confirmCashHandover(
        adminUser.role,
        adminUser.id,
        {
          vanDayId: morningSheet.id,
          receivedCashPaise: 5000,
        }
      )
    ).rejects.toThrow(/must be reconciled before confirming cash handover/i);
  });

  it("rejects duplicate confirmation if van day is already CLOSED", async () => {
    const { vanDayId, totalExpectedCashPaise } = await setupReconciledVanDay({
      cashInvoiceAmountPaise: 15000,
      routeCollectionAmountPaise: 0,
    });

    // First confirmation
    await vanService.confirmCashHandover(
      adminUser.role,
      adminUser.id,
      {
        vanDayId,
        receivedCashPaise: totalExpectedCashPaise,
      }
    );

    // Second confirmation attempt must throw
    await expect(
      vanService.confirmCashHandover(
        adminUser.role,
        adminUser.id,
        {
          vanDayId,
          receivedCashPaise: totalExpectedCashPaise,
        }
      )
    ).rejects.toThrow(/has already been confirmed and closed/i);
  });

  it("rejects unauthorized roles from confirming cash handover", async () => {
    const { vanDayId, totalExpectedCashPaise } = await setupReconciledVanDay({
      cashInvoiceAmountPaise: 10000,
      routeCollectionAmountPaise: 0,
    });

    // Salesperson cannot confirm their own cash handover
    await expect(
      vanService.confirmCashHandover(
        salesUser.role,
        salesUser.id,
        {
          vanDayId,
          receivedCashPaise: totalExpectedCashPaise,
        }
      )
    ).rejects.toThrow(ForbiddenError);

    // Godown staff cannot confirm cash handover (cash goes to Owner/Accounts)
    await expect(
      vanService.confirmCashHandover(
        godownUser.role,
        godownUser.id,
        {
          vanDayId,
          receivedCashPaise: totalExpectedCashPaise,
        }
      )
    ).rejects.toThrow(ForbiddenError);

    // Shop counter cannot confirm van cash handover
    await expect(
      vanService.confirmCashHandover(
        shopUser.role,
        shopUser.id,
        {
          vanDayId,
          receivedCashPaise: totalExpectedCashPaise,
        }
      )
    ).rejects.toThrow(ForbiddenError);
  });
});
