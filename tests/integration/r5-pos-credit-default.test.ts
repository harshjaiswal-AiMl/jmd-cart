import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { billingService } from "@/modules/billing/billing.service";
import { settingsService } from "@/modules/settings/settings.service";
import { partyRepository } from "@/modules/party/party.repository";
import { partyService } from "@/modules/party/party.service";
import { stockService } from "@/modules/stock/stock.service";
import {
  LocationType,
  MovementType,
  PartyType,
  PaymentMode,
  UserRole,
} from "@prisma/client";

describe("R5: Shop POS pos.creditAllParties setting & limit enforcement", () => {
  const runId = Date.now().toString().slice(-6);
  let shopLocId: string;
  let vanLocId: string;
  let prodId: string;
  let actorId: string;
  let noCreditZeroLimitPartyId: string;
  let limitedPartyId: string;

  beforeAll(async () => {
    const admin = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.SUPER_ADMIN },
    });
    actorId = admin.id;

    const shopLoc = await prisma.location.create({
      data: { name: `R5 Shop ${runId}`, type: LocationType.SHOP, active: true },
    });
    shopLocId = shopLoc.id;

    const vanLoc = await prisma.location.create({
      data: { name: `R5 Van ${runId}`, type: LocationType.VAN, active: true },
    });
    vanLocId = vanLoc.id;

    await prisma.vanDay.create({
      data: {
        vanLocationId: vanLocId,
        salespersonId: actorId,
        date: new Date(),
        issueSheetNo: `R5VAN${runId}`,
        status: "OPEN",
      },
    });

    const prod = await prisma.product.create({
      data: {
        shortCode: `R5SC${runId}`,
        name: `R5 Biscuit ${runId}`,
        mrpPaise: 10000,
        priceAPaise: 8500,
        priceBPaise: 8500,
        priceCPaise: 8500,
        gstRateBp: 500,
        active: true,
      },
    });
    prodId = prod.id;

    await stockService.postMovement({
      type: MovementType.PURCHASE_RECEIPT,
      productId: prodId,
      toLocationId: shopLocId,
      qty: 100,
      idempotencyKey: `r5_init_shop_${runId}`,
      reason: "R5 seed stock",
    });
    await stockService.postMovement({
      type: MovementType.PURCHASE_RECEIPT,
      productId: prodId,
      toLocationId: vanLocId,
      qty: 50,
      idempotencyKey: `r5_init_van_${runId}`,
      reason: "R5 van seed stock",
    });

    const pNoCredit = await prisma.party.create({
      data: {
        name: `R5 Unapproved ZeroLimit ${runId}`,
        type: PartyType.CUSTOMER,
        creditEnabled: false,
        creditLimitPaise: 0,
      },
    });
    noCreditZeroLimitPartyId = pNoCredit.id;

    const pLimited = await prisma.party.create({
      data: {
        name: `R5 Limited Party ${runId}`,
        type: PartyType.RETAILER,
        creditEnabled: false,
        creditLimitPaise: 15000, // Rs 150 limit
      },
    });
    limitedPartyId = pLimited.id;
  });

  afterAll(async () => {
    await settingsService.updatePosCreditAllParties(
      UserRole.SUPER_ADMIN,
      actorId,
      true
    );
  });

  it("defaults pos.creditAllParties to true and allows Shop POS credit for creditEnabled=false without mutating party rows", async () => {
    const ops = await settingsService.getPosOperationalSettings();
    expect(ops.creditAllParties).toBe(true);

    const inv = await billingService.finalizeInvoice(
      UserRole.SHOP,
      {
        channel: "SHOP",
        locationId: shopLocId,
        partyId: noCreditZeroLimitPartyId,
        items: [{ productId: prodId, qty: 2 }],
        payments: [],
        idempotencyKey: `r5_shop_ok_${runId}`,
      },
      actorId
    );
    expect(inv.totalPaise).toBeGreaterThan(0);

    // Party row creditEnabled must remain false
    const partyRow = await prisma.party.findUniqueOrThrow({
      where: { id: noCreditZeroLimitPartyId },
    });
    expect(partyRow.creditEnabled).toBe(false);

    // Payable increased, and collection reduces it
    const payableAfterBill = await partyRepository.getPartyOutstanding(
      noCreditZeroLimitPartyId
    );
    expect(payableAfterBill).toBe(inv.totalPaise);

    await partyService.recordCollection(
      UserRole.SHOP,
      actorId,
      {
        partyId: noCreditZeroLimitPartyId,
        amountPaise: 5000,
        mode: "CASH",
        notes: `r5_col_${runId}`,
      }
    );
    const payableAfterCol = await partyRepository.getPartyOutstanding(
      noCreditZeroLimitPartyId
    );
    expect(payableAfterCol).toBe(inv.totalPaise - 5000);
  });

  it("blocks Walk-in credit on Shop POS", async () => {
    await expect(
      billingService.finalizeInvoice(
        UserRole.SHOP,
        {
          channel: "SHOP",
          locationId: shopLocId,
          partyId: null,
          items: [{ productId: prodId, qty: 1 }],
          payments: [],
          idempotencyKey: `r5_walkin_${runId}`,
        },
        actorId
      )
    ).rejects.toThrow(/Walk-in/i);
  });

  it("enforces credit limit only when creditLimitPaise > 0", async () => {
    await expect(
      billingService.finalizeInvoice(
        UserRole.SHOP,
        {
          channel: "SHOP",
          locationId: shopLocId,
          partyId: limitedPartyId,
          items: [{ productId: prodId, qty: 3 }], // Rs 255 > Rs 150 limit
          payments: [],
          idempotencyKey: `r5_limit_block_${runId}`,
        },
        actorId
      )
    ).rejects.toThrow(/Credit limit of .*150\.00 exceeded/i);
  });

  it("keeps VAN channel strict per-party even when pos.creditAllParties is true", async () => {
    await expect(
      billingService.finalizeInvoice(
        UserRole.SALESPERSON,
        {
          channel: "VAN",
          locationId: vanLocId,
          partyId: noCreditZeroLimitPartyId,
          items: [{ productId: prodId, qty: 1 }],
          payments: [],
          idempotencyKey: `r5_van_strict_${runId}`,
        },
        actorId
      )
    ).rejects.toThrow(/not authorized for credit billing/i);
  });

  it("restores strict per-party behavior on Shop POS when pos.creditAllParties is turned off", async () => {
    await settingsService.updatePosCreditAllParties(
      UserRole.SUPER_ADMIN,
      actorId,
      false
    );

    await expect(
      billingService.finalizeInvoice(
        UserRole.SHOP,
        {
          channel: "SHOP",
          locationId: shopLocId,
          partyId: noCreditZeroLimitPartyId,
          items: [{ productId: prodId, qty: 1 }],
          payments: [],
          idempotencyKey: `r5_shop_off_block_${runId}`,
        },
        actorId
      )
    ).rejects.toThrow(/not authorized for credit billing/i);
  });
});
