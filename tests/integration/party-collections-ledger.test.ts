import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { partyService } from "@/modules/party/party.service";
import { PartyType, UserRole, LocationType } from "@prisma/client";
import { ForbiddenError } from "@/modules/auth/permissions";
import { formatCollectionReceiptForEscPos } from "@/lib/escpos-invoice";

describe("Task 2.6 Integration Tests: Collections & Party Ledger Statement", () => {
  const testPartyPrefix = "TEST-COLL-";

  let adminUser: { id: string; role: UserRole; name: string };
  let salesUser: { id: string; role: UserRole; name: string };
  let accountsUser: { id: string; role: UserRole; name: string };
  let godownUser: { id: string; role: UserRole; name: string };
  let testVanLocation: { id: string; name: string };

  const cleanup = async () => {
    const parties = await prisma.party.findMany({
      where: {
        name: { startsWith: testPartyPrefix },
      },
    });

    if (parties.length > 0) {
      const ids = parties.map((p) => p.id);
      await prisma.payment.deleteMany({ where: { partyId: { in: ids } } });
      await prisma.ledgerEntry.deleteMany({ where: { partyId: { in: ids } } });
      await prisma.party.deleteMany({ where: { id: { in: ids } } });
    }
  };

  beforeEach(async () => {
    await cleanup();

    adminUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.SUPER_ADMIN },
      select: { id: true, role: true, name: true },
    });

    salesUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.SALESPERSON },
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

    testVanLocation = await prisma.location.upsert({
      where: { id: "test-van-coll-01" },
      update: { active: true },
      create: {
        id: "test-van-coll-01",
        name: "Collection Test Van (BR-19-T-1111)",
        type: LocationType.VAN,
        assignedUserId: salesUser.id,
        active: true,
      },
    });
  });

  afterEach(async () => {
    await cleanup();
  });

  it("should record collection, issue gapless receipt number, create ledger entry, and update outstanding", async () => {
    // 1. Create party with ₹10,000 opening outstanding
    const party = await partyService.createParty(UserRole.SUPER_ADMIN, adminUser.id, {
      name: `${testPartyPrefix}Shree Ram General Store`,
      type: PartyType.CUSTOMER,
      phone: "9876543210",
      creditEnabled: true,
      creditLimitPaise: 5000000, // ₹50,000
      creditDays: 15,
      openingOutstandingPaise: 1000000, // ₹10,000 Dr
      active: true,
    });

    expect(party.outstandingPaise).toBe(1000000);

    // 2. Record cash collection of ₹4,000 on van route by salesperson
    const collectionReceipt = await partyService.recordCollection(
      UserRole.SALESPERSON,
      salesUser.id,
      {
        partyId: party.id,
        amountPaise: 400000, // ₹4,000
        mode: "CASH",
        vanLocationId: testVanLocation.id,
        notes: "On-route cash collection at Bazar",
      }
    );

    // 3. Verify receipt details & gapless sequence format
    expect(collectionReceipt.id).toBeDefined();
    expect(collectionReceipt.receiptNo).toMatch(/^REC\/\d{2}-\d{2}\/\d{6}$/);
    expect(collectionReceipt.amountPaise).toBe(400000);
    expect(collectionReceipt.mode).toBe("CASH");
    expect(collectionReceipt.partyId).toBe(party.id);
    expect(collectionReceipt.previousOutstandingPaise).toBe(1000000);
    expect(collectionReceipt.currentOutstandingPaise).toBe(600000); // ₹6,000 left
    expect(collectionReceipt.vanLocationId).toBe(testVanLocation.id);
    expect(collectionReceipt.collectedById).toBe(salesUser.id);

    // 4. Verify Payment row in database
    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: collectionReceipt.id },
    });
    expect(payment.receiptNo).toBe(collectionReceipt.receiptNo);
    expect(payment.partyId).toBe(party.id);
    expect(payment.amountPaise).toBe(400000);
    expect(payment.mode).toBe("CASH");
    expect(payment.vanLocationId).toBe(testVanLocation.id);
    expect(payment.notes).toBe("On-route cash collection at Bazar");
    expect(payment.receivedBy).toBe(salesUser.id);

    // 5. Verify LedgerEntry row in database
    const ledgerEntry = await prisma.ledgerEntry.findFirstOrThrow({
      where: {
        partyId: party.id,
        referenceId: collectionReceipt.receiptNo,
      },
    });
    expect(ledgerEntry.kind).toBe("RECEIPT");
    expect(ledgerEntry.referenceType).toBe("RECEIPT");
    expect(ledgerEntry.debitPaise).toBe(0);
    expect(ledgerEntry.creditPaise).toBe(400000);

    // 6. Verify live party outstanding recalculation
    const updatedParty = await partyService.getPartyById(UserRole.SUPER_ADMIN, party.id);
    expect(updatedParty?.outstandingPaise).toBe(600000);
  });

  it("should assign strictly consecutive sequence numbers to back-to-back collections", async () => {
    const party = await partyService.createParty(UserRole.SUPER_ADMIN, adminUser.id, {
      name: `${testPartyPrefix}Gupta Traders`,
      type: PartyType.CUSTOMER,
      openingOutstandingPaise: 2000000,
      active: true,
    });

    const c1 = await partyService.recordCollection(UserRole.ACCOUNTS, accountsUser.id, {
      partyId: party.id,
      amountPaise: 50000,
      mode: "UPI",
    });

    const c2 = await partyService.recordCollection(UserRole.ACCOUNTS, accountsUser.id, {
      partyId: party.id,
      amountPaise: 75000,
      mode: "CASH",
    });

    const num1 = parseInt(c1.receiptNo.split("/")[2], 10);
    const num2 = parseInt(c2.receiptNo.split("/")[2], 10);
    expect(num2).toBe(num1 + 1);
  });

  it("should enforce authorization rules for recording collections and viewing ledgers", async () => {
    const party = await partyService.createParty(UserRole.SUPER_ADMIN, adminUser.id, {
      name: `${testPartyPrefix}Auth Check Kirana`,
      type: PartyType.CUSTOMER,
      openingOutstandingPaise: 500000,
      active: true,
    });

    // GODOWN user must be denied
    await expect(
      partyService.recordCollection(UserRole.GODOWN, godownUser.id, {
        partyId: party.id,
        amountPaise: 100000,
        mode: "CASH",
      })
    ).rejects.toThrow(ForbiddenError);

    await expect(
      partyService.getPartyLedgerStatement(UserRole.GODOWN, {
        partyId: party.id,
      })
    ).rejects.toThrow(ForbiddenError);

    // SALESPERSON & ACCOUNTS must be permitted
    const resSales = await partyService.recordCollection(
      UserRole.SALESPERSON,
      salesUser.id,
      {
        partyId: party.id,
        amountPaise: 100000,
        mode: "CASH",
      }
    );
    expect(resSales.receiptNo).toBeDefined();

    const statement = await partyService.getPartyLedgerStatement(UserRole.ACCOUNTS, {
      partyId: party.id,
    });
    expect(statement.party.id).toBe(party.id);
  });

  it("should generate complete party ledger statement with chronological running balances", async () => {
    // 1. Create party with ₹5,000 opening balance
    const party = await partyService.createParty(UserRole.SUPER_ADMIN, adminUser.id, {
      name: `${testPartyPrefix}Mithila Provision Stores`,
      type: PartyType.CUSTOMER,
      openingOutstandingPaise: 500000, // ₹5,000 Dr
      active: true,
    });

    // 2. Add an invoice ledger entry (₹3,000 Dr)
    await prisma.ledgerEntry.create({
      data: {
        partyId: party.id,
        kind: "INVOICE",
        debitPaise: 300000,
        creditPaise: 0,
        referenceType: "INVOICE",
        referenceId: "INV/26-27/000999",
      },
    });

    // 3. Record a receipt voucher (₹2,500 Cr)
    await partyService.recordCollection(UserRole.ACCOUNTS, accountsUser.id, {
      partyId: party.id,
      amountPaise: 250000,
      mode: "UPI",
    });

    // 4. Record another receipt voucher (₹1,500 Cr)
    await partyService.recordCollection(UserRole.ACCOUNTS, accountsUser.id, {
      partyId: party.id,
      amountPaise: 150000,
      mode: "CASH",
    });

    // 5. Query ledger statement
    const statement = await partyService.getPartyLedgerStatement(UserRole.SUPER_ADMIN, {
      partyId: party.id,
    });

    expect(statement.party.name).toBe(`${testPartyPrefix}Mithila Provision Stores`);
    expect(statement.openingBalancePaise).toBe(0); // Query without startDate has 0 as base opening
    expect(statement.entries.length).toBe(4); // OPENING, INVOICE, 2x RECEIPT

    // Chronological progression:
    // Entry 0: OPENING -> +₹5,000 -> Running: ₹5,000
    expect(statement.entries[0].kind).toBe("ADJUSTMENT");
    expect(statement.entries[0].referenceType).toBe("OPENING_BALANCE");
    expect(statement.entries[0].debitPaise).toBe(500000);
    expect(statement.entries[0].runningBalancePaise).toBe(500000);

    // Entry 1: INVOICE -> +₹3,000 -> Running: ₹8,000
    expect(statement.entries[1].kind).toBe("INVOICE");
    expect(statement.entries[1].debitPaise).toBe(300000);
    expect(statement.entries[1].runningBalancePaise).toBe(800000);

    // Entry 2: RECEIPT -> -₹2,500 -> Running: ₹5,500
    expect(statement.entries[2].kind).toBe("RECEIPT");
    expect(statement.entries[2].creditPaise).toBe(250000);
    expect(statement.entries[2].runningBalancePaise).toBe(550000);

    // Entry 3: RECEIPT -> -₹1,500 -> Running: ₹4,000
    expect(statement.entries[3].kind).toBe("RECEIPT");
    expect(statement.entries[3].creditPaise).toBe(150000);
    expect(statement.entries[3].runningBalancePaise).toBe(400000);

    // Aggregates
    expect(statement.totalDebitPaise).toBe(800000);
    expect(statement.totalCreditPaise).toBe(400000);
    expect(statement.closingBalancePaise).toBe(400000); // ₹4,000 Dr
  });

  it("should calculate opening balance properly when startDate filter is applied", async () => {
    const party = await partyService.createParty(UserRole.SUPER_ADMIN, adminUser.id, {
      name: `${testPartyPrefix}Date Filter Test Stores`,
      type: PartyType.CUSTOMER,
      openingOutstandingPaise: 100000, // ₹1,000 Dr
      active: true,
    });

    // Backdate the opening balance entry to 2 days ago so it falls before twoHoursAgo
    const twoDaysAgo = new Date(Date.now() - 48 * 3600 * 1000);
    await prisma.ledgerEntry.updateMany({
      where: { partyId: party.id, referenceType: "OPENING_BALANCE" },
      data: { createdAt: twoDaysAgo },
    });

    // Simulate entry yesterday
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
    await prisma.ledgerEntry.create({
      data: {
        partyId: party.id,
        kind: "INVOICE",
        debitPaise: 200000,
        creditPaise: 0,
        referenceType: "INVOICE",
        referenceId: "INV-PAST-01",
        createdAt: yesterday,
      },
    });

    // Simulate entry today (1 minute ago)
    await partyService.recordCollection(UserRole.ACCOUNTS, accountsUser.id, {
      partyId: party.id,
      amountPaise: 50000,
      mode: "CASH",
    });

    // Query ledger starting from 2 hours ago
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000);
    const statement = await partyService.getPartyLedgerStatement(UserRole.SUPER_ADMIN, {
      partyId: party.id,
      startDate: twoHoursAgo,
    });

    // Prior entries: Opening (₹1,000) + Yesterday Invoice (₹2,000) = ₹3,000 Opening Balance
    expect(statement.openingBalancePaise).toBe(300000);
    expect(statement.entries.length).toBe(1); // Only today's receipt
    expect(statement.entries[0].kind).toBe("RECEIPT");
    expect(statement.closingBalancePaise).toBe(250000); // ₹3,000 - ₹500 = ₹2,500
  });

  it("should format collection receipt for ESC/POS thermal printer correctly", async () => {
    const party = await partyService.createParty(UserRole.SUPER_ADMIN, adminUser.id, {
      name: `${testPartyPrefix}Thermal Print Store`,
      type: PartyType.CUSTOMER,
      phone: "9876500011",
      openingOutstandingPaise: 1500000,
      active: true,
    });

    const receipt = await partyService.recordCollection(
      UserRole.SALESPERSON,
      salesUser.id,
      {
        partyId: party.id,
        amountPaise: 500000,
        mode: "CASH",
        vanLocationId: testVanLocation.id,
        notes: "Cash on delivery receipt",
      }
    );

    const business = {
      legalName: "JMD TRADERS",
      tradeName: "JMD TRADERS",
      address: "Main Road, Saharsa, Bihar 852201",
      phone: "+91 94312 00000",
      email: "admin@jmdcart.in",
      gstin: "10ABCDE1234F1Z5",
      fssai: "10421000000001",
      upiId: "jmd@upi",
    };

    const bytes = formatCollectionReceiptForEscPos(receipt, business, { paperWidth: 58 });

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(100);

    const decoded = String.fromCharCode(...Array.from(bytes));
    expect(decoded).toContain("JMD TRADERS");
    expect(decoded).toContain("PAYMENT RECEIPT");
    expect(decoded).toContain(receipt.receiptNo);
    expect(decoded).toContain("Rs.5000.00"); // Sanitized rupee symbol
    expect(decoded).toContain("Rs.10000.00"); // Current outstanding
    expect(decoded).toContain(salesUser.name);
  });
});
