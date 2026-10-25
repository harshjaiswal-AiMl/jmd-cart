import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { reportsService } from "@/modules/reports/reports.service";
import { partyService } from "@/modules/party/party.service";
import {
  UserRole,
  PartyType,
  LedgerKind,
} from "@prisma/client";
import { ForbiddenError } from "@/modules/auth/permissions";

describe("Task 2.10 Integration Tests: Outstanding & Ageing Reports (FIFO Bucketing)", () => {
  const testPrefix = "TEST-AGEING-";

  let adminUser: { id: string; role: UserRole; name: string };
  let accountsUser: { id: string; role: UserRole; name: string };
  let salespersonUser: { id: string; role: UserRole; name: string };
  let godownUser: { id: string; role: UserRole; name: string };
  let shopUser: { id: string; role: UserRole; name: string };

  const cleanup = async () => {
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

    salespersonUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.SALESPERSON },
      select: { id: true, role: true, name: true },
    });

    godownUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.GODOWN },
      select: { id: true, role: true, name: true },
    });

    shopUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.SHOP },
      select: { id: true, role: true, name: true },
    });

    await cleanup();
  });

  afterEach(async () => {
    await cleanup();
  });

  it("calculates exact FIFO bucket allocations across 0-15, 16-30, 31-60, and 60+ day intervals", async () => {
    // Create test retailer party
    const party = await partyService.createParty(UserRole.SUPER_ADMIN, adminUser.id, {
      name: `${testPrefix}Kisan Trading Co`,
      type: PartyType.RETAILER,
      phone: "9876543101",
      creditEnabled: true,
      creditLimitPaise: 5000000, // ₹50,000
      creditDays: 30,
      active: true,
    });

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // 1. Post debit 1 (65 days ago): ₹100
    await prisma.ledgerEntry.create({
      data: {
        partyId: party.id,
        kind: LedgerKind.INVOICE,
        debitPaise: 10000,
        creditPaise: 0,
        createdAt: new Date(now - 65 * dayMs),
      },
    });

    // 2. Post debit 2 (40 days ago): ₹150
    await prisma.ledgerEntry.create({
      data: {
        partyId: party.id,
        kind: LedgerKind.INVOICE,
        debitPaise: 15000,
        creditPaise: 0,
        createdAt: new Date(now - 40 * dayMs),
      },
    });

    // 3. Post debit 3 (20 days ago): ₹200
    await prisma.ledgerEntry.create({
      data: {
        partyId: party.id,
        kind: LedgerKind.INVOICE,
        debitPaise: 20000,
        creditPaise: 0,
        createdAt: new Date(now - 20 * dayMs),
      },
    });

    // 4. Post debit 4 (5 days ago): ₹250
    await prisma.ledgerEntry.create({
      data: {
        partyId: party.id,
        kind: LedgerKind.INVOICE,
        debitPaise: 25000,
        creditPaise: 0,
        createdAt: new Date(now - 5 * dayMs),
      },
    });

    // 5. Post partial credit payment of ₹40 (4,000 paise) 2 days ago
    // Total debit = ₹700 (70,000 paise). Total credit = ₹40 (4,000 paise).
    // FIFO allocation: ₹4,000 settles against the oldest entry (65 days ago, ₹100).
    // Remaining in 60+ days bucket = ₹60 (6,000 paise).
    await prisma.ledgerEntry.create({
      data: {
        partyId: party.id,
        kind: LedgerKind.RECEIPT,
        debitPaise: 0,
        creditPaise: 4000,
        createdAt: new Date(now - 2 * dayMs),
      },
    });

    const report = await reportsService.getPartyAgeingReport(adminUser.role, {
      search: party.name,
    });

    expect(report.rows.length).toBe(1);
    const row = report.rows[0];

    expect(row.partyId).toBe(party.id);
    expect(row.totalOutstandingPaise).toBe(66000); // ₹660 total net outstanding

    // Check individual FIFO buckets
    expect(row.bucket60PlusPaise).toBe(6000); // 10000 - 4000 = 6000 paise (₹60)
    expect(row.bucket31_60Paise).toBe(15000); // ₹150
    expect(row.bucket16_30Paise).toBe(20000); // ₹200
    expect(row.bucket0_15Paise).toBe(25000); // ₹250

    // Sum of all 4 buckets MUST exactly equal total outstanding
    const sumBuckets =
      row.bucket0_15Paise +
      row.bucket16_30Paise +
      row.bucket31_60Paise +
      row.bucket60PlusPaise;
    expect(sumBuckets).toBe(row.totalOutstandingPaise);

    // Oldest debt is ~65 days old; party has 30 credit days -> overdue by ~35 days
    expect(row.isOverdue).toBe(true);
    expect(row.overdueDays).toBeGreaterThanOrEqual(34);
    expect(row.isOverLimit).toBe(false); // Outstanding ₹660 < limit ₹50,000
  });

  it("identifies over-limit parties and calculates breach amounts", async () => {
    const party = await partyService.createParty(UserRole.SUPER_ADMIN, adminUser.id, {
      name: `${testPrefix}Overlimit Store`,
      type: PartyType.RETAILER,
      phone: "9876543102",
      creditEnabled: true,
      creditLimitPaise: 20000, // ₹200 limit
      creditDays: 15,
      active: true,
    });

    // Debit of ₹300 (exceeds ₹200 limit by ₹100) 10 days ago
    await prisma.ledgerEntry.create({
      data: {
        partyId: party.id,
        kind: LedgerKind.INVOICE,
        debitPaise: 30000,
        creditPaise: 0,
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
    });

    const report = await reportsService.getPartyAgeingReport(adminUser.role, {
      search: party.name,
    });

    const row = report.rows[0];
    expect(row.totalOutstandingPaise).toBe(30000);
    expect(row.isOverLimit).toBe(true);
    expect(row.limitExceededByPaise).toBe(10000); // ₹100 over limit
    expect(row.isOverdue).toBe(false); // 10 days <= 15 creditDays
    expect(row.bucket0_15Paise).toBe(30000);
  });

  it("handles advance payments and settled zero-balance accounts", async () => {
    // 1. Advance paying customer (credit > debit)
    const advanceParty = await partyService.createParty(UserRole.SUPER_ADMIN, adminUser.id, {
      name: `${testPrefix}Advance Customer`,
      type: PartyType.CUSTOMER,
      phone: "9876543103",
      creditEnabled: false,
      active: true,
    });

    await prisma.ledgerEntry.create({
      data: {
        partyId: advanceParty.id,
        kind: LedgerKind.RECEIPT,
        debitPaise: 0,
        creditPaise: 15000, // ₹150 advance
        createdAt: new Date(),
      },
    });

    const report = await reportsService.getPartyAgeingReport(adminUser.role, {
      search: advanceParty.name,
    });

    const row = report.rows[0];
    expect(row.totalOutstandingPaise).toBe(-15000);
    expect(row.advancePaise).toBe(15000);
    expect(row.bucket0_15Paise).toBe(0);
    expect(row.bucket16_30Paise).toBe(0);
    expect(row.bucket31_60Paise).toBe(0);
    expect(row.bucket60PlusPaise).toBe(0);
    expect(row.isOverdue).toBe(false);
    expect(row.isOverLimit).toBe(false);
  });

  it("filters correctly by overdueOnly, overLimitOnly, and party type", async () => {
    // Party A: Overdue
    const partyA = await partyService.createParty(UserRole.SUPER_ADMIN, adminUser.id, {
      name: `${testPrefix}Filter Overdue`,
      type: PartyType.RETAILER,
      creditEnabled: true,
      creditLimitPaise: 1000000,
      creditDays: 10,
      active: true,
    });
    await prisma.ledgerEntry.create({
      data: {
        partyId: partyA.id,
        kind: LedgerKind.INVOICE,
        debitPaise: 5000,
        creditPaise: 0,
        createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), // 25 days old (overdue > 10)
      },
    });

    // Party B: Over limit but not overdue
    const partyB = await partyService.createParty(UserRole.SUPER_ADMIN, adminUser.id, {
      name: `${testPrefix}Filter Overlimit`,
      type: PartyType.WHOLESALER,
      creditEnabled: true,
      creditLimitPaise: 1000, // ₹10 limit
      creditDays: 30,
      active: true,
    });
    await prisma.ledgerEntry.create({
      data: {
        partyId: partyB.id,
        kind: LedgerKind.INVOICE,
        debitPaise: 5000, // ₹50 (over limit)
        creditPaise: 0,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days old (not overdue)
      },
    });

    // Test overdueOnly filter
    const overdueReport = await reportsService.getPartyAgeingReport(adminUser.role, {
      search: testPrefix,
      overdueOnly: true,
    });
    expect(overdueReport.rows.some((r) => r.partyId === partyA.id)).toBe(true);
    expect(overdueReport.rows.some((r) => r.partyId === partyB.id)).toBe(false);

    // Test overLimitOnly filter
    const overLimitReport = await reportsService.getPartyAgeingReport(adminUser.role, {
      search: testPrefix,
      overLimitOnly: true,
    });
    expect(overLimitReport.rows.some((r) => r.partyId === partyB.id)).toBe(true);
    expect(overLimitReport.rows.some((r) => r.partyId === partyA.id)).toBe(false);

    // Test type filter
    const wholesalerReport = await reportsService.getPartyAgeingReport(adminUser.role, {
      search: testPrefix,
      type: PartyType.WHOLESALER,
    });
    expect(wholesalerReport.rows.some((r) => r.partyId === partyB.id)).toBe(true);
    expect(wholesalerReport.rows.some((r) => r.partyId === partyA.id)).toBe(false);
  });

  it("enforces RBAC permissions on viewing accounts ageing report", async () => {
    // SUPER_ADMIN and ACCOUNTS roles allowed
    await expect(
      reportsService.getPartyAgeingReport(adminUser.role)
    ).resolves.toBeDefined();

    await expect(
      reportsService.getPartyAgeingReport(accountsUser.role)
    ).resolves.toBeDefined();

    // SALESPERSON, GODOWN, SHOP roles blocked
    await expect(
      reportsService.getPartyAgeingReport(salespersonUser.role)
    ).rejects.toThrow(ForbiddenError);

    await expect(
      reportsService.getPartyAgeingReport(godownUser.role)
    ).rejects.toThrow(ForbiddenError);

    await expect(
      reportsService.getPartyAgeingReport(shopUser.role)
    ).rejects.toThrow(ForbiddenError);
  });
});
