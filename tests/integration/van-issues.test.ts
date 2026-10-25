import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { vanService } from "@/modules/van/van.service";
import { stockService } from "@/modules/stock/stock.service";
import { MovementType, UserRole, LocationType } from "@prisma/client";
import { InsufficientStockError } from "@/modules/stock/stock.types";
import { VanAlreadyActiveError } from "@/modules/van/van.repository";
import { ForbiddenError } from "@/modules/auth/permissions";

describe("Task 2.2 Integration Tests: Van Locations & Van Issue Sheet", () => {
  let godownUser: { id: string; role: UserRole };
  let salesUser: { id: string; role: UserRole };
  let adminUser: { id: string; role: UserRole };
  let godownLocation: { id: string };
  let vanLocation: { id: string; name: string };
  let testProduct: { id: string; name: string; packSize: number; mrpPaise: number | null };

  const cleanup = async () => {
    // Delete test van days
    const vanDays = await prisma.vanDay.findMany({
      where: { vanLocationId: vanLocation?.id },
    });
    if (vanDays.length > 0) {
      const ids = vanDays.map((vd) => vd.id);
      await prisma.vanDayLine.deleteMany({ where: { vanDayId: { in: ids } } });
      await prisma.vanDay.deleteMany({ where: { id: { in: ids } } });
    }
  };

  beforeEach(async () => {
    godownUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.GODOWN },
      select: { id: true, role: true },
    });

    salesUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.SALESPERSON },
      select: { id: true, role: true },
    });

    adminUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.SUPER_ADMIN },
      select: { id: true, role: true },
    });

    godownLocation = await prisma.location.findFirstOrThrow({
      where: { type: LocationType.GODOWN, active: true },
      select: { id: true },
    });

    vanLocation = await prisma.location.findFirstOrThrow({
      where: { type: LocationType.VAN, assignedUserId: salesUser.id, active: true },
      select: { id: true, name: true },
    });

    testProduct = await prisma.product.findFirstOrThrow({
      where: { active: true },
      select: { id: true, name: true, packSize: true, mrpPaise: true },
    });

    await cleanup();

    // Ensure Godown has plenty of stock for testing
    await stockService.postMovement({
      type: MovementType.PURCHASE_RECEIPT,
      productId: testProduct.id,
      toLocationId: godownLocation.id,
      qty: 500, // 500 pieces
      idempotencyKey: `SEED_GODOWN_TEST_${Date.now()}_${Math.random()}`,
      actorId: godownUser.id,
      reason: "Initial test receipt for van loading tests",
    });
  });

  afterEach(async () => {
    await cleanup();
  });

  describe("Morning Van Loading & Issue Sheet Creation", () => {
    it("should create a van issue sheet and atomically transfer stock from Godown to Van", async () => {
      const initialGodownBal = await prisma.stockBalance.findUnique({
        where: {
          productId_locationId: {
            productId: testProduct.id,
            locationId: godownLocation.id,
          },
        },
      });
      const godownQtyBefore = initialGodownBal?.qty || 0;

      const initialVanBal = await prisma.stockBalance.findUnique({
        where: {
          productId_locationId: {
            productId: testProduct.id,
            locationId: vanLocation.id,
          },
        },
      });
      const vanQtyBefore = initialVanBal?.qty || 0;

      // Issue: 2 cartons + 4 loose pieces = 2 * packSize + 4
      const expectedIssuedQty = 2 * testProduct.packSize + 4;

      const vanDay = await vanService.createVanIssueSheet(
        UserRole.GODOWN,
        godownUser.id,
        {
          vanLocationId: vanLocation.id,
          notes: "Morning test route dispatch",
          items: [
            {
              productId: testProduct.id,
              cartons: 2,
              pieces: 4,
            },
          ],
        }
      );

      // 1. Verify VanDay record
      expect(vanDay).toBeDefined();
      expect(vanDay.status).toBe("OPEN");
      expect(vanDay.issueSheetNo).toMatch(/^VIS\/\d{2}-\d{2}\/\d{6}$/);
      expect(vanDay.vanLocationId).toBe(vanLocation.id);
      expect(vanDay.salespersonId).toBe(salesUser.id);
      expect(vanDay.lines.length).toBe(1);
      expect(vanDay.lines[0].issuedQty).toBe(expectedIssuedQty);

      // 2. Verify stock ledger balance deduction from Godown
      const godownBalAfter = await prisma.stockBalance.findUniqueOrThrow({
        where: {
          productId_locationId: {
            productId: testProduct.id,
            locationId: godownLocation.id,
          },
        },
      });
      expect(godownBalAfter.qty).toBe(godownQtyBefore - expectedIssuedQty);

      // 3. Verify stock ledger balance addition to Van
      const vanBalAfter = await prisma.stockBalance.findUniqueOrThrow({
        where: {
          productId_locationId: {
            productId: testProduct.id,
            locationId: vanLocation.id,
          },
        },
      });
      expect(vanBalAfter.qty).toBe(vanQtyBefore + expectedIssuedQty);

      // 4. Verify TRANSFER movement logged in immutable ledger
      const movement = await prisma.stockMovement.findFirst({
        where: {
          referenceType: "VAN_ISSUE",
          referenceId: vanDay.id,
          productId: testProduct.id,
        },
      });
      expect(movement).toBeDefined();
      expect(movement?.type).toBe(MovementType.TRANSFER);
      expect(movement?.fromLocationId).toBe(godownLocation.id);
      expect(movement?.toLocationId).toBe(vanLocation.id);
      expect(movement?.qty).toBe(expectedIssuedQty);
    });

    it("should prevent creating a second active issue sheet on the same van", async () => {
      // Create first issue sheet
      await vanService.createVanIssueSheet(UserRole.GODOWN, godownUser.id, {
        vanLocationId: vanLocation.id,
        items: [{ productId: testProduct.id, cartons: 1, pieces: 0 }],
      });

      // Attempt to create second issue sheet while first is OPEN
      await expect(
        vanService.createVanIssueSheet(UserRole.GODOWN, godownUser.id, {
          vanLocationId: vanLocation.id,
          items: [{ productId: testProduct.id, cartons: 1, pieces: 0 }],
        })
      ).rejects.toThrow(VanAlreadyActiveError);
    });

    it("should reject van issue and rollback if Godown has insufficient stock", async () => {
      // Request an enormous quantity that Godown does not have
      await expect(
        vanService.createVanIssueSheet(UserRole.GODOWN, godownUser.id, {
          vanLocationId: vanLocation.id,
          items: [{ productId: testProduct.id, cartons: 99999, pieces: 0 }],
        })
      ).rejects.toThrow(InsufficientStockError);

      // Ensure no orphaned VanDay was created
      const openDay = await prisma.vanDay.findFirst({
        where: { vanLocationId: vanLocation.id, status: "OPEN" },
      });
      expect(openDay).toBeNull();
    });
  });

  describe("Van Live Stock Summary & Salesperson Access", () => {
    it("should return on-van stock breakdown with cartons and loose pieces", async () => {
      await vanService.createVanIssueSheet(UserRole.GODOWN, godownUser.id, {
        vanLocationId: vanLocation.id,
        items: [{ productId: testProduct.id, cartons: 3, pieces: 5 }],
      });

      const summary = await vanService.getVanStockSummary(UserRole.GODOWN, vanLocation.id);
      expect(summary).toBeDefined();
      expect(summary.activeVanDay).toBeDefined();
      expect(summary.totalPieces).toBeGreaterThanOrEqual(3 * testProduct.packSize + 5);

      const item = summary.inventory.find((i) => i.product.id === testProduct.id);
      expect(item).toBeDefined();
      expect(item?.cartons).toBeGreaterThanOrEqual(3);
    });

    it("should allow salesperson to view active issue sheet", async () => {
      const created = await vanService.createVanIssueSheet(UserRole.GODOWN, godownUser.id, {
        vanLocationId: vanLocation.id,
        items: [{ productId: testProduct.id, cartons: 1, pieces: 0 }],
      });

      const active = await vanService.getActiveVanDayForSalesperson(
        UserRole.SALESPERSON,
        salesUser.id
      );

      expect(active).toBeDefined();
      expect(active?.id).toBe(created.id);
      expect(active?.issueSheetNo).toBe(created.issueSheetNo);
    });
  });

  describe("RBAC Permissions", () => {
    it("should allow SUPER_ADMIN to issue van loads", async () => {
      const vanDay = await vanService.createVanIssueSheet(
        UserRole.SUPER_ADMIN,
        adminUser.id,
        {
          vanLocationId: vanLocation.id,
          items: [{ productId: testProduct.id, cartons: 1, pieces: 0 }],
        }
      );
      expect(vanDay).toBeDefined();
    });

    it("should forbid SHOP cashier from issuing van loads", async () => {
      await expect(
        vanService.createVanIssueSheet(UserRole.SHOP, "shop-user-id", {
          vanLocationId: vanLocation.id,
          items: [{ productId: testProduct.id, cartons: 1, pieces: 0 }],
        })
      ).rejects.toThrow(ForbiddenError);
    });
  });
});
