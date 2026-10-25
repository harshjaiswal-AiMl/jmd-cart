import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { UserRole, MovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { crudService } from "@/modules/crud/crud.service";
import { stockRepository } from "@/modules/stock/stock.repository";

describe("Part 5 — Admin Full CRUD, Archive/Void Policy, and RBAC Tests", () => {
  let superAdminId: string;
  let adminId: string;
  let godownId: string;

  beforeAll(async () => {
    // Ensure a clean user set for testing
    const superAdmin = await prisma.user.create({
      data: {
        name: "Primary Super Admin",
        phone: "9888800001",
        passwordHash: "hash",
        role: UserRole.SUPER_ADMIN,
        active: true,
      },
    });
    superAdminId = superAdmin.id;

    const admin = await prisma.user.create({
      data: {
        name: "Operations Admin",
        phone: "9888800002",
        passwordHash: "hash",
        role: UserRole.ADMIN,
        active: true,
      },
    });
    adminId = admin.id;

    const godown = await prisma.user.create({
      data: {
        name: "Godown Manager",
        phone: "9888800003",
        passwordHash: "hash",
        role: UserRole.GODOWN,
        active: true,
      },
    });
    godownId = godown.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("1. performs full CRUD on unreferenced vs referenced records (Hard Delete vs Archive & Restore)", async () => {
    // Create a brand/company
    const brand = await crudService.createRecord(
      UserRole.ADMIN,
      adminId,
      "companies",
      { name: "CRUD_BRAND_TEST", active: true }
    );
    const brandId = String(brand.id);
    expect(brandId).toBeTruthy();

    // Update the brand
    const updatedBrand = await crudService.updateRecord(
      UserRole.ADMIN,
      adminId,
      "companies",
      brandId,
      { name: "CRUD_BRAND_UPDATED" }
    );
    expect(updatedBrand.name).toBe("CRUD_BRAND_UPDATED");

    // Create an unreferenced category and hard-delete it
    const tempCat = await crudService.createRecord(
      UserRole.ADMIN,
      adminId,
      "categories",
      { name: "TEMP_UNREF_CAT" }
    );
    const delCatRes = await crudService.deleteOrArchiveRecord(
      UserRole.ADMIN,
      adminId,
      "categories",
      String(tempCat.id)
    );
    expect(delCatRes.action).toBe("DELETED");

    // Create a product with A/B/C prices and link a stock movement so it has history
    const prod = await crudService.createRecord(
      UserRole.ADMIN,
      adminId,
      "products",
      {
        shortCode: "CRUD-PROD-1",
        name: "CRUD Test Mustard Oil 1L",
        weight: "1L",
        packSize: 12,
        mrpRupees: 220,
        priceARupees: 175,
        priceBRupees: 178,
        priceCRupees: 182,
        reorderLevel: 10,
      }
    );
    const prodId = String(prod.id);

    // Record a stock movement so the product has ledger history
    await prisma.$transaction(async (tx) => {
      const bal = await stockRepository.lockAndGetBalance(
        tx,
        prodId,
        "loc-godown-main"
      );
      await stockRepository.setBalance(tx, prodId, "loc-godown-main", bal + 24);
      await tx.stockMovement.create({
        data: {
          type: MovementType.PURCHASE_RECEIPT,
          productId: prodId,
          toLocationId: "loc-godown-main",
          qty: 24,
          reason: "Opening stock for CRUD test",
          idempotencyKey: `crud-test-mov-${Date.now()}`,
          createdBy: adminId,
        },
      });
    });

    // Attempting to delete the product with ledger history MUST archive it, not hard-delete!
    const archiveProdRes = await crudService.deleteOrArchiveRecord(
      UserRole.ADMIN,
      adminId,
      "products",
      prodId
    );
    expect(archiveProdRes.action).toBe("ARCHIVED");

    // Hidden from default active list
    const activeList = await crudService.listRecords(
      UserRole.ADMIN,
      "products",
      { includeArchived: false }
    );
    expect(activeList.some((p) => p.id === prodId)).toBe(false);

    // Visible when includeArchived: true
    const withArchivedList = await crudService.listRecords(
      UserRole.ADMIN,
      "products",
      { includeArchived: true }
    );
    expect(withArchivedList.some((p) => p.id === prodId)).toBe(true);

    // Restore the archived product
    await crudService.restoreRecord(
      UserRole.ADMIN,
      adminId,
      "products",
      prodId
    );
    const restoredList = await crudService.listRecords(
      UserRole.ADMIN,
      "products",
      { includeArchived: false }
    );
    expect(restoredList.some((p) => p.id === prodId)).toBe(true);
  });

  it("2. enforces VOID_WITH_REASON on accounting records (receipts) and logs every mutation in AuditLog", async () => {
    const party = await crudService.createRecord(
      UserRole.ADMIN,
      adminId,
      "parties",
      {
        name: "Saharsa Kirana Store",
        type: "RETAILER",
        phone: "9777700001",
        creditLimitRupees: 25000,
      }
    );

    const receipt = await crudService.createRecord(
      UserRole.ADMIN,
      adminId,
      "receipts",
      {
        partyId: String(party.id),
        amountRupees: 1500,
        mode: "CASH",
        notes: "Counter collection",
      }
    );
    const receiptId = String(receipt.id);

    // Attempting to void without reason must fail
    await expect(
      crudService.deleteOrArchiveRecord(
        UserRole.ADMIN,
        adminId,
        "receipts",
        receiptId,
        ""
      )
    ).rejects.toThrow(/mandatory reason/i);

    // Void with valid reason -> VOIDED (never deleted from DB)
    const voidRes = await crudService.deleteOrArchiveRecord(
      UserRole.ADMIN,
      adminId,
      "receipts",
      receiptId,
      "Duplicate entry by cashier"
    );
    expect(voidRes.action).toBe("VOIDED");

    const dbPayment = await prisma.payment.findUnique({
      where: { id: receiptId },
    });
    expect(dbPayment).not.toBeNull();
    expect(dbPayment?.notes).toContain("[VOIDED: Duplicate entry by cashier]");

    // Verify audit logs were written
    const auditLogs = await prisma.auditLog.findMany({
      where: { entityId: receiptId },
    });
    expect(auditLogs.length).toBeGreaterThanOrEqual(2);
  });

  it("3. enforces User & Role safety: protects last SUPER_ADMIN, blocks self-delete, and restricts ADMIN from managing SUPER_ADMIN", async () => {
    // Cannot delete yourself
    await expect(
      crudService.deleteOrArchiveRecord(
        UserRole.ADMIN,
        adminId,
        "users",
        adminId
      )
    ).rejects.toThrow(/cannot delete or archive your own user account/i);

    // ADMIN cannot create or modify a SUPER_ADMIN
    await expect(
      crudService.createRecord(UserRole.ADMIN, adminId, "users", {
        name: "Unauthorized Super",
        phone: "9888899999",
        role: "SUPER_ADMIN",
      })
    ).rejects.toThrow(/Only a SUPER_ADMIN/i);

    await expect(
      crudService.updateRecord(
        UserRole.ADMIN,
        adminId,
        "users",
        superAdminId,
        { name: "Edited by Admin" }
      )
    ).rejects.toThrow(/Only a SUPER_ADMIN/i);

    // Cannot demote or delete the last active SUPER_ADMIN
    const activeSuperAdmins = await prisma.user.findMany({
      where: { role: UserRole.SUPER_ADMIN, active: true },
    });
    // Deactivate any extra super admins from other tests so superAdminId is the only one
    for (const sa of activeSuperAdmins) {
      if (sa.id !== superAdminId) {
        await prisma.user.update({
          where: { id: sa.id },
          data: { active: false },
        });
      }
    }

    await expect(
      crudService.updateRecord(
        UserRole.SUPER_ADMIN,
        superAdminId,
        "users",
        superAdminId,
        { role: "ADMIN" }
      )
    ).rejects.toThrow(/last active SUPER_ADMIN/i);
  });

  it("4. enforces GODOWN role read-only restriction on Catalog CRUD", async () => {
    // GODOWN can list companies and products
    const list = await crudService.listRecords(UserRole.GODOWN, "companies");
    expect(Array.isArray(list)).toBe(true);

    // GODOWN cannot create, update, or delete companies or products
    await expect(
      crudService.createRecord(UserRole.GODOWN, godownId, "companies", {
        name: "UNAUTHORIZED_BRAND",
      })
    ).rejects.toThrow(/not authorized/i);
  });

  afterAll(async () => {
    await prisma.user.updateMany({
      where: { phone: "9876543210" },
      data: { active: true },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [superAdminId, adminId, godownId].filter(Boolean) } },
    });
  });
});


