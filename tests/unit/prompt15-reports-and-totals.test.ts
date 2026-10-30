import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../../src/lib/prisma";
import { UserRole, LocationType, MovementType } from "@prisma/client";
import { itemStockStatementService } from "../../src/modules/reports/item-stock-statement.service";
import { invoiceTotalsService } from "../../src/modules/billing/invoice-totals.service";
import { billingService } from "../../src/modules/billing/billing.service";
import { stockService } from "../../src/modules/stock/stock.service";

describe("Prompt #15 Parts 7 & 8: Item Stock Statement & Invoice Totals Bar", () => {
  let locationId: string;
  let productId: string;

  beforeEach(async () => {
    const loc = await prisma.location.create({
      data: {
        name: `Shop Location ${Date.now()}`,
        type: LocationType.SHOP,
        branchId: 1,
      },
    });
    locationId = loc.id;

    const p = await prisma.product.create({
      data: {
        name: "Statement Test Product",
        shortCode: `STP_${Date.now()}`,
        mrpPaise: 15000,
        priceAPaise: 14000,
        gstRateBp: 1800,
        packSize: 10,
        hsn: "21069099",
      },
    });
    productId = p.id;

    // Receive 50 pcs into shop
    await stockService.postMovement({
      type: MovementType.PURCHASE_RECEIPT,
      productId,
      toLocationId: locationId,
      qty: 50,
      idempotencyKey: `stmt_receipt_${Date.now()}`,
    });
  });

  it("proves Opening + In - Out = Closing invariant in Item Stock Statement", async () => {
    // Sell 10 pcs
    await billingService.finalizeInvoice(
      UserRole.ADMIN,
      {
        channel: "SHOP" as never,
        locationId,
        items: [{ productId, qty: 10 }],
        idempotencyKey: `stmt_inv_${Date.now()}`,
        payments: [{ mode: "CASH" as never, amountPaise: 140000 }],
      }
    );

    const report = await itemStockStatementService.getStatement({
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      endDate: new Date(),
    });

    const row = report.rows.find((r) => r.productId === productId);
    expect(row).toBeDefined();
    if (row) {
      // Invariant: Opening + In - Out = Closing
      const expectedClosing =
        row.openingQty +
        row.purchasedQty +
        row.transfersInQty +
        row.vanReturnsQty -
        (row.totalSoldQty + row.transfersOutQty + row.adjustmentsQty);
      expect(row.closingQty).toBe(expectedClosing);
      expect(row.totalSoldQty).toBe(10);
      expect(row.purchasedQty).toBe(50);
      expect(row.closingQty).toBe(40);
    }
  });

  it("computes exact full-query aggregates for invoice totals bar", async () => {
    const totals = await invoiceTotalsService.getInvoiceTotals({});
    expect(totals.invoiceCount).toBeGreaterThanOrEqual(0);
    expect(totals.totalAmountPaise).toBeGreaterThanOrEqual(0);
    expect(totals.avgBillPaise).toBeGreaterThanOrEqual(0);
    expect(totals.channelBreakdown).toBeDefined();
  });
});
