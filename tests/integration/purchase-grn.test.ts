import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { purchaseService } from "@/modules/purchase/purchase.service";
import { stockService } from "@/modules/stock/stock.service";
import { UserRole, MovementType, LedgerKind, PurchaseStatus } from "@prisma/client";
import { ForbiddenError } from "@/modules/auth/permissions";
import { prisma } from "@/lib/prisma";
import { ZodError } from "zod";

describe("Task 1.7: Purchase & Goods Receipt Note (GRN) Service", () => {
  let godownUser: { id: string; role: UserRole };
  let shopUser: { id: string; role: UserRole };
  let godownLocation: { id: string; name: string };
  let product1: { id: string; shortCode: string };
  let product2: { id: string; shortCode: string };
  let supplier: { id: string; name: string };

  const createdPurchaseIds: string[] = [];

  beforeEach(async () => {
    godownUser = await prisma.user.findUniqueOrThrow({
      where: { phone: "9876543211" }, // seeded godown staff
      select: { id: true, role: true },
    });

    shopUser = await prisma.user.findUniqueOrThrow({
      where: { phone: "9876543212" }, // seeded shop staff
      select: { id: true, role: true },
    });

    godownLocation = await prisma.location.findFirstOrThrow({
      where: { name: { contains: "Godown" } },
      select: { id: true, name: true },
    });

    product1 = await prisma.product.findUniqueOrThrow({
      where: { shortCode: "BKJ-BHU-1K" },
      select: { id: true, shortCode: true },
    });

    product2 = await prisma.product.findUniqueOrThrow({
      where: { shortCode: "MDH-DEG-100" },
      select: { id: true, shortCode: true },
    });

    supplier = await prisma.party.findFirstOrThrow({
      where: { type: "SUPPLIER" },
      select: { id: true, name: true },
    });
  });

  afterAll(async () => {
    if (createdPurchaseIds.length > 0) {
      await prisma.ledgerEntry.deleteMany({
        where: { referenceId: { in: createdPurchaseIds } },
      });
      // Note: stock_movements are immutable due to DB trigger, so we leave them intact
      await prisma.purchaseItem.deleteMany({
        where: { purchaseId: { in: createdPurchaseIds } },
      });
      await prisma.purchase.deleteMany({
        where: { id: { in: createdPurchaseIds } },
      });
    }
  });

  describe("Record Stock Receipt (GRN)", () => {
    it("should record purchase, increment godown stock, create ledger entry, and log audit event", async () => {
      // 1. Get initial stock balances at Godown
      const initialBal1 = await stockService.getBalance(product1.id, godownLocation.id);
      const initialBal2 = await stockService.getBalance(product2.id, godownLocation.id);

      const qty1 = 60; // 60 pieces
      const qty2 = 40; // 40 pieces

      const purchaseData = {
        supplierId: supplier.id,
        billNo: `TEST-BILL-${Date.now()}`,
        billDate: new Date(),
        locationId: godownLocation.id,
        items: [
          {
            productId: product1.id,
            qty: qty1,
            ratePaise: 18000, // Rs 180.00
            gstRateBp: 1200, // 12%
          },
          {
            productId: product2.id,
            qty: qty2,
            ratePaise: 7500, // Rs 75.00
            gstRateBp: 500, // 5%
          },
        ],
      };

      // 2. Execute purchase receipt as Godown staff
      const purchase = await purchaseService.recordPurchaseReceive(
        godownUser.role,
        godownUser.id,
        purchaseData
      );
      createdPurchaseIds.push(purchase.id);

      expect(purchase.id).toBeDefined();
      expect(purchase.status).toBe(PurchaseStatus.RECEIVED);
      expect(purchase.items.length).toBe(2);

      // Verify Total paise:
      // Item 1: 60 * 18000 = 1080000 taxable; tax = round(1080000 * 0.12) = 129600; total = 1209600
      // Item 2: 40 * 7500 = 300000 taxable; tax = round(300000 * 0.05) = 15000; total = 315000
      // Grand total = 1209600 + 315000 = 1524600 paise
      expect(purchase.totalPaise).toBe(1524600);

      // 3. Verify Stock Ledger Balances increased by exact quantities
      const newBal1 = await stockService.getBalance(product1.id, godownLocation.id);
      const newBal2 = await stockService.getBalance(product2.id, godownLocation.id);

      expect(newBal1).toBe(initialBal1 + qty1);
      expect(newBal2).toBe(initialBal2 + qty2);

      // 4. Verify Stock Movements created
      const movements = await prisma.stockMovement.findMany({
        where: {
          referenceType: "PURCHASE",
          referenceId: purchase.id,
        },
      });
      expect(movements.length).toBe(2);
      expect(movements[0].type).toBe(MovementType.PURCHASE_RECEIPT);
      expect(movements[0].toLocationId).toBe(godownLocation.id);

      // 5. Verify Supplier Ledger Entry
      const ledgerEntry = await prisma.ledgerEntry.findFirst({
        where: {
          referenceType: "PURCHASE",
          referenceId: purchase.id,
        },
      });
      expect(ledgerEntry).not.toBeNull();
      expect(ledgerEntry?.partyId).toBe(supplier.id);
      expect(ledgerEntry?.kind).toBe(LedgerKind.INVOICE);
      expect(ledgerEntry?.creditPaise).toBe(1524600);

      // 6. Verify Audit Log
      const audit = await prisma.auditLog.findFirst({
        where: { action: "PURCHASE_RECEIVED", entityId: purchase.id },
      });
      expect(audit).not.toBeNull();
      expect(audit?.actorId).toBe(godownUser.id);
    });

    it("should enforce RBAC: reject purchase recording by Shop staff", async () => {
      const purchaseData = {
        supplierId: supplier.id,
        billNo: `SHOP-ATTEMPT-${Date.now()}`,
        locationId: godownLocation.id,
        items: [
          {
            productId: product1.id,
            qty: 10,
            ratePaise: 10000,
            gstRateBp: 500,
          },
        ],
      };

      await expect(
        purchaseService.recordPurchaseReceive(
          shopUser.role, // SHOP role does not have STOCK_RECEIVE
          shopUser.id,
          purchaseData
        )
      ).rejects.toThrow(ForbiddenError);
    });

    it("should reject invalid inputs such as non-positive quantity or empty items", async () => {
      await expect(
        purchaseService.recordPurchaseReceive(
          godownUser.role,
          godownUser.id,
          {
            billNo: "BAD-QTY",
            locationId: godownLocation.id,
            items: [
              {
                productId: product1.id,
                qty: -5, // invalid negative quantity
                ratePaise: 10000,
                gstRateBp: 500,
              },
            ],
          }
        )
      ).rejects.toThrow(ZodError);

      await expect(
        purchaseService.recordPurchaseReceive(
          godownUser.role,
          godownUser.id,
          {
            billNo: "NO-ITEMS",
            locationId: godownLocation.id,
            items: [], // invalid empty array
          }
        )
      ).rejects.toThrow(ZodError);
    });
  });
});
