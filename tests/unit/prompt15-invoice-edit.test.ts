import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../../src/lib/prisma";
import { UserRole, LocationType, MovementType } from "@prisma/client";
import { invoiceEditService } from "../../src/modules/billing/invoice-edit.service";
import { billingService } from "../../src/modules/billing/billing.service";
import { stockService } from "../../src/modules/stock/stock.service";

describe("Prompt #15 Part 5: Invoice Modification & Append-Only Stock Deltas", () => {
  let locationId: string;
  let productId1: string;
  let productId2: string;
  let partyId: string;

  beforeEach(async () => {
    // 1. Setup test location
    const loc = await prisma.location.create({
      data: {
        name: `Test Shop ${Date.now()}`,
        type: LocationType.SHOP,
        branchId: 1,
      },
    });
    locationId = loc.id;

    // 2. Setup test products
    const p1 = await prisma.product.create({
      data: {
        name: "Test Product A",
        shortCode: `TPA_${Date.now()}`,
        mrpPaise: 10000, // Rs 100
        priceAPaise: 9000, // Rs 90
        gstRateBp: 1800,
        packSize: 10,
        hsn: "21069099",
      },
    });
    productId1 = p1.id;

    const p2 = await prisma.product.create({
      data: {
        name: "Test Product B",
        shortCode: `TPB_${Date.now()}`,
        mrpPaise: 20000, // Rs 200
        priceAPaise: 18000, // Rs 180
        gstRateBp: 1200,
        packSize: 5,
        hsn: "21069099",
      },
    });
    productId2 = p2.id;

    // 3. Post initial stock to shop location
    await stockService.postMovement({
      type: MovementType.PURCHASE_RECEIPT,
      productId: productId1,
      toLocationId: locationId,
      qty: 100,
      idempotencyKey: `init_stock_p1_${Date.now()}`,
    });

    await stockService.postMovement({
      type: MovementType.PURCHASE_RECEIPT,
      productId: productId2,
      toLocationId: locationId,
      qty: 100,
      idempotencyKey: `init_stock_p2_${Date.now()}`,
    });

    // 4. Setup party
    const party = await prisma.party.create({
      data: {
        name: `Test Kirana ${Date.now()}`,
        type: "RETAILER" as never,
        phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        creditEnabled: true,
        creditLimitPaise: 5000000,
      },
    });
    partyId = party.id;
  });

  it("modifies invoice items, posts append-only stock deltas, and creates InvoiceRevision", async () => {
    // 1. Create an initial invoice with 5 pcs of Product A
    const initialInvoice = await billingService.finalizeInvoice(
      UserRole.ADMIN,
      {
        channel: "SHOP" as never,
        locationId,
        partyId,
        items: [{ productId: productId1, qty: 5 }],
        idempotencyKey: `inv_test_${Date.now()}`,
        payments: [{ mode: "CASH" as never, amountPaise: 45000 }],
      }
    );

    expect(initialInvoice.version).toBe(1);
    expect(initialInvoice.isRevised).toBe(false);

    // Verify stock balance after sale (100 - 5 = 95)
    const balAfterSale = await prisma.stockBalance.findUnique({
      where: { productId_locationId: { productId: productId1, locationId } },
    });
    expect(balAfterSale?.qty).toBe(95);

    // 2. Modify invoice: Increase Product A to 8 pcs (+3 pcs) and add 2 pcs of Product B
    const updatedInvoice = await invoiceEditService.modifyInvoice(
      UserRole.ADMIN,
      {
        invoiceId: initialInvoice.id,
        expectedVersion: 1,
        reason: "Customer requested additional items and changed quantity",
        items: [
          { productId: productId1, qty: 8, ratePaise: 9000 },
          { productId: productId2, qty: 2, ratePaise: 18000 },
        ],
      }
    );

    expect(updatedInvoice.version).toBe(2);
    expect(updatedInvoice.isRevised).toBe(true);

    // 3. Verify stock balances:
    // Product A: 95 - 3 = 92 pcs
    // Product B: 100 - 2 = 98 pcs
    const balP1AfterEdit = await prisma.stockBalance.findUnique({
      where: { productId_locationId: { productId: productId1, locationId } },
    });
    expect(balP1AfterEdit?.qty).toBe(92);

    const balP2AfterEdit = await prisma.stockBalance.findUnique({
      where: { productId_locationId: { productId: productId2, locationId } },
    });
    expect(balP2AfterEdit?.qty).toBe(98);

    // 4. Verify InvoiceRevision record exists with before & after snapshots
    const revisions = await prisma.invoiceRevision.findMany({
      where: { invoiceId: initialInvoice.id },
    });
    expect(revisions.length).toBe(1);
    expect(revisions[0].revisionNumber).toBe(1);
    expect(revisions[0].reason).toContain("Customer requested additional items");

    // 5. Verify optimistic locking blocks edits with outdated expectedVersion
    await expect(
      invoiceEditService.modifyInvoice(UserRole.ADMIN, {
        invoiceId: initialInvoice.id,
        expectedVersion: 1, // now version 2!
        reason: "Outdated concurrent edit",
        items: [{ productId: productId1, qty: 10 }],
      })
    ).rejects.toThrow("Conflict");
  });
});
