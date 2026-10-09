import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { partyService } from "@/modules/party/party.service";
import { partyImportService } from "@/modules/party/party-import.service";
import { PartyType, UserRole } from "@prisma/client";
import { ForbiddenError } from "@/modules/auth/permissions";

describe("Task 2.1 Integration Tests: Party Master & Tally Import", () => {
  const testTallyPrefix = "TALLY-TEST-";

  const cleanup = async () => {
    const parties = await prisma.party.findMany({
      where: {
        OR: [
          { tallyRef: { startsWith: testTallyPrefix } },
          { name: { startsWith: "Test Party" } },
        ],
      },
    });

    if (parties.length > 0) {
      const ids = parties.map((p) => p.id);
      await prisma.ledgerEntry.deleteMany({ where: { partyId: { in: ids } } });
      await prisma.party.deleteMany({ where: { id: { in: ids } } });
    }
  };

  let adminUser: { id: string; role: UserRole };

  beforeEach(async () => {
    await cleanup();
    adminUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.SUPER_ADMIN },
      select: { id: true, role: true },
    });
  });

  afterEach(async () => {
    await cleanup();
  });

  describe("Party CRUD & Opening Balance Ledger Invariants", () => {
    it("should create party with credit terms and opening balance ledger entry", async () => {
      const party = await partyService.createParty(UserRole.SUPER_ADMIN, adminUser.id, {
        name: "Test Party Maa Kali Stores",
        type: PartyType.CUSTOMER,
        phone: "9876599901",
        creditEnabled: true,
        creditLimitPaise: 5000000, // ₹50,000
        creditDays: 15,
        openingOutstandingPaise: 1250000, // ₹12,500
        tallyRef: `${testTallyPrefix}01`,
        active: true,
      });

      expect(party.id).toBeDefined();
      expect(party.name).toBe("Test Party Maa Kali Stores");
      expect(party.creditLimitPaise).toBe(5000000);
      expect(party.creditDays).toBe(15);
      expect(party.outstandingPaise).toBe(1250000);

      // Verify opening balance ledger entry in database
      const ledgerEntry = await prisma.ledgerEntry.findFirst({
        where: { partyId: party.id, referenceType: "OPENING_BALANCE" },
      });
      expect(ledgerEntry).toBeDefined();
      expect(ledgerEntry?.debitPaise).toBe(1250000);
      expect(ledgerEntry?.creditPaise).toBe(0);
    });

    it("should correctly update party and reconcile opening balance", async () => {
      const party = await partyService.createParty(UserRole.SUPER_ADMIN, adminUser.id, {
        name: "Test Party Shyam Trader",
        type: PartyType.CUSTOMER,
        phone: "9876599902",
        creditEnabled: true,
        creditLimitPaise: 3000000,
        creditDays: 7,
        openingOutstandingPaise: 500000, // ₹5,000
        tallyRef: `${testTallyPrefix}02`,
        active: true,
      });

      // Update opening balance to ₹8,000 (800000 paise)
      const updated = await partyService.updateParty(UserRole.SUPER_ADMIN, adminUser.id, {
        id: party.id,
        creditLimitPaise: 4000000,
        openingOutstandingPaise: 800000,
      });

      expect(updated.creditLimitPaise).toBe(4000000);
      expect(updated.outstandingPaise).toBe(800000);

      const entries = await prisma.ledgerEntry.findMany({
        where: { partyId: party.id, referenceType: "OPENING_BALANCE" },
      });
      expect(entries.length).toBe(1);
      expect(entries[0].debitPaise).toBe(800000);
    });
  });

  describe("Tally CSV Bulk Import & Idempotency", () => {
    it("should import Tally export CSV with Sundry Debtors and Creditors", async () => {
      const csv = `name,parent,phone,gstin,creditLimit,creditDays,openingBalance,tallyRef
Test Party Gupta Kirana,Sundry Debtors,9876599911,10ABCDE1234F1Z5,50000,15,12000.00 Dr,${testTallyPrefix}IMP01
Test Party Britannia Depot,Sundry Creditors,9876599912,,0,0,45000.00 Cr,${testTallyPrefix}IMP02`;

      const result = await partyImportService.importTallyParties(
        UserRole.SUPER_ADMIN,
        adminUser.id,
        csv
      );

      expect(result.total).toBe(2);
      expect(result.created).toBe(2);
      expect(result.failed).toBe(0);

      // Verify Gupta Kirana (Customer debtor)
      const customer = await prisma.party.findFirst({
        where: { tallyRef: `${testTallyPrefix}IMP01` },
        include: { ledgerEntries: true },
      });
      expect(customer).toBeDefined();
      expect(customer?.type).toBe(PartyType.CUSTOMER);
      expect(customer?.creditEnabled).toBe(true);
      expect(customer?.creditLimitPaise).toBe(5000000); // ₹50,000 * 100
      expect(customer?.creditDays).toBe(15);
      expect(customer?.ledgerEntries[0].debitPaise).toBe(1200000); // 12000 Dr

      // Verify Britannia Depot (Supplier creditor)
      const supplier = await prisma.party.findFirst({
        where: { tallyRef: `${testTallyPrefix}IMP02` },
        include: { ledgerEntries: true },
      });
      expect(supplier).toBeDefined();
      expect(supplier?.type).toBe(PartyType.SUPPLIER);
      expect(supplier?.ledgerEntries[0].creditPaise).toBe(4500000); // 45000 Cr
    });

    it("should be idempotent: re-running the same Tally CSV updates existing records without creating duplicates", async () => {
      const csv = `name,parent,phone,gstin,creditLimit,creditDays,openingBalance,tallyRef
Test Party Idempotent Store,Sundry Debtors,9876599921,,20000,10,5000.00 Dr,${testTallyPrefix}IDEM01`;

      // Run 1
      const res1 = await partyImportService.importTallyParties(
        UserRole.SUPER_ADMIN,
        adminUser.id,
        csv
      );
      expect(res1.created).toBe(1);
      expect(res1.updated).toBe(0);

      // Run 2 (modified credit limit to 25,000)
      const csvUpdated = `name,parent,phone,gstin,creditLimit,creditDays,openingBalance,tallyRef
Test Party Idempotent Store,Sundry Debtors,9876599921,,25000,10,6000.00 Dr,${testTallyPrefix}IDEM01`;

      const res2 = await partyImportService.importTallyParties(
        UserRole.SUPER_ADMIN,
        adminUser.id,
        csvUpdated
      );
      expect(res2.created).toBe(0);
      expect(res2.updated).toBe(1);

      // Check database: only 1 party exists with updated limit
      const parties = await prisma.party.findMany({
        where: { tallyRef: `${testTallyPrefix}IDEM01` },
        include: { ledgerEntries: true },
      });
      expect(parties.length).toBe(1);
      expect(parties[0].creditLimitPaise).toBe(2500000);
      expect(parties[0].ledgerEntries.length).toBe(1);
      expect(parties[0].ledgerEntries[0].debitPaise).toBe(600000);
    });

    it("should catch row-level validation errors and continue processing valid rows", async () => {
      const csv = `name,parent,phone,gstin,creditLimit,creditDays,openingBalance,tallyRef
,Sundry Debtors,9876599931,,10000,5,0,${testTallyPrefix}ERR01
Test Party Bad Phone,Sundry Debtors,12345,,10000,5,0,${testTallyPrefix}ERR02
Test Party Valid,Sundry Debtors,9876599933,,10000,5,1000,${testTallyPrefix}VALID01`;

      const result = await partyImportService.importTallyParties(
        UserRole.SUPER_ADMIN,
        adminUser.id,
        csv
      );

      expect(result.total).toBe(3);
      expect(result.created).toBe(1);
      expect(result.failed).toBe(2);
      expect(result.errors.length).toBe(2);

      // Row 2 (missing name)
      expect(result.errors[0].row).toBe(2);
      expect(result.errors[0].message).toContain("name is required");

      // Row 3 (bad phone)
      expect(result.errors[1].row).toBe(3);
      expect(result.errors[1].column).toBe("Phone");
    });
  });

  describe("RBAC Permissions", () => {
    it("should allow SUPER_ADMIN and ACCOUNTS to access and manage parties", async () => {
      const adminSearch = await partyService.searchParties(UserRole.SUPER_ADMIN, {});
      expect(adminSearch.parties).toBeDefined();

      const accountsSearch = await partyService.searchParties(UserRole.ACCOUNTS, {});
      expect(accountsSearch.parties).toBeDefined();
    });

    it("should allow SHOP and SALESPERSON to view parties", async () => {
      const shopSearch = await partyService.searchParties(UserRole.SHOP, {});
      expect(shopSearch.parties).toBeDefined();

      const salesSearch = await partyService.searchParties(UserRole.SALESPERSON, {});
      expect(salesSearch.parties).toBeDefined();
    });

    it("should forbid GODOWN role from creating parties", async () => {
      await expect(
        partyService.createParty(UserRole.GODOWN, "godown-user-id", {
          name: "Test Party Forbidden",
          type: PartyType.CUSTOMER,
        })
      ).rejects.toThrow(ForbiddenError);
    });
  });
});
