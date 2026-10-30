import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../../src/lib/prisma";
import { UserRole, LocationType, MovementType } from "@prisma/client";
import { productEditService } from "../../src/modules/catalog/product-edit.service";
import { stockService } from "../../src/modules/stock/stock.service";

describe("Prompt #15 Part 6: Product Details Modification & Pack Size Guard", () => {
  let productId: string;
  let locationId: string;

  beforeEach(async () => {
    const p = await prisma.product.create({
      data: {
        name: "Pack Guard Test Product",
        shortCode: `PGP_${Date.now()}`,
        mrpPaise: 5000,
        priceAPaise: 4500,
        packSize: 10,
        packLabel: "Box",
        hsn: "21069099",
      },
    });
    productId = p.id;

    const loc = await prisma.location.create({
      data: {
        name: `Test Godown ${Date.now()}`,
        type: LocationType.GODOWN,
        branchId: 1,
      },
    });
    locationId = loc.id;
  });

  it("blocks non-admin users from modifying pricing fields", async () => {
    await expect(
      productEditService.updateProduct(
        UserRole.GODOWN,
        {
          productId,
          mrpPaise: 6000,
        }
      )
    ).rejects.toThrow("Only Administrators can modify pricing fields");
  });

  it("requires confirmation when altering pack size on a product with stock", async () => {
    // Add stock to product
    await stockService.postMovement({
      type: MovementType.PURCHASE_RECEIPT,
      productId,
      toLocationId: locationId,
      qty: 100, // 10 cartons of 10
      idempotencyKey: `init_pack_stock_${Date.now()}`,
    });

    // Attempt pack size change without confirmation -> should fail
    await expect(
      productEditService.updateProduct(
        UserRole.ADMIN,
        {
          productId,
          packSize: 20,
        }
      )
    ).rejects.toThrow("Pack size change requires confirmation");

    // With explicit confirmation -> succeeds
    const updated = await productEditService.updateProduct(
      UserRole.ADMIN,
      {
        productId,
        packSize: 20,
        confirmPackSizeChange: true,
      }
    );
    expect(updated.packSize).toBe(20);

    // Verify ProductRevision created
    const revisions = await prisma.productRevision.findMany({
      where: { productId },
    });
    expect(revisions.length).toBe(1);
  });
});
