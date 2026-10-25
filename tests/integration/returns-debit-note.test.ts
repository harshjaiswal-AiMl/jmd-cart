import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { returnsService } from "@/modules/returns/returns.service";
import { partyService } from "@/modules/party/party.service";
import {
  UserRole,
  PartyType,
  LocationType,
  MovementType,
  LedgerKind,
} from "@prisma/client";
import { ForbiddenError } from "@/modules/auth/permissions";

describe("Task 2.11 Integration Tests: Return to Company, Debit Notes & Stock-Wise Returns", () => {
  const testPrefix = "TEST-RETDN-";

  let adminUser: { id: string; role: UserRole; name: string };
  let godownUser: { id: string; role: UserRole; name: string };
  let accountsUser: { id: string; role: UserRole; name: string };
  let salesUser: { id: string; role: UserRole; name: string };
  let shopUser: { id: string; role: UserRole; name: string };
  let centralGodown: { id: string; name: string };
  let testSupplier: { id: string; name: string };
  let testProduct1: { id: string; name: string; mrpPaise: number | null; packSize: number };
  let testProduct2: { id: string; name: string; mrpPaise: number | null; packSize: number };

  const cleanup = async () => {
    // 1. Delete debit note items and debit notes linked to test suppliers
    const testParties = await prisma.party.findMany({
      where: { name: { startsWith: testPrefix } },
      select: { id: true },
    });
    const partyIds = testParties.map((p) => p.id);

    if (partyIds.length > 0) {
      const notes = await prisma.debitNote.findMany({
        where: { supplierId: { in: partyIds } },
        select: { id: true },
      });
      const noteIds = notes.map((n) => n.id);

      if (noteIds.length > 0) {
        await prisma.debitNoteItem.deleteMany({
          where: { debitNoteId: { in: noteIds } },
        });
        await prisma.debitNote.deleteMany({
          where: { id: { in: noteIds } },
        });
      }

      await prisma.ledgerEntry.deleteMany({
        where: { partyId: { in: partyIds } },
      });
      await prisma.party.deleteMany({
        where: { id: { in: partyIds } },
      });
    }
  };

  beforeEach(async () => {
    adminUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.SUPER_ADMIN },
      select: { id: true, role: true, name: true },
    });

    godownUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.GODOWN },
      select: { id: true, role: true, name: true },
    });

    accountsUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.ACCOUNTS },
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

    await cleanup();

    // Create test supplier party
    testSupplier = await partyService.createParty(UserRole.SUPER_ADMIN, adminUser.id, {
      name: `${testPrefix}Britannia Industries Depot`,
      type: PartyType.SUPPLIER,
      phone: "9876543888",
      gstin: "10AABCB1234F1Z1",
      address: "Industrial Area, Barauni, Bihar",
      active: true,
    });

    // Upsert persistent test products
    testProduct1 = await prisma.product.upsert({
      where: { id: "test-retdn-prod-1" },
      update: { mrpPaise: 4000, packSize: 12, gstRateBp: 1800, active: true },
      create: {
        id: "test-retdn-prod-1",
        name: `${testPrefix}Good Day Butter Cookies 120g`,
        shortCode: "RDN_GD_120",
        hsn: "19053100",
        gstRateBp: 1800, // 18%
        mrpPaise: 4000, // ₹40
        packSize: 12,
        packLabel: "12 pcs / ctn",
        active: true,
      },
    });

    testProduct2 = await prisma.product.upsert({
      where: { id: "test-retdn-prod-2" },
      update: { mrpPaise: 6000, packSize: 6, gstRateBp: 1200, active: true },
      create: {
        id: "test-retdn-prod-2",
        name: `${testPrefix}Treat Chocolate Cream 150g`,
        shortCode: "RDN_TREAT_150",
        hsn: "19053100",
        gstRateBp: 1200, // 12%
        mrpPaise: 6000, // ₹60
        packSize: 6,
        packLabel: "6 pcs / ctn",
        active: true,
      },
    });

    // Stock initial inventory in Central Godown
    await prisma.stockBalance.upsert({
      where: {
        productId_locationId: {
          productId: testProduct1.id,
          locationId: centralGodown.id,
        },
      },
      update: { qty: 500 },
      create: {
        productId: testProduct1.id,
        locationId: centralGodown.id,
        qty: 500,
      },
    });

    await prisma.stockBalance.upsert({
      where: {
        productId_locationId: {
          productId: testProduct2.id,
          locationId: centralGodown.id,
        },
      },
      update: { qty: 300 },
      create: {
        productId: testProduct2.id,
        locationId: centralGodown.id,
        qty: 300,
      },
    });
  });

  afterEach(async () => {
    await cleanup();
  });

  it("creates a GST Debit Note, generates gapless sequence, deducts inventory, and debits supplier ledger", async () => {
    const returnQty1 = 24; // 2 cartons of Good Day
    const returnQty2 = 12; // 2 cartons of Treat

    // Initial stock balances
    const balBefore1 = await prisma.stockBalance.findUniqueOrThrow({
      where: { productId_locationId: { productId: testProduct1.id, locationId: centralGodown.id } },
    });
    const balBefore2 = await prisma.stockBalance.findUniqueOrThrow({
      where: { productId_locationId: { productId: testProduct2.id, locationId: centralGodown.id } },
    });

    // Create Debit Note as Godown staff
    const debitNote = await returnsService.createDebitNote(
      godownUser.role,
      godownUser.id,
      {
        supplierId: testSupplier.id,
        locationId: centralGodown.id,
        reason: "DAMAGE",
        notes: "Cartons crushed during unloading at dock. Replacement agreed by depot.",
        items: [
          {
            productId: testProduct1.id,
            qty: returnQty1,
            unitPricePaise: 3200, // ₹32 purchase rate (80% MRP)
            batchNo: "BATCH-GD-991",
            reason: "Transit water damage",
          },
          {
            productId: testProduct2.id,
            qty: returnQty2,
            unitPricePaise: 4800, // ₹48 purchase rate (80% MRP)
            batchNo: "BATCH-TR-882",
            reason: "Crushed packs",
          },
        ],
      }
    );

    // 1. Verify Debit Note sequence format: DN/26-27/XXXXXX
    expect(debitNote.id).toBeDefined();
    expect(debitNote.number).toMatch(/^DN\/26-27\/\d{6}$/);
    expect(debitNote.reason).toBe("DAMAGE");
    expect(debitNote.supplierId).toBe(testSupplier.id);
    expect(debitNote.locationId).toBe(centralGodown.id);
    expect(debitNote.items.length).toBe(2);

    // 2. Financial calculation verification
    // Line 1: 24 pcs * ₹32 = ₹768.00 taxable (76,800 paise). GST 18% = ₹138.24 (13,824 paise). Total = ₹906.24 (90,624 paise).
    // Line 2: 12 pcs * ₹48 = ₹576.00 taxable (57,600 paise). GST 12% = ₹69.12 (6,912 paise). Total = ₹645.12 (64,512 paise).
    // Subtotal = ₹1,344.00 (134,400 paise).
    // Tax = ₹207.36 (20,736 paise).
    // Grand unrounded = ₹1,551.36 (155,136 paise).
    // Round-off to nearest rupee = -₹0.36 (-36 paise).
    // Total = ₹1,551.00 (155,100 paise).
    expect(debitNote.subtotalPaise).toBe(134400);
    expect(debitNote.taxPaise).toBe(20736);
    expect(debitNote.totalPaise).toBe(155100);

    // 3. Verify Central Godown inventory deducted via RETURN_TO_COMPANY
    const balAfter1 = await prisma.stockBalance.findUniqueOrThrow({
      where: { productId_locationId: { productId: testProduct1.id, locationId: centralGodown.id } },
    });
    const balAfter2 = await prisma.stockBalance.findUniqueOrThrow({
      where: { productId_locationId: { productId: testProduct2.id, locationId: centralGodown.id } },
    });

    expect(balAfter1.qty).toBe(balBefore1.qty - returnQty1);
    expect(balAfter2.qty).toBe(balBefore2.qty - returnQty2);

    // 4. Verify immutable stock movements recorded
    const mvm1 = await prisma.stockMovement.findFirst({
      where: {
        type: MovementType.RETURN_TO_COMPANY,
        referenceId: debitNote.id,
        productId: testProduct1.id,
      },
    });
    expect(mvm1).toBeDefined();
    expect(mvm1?.qty).toBe(returnQty1);
    expect(mvm1?.fromLocationId).toBe(centralGodown.id);
    expect(mvm1?.toLocationId).toBeNull();

    // 5. Verify Supplier Ledger entry debited
    const ledgerEntry = await prisma.ledgerEntry.findFirst({
      where: {
        partyId: testSupplier.id,
        referenceId: debitNote.id,
        kind: LedgerKind.DEBIT_NOTE,
      },
    });
    expect(ledgerEntry).toBeDefined();
    expect(ledgerEntry?.debitPaise).toBe(155100); // Debited by ₹1,551.00
    expect(ledgerEntry?.creditPaise).toBe(0);

    // 6. Verify fetch by id
    const fetched = await returnsService.getDebitNoteById(adminUser.role, debitNote.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.number).toBe(debitNote.number);
    expect(fetched?.items.length).toBe(2);
  });

  it("enforces consecutive gapless numbering for multiple debit notes", async () => {
    const note1 = await returnsService.createDebitNote(
      adminUser.role,
      adminUser.id,
      {
        supplierId: testSupplier.id,
        reason: "EXPIRY",
        items: [{ productId: testProduct1.id, qty: 5 }],
      }
    );

    const note2 = await returnsService.createDebitNote(
      accountsUser.role,
      accountsUser.id,
      {
        supplierId: testSupplier.id,
        reason: "EXPIRY",
        items: [{ productId: testProduct1.id, qty: 5 }],
      }
    );

    const seq1 = parseInt(note1.number.split("/")[2], 10);
    const seq2 = parseInt(note2.number.split("/")[2], 10);
    expect(seq2).toBe(seq1 + 1);
  });

  it("blocks creation if requested return quantity exceeds available stock", async () => {
    // Current stock is 500, attempt to return 501
    await expect(
      returnsService.createDebitNote(
        godownUser.role,
        godownUser.id,
        {
          supplierId: testSupplier.id,
          locationId: centralGodown.id,
          reason: "DAMAGE",
          items: [{ productId: testProduct1.id, qty: 501 }],
        }
      )
    ).rejects.toThrow(/Insufficient stock/i);
  });

  it("generates aggregated Stock-Wise Return to Company Report with reasons breakdown", async () => {
    // Create Note 1 (DAMAGE): 10 pcs of P1, 5 pcs of P2
    await returnsService.createDebitNote(
      godownUser.role,
      godownUser.id,
      {
        supplierId: testSupplier.id,
        reason: "DAMAGE",
        items: [
          { productId: testProduct1.id, qty: 10, reason: "DAMAGE" },
          { productId: testProduct2.id, qty: 5, reason: "DAMAGE" },
        ],
      }
    );

    // Create Note 2 (EXPIRY): 15 pcs of P1
    await returnsService.createDebitNote(
      godownUser.role,
      godownUser.id,
      {
        supplierId: testSupplier.id,
        reason: "EXPIRY",
        items: [
          { productId: testProduct1.id, qty: 15, reason: "EXPIRY" },
        ],
      }
    );

    const report = await returnsService.getStockWiseReturnReport(adminUser.role, {
      supplierId: testSupplier.id,
    });

    expect(report.totalItemsReturned).toBe(30); // 10 + 5 + 15 = 30 pcs
    expect(report.totalDebitNotesCount).toBe(2);

    const p1Row = report.rows.find((r) => r.productId === testProduct1.id);
    expect(p1Row).toBeDefined();
    expect(p1Row?.totalQtyReturned).toBe(25); // 10 + 15
    expect(p1Row?.returnsCount).toBe(2);
    expect(p1Row?.reasonsBreakdown["DAMAGE"]).toBe(10);
    expect(p1Row?.reasonsBreakdown["EXPIRY"]).toBe(15);

    const p2Row = report.rows.find((r) => r.productId === testProduct2.id);
    expect(p2Row).toBeDefined();
    expect(p2Row?.totalQtyReturned).toBe(5);
    expect(p2Row?.reasonsBreakdown["DAMAGE"]).toBe(5);
  });

  it("enforces RBAC permissions: allows SUPER_ADMIN, GODOWN, ACCOUNTS and rejects SHOP, SALESPERSON", async () => {
    const payload = {
      supplierId: testSupplier.id,
      reason: "RECALL" as const,
      items: [{ productId: testProduct1.id, qty: 2 }],
    };

    // SALESPERSON cannot create debit notes
    await expect(
      returnsService.createDebitNote(salesUser.role, salesUser.id, payload)
    ).rejects.toThrow(ForbiddenError);

    // SHOP cashier cannot create debit notes
    await expect(
      returnsService.createDebitNote(shopUser.role, shopUser.id, payload)
    ).rejects.toThrow(ForbiddenError);

    // ACCOUNTS can create debit notes
    const accountsNote = await returnsService.createDebitNote(
      accountsUser.role,
      accountsUser.id,
      payload
    );
    expect(accountsNote.id).toBeDefined();

    // SHOP cannot view stock-wise return report
    await expect(
      returnsService.getStockWiseReturnReport(shopUser.role)
    ).rejects.toThrow(ForbiddenError);
  });
});
