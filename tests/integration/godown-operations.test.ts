import { describe, it, expect, beforeEach } from "vitest";
import { godownService } from "@/modules/godown/godown.service";
import { stockService } from "@/modules/stock/stock.service";
import { UserRole, MovementType, AuditStatus } from "@prisma/client";
import { InsufficientStockError } from "@/modules/stock/stock.types";
import { ForbiddenError } from "@/modules/auth/permissions";
import { prisma } from "@/lib/prisma";
import { ZodError } from "zod";

describe("Task 1.8: Godown Operations (Transfer, Carton Break, Damage, Adjustment, Audit)", () => {
  let godownUser: { id: string; role: UserRole };
  let salespersonUser: { id: string; role: UserRole };
  let godownLocation: { id: string; name: string };
  let shopLocation: { id: string; name: string };
  let product: { id: string; shortCode: string; packSize: number };

  beforeEach(async () => {
    godownUser = await prisma.user.findUniqueOrThrow({
      where: { phone: "9876543211" },
      select: { id: true, role: true },
    });

    salespersonUser = await prisma.user.findUniqueOrThrow({
      where: { phone: "9876543213" },
      select: { id: true, role: true },
    });

    godownLocation = await prisma.location.findFirstOrThrow({
      where: { name: { contains: "Godown" } },
      select: { id: true, name: true },
    });

    shopLocation = await prisma.location.findFirstOrThrow({
      where: { name: { contains: "Shop" } },
      select: { id: true, name: true },
    });

    product = await prisma.product.findUniqueOrThrow({
      where: { shortCode: "BKJ-BHU-1K" },
      select: { id: true, shortCode: true, packSize: true },
    });

    // Seed ample stock at Godown for testing: 200 pieces
    await stockService.postMovement({
      type: MovementType.PURCHASE_RECEIPT,
      productId: product.id,
      toLocationId: godownLocation.id,
      qty: 200,
      idempotencyKey: `setup-stock-${Date.now()}-${Math.random()}`,
      reason: "Test setup stock",
    });
  });

  describe("Inter-Location Transfer", () => {
    it("should transfer stock pieces from Godown to Shop", async () => {
      const initialGodown = await stockService.getBalance(product.id, godownLocation.id);
      const initialShop = await stockService.getBalance(product.id, shopLocation.id);

      const transferQty = 25;

      const movement = await godownService.transferStock(
        godownUser.role,
        godownUser.id,
        {
          productId: product.id,
          fromLocationId: godownLocation.id,
          toLocationId: shopLocation.id,
          qty: transferQty,
          reason: "Shop restock",
        }
      );

      expect(movement.id).toBeDefined();
      expect(movement.type).toBe(MovementType.TRANSFER);

      const newGodown = await stockService.getBalance(product.id, godownLocation.id);
      const newShop = await stockService.getBalance(product.id, shopLocation.id);

      expect(newGodown).toBe(initialGodown - transferQty);
      expect(newShop).toBe(initialShop + transferQty);
    });

    it("should reject transfer when source has insufficient stock", async () => {
      const godownBal = await stockService.getBalance(product.id, godownLocation.id);

      await expect(
        godownService.transferStock(
          godownUser.role,
          godownUser.id,
          {
            productId: product.id,
            fromLocationId: godownLocation.id,
            toLocationId: shopLocation.id,
            qty: godownBal + 500, // exceeds available stock
          }
        )
      ).rejects.toThrow(InsufficientStockError);
    });

    it("should reject transfer when from and to locations are identical", async () => {
      await expect(
        godownService.transferStock(
          godownUser.role,
          godownUser.id,
          {
            productId: product.id,
            fromLocationId: godownLocation.id,
            toLocationId: godownLocation.id, // same location
            qty: 10,
          }
        )
      ).rejects.toThrow(ZodError);
    });
  });

  describe("Carton Break", () => {
    it("should break cartons into loose pieces at Shop (cartons * packSize)", async () => {
      const initialGodown = await stockService.getBalance(product.id, godownLocation.id);
      const initialShop = await stockService.getBalance(product.id, shopLocation.id);

      const cartonsToBreak = 3;
      const expectedPieces = cartonsToBreak * product.packSize; // 3 * 20 = 60 pcs

      const res = await godownService.cartonBreak(
        godownUser.role,
        godownUser.id,
        {
          productId: product.id,
          fromLocationId: godownLocation.id,
          toLocationId: shopLocation.id,
          cartons: cartonsToBreak,
        }
      );

      expect(res.totalPieces).toBe(expectedPieces);
      expect(res.movement.type).toBe(MovementType.CARTON_BREAK);

      const newGodown = await stockService.getBalance(product.id, godownLocation.id);
      const newShop = await stockService.getBalance(product.id, shopLocation.id);

      expect(newGodown).toBe(initialGodown - expectedPieces);
      expect(newShop).toBe(initialShop + expectedPieces);
    });
  });

  describe("Damage & Manual Adjustment", () => {
    it("should deduct damaged stock with mandatory reason", async () => {
      const initialGodown = await stockService.getBalance(product.id, godownLocation.id);
      const damageQty = 4;

      const movement = await godownService.recordDamage(
        godownUser.role,
        godownUser.id,
        {
          productId: product.id,
          locationId: godownLocation.id,
          qty: damageQty,
          reason: "Carton dropped during unloading, torn packages",
        }
      );

      expect(movement.type).toBe(MovementType.DAMAGE);
      const newGodown = await stockService.getBalance(product.id, godownLocation.id);
      expect(newGodown).toBe(initialGodown - damageQty);
    });

    it("should execute positive and negative manual adjustments", async () => {
      const initialShop = await stockService.getBalance(product.id, shopLocation.id);

      // Positive adjustment (+8 pieces)
      await godownService.adjustStock(
        godownUser.role,
        godownUser.id,
        {
          productId: product.id,
          locationId: shopLocation.id,
          adjustmentQty: 8,
          reason: "Found unrecorded loose items behind shelf",
        }
      );

      let shopBal = await stockService.getBalance(product.id, shopLocation.id);
      expect(shopBal).toBe(initialShop + 8);

      // Negative adjustment (-3 pieces)
      await godownService.adjustStock(
        godownUser.role,
        godownUser.id,
        {
          productId: product.id,
          locationId: shopLocation.id,
          adjustmentQty: -3,
          reason: "Cycle count correction",
        }
      );

      shopBal = await stockService.getBalance(product.id, shopLocation.id);
      expect(shopBal).toBe(initialShop + 5);
    });
  });

  describe("Stock Audit Workflow", () => {
    it("should create stock audit, compute variance, and approve adjustments to match counted stock", async () => {
      const currentBal = await stockService.getBalance(product.id, godownLocation.id);
      const physicalCount = currentBal + 15; // physical count finds 15 more pieces

      // 1. Create audit
      const audit = await godownService.createStockAudit(
        godownUser.role,
        godownUser.id,
        {
          locationId: godownLocation.id,
          lines: [
            {
              productId: product.id,
              countedQty: physicalCount,
            },
          ],
        }
      );

      expect(audit.id).toBeDefined();
      expect(audit.status).toBe(AuditStatus.PENDING);
      expect(audit.lines[0].systemQty).toBe(currentBal);
      expect(audit.lines[0].countedQty).toBe(physicalCount);

      // 2. Approve audit
      const approved = await godownService.approveStockAudit(
        godownUser.role,
        godownUser.id,
        audit.id
      );

      expect(approved.status).toBe(AuditStatus.APPROVED);

      // 3. Verify stock balance now matches exactly the physical count!
      const newGodownBal = await stockService.getBalance(product.id, godownLocation.id);
      expect(newGodownBal).toBe(physicalCount);
    });
  });

  describe("RBAC Permissions", () => {
    it("should prevent unauthorized roles from executing godown operations", async () => {
      await expect(
        godownService.cartonBreak(
          salespersonUser.role, // Salesperson cannot break cartons
          salespersonUser.id,
          {
            productId: product.id,
            fromLocationId: godownLocation.id,
            toLocationId: shopLocation.id,
            cartons: 1,
          }
        )
      ).rejects.toThrow(ForbiddenError);
    });
  });
});
