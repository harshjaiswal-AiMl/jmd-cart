import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { billingService } from "@/modules/billing/billing.service";
import { vanService } from "@/modules/van/van.service";
import { stockService } from "@/modules/stock/stock.service";
import {
  UserRole,
  LocationType,
  InvoiceChannel,
  PaymentMode,
  MovementType,
  InvoiceStatus,
} from "@prisma/client";
import { ForbiddenError } from "@/modules/auth/permissions";

describe("Task 2.4: Van Billing, Offline Drafts & Idempotent Finalize", () => {
  let godownLoc: { id: string; name: string };
  let vanLoc: { id: string; name: string };
  let salesUser: { id: string; name: string; role: UserRole };
  let testProduct: { id: string; name: string; mrpPaise: number; packSize: number };
  let creditParty: { id: string; name: string; creditLimitPaise: number };

  beforeEach(async () => {
    // 1. Fetch Central Godown & setup Van location
    godownLoc = await prisma.location.findFirstOrThrow({
      where: { type: LocationType.GODOWN, active: true },
    });

    salesUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.SALESPERSON },
    });

    vanLoc = await prisma.location.upsert({
      where: { id: "test-van-vb" },
      update: { assignedUserId: salesUser.id, active: true },
      create: {
        id: "test-van-vb",
        name: "Test Van VB (BR-19-T-9999)",
        type: LocationType.VAN,
        assignedUserId: salesUser.id,
        active: true,
      },
    });

    // Clean up any open van days on this van from previous test runs
    await prisma.vanDay.updateMany({
      where: { vanLocationId: vanLoc.id, status: "OPEN" },
      data: { status: "CLOSED" },
    });

    // 2. Create fresh isolated test product
    const runCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    testProduct = await prisma.product.create({
      data: {
        name: `Van Billing Test Product ${runCode}`,
        shortCode: `VB_${runCode}`,
        hsn: "21069099",
        gstRateBp: 500, // 5%
        mrpPaise: 5000, // Rs 50
        packSize: 10,
        packLabel: "10 pcs / box",
      },
    });

    // 3. Ensure Central Godown has 1000 pieces of stock
    await stockService.postMovement({
      type: MovementType.PURCHASE_RECEIPT,
      productId: testProduct.id,
      fromLocationId: null,
      toLocationId: godownLoc.id,
      qty: 1000,
      referenceType: "TEST",
      idempotencyKey: `init_godown_vb_${Date.now()}_${Math.random()}`,
    });

    // 4. Create credit party isolated per test run
    creditParty = await prisma.party.create({
      data: {
        id: `test-party-vb-${runCode}`,
        name: `Van Credit Test Kirana ${runCode}`,
        phone: `98765${Math.floor(10000 + Math.random() * 90000)}`,
        type: "RETAILER",
        creditEnabled: true,
        creditLimitPaise: 50000, // Rs 500 limit
      },
    });
  });

  describe("Van Billing Guard & Active Van Day Requirement", () => {
    it("should reject van billing when van has no active morning load sheet", async () => {
      const input = {
        channel: InvoiceChannel.VAN,
        locationId: vanLoc.id,
        idempotencyKey: `vb_guard_${Date.now()}`,
        items: [{ productId: testProduct.id, qty: 5 }],
        payments: [{ mode: PaymentMode.CASH, amountPaise: 25000 }],
      };

      await expect(
        billingService.finalizeInvoice(UserRole.SALESPERSON, input, salesUser.id)
      ).rejects.toThrow(/Van has no active morning load sheet/);
    });

    it("should block non-billing roles (Godown, Customer) with ForbiddenError", async () => {
      const input = {
        channel: InvoiceChannel.VAN,
        locationId: vanLoc.id,
        idempotencyKey: `vb_forbid_${Date.now()}`,
        items: [{ productId: testProduct.id, qty: 5 }],
        payments: [{ mode: PaymentMode.CASH, amountPaise: 25000 }],
      };

      await expect(
        billingService.finalizeInvoice(UserRole.GODOWN, input, salesUser.id)
      ).rejects.toThrow(ForbiddenError);

      await expect(
        billingService.finalizeInvoice(UserRole.CUSTOMER, input, salesUser.id)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("Atomic Van Stock Deduction & Sequence Numbering", () => {
    it("should finalize invoice, assign gapless FY sequence, and deduct pieces only from Van location", async () => {
      // 1. Issue 50 pieces from Godown to Van
      await vanService.createVanIssueSheet(UserRole.SUPER_ADMIN, salesUser.id, {
        vanLocationId: vanLoc.id,
        notes: "Morning load for route test",
        items: [{ productId: testProduct.id, cartons: 5 }], // 5 ctns * 10 = 50 pcs
      });

      // Verify van balance is 50
      const initialVanStock = await stockService.getBalance(testProduct.id, vanLoc.id);
      expect(initialVanStock).toBe(50);

      // 2. Salesperson finalizes a sale of 12 pieces for cash
      // 12 pcs * Rs 50 MRP = Rs 600, minus 8% volume slab (>= 10 pcs) = Rs 552 (55200 paise)
      const idempotencyKey = `vb_sale_${Date.now()}`;
      const invoice = await billingService.finalizeInvoice(
        UserRole.SALESPERSON,
        {
          channel: InvoiceChannel.VAN,
          locationId: vanLoc.id,
          idempotencyKey,
          items: [{ productId: testProduct.id, qty: 12 }],
          payments: [{ mode: PaymentMode.CASH, amountPaise: 55200 }],
        },
        salesUser.id
      );

      // Verify invoice properties
      expect(invoice.id).toBeDefined();
      expect(invoice.number).toMatch(/^INV\/\d{2}-\d{2}\/\d{6}$/);
      expect(invoice.status).toBe(InvoiceStatus.FINAL);
      expect(invoice.channel).toBe(InvoiceChannel.VAN);
      expect(invoice.locationId).toBe(vanLoc.id);
      expect(invoice.totalPaise).toBe(55200);
      expect(invoice.idempotencyKey).toBe(idempotencyKey);

      // 3. Verify on-van stock is deducted by exactly 12 pieces: 50 - 12 = 38
      const remainingVanStock = await stockService.getBalance(testProduct.id, vanLoc.id);
      expect(remainingVanStock).toBe(38);

      // 4. Verify stock movement was recorded
      const movements = await prisma.stockMovement.findMany({
        where: { referenceId: invoice.id },
      });
      expect(movements.length).toBe(1);
      expect(movements[0].type).toBe(MovementType.SALE);
      expect(movements[0].fromLocationId).toBe(vanLoc.id);
      expect(movements[0].toLocationId).toBeNull();
      expect(movements[0].qty).toBe(12);
    });

    it("should fail atomically and roll back if requested qty exceeds available on-van stock", async () => {
      // Create active van day with 20 pieces loaded
      await vanService.createVanIssueSheet(UserRole.SUPER_ADMIN, salesUser.id, {
        vanLocationId: vanLoc.id,
        notes: "Small load",
        items: [{ productId: testProduct.id, cartons: 2 }], // 20 pcs
      });

      const currentStock = await stockService.getBalance(testProduct.id, vanLoc.id);

      // Attempt to sell 50 pieces when only 20 pieces exist
      await expect(
        billingService.finalizeInvoice(
          UserRole.SALESPERSON,
          {
            channel: InvoiceChannel.VAN,
            locationId: vanLoc.id,
            idempotencyKey: `vb_oversell_${Date.now()}`,
            items: [{ productId: testProduct.id, qty: currentStock + 30 }],
            payments: [{ mode: PaymentMode.CASH, amountPaise: 250000 }],
          },
          salesUser.id
        )
      ).rejects.toThrow();

      // Verify stock was NOT altered
      const stockAfter = await stockService.getBalance(testProduct.id, vanLoc.id);
      expect(stockAfter).toBe(currentStock);
    });
  });

  describe("Idempotent Finalization Replay", () => {
    it("should return the exact same invoice on duplicate replay without burning numbers or double-deducting stock", async () => {
      // Load 30 pieces on van
      await vanService.createVanIssueSheet(UserRole.SUPER_ADMIN, salesUser.id, {
        vanLocationId: vanLoc.id,
        items: [{ productId: testProduct.id, cartons: 3 }], // 30 pcs
      });

      const initialStock = await stockService.getBalance(testProduct.id, vanLoc.id);
      const idempotencyKey = `idemp_replay_key_${Date.now()}`;

      // First finalization
      const invoice1 = await billingService.finalizeInvoice(
        UserRole.SALESPERSON,
        {
          channel: InvoiceChannel.VAN,
          locationId: vanLoc.id,
          idempotencyKey,
          items: [{ productId: testProduct.id, qty: 10 }],
          payments: [{ mode: PaymentMode.CASH, amountPaise: 50000 }],
        },
        salesUser.id
      );

      const stockAfterFirst = await stockService.getBalance(testProduct.id, vanLoc.id);
      expect(stockAfterFirst).toBe(initialStock - 10);

      // Second finalization with the EXACT SAME idempotencyKey (network retry simulation)
      const invoice2 = await billingService.finalizeInvoice(
        UserRole.SALESPERSON,
        {
          channel: InvoiceChannel.VAN,
          locationId: vanLoc.id,
          idempotencyKey,
          items: [{ productId: testProduct.id, qty: 10 }],
          payments: [{ mode: PaymentMode.CASH, amountPaise: 50000 }],
        },
        salesUser.id
      );

      // Must be identical
      expect(invoice2.id).toBe(invoice1.id);
      expect(invoice2.number).toBe(invoice1.number);
      expect(invoice2.totalPaise).toBe(invoice1.totalPaise);

      // Stock must NOT be deducted again
      const stockAfterSecond = await stockService.getBalance(testProduct.id, vanLoc.id);
      expect(stockAfterSecond).toBe(stockAfterFirst);
    });
  });

  describe("Credit Party Billing and Limit Enforcement on Route", () => {
    it("should allow credit billing for authorized party within credit limit", async () => {
      // Load 40 pieces on van
      await vanService.createVanIssueSheet(UserRole.SUPER_ADMIN, salesUser.id, {
        vanLocationId: vanLoc.id,
        items: [{ productId: testProduct.id, cartons: 4 }],
      });

      // Party has 50000 paise (Rs 500) limit. Bill 6 pieces = Rs 300.
      const invoice = await billingService.finalizeInvoice(
        UserRole.SALESPERSON,
        {
          channel: InvoiceChannel.VAN,
          locationId: vanLoc.id,
          partyId: creditParty.id,
          idempotencyKey: `credit_ok_${Date.now()}`,
          items: [{ productId: testProduct.id, qty: 6 }],
          payments: [], // Full credit sale
        },
        salesUser.id
      );

      expect(invoice.id).toBeDefined();
      expect(invoice.partyId).toBe(creditParty.id);

      // Verify party ledger debit entry
      const ledgerEntry = await prisma.ledgerEntry.findFirst({
        where: { referenceId: invoice.id, kind: "INVOICE" },
      });
      expect(ledgerEntry).toBeDefined();
      expect(ledgerEntry?.debitPaise).toBe(30000);
    });

    it("should reject credit sale if requested amount exceeds remaining credit limit", async () => {
      // Load 40 pieces on van
      await vanService.createVanIssueSheet(UserRole.SUPER_ADMIN, salesUser.id, {
        vanLocationId: vanLoc.id,
        items: [{ productId: testProduct.id, cartons: 4 }],
      });

      // Party limit is Rs 500 (50000 paise). 15 pcs @ Rs 50 = Rs 750 (with 8% slab = Rs 690) > Rs 500 limit.
      await expect(
        billingService.finalizeInvoice(
          UserRole.SALESPERSON,
          {
            channel: InvoiceChannel.VAN,
            locationId: vanLoc.id,
            partyId: creditParty.id,
            idempotencyKey: `credit_exceed_${Date.now()}`,
            items: [{ productId: testProduct.id, qty: 15 }],
            payments: [], // Full credit exceeding limit
          },
          salesUser.id
        )
      ).rejects.toThrow(/Credit limit exceeded/);
    });
  });
});
