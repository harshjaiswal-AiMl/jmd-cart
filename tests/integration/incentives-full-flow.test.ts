import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { incentiveService } from "@/modules/incentive/incentive.service";
import {
  IncentiveRuleScope,
  IncentiveEntryType,
  IncentiveEntryStatus,
  IncentivePayoutStatus,
  UserRole,
  InvoiceChannel,
  InvoiceStatus,
  PaymentStatus,
} from "@prisma/client";

describe("Prompt #12 Gate C: End-to-End Incentive System Scenario", () => {
  let agentUser: any;
  let company: any;
  let category: any;
  let specialProduct: any;
  let normalProduct: any;
  let period: string;
  let location: any;

  beforeAll(async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    period = `${year}-${month}`;

    // Clean up previous test runs
    await prisma.incentiveEntry.deleteMany({});
    await prisma.incentivePayout.deleteMany({});
    await prisma.incentiveRule.deleteMany({});

    // 1. Create test Agent User
    agentUser = await prisma.user.upsert({
      where: { phone: "9999900001" },
      create: {
        name: "Test Incentive Agent",
        phone: "9999900001",
        email: "agent1@jmdcart.test",
        passwordHash: "hash123",
        role: UserRole.SHOP,
        agentCode: "A001",
      },
      update: { agentCode: "A001" },
    });

    // 2. Create Brand & Category
    company = await prisma.company.upsert({
      where: { name: "Test FMCG Brand" },
      create: { name: "Test FMCG Brand" },
      update: {},
    });

    category = await prisma.category.upsert({
      where: { name: "Snacks & Bhujia" },
      create: { name: "Snacks & Bhujia" },
      update: {},
    });

    // 3. Create Products
    specialProduct = await prisma.product.upsert({
      where: { shortCode: "SPEC_BHU_1" },
      create: {
        name: "Special Premium Bhujia 500g",
        shortCode: "SPEC_BHU_1",
        companyId: company.id,
        categoryId: category.id,
        packSize: 1,
        packLabel: "Packet",
      },
      update: {},
    });

    location = await prisma.location.findFirst({ where: { active: true } });
    if (!location) {
      location = await prisma.location.create({
        data: { name: "Test Counter Shop", type: "SHOP", active: true },
      });
    }

    normalProduct = await prisma.product.upsert({
      where: { shortCode: "NORM_OIL_1" },
      create: {
        name: "Normal Mustard Oil 1L",
        shortCode: "NORM_OIL_1",
        packSize: 1,
        packLabel: "Bottle",
      },
      update: {},
    });
  });

  it("1. Precedence Cascade: agent+product > agent+category > product > global", async () => {
    // Rule 1: Global default 100 bp (1%)
    const ruleGlobal = await prisma.incentiveRule.create({
      data: {
        scope: IncentiveRuleScope.GLOBAL,
        percentBp: 100, // 1%
        validFrom: new Date("2026-01-01"),
      },
    });

    // Rule 2: Category 200 bp (2%)
    const ruleCat = await prisma.incentiveRule.create({
      data: {
        scope: IncentiveRuleScope.CATEGORY,
        categoryId: category.id,
        percentBp: 200, // 2%
        validFrom: new Date("2026-01-01"),
      },
    });

    // Rule 3: Product 300 bp (3%)
    const ruleProd = await prisma.incentiveRule.create({
      data: {
        scope: IncentiveRuleScope.PRODUCT,
        productId: specialProduct.id,
        percentBp: 300, // 3%
        validFrom: new Date("2026-01-01"),
      },
    });

    // Rule 4: Agent + Product 400 bp (4%)
    const ruleAgentProd = await prisma.incentiveRule.create({
      data: {
        scope: IncentiveRuleScope.PRODUCT,
        agentUserId: agentUser.id,
        productId: specialProduct.id,
        percentBp: 400, // 4%
        validFrom: new Date("2026-01-01"),
      },
    });

    // Test calculation on specialProduct with agentUser -> should win agent+product (4%)
    const calcAgentSpecial = await incentiveService.testCalculation({
      agentUserId: agentUser.id,
      productId: specialProduct.id,
      baseAmountPaise: 100000, // ₹1,000.00
    });
    expect(calcAgentSpecial.ruleScope).toBe("AGENT_PRODUCT");
    expect(calcAgentSpecial.percentBp).toBe(400);
    expect(calcAgentSpecial.amountPaise).toBe(4000); // ₹40.00

    // Test calculation on normalProduct with agentUser -> should fallback to global (1%)
    const calcNormal = await incentiveService.testCalculation({
      agentUserId: agentUser.id,
      productId: normalProduct.id,
      baseAmountPaise: 100000,
    });
    expect(calcNormal.ruleScope).toBe("GLOBAL");
    expect(calcNormal.percentBp).toBe(100);
    expect(calcNormal.amountPaise).toBe(1000); // ₹10.00
  });

  it("2. Counter Sale: Created & CREDITED immediately in the transaction", async () => {
    // Create counter invoice of ₹1,000 on specialProduct (4%)
    const invoice = await prisma.invoice.create({
      data: {
        number: "INV/26-27/TEST-001",
        fy: "26-27",
        channel: InvoiceChannel.SHOP,
        locationId: location.id,
        status: InvoiceStatus.FINAL,
        subtotalPaise: 100000,
        taxablePaise: 95238,
        cgstPaise: 2381,
        sgstPaise: 2381,
        totalPaise: 100000,
        paymentStatus: PaymentStatus.PAID,
        agentUserId: agentUser.id,
        agentCodeSnapshot: agentUser.agentCode,
        createdBy: agentUser.id,
        items: {
          create: [
            {
              productId: specialProduct.id,
              qty: 2,
              mrpPaise: 50000,
              unitPricePaise: 50000,
              taxablePaise: 95238,
              gstRateBp: 500,
              taxPaise: 4762,
              hsn: "21069099",
            },
          ],
        },
      },
    });

    const entries = await incentiveService.onInvoiceCreated(invoice.id);
    expect(entries.length).toBe(1);
    expect(entries[0].status).toBe(IncentiveEntryStatus.CREDITED);
    expect(entries[0].baseAmountPaise).toBe(100000); // Payable base
    expect(entries[0].percentBp).toBe(400); // 4%
    expect(entries[0].amountPaise).toBe(4000); // ₹40.00
    expect(entries[0].ruleId).toBeDefined();
  });

  it("3. Van Sale: Created & CREDITED immediately in the transaction", async () => {
    // Van sale of ₹2,000 on normalProduct (1% global)
    const vanInvoice = await prisma.invoice.create({
      data: {
        number: "INV/26-27/TEST-002",
        fy: "26-27",
        channel: InvoiceChannel.VAN,
        locationId: location.id,
        status: InvoiceStatus.FINAL,
        subtotalPaise: 200000,
        taxablePaise: 190476,
        cgstPaise: 4762,
        sgstPaise: 4762,
        totalPaise: 200000,
        paymentStatus: PaymentStatus.PAID,
        agentUserId: agentUser.id,
        agentCodeSnapshot: agentUser.agentCode,
        createdBy: agentUser.id,
        items: {
          create: [
            {
              productId: normalProduct.id,
              qty: 5,
              mrpPaise: 40000,
              unitPricePaise: 40000,
              taxablePaise: 190476,
              gstRateBp: 500,
              taxPaise: 9524,
              hsn: "21069099",
            },
          ],
        },
      },
    });

    const entries = await incentiveService.onInvoiceCreated(vanInvoice.id);
    expect(entries.length).toBe(1);
    expect(entries[0].status).toBe(IncentiveEntryStatus.CREDITED);
    expect(entries[0].percentBp).toBe(100); // 1%
    expect(entries[0].amountPaise).toBe(2000); // ₹20.00
  });

  it("4. Dispatch Order: Starts as PENDING, CREDITED upon Handover trigger", async () => {
    // Store/Dispatch invoice of ₹5,000 on normalProduct (1%)
    const dispatchInvoice = await prisma.invoice.create({
      data: {
        number: "INV/26-27/TEST-003",
        fy: "26-27",
        channel: InvoiceChannel.ONLINE,
        locationId: location.id,
        status: InvoiceStatus.FINAL,
        subtotalPaise: 500000,
        taxablePaise: 476190,
        cgstPaise: 11905,
        sgstPaise: 11905,
        totalPaise: 500000,
        paymentStatus: PaymentStatus.PENDING,
        agentUserId: agentUser.id,
        agentCodeSnapshot: agentUser.agentCode,
        createdBy: agentUser.id,
        items: {
          create: [
            {
              productId: normalProduct.id,
              qty: 10,
              mrpPaise: 50000,
              unitPricePaise: 50000,
              taxablePaise: 476190,
              gstRateBp: 500,
              taxPaise: 23810,
              hsn: "21069099",
            },
          ],
        },
      },
    });

    // Linked Order
    const order = await prisma.order.create({
      data: {
        orderNumber: "ORD/26-27/TEST-003",
        subtotalPaise: 500000,
        taxablePaise: 476190,
        cgstPaise: 11905,
        sgstPaise: 11905,
        totalPaise: 500000,
        invoiceId: dispatchInvoice.id,
        userId: agentUser.id,
        deliveryZoneCode: "SAHARSA_TOWN",
        deliveryZoneName: "Saharsa Town",
        deliveryAddress: "Ward 10, Saharsa",
        contactPhone: "9876543210",
      },
    });

    const entries = await incentiveService.onInvoiceCreated(dispatchInvoice.id);
    expect(entries.length).toBe(1);
    // Must be PENDING because it is an online/dispatch order awaiting handover
    expect(entries[0].status).toBe(IncentiveEntryStatus.PENDING);
    expect(entries[0].amountPaise).toBe(5000); // ₹50.00

    // Simulate dispatch handover:
    const creditedCount = await incentiveService.onDispatchHandover([order.id]);
    expect(creditedCount).toBe(1);

    // Verify entry transitioned to CREDITED
    const updatedEntry = await prisma.incentiveEntry.findUnique({
      where: { id: entries[0].id },
    });
    expect(updatedEntry?.status).toBe(IncentiveEntryStatus.CREDITED);
    expect(updatedEntry?.triggerEvent).toBe("ORDER_HANDOVER");
  });

  it("5. Invoice Cancel: Posts an append-only REVERSAL row", async () => {
    // Cancel the Van sale (TEST-002) of ₹20
    const vanInvoice = await prisma.invoice.findUniqueOrThrow({
      where: { number: "INV/26-27/TEST-002" },
    });

    await incentiveService.onInvoiceCancelled(
      vanInvoice.id,
      "Customer returned goods at counter",
      "admin-user-id"
    );

    // Verify REVERSAL row exists
    const reversals = await prisma.incentiveEntry.findMany({
      where: {
        invoiceId: vanInvoice.id,
        type: IncentiveEntryType.REVERSAL,
      },
    });
    expect(reversals.length).toBe(1);
    expect(reversals[0].amountPaise).toBe(-2000); // -₹20.00
    expect(reversals[0].status).toBe(IncentiveEntryStatus.REVERSED);
  });

  it("6. Monthly Statement, Approval, Payout & Period Locking", async () => {
    // Monthly statement for agent in period
    // Hand calculation:
    // + ₹40 (Counter: 4,000 paise)
    // + ₹20 (Van: 2,000 paise)
    // - ₹20 (Van Reversal: -2,000 paise)
    // + ₹50 (Dispatch: 5,000 paise)
    // Net Payable = 4,000 + 2,000 - 2,000 + 5,000 = 9,000 paise (₹90.00)
    const statement = await incentiveService.getMonthlyStatement(agentUser.id, period);
    expect(statement.totalCreditedPaise).toBe(11000); // 4000 + 2000 + 5000
    expect(statement.totalReversedPaise).toBe(-2000);
    expect(statement.netPayablePaise).toBe(9000); // ₹90.00
    expect(statement.status).toBe(IncentivePayoutStatus.DRAFT);
    expect(statement.isLocked).toBe(false);

    // 7. Approve payout
    const approved = await incentiveService.approvePayout(
      agentUser.id,
      period,
      "admin-user",
      UserRole.SUPER_ADMIN
    );
    expect(approved.status).toBe(IncentivePayoutStatus.APPROVED);

    // 8. Mark paid (Locks the period)
    const paid = await incentiveService.markPayoutPaid({
      agentUserId: agentUser.id,
      period,
      method: "UPI",
      reference: "UPI_REF_998877",
      actorId: "admin-user",
      actorRole: UserRole.SUPER_ADMIN,
    });
    expect(paid.status).toBe(IncentivePayoutStatus.PAID);
    expect(paid.paidAt).toBeDefined();

    // Verify statement is locked
    const lockedStatement = await incentiveService.getMonthlyStatement(agentUser.id, period);
    expect(lockedStatement.isLocked).toBe(true);
    expect(lockedStatement.status).toBe(IncentivePayoutStatus.PAID);

    // 9. Invariant: Locked period rejects further manual adjustments
    await expect(
      incentiveService.recordAdjustment({
        agentUserId: agentUser.id,
        period,
        amountPaise: 500,
        reason: "Late bonus",
        actorId: "admin-user",
        actorRole: UserRole.SUPER_ADMIN,
      })
    ).rejects.toThrow(/locked/i);
  });
});
