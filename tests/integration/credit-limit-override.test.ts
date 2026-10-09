import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { billingService } from "@/modules/billing/billing.service";
import { partyService } from "@/modules/party/party.service";
import {
  UserRole,
  PartyType,
  InvoiceChannel,
  PaymentStatus,
  LocationType,
} from "@prisma/client";
import { ForbiddenError } from "@/modules/auth/permissions";

describe("Task 2.7 Integration Tests: Credit Limit Enforcement & Owner Override", () => {
  const testPrefix = "TEST-CREDIT-";

  let adminUser: { id: string; role: UserRole; name: string };
  let shopUser: { id: string; role: UserRole; name: string };
  let salesUser: { id: string; role: UserRole; name: string };
  let godownUser: { id: string; role: UserRole; name: string };
  let shopLocation: { id: string; name: string };
  let testProduct: { id: string; name: string; mrpPaise: number };

  const cleanup = async () => {
    const parties = await prisma.party.findMany({
      where: { name: { startsWith: testPrefix } },
    });

    if (parties.length > 0) {
      const partyIds = parties.map((p) => p.id);
      const invoices = await prisma.invoice.findMany({
        where: { partyId: { in: partyIds } },
      });
      const invoiceIds = invoices.map((inv) => inv.id);

      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { entityId: { in: invoiceIds } },
            { entityId: { in: partyIds } },
          ],
        },
      });
      await prisma.payment.deleteMany({
        where: { OR: [{ partyId: { in: partyIds } }, { invoiceId: { in: invoiceIds } }] },
      });
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
      await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
      await prisma.ledgerEntry.deleteMany({ where: { partyId: { in: partyIds } } });
      await prisma.party.deleteMany({ where: { id: { in: partyIds } } });
    }
  };

  beforeEach(async () => {
    await cleanup();

    adminUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.SUPER_ADMIN },
      select: { id: true, role: true, name: true },
    });

    shopUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.SHOP },
      select: { id: true, role: true, name: true },
    });

    salesUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.SALESPERSON },
      select: { id: true, role: true, name: true },
    });

    godownUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.GODOWN },
      select: { id: true, role: true, name: true },
    });

    shopLocation = await prisma.location.findFirstOrThrow({
      where: { type: LocationType.SHOP, active: true },
    });

    // Upsert persistent test product with MRP ₹100
    testProduct = await prisma.product.upsert({
      where: { id: "test-credit-prod-override" },
      update: { mrpPaise: 10000, active: true },
      create: {
        id: "test-credit-prod-override",
        name: `${testPrefix}MDH Deggi Mirch 100g`,
        shortCode: "CR_MDH_100",
        hsn: "09042211",
        gstRateBp: 500, // 5%
        mrpPaise: 10000, // ₹100
        packSize: 10,
        packLabel: "10 pcs / box",
        active: true,
      },
    });

    await prisma.stockBalance.upsert({
      where: {
        productId_locationId: {
          productId: testProduct.id,
          locationId: shopLocation.id,
        },
      },
      update: { qty: 50000 },
      create: {
        productId: testProduct.id,
        locationId: shopLocation.id,
        qty: 50000,
      },
    });
  });

  afterEach(async () => {
    await cleanup();
  });

  it("should allow credit sale within party credit limit", async () => {
    const party = await partyService.createParty(UserRole.SUPER_ADMIN, adminUser.id, {
      name: `${testPrefix}Within Limit Retailer`,
      type: PartyType.CUSTOMER,
      creditEnabled: true,
      creditLimitPaise: 50000, // ₹500 limit
      creditDays: 15,
      openingOutstandingPaise: 10000, // ₹100 already outstanding
      active: true,
    });

    // Bill 3 items @ ₹100 = ₹300 on credit. Total outstanding becomes ₹100 + ₹300 = ₹400 <= ₹500 limit
    const invoice = await billingService.finalizeInvoice(
      UserRole.SHOP,
      {
        channel: InvoiceChannel.SHOP,
        locationId: shopLocation.id,
        partyId: party.id,
        idempotencyKey: `test_credit_sale_01_${Date.now()}`,
        items: [{ productId: testProduct.id, qty: 3 }],
        payments: [], // 0 paid = full credit
      },
      shopUser.id
    );

    expect(invoice.id).toBeDefined();
    expect(invoice.totalPaise).toBe(30000);
    expect(invoice.creditOverride).toBe(false);
    expect(invoice.paymentStatus).toBe(PaymentStatus.PENDING);

    const creditStatus = await partyService.checkPartyCreditStatus(
      UserRole.SHOP,
      party.id
    );
    expect(creditStatus.currentOutstandingPaise).toBe(40000); // ₹400
    expect(creditStatus.isLimitExceeded).toBe(false);
  });

  it("should block credit sale when credit limit is exceeded, but allow with Super Admin override", async () => {
    const party = await partyService.createParty(UserRole.SUPER_ADMIN, adminUser.id, {
      name: `${testPrefix}Exceeded Limit Retailer`,
      type: PartyType.CUSTOMER,
      creditEnabled: true,
      creditLimitPaise: 50000, // ₹500 limit
      creditDays: 15,
      openingOutstandingPaise: 40000, // ₹400 already outstanding
      active: true,
    });

    // Attempt to bill 2 items @ ₹100 = ₹200 on credit. Total becomes ₹400 + ₹200 = ₹600 > ₹500 limit!
    await expect(
      billingService.finalizeInvoice(
        UserRole.SHOP,
        {
          channel: InvoiceChannel.SHOP,
          locationId: shopLocation.id,
          partyId: party.id,
          idempotencyKey: `test_credit_sale_exceed_${Date.now()}`,
          items: [{ productId: testProduct.id, qty: 2 }],
          payments: [],
        },
        shopUser.id
      )
    ).rejects.toThrow(/Credit sale blocked.*Credit limit of ₹500.00 exceeded by ₹100.00/);

    // Now cashier finalizes with Owner Override from Super Admin
    const overriddenInvoice = await billingService.finalizeInvoice(
      UserRole.SHOP,
      {
        channel: InvoiceChannel.SHOP,
        locationId: shopLocation.id,
        partyId: party.id,
        idempotencyKey: `test_credit_sale_override_${Date.now()}`,
        items: [{ productId: testProduct.id, qty: 2 }],
        payments: [],
        creditOverride: {
          approvedByUserId: adminUser.id,
          reason: "Sachin Prakash approved over phone call",
        },
      },
      shopUser.id
    );

    expect(overriddenInvoice.id).toBeDefined();
    expect(overriddenInvoice.creditOverride).toBe(true);
    expect(overriddenInvoice.creditOverrideBy).toBe(adminUser.id);
    expect(overriddenInvoice.creditOverrideReason).toBe("Sachin Prakash approved over phone call");

    // Verify audit log entry was created for the override
    const audit = await prisma.auditLog.findFirst({
      where: {
        action: "CREDIT_LIMIT_OVERRIDE",
        entityId: overriddenInvoice.id,
      },
    });
    expect(audit).toBeDefined();
  });

  it("should reject credit override if approvedBy user does not have OVERRIDE_CREDIT_LIMIT permission", async () => {
    const party = await partyService.createParty(UserRole.SUPER_ADMIN, adminUser.id, {
      name: `${testPrefix}Fake Approver Retailer`,
      type: PartyType.CUSTOMER,
      creditEnabled: true,
      creditLimitPaise: 30000,
      openingOutstandingPaise: 30000, // Limit fully utilized
      active: true,
    });

    // Attempt override signed by Godown user (who lacks OVERRIDE_CREDIT_LIMIT)
    await expect(
      billingService.finalizeInvoice(
        UserRole.SHOP,
        {
          channel: InvoiceChannel.SHOP,
          locationId: shopLocation.id,
          partyId: party.id,
          idempotencyKey: `test_fake_override_${Date.now()}`,
          items: [{ productId: testProduct.id, qty: 1 }],
          payments: [],
          creditOverride: {
            approvedByUserId: godownUser.id,
            reason: "Godown clerk tried to approve",
          },
        },
        shopUser.id
      )
    ).rejects.toThrow(ForbiddenError);
  });

  it("should allow Super Admin to override directly without explicit creditOverride payload", async () => {
    const party = await partyService.createParty(UserRole.SUPER_ADMIN, adminUser.id, {
      name: `${testPrefix}Direct Admin Override Retailer`,
      type: PartyType.CUSTOMER,
      creditEnabled: true,
      creditLimitPaise: 20000,
      openingOutstandingPaise: 20000,
      active: true,
    });

    // Super Admin bills directly exceeding limit
    const invoice = await billingService.finalizeInvoice(
      UserRole.SUPER_ADMIN,
      {
        channel: InvoiceChannel.SHOP,
        locationId: shopLocation.id,
        partyId: party.id,
        idempotencyKey: `test_admin_direct_${Date.now()}`,
        items: [{ productId: testProduct.id, qty: 1 }],
        payments: [],
      },
      adminUser.id
    );

    expect(invoice.id).toBeDefined();
    expect(invoice.creditOverride).toBe(true);
    expect(invoice.creditOverrideBy).toBe(adminUser.id);
  });

  it("should block credit sale if party has overdue unpaid bills older than creditDays, but allow with override", async () => {
    const party = await partyService.createParty(UserRole.SUPER_ADMIN, adminUser.id, {
      name: `${testPrefix}Overdue Debtor`,
      type: PartyType.CUSTOMER,
      creditEnabled: true,
      creditLimitPaise: 100000, // ₹1,000 limit (plenty of room)
      creditDays: 7, // 7 days payment term
      openingOutstandingPaise: 0,
      active: true,
    });

    // Create an old unpaid invoice created 10 days ago (> 7 days)
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    const oldInvoice = await billingService.finalizeInvoice(
      UserRole.SHOP,
      {
        channel: InvoiceChannel.SHOP,
        locationId: shopLocation.id,
        partyId: party.id,
        idempotencyKey: `test_old_inv_${Date.now()}`,
        items: [{ productId: testProduct.id, qty: 1 }],
        payments: [],
      },
      shopUser.id
    );

    // Manually push its createdAt back to 10 days ago
    await prisma.invoice.update({
      where: { id: oldInvoice.id },
      data: { createdAt: tenDaysAgo },
    });

    // Attempting a new credit sale must be blocked due to overdue invoice!
    await expect(
      billingService.finalizeInvoice(
        UserRole.SHOP,
        {
          channel: InvoiceChannel.SHOP,
          locationId: shopLocation.id,
          partyId: party.id,
          idempotencyKey: `test_overdue_blocked_${Date.now()}`,
          items: [{ productId: testProduct.id, qty: 1 }],
          payments: [],
        },
        shopUser.id
      )
    ).rejects.toThrow(/Credit sale blocked.*1 overdue invoice\(s\) older than 7 days/);

    // But with Owner Override, it goes through
    const overridden = await billingService.finalizeInvoice(
      UserRole.SHOP,
      {
        channel: InvoiceChannel.SHOP,
        locationId: shopLocation.id,
        partyId: party.id,
        idempotencyKey: `test_overdue_override_${Date.now()}`,
        items: [{ productId: testProduct.id, qty: 1 }],
        payments: [],
        creditOverride: {
          approvedByUserId: adminUser.id,
          reason: "Customer promised to clear both bills tomorrow",
        },
      },
      shopUser.id
    );

    expect(overridden.id).toBeDefined();
    expect(overridden.creditOverride).toBe(true);
  });

  it("should allow cash sale even if party exceeds credit limit", async () => {
    const party = await partyService.createParty(UserRole.SUPER_ADMIN, adminUser.id, {
      name: `${testPrefix}Cash Buyer Over Limit`,
      type: PartyType.CUSTOMER,
      creditEnabled: true,
      creditLimitPaise: 10000,
      openingOutstandingPaise: 50000, // Outstanding exceeds limit by ₹400
      active: true,
    });

    // Cash sale: customer pays in full immediately
    const cashInvoice = await billingService.finalizeInvoice(
      UserRole.SHOP,
      {
        channel: InvoiceChannel.SHOP,
        locationId: shopLocation.id,
        partyId: party.id,
        idempotencyKey: `test_cash_sale_over_limit_${Date.now()}`,
        items: [{ productId: testProduct.id, qty: 1 }],
        payments: [
          {
            mode: "CASH",
            amountPaise: 10000, // ₹100 full payment
          },
        ],
      },
      shopUser.id
    );

    expect(cashInvoice.id).toBeDefined();
    expect(cashInvoice.paymentStatus).toBe(PaymentStatus.PAID);
    expect(cashInvoice.totalPaise).toBe(10000);
    expect(cashInvoice.payments.length).toBe(1);
    expect(cashInvoice.payments[0].amountPaise).toBe(10000);
    expect(cashInvoice.creditOverride).toBe(false);
  });
});