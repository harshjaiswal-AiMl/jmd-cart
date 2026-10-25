import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { seedReferenceData } from "../../prisma/seed";
import { setupService } from "@/modules/auth/setup.service";
import { godownService } from "@/modules/godown/godown.service";
import { storeService } from "@/modules/store/store.service";
import { UserRole } from "@prisma/client";

describe("Prompt 05 Guard Tests: Reference Seed, First-Run Setup & Stock Entry Without GRN", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("seedReferenceData is idempotent and never creates business rows on its own", async () => {
    const beforeUsers = await prisma.user.count();
    const beforeProducts = await prisma.product.count();

    await seedReferenceData(prisma);

    const afterUsers = await prisma.user.count();
    const afterProducts = await prisma.product.count();
    expect(afterUsers).toBe(beforeUsers);
    expect(afterProducts).toBe(beforeProducts);

    const locations = await prisma.location.findMany({
      where: {
        id: {
          in: ["loc-godown-main", "loc-shop-retail", "loc-van-1", "loc-van-2"],
        },
      },
    });
    expect(locations.length).toBe(4);
  });

  it("blocks /setup (completeFirstRunSetup) once a SUPER_ADMIN already exists", async () => {
    const isReq = await setupService.isSetupRequired();
    expect(isReq).toBe(false);

    await expect(
      setupService.completeFirstRunSetup({
        ownerName: "Second Owner Attempt",
        ownerPhone: "9999988888",
        ownerPassword: "password123",
        tradeName: "Attempt Store",
        legalName: "Attempt Legal",
        address: "Saharsa, Bihar",
      })
    ).rejects.toThrow(/First-run setup has already been completed/);
  });

  it("enters Opening Stock and Stock Count without a GRN and updates Godown + Storefront availability", async () => {
    const admin = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.SUPER_ADMIN },
    });

    const uniqueCode = `GRD-${Date.now().toString().slice(-5)}`;
    const product = await prisma.product.create({
      data: {
        shortCode: uniqueCode,
        name: `Guard Test Item ${uniqueCode}`,
        hsn: "1905",
        packSize: 12,
        mrpPaise: 10000,
        gstRateBp: 1200,
        reorderLevel: 10,
        active: true,
      },
    });

    // 1. Enter Opening Stock (3 cartons + 4 loose = 40 pieces) without a GRN
    const openRes = await godownService.enterOpeningStock(
      UserRole.SUPER_ADMIN,
      admin.id,
      {
        productId: product.id,
        locationId: "loc-godown-main",
        qty: 40,
        reason: "Initial physical opening stock without GRN",
      }
    );

    expect(openRes.resultingBalance).toBe(40);
    expect(openRes.movement.type).toBe("ADJUSTMENT");
    expect(openRes.movement.referenceType).toBe("OPENING_STOCK");

    // Verify in Storefront Catalogue (live Godown stock)
    const catalogue = await storeService.getCatalogue({ q: uniqueCode });
    const storeItem = catalogue.products.find((p) => p.id === product.id);
    expect(storeItem).toBeDefined();
    expect(storeItem?.totalAvailableQty).toBe(40);
    expect(storeItem?.isAvailable).toBe(true);

    // 2. Set Stock Count (physical count = 35 pieces -> delta -5 adjustment)
    const countRes = await godownService.setStockCount(
      UserRole.SUPER_ADMIN,
      admin.id,
      {
        productId: product.id,
        locationId: "loc-godown-main",
        countedQty: 35,
        reason: "Physical shelf count check",
      }
    );

    expect(countRes.systemQty).toBe(40);
    expect(countRes.countedQty).toBe(35);
    expect(countRes.delta).toBe(-5);
    expect(countRes.resultingBalance).toBe(35);

    // 3. Bulk CSV Preview & Apply
    const csvPreview = await godownService.previewOrApplyBulkStockCsv(
      UserRole.SUPER_ADMIN,
      admin.id,
      {
        locationId: "loc-godown-main",
        mode: "ADJUSTMENT",
        rawCsv: `shortCode,cartons,loosePieces,reason\n${uniqueCode},1,3,Found extra carton and 3 loose`,
        previewOnly: true,
      }
    );

    expect(csvPreview.applied).toBe(false);
    expect(csvPreview.errorCount).toBe(0);
    expect(csvPreview.rows[0].inputPieces).toBe(15); // 1 * 12 + 3
    expect(csvPreview.rows[0].resultingBalance).toBe(50); // 35 + 15

    const csvApply = await godownService.previewOrApplyBulkStockCsv(
      UserRole.SUPER_ADMIN,
      admin.id,
      {
        locationId: "loc-godown-main",
        mode: "ADJUSTMENT",
        rawCsv: `shortCode,cartons,loosePieces,reason\n${uniqueCode},1,3,Found extra carton and 3 loose`,
        previewOnly: false,
      }
    );

    expect(csvApply.applied).toBe(true);

    const finalCat = await storeService.getCatalogue({ q: uniqueCode });
    const finalItem = finalCat.products.find((p) => p.id === product.id);
    expect(finalItem?.totalAvailableQty).toBe(50);
  });
});
