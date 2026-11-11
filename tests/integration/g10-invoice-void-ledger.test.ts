import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { billingService } from "@/modules/billing/billing.service";
import { stockService } from "@/modules/stock/stock.service";
import { invoiceTotalsService } from "@/modules/billing/invoice-totals.service";
import {
  UserRole,
  InvoiceStatus,
  PaymentMode,
  PartyType,
  MovementType,
} from "@prisma/client";

describe("G10: Invoice Void / Cancel Ledger & Stock Reversal", () => {
  const runId = Date.now().toString().slice(-6);
  let locId: string;
  let prodId: string;
  let cashPartyId: string;
  let creditPartyId: string;
  let actorId: string;

  beforeAll(async () => {
    const loc = await prisma.location.upsert({
      where: { id: `loc-g10-${runId}` },
      update: {},
      create: {
        id: `loc-g10-${runId}`,
        name: `G10 Shop ${runId}`,
        type: "SHOP",
      },
    });
    locId = loc.id;

    const user = await prisma.user.create({
      data: {
        phone: `98000${runId.slice(-5)}`,
        name: `G10 Admin ${runId}`,
        role: UserRole.SUPER_ADMIN,
        passwordHash: "hash",
      },
    });
    actorId = user.id;

    const prod = await prisma.product.create({
      data: {
        name: `G10 Item ${runId}`,
        shortCode: `G10_${runId}`,
        hsn: "2106",
        gstRateBp: 500,
        mrpPaise: 10000,
        priceAPaise: 8000,
        priceBPaise: 8500,
        priceCPaise: 9000,
        packSize: 10,
      },
    });
    prodId = prod.id;

    await stockService.postMovement({
      type: MovementType.PURCHASE_RECEIPT,
      productId: prodId,
      toLocationId: locId,
      qty: 50,
      idempotencyKey: `g10_init_${runId}`,
      reason: "G10 seed stock",
    });

    const pCash = await prisma.party.create({
      data: {
        name: `G10 Cash Party ${runId}`,
        type: PartyType.RETAILER,
        creditEnabled: false,
      },
    });
    cashPartyId = pCash.id;

    const pCredit = await prisma.party.create({
      data: {
        name: `G10 Credit Party ${runId}`,
        type: PartyType.RETAILER,
        creditEnabled: true,
        creditLimitPaise: 500000,
      },
    });
    creditPartyId = pCredit.id;
  });

  async function getPartyNetBalance(partyId: string): Promise<number> {
    const entries = await prisma.ledgerEntry.findMany({ where: { partyId } });
    return entries.reduce((sum, e) => sum + e.debitPaise - e.creditPaise, 0);
  }

  it("reverses CASH invoice exact ledger balance back to 0 (no free credit), restores stock, blocks double-void, and excludes from totals", async () => {
    const preBalance = await getPartyNetBalance(cashPartyId);
    expect(preBalance).toBe(0);

    const inv = await billingService.finalizeInvoice(
      UserRole.SUPER_ADMIN,
      {
        channel: "SHOP",
        locationId: locId,
        partyId: cashPartyId,
        items: [{ productId: prodId, qty: 4 }],
        payments: [{ mode: PaymentMode.CASH, amountPaise: 34000 }],
        idempotencyKey: `g10_cash_${runId}`,
      },
      actorId
    );

    const midStock = await prisma.stockBalance.findUnique({
      where: { productId_locationId: { productId: prodId, locationId: locId } },
    });
    expect(midStock?.qty).toBe(46);
    expect(await getPartyNetBalance(cashPartyId)).toBe(0);

    // Void/cancel CASH invoice
    const res = await billingService.cancelInvoice(
      UserRole.SUPER_ADMIN,
      { invoiceId: inv.id, reason: "Wrong party billed" },
      actorId
    );
    expect(res.invoice.status).toBe(InvoiceStatus.CANCELLED);
    expect(res.invoice.number).toBe(inv.number);

    // Critical: net balance MUST revert to 0 (NOT -totalPaise!)
    expect(await getPartyNetBalance(cashPartyId)).toBe(0);

    // Stock restored via SALE_CANCEL
    const afterStock = await prisma.stockBalance.findUnique({
      where: { productId_locationId: { productId: prodId, locationId: locId } },
    });
    expect(afterStock?.qty).toBe(50);

    // Double-void blocked
    await expect(
      billingService.cancelInvoice(
        UserRole.SUPER_ADMIN,
        { invoiceId: inv.id, reason: "Duplicate void" },
        actorId
      )
    ).rejects.toThrow(/CANCELLED/i);

    // Totals exclude voided bill
    const summary = await invoiceTotalsService.getInvoiceTotals({ locationId: locId });
    expect(summary.totalAmountPaise).toBe(0);
    expect(summary.cancelledCount).toBeGreaterThanOrEqual(1);
  });

  it("reverses CREDIT invoice net balance back to 0", async () => {
    expect(await getPartyNetBalance(creditPartyId)).toBe(0);
    const inv = await billingService.finalizeInvoice(
      UserRole.SUPER_ADMIN,
      {
        channel: "SHOP",
        locationId: locId,
        partyId: creditPartyId,
        items: [{ productId: prodId, qty: 2 }],
        payments: [],
        idempotencyKey: `g10_credit_${runId}`,
      },
      actorId
    );
    expect(await getPartyNetBalance(creditPartyId)).toBe(inv.totalPaise);

    await billingService.cancelInvoice(
      UserRole.SUPER_ADMIN,
      { invoiceId: inv.id, reason: "Customer cancelled order" },
      actorId
    );
    expect(await getPartyNetBalance(creditPartyId)).toBe(0);
  });

  it("reverses UPI invoice net balance and stock cleanly, enforces SHOP invoice.void permission, and rejects double void", async () => {
    const preStock = await prisma.stockBalance.findUnique({ where: { productId_locationId: { productId: prodId, locationId: locId } } });
    const inv = await billingService.finalizeInvoice(
      UserRole.SUPER_ADMIN,
      {
        channel: "SHOP",
        locationId: locId,
        partyId: cashPartyId,
        items: [{ productId: prodId, qty: 3 }],
        payments: [{ mode: PaymentMode.UPI, amountPaise: 25500 }],
        idempotencyKey: `g10_upi_${runId}`,
      },
      actorId
    );
    const midStock = await prisma.stockBalance.findUnique({ where: { productId_locationId: { productId: prodId, locationId: locId } } });
    expect(midStock?.qty).toBe((preStock?.qty ?? 0) - 3);
    expect(await getPartyNetBalance(cashPartyId)).toBe(0);

    await expect(
      billingService.cancelInvoice(UserRole.SHOP, { invoiceId: inv.id, reason: "Unauthorized attempt" }, actorId)
    ).rejects.toThrow();

    const voidRes = await billingService.cancelInvoice(
      UserRole.SUPER_ADMIN,
      { invoiceId: inv.id, reason: "Wrong UPI entry R2" },
      actorId
    );
    expect(voidRes.invoice.status).toBe(InvoiceStatus.CANCELLED);
    const postStock = await prisma.stockBalance.findUnique({ where: { productId_locationId: { productId: prodId, locationId: locId } } });
    expect(postStock?.qty).toBe(preStock?.qty ?? 0);
    expect(await getPartyNetBalance(cashPartyId)).toBe(0);

    await expect(
      billingService.cancelInvoice(UserRole.SUPER_ADMIN, { invoiceId: inv.id, reason: "Double void attempt" }, actorId)
    ).rejects.toThrow();
  });
});
