import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { billingService } from "@/modules/billing/billing.service";
import { stockService } from "@/modules/stock/stock.service";
import {
  UserRole,
  InvoiceStatus,
  PaymentMode,
  PaymentStatus,
  PartyType,
  LedgerKind,
} from "@prisma/client";
import { ForbiddenError } from "@/modules/auth/permissions";

describe("Task 1.11: Billing Service, Invoice Numbering, GST & Finalize/Cancel", () => {
  const runId = Date.now().toString().slice(-6);
  let shopLocId: string;
  let testCompanyId: string;
  let productAId: string;
  let productBId: string;
  let approvedPartyId: string;
  let nonCreditPartyId: string;

  beforeAll(async () => {
    // 1. Setup Shop Location
    const shop = await prisma.location.upsert({
      where: { id: `loc-shop-billing-${runId}` },
      update: {},
      create: {
        id: `loc-shop-billing-${runId}`,
        name: `Shop Billing ${runId}`,
        type: "SHOP",
      },
    });
    shopLocId = shop.id;

    // 2. Setup Company
    const comp = await prisma.company.create({
      data: { name: `Billing Comp ${runId}` },
    });
    testCompanyId = comp.id;

    // 3. Setup Products
    const prodA = await prisma.product.create({
      data: {
        name: `Billing Prod A ${runId}`,
        shortCode: `BPA_${runId}`,
        companyId: testCompanyId,
        hsn: "21069099",
        gstRateBp: 1200, // 12% GST
        mrpPaise: 10000, // ₹100.00
        packSize: 10,
        reorderLevel: 10,
      },
    });
    productAId = prodA.id;

    const prodB = await prisma.product.create({
      data: {
        name: `Billing Prod B ${runId}`,
        shortCode: `BPB_${runId}`,
        companyId: testCompanyId,
        hsn: "09042010",
        gstRateBp: 500, // 5% GST
        mrpPaise: 5000, // ₹50.00
        packSize: 20,
        reorderLevel: 10,
      },
    });
    productBId = prodB.id;

    // 4. Setup Initial Inventory in Shop via Purchase Receipt
    await stockService.postMovement({
      type: "PURCHASE_RECEIPT",
      productId: productAId,
      toLocationId: shopLocId,
      qty: 100,
      idempotencyKey: `grn_init_a_${runId}`,
      reason: "Initial test inventory for billing",
    });

    await stockService.postMovement({
      type: "PURCHASE_RECEIPT",
      productId: productBId,
      toLocationId: shopLocId,
      qty: 100,
      idempotencyKey: `grn_init_b_${runId}`,
      reason: "Initial test inventory for billing",
    });

    // 5. Setup Customer Parties
    const approvedParty = await prisma.party.create({
      data: {
        type: PartyType.RETAILER,
        name: `Gupta Store ${runId}`,
        phone: `9801${runId}`,
        creditEnabled: true,
        creditLimitPaise: 5000000, // ₹50,000 credit limit
      },
    });
    approvedPartyId = approvedParty.id;

    const nonCreditParty = await prisma.party.create({
      data: {
        type: PartyType.CUSTOMER,
        name: `Cash Customer ${runId}`,
        phone: `9802${runId}`,
        creditEnabled: false,
      },
    });
    nonCreditPartyId = nonCreditParty.id;
  });

  afterAll(async () => {
    // Deactivate test products and delete parties
    await prisma.product.updateMany({
      where: { id: { in: [productAId, productBId] } },
      data: { active: false },
    });
    await prisma.company.deleteMany({
      where: { id: testCompanyId },
    });
  });

  it("should finalize retail cash sale with gapless invoice number, stock deduction, and tax breakdown", async () => {
    const beforeBalA = await stockService.getBalance(productAId, shopLocId);
    const beforeBalB = await stockService.getBalance(productBId, shopLocId);

    // Bill 10 pcs of A (MRP ₹100 = ₹1,000) and 4 pcs of B (MRP ₹50 = ₹200)
    // Subtotal: ₹1,200.00 (120000 paise).
    // Note: Global slab gives 8% on A (10 pcs >= minQty 10) -> unit price ₹92.00 (92000 paise for 10 pcs).
    // B has 4 pcs < 10 -> 0% discount -> ₹50.00 x 4 = ₹200.00 (20000 paise).
    // Total line total = 92000 + 20000 = 112000 paise (₹1,120.00).
    const invoice = await billingService.finalizeInvoice(UserRole.SHOP, {
      locationId: shopLocId,
      partyId: null, // Walk-in customer
      items: [
        { productId: productAId, qty: 10 },
        { productId: productBId, qty: 4 },
      ],
      payments: [
        { mode: PaymentMode.CASH, amountPaise: 62000 },
        { mode: PaymentMode.UPI, amountPaise: 50000 },
      ],
      idempotencyKey: `inv_test_cash_${runId}`,
    });

    expect(invoice.id).toBeDefined();
    expect(invoice.status).toBe(InvoiceStatus.FINAL);
    expect(invoice.number).toMatch(/^INV\/\d{2}-\d{2}\/\d{6}$/);
    expect(invoice.totalPaise).toBe(112000);
    expect(invoice.paymentStatus).toBe(PaymentStatus.PAID);
    expect(invoice.payments.length).toBe(2);

    // Tax split validation
    expect(invoice.cgstPaise + invoice.sgstPaise + invoice.igstPaise).toBeGreaterThan(0);
    expect(invoice.taxablePaise + invoice.cgstPaise + invoice.sgstPaise).toBe(invoice.totalPaise);

    // Verify stock deductions in shop
    const afterBalA = await stockService.getBalance(productAId, shopLocId);
    const afterBalB = await stockService.getBalance(productBId, shopLocId);
    expect(afterBalA).toBe(beforeBalA - 10);
    expect(afterBalB).toBe(beforeBalB - 4);

    // Verify SALE movements were recorded
    const movements = await stockService.getMovements(productAId, 1);
    expect(movements[0].type).toBe("SALE");
    expect(movements[0].qty).toBe(10);
    expect(movements[0].referenceType).toBe("INVOICE");
    expect(movements[0].referenceId).toBe(invoice.id);
  });

  it("should record credit sale for approved retailer and post debit to party ledger", async () => {
    // Bill 10 pcs of A to approved party with zero immediate payment
    const invoice = await billingService.finalizeInvoice(UserRole.SHOP, {
      locationId: shopLocId,
      partyId: approvedPartyId,
      items: [{ productId: productAId, qty: 10 }],
      payments: [], // Full credit
      idempotencyKey: `inv_test_credit_${runId}`,
    });

    expect(invoice.paymentStatus).toBe(PaymentStatus.PENDING);
    expect(invoice.partyId).toBe(approvedPartyId);

    // Verify ledger entry debit
    const entries = await prisma.ledgerEntry.findMany({
      where: {
        partyId: approvedPartyId,
        referenceId: invoice.id,
      },
    });

    expect(entries.length).toBe(1);
    expect(entries[0].kind).toBe(LedgerKind.INVOICE);
    expect(entries[0].debitPaise).toBe(invoice.totalPaise);
    expect(entries[0].creditPaise).toBe(0);
  });

  it("should reject credit sale for walk-in retail or unapproved party", async () => {
    // 1. Walk-in customer paying less than total
    await expect(
      billingService.finalizeInvoice(UserRole.SHOP, {
        locationId: shopLocId,
        partyId: null,
        items: [{ productId: productAId, qty: 1 }],
        payments: [{ mode: PaymentMode.CASH, amountPaise: 5000 }], // 50 paid on 100 MRP
        idempotencyKey: `inv_fail_walkin_${runId}`,
      })
    ).rejects.toThrow("Walk-in retail sales must be fully paid");

    // 2. Party with creditEnabled === false paying less than total
    await expect(
      billingService.finalizeInvoice(UserRole.SHOP, {
        locationId: shopLocId,
        partyId: nonCreditPartyId,
        items: [{ productId: productAId, qty: 1 }],
        payments: [],
        idempotencyKey: `inv_fail_noncredit_${runId}`,
      })
    ).rejects.toThrow("not authorized for credit billing");
  });

  it("should rollback transaction and not burn invoice sequence if stock is insufficient", async () => {
    const currentStockA = await stockService.getBalance(productAId, shopLocId);
    const excessQty = currentStockA + 500;

    // Request more than available with full cash payment to test stock deduction rollback
    await expect(
      billingService.finalizeInvoice(UserRole.SHOP, {
        locationId: shopLocId,
        partyId: null,
        items: [{ productId: productAId, qty: excessQty }],
        payments: [{ mode: PaymentMode.CASH, amountPaise: excessQty * 10000 }],
        idempotencyKey: `inv_fail_stock_${runId}`,
      })
    ).rejects.toThrow("Insufficient stock");

    // Stock balance unchanged
    const afterStockA = await stockService.getBalance(productAId, shopLocId);
    expect(afterStockA).toBe(currentStockA);
  });

  it("should cancel finalized invoice (Admin only), issue Credit Note, and restore stock", async () => {
    // 1. Create a finalized invoice with 5 units of Product A
    const beforeCancelBalA = await stockService.getBalance(productAId, shopLocId);

    const invoice = await billingService.finalizeInvoice(UserRole.SHOP, {
      locationId: shopLocId,
      partyId: approvedPartyId,
      items: [{ productId: productAId, qty: 5 }],
      payments: [],
      idempotencyKey: `inv_cancel_prep_${runId}`,
    });

    const midBalA = await stockService.getBalance(productAId, shopLocId);
    expect(midBalA).toBe(beforeCancelBalA - 5);

    // 2. Non-admin role cannot cancel
    await expect(
      billingService.cancelInvoice(UserRole.SHOP, {
        invoiceId: invoice.id,
        reason: "Customer returned items",
      })
    ).rejects.toThrow(ForbiddenError);

    // 3. Super Admin cancels invoice
    const { invoice: cancelled, creditNoteId } = await billingService.cancelInvoice(
      UserRole.SUPER_ADMIN,
      {
        invoiceId: invoice.id,
        reason: "Client order cancellation approved by owner",
      }
    );

    expect(cancelled.status).toBe(InvoiceStatus.CANCELLED);
    expect(creditNoteId).toBeDefined();

    // Verify Credit Note
    const creditNote = await prisma.creditNote.findUnique({
      where: { id: creditNoteId },
    });
    expect(creditNote).not.toBeNull();
    expect(creditNote!.number).toMatch(/^CN\/\d{2}-\d{2}\/\d{6}$/);
    expect(creditNote!.totalPaise).toBe(invoice.totalPaise);

    // Verify stock restored via SALE_CANCEL counter-movement
    const restoredBalA = await stockService.getBalance(productAId, shopLocId);
    expect(restoredBalA).toBe(beforeCancelBalA); // Exactly restored!

    // Verify party ledger has credit entry offsetting the invoice
    const cnLedger = await prisma.ledgerEntry.findFirst({
      where: {
        partyId: approvedPartyId,
        referenceId: creditNoteId,
        kind: LedgerKind.CREDIT_NOTE,
      },
    });
    expect(cnLedger).not.toBeNull();
    expect(cnLedger!.creditPaise).toBe(invoice.totalPaise);

    // 4. Cannot cancel an already cancelled invoice
    await expect(
      billingService.cancelInvoice(UserRole.SUPER_ADMIN, {
        invoiceId: invoice.id,
        reason: "Second cancellation attempt",
      })
    ).rejects.toThrow("Only FINAL invoices can be cancelled");
  });

  it("should generate sequential gapless invoice numbers under concurrent finalizations", async () => {
    // Launch 5 parallel finalizations of 1 unit of Product B
    const results = await Promise.all(
      Array.from({ length: 5 }).map((_, idx) =>
        billingService.finalizeInvoice(UserRole.SHOP, {
          locationId: shopLocId,
          partyId: approvedPartyId,
          items: [{ productId: productBId, qty: 1 }],
          payments: [],
          idempotencyKey: `concurrent_inv_${runId}_${idx}`,
        })
      )
    );

    const numbers = results.map((r) => r.number);
    const uniqueNumbers = new Set(numbers);
    expect(uniqueNumbers.size).toBe(5); // Strictly gapless and unique
  });
});
