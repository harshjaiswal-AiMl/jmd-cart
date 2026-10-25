import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { reportsService } from "@/modules/reports/reports.service";
import { billingService } from "@/modules/billing/billing.service";
import { getISTDateString } from "@/lib/date";
import {
  UserRole,
  LocationType,
  PaymentMode,
  InvoiceChannel,
} from "@prisma/client";

describe("Task 1.14: Basic Reports Service", () => {
  let shopLocationId: string;
  let testProductId: string;
  let todayStr: string;

  beforeAll(async () => {
    todayStr = getISTDateString();

    let shopLoc = await prisma.location.findFirst({
      where: { type: LocationType.SHOP },
    });
    if (!shopLoc) {
      shopLoc = await prisma.location.create({
        data: { name: "Report Test Shop", type: LocationType.SHOP },
      });
    }
    shopLocationId = shopLoc.id;

    const timestamp = Date.now();
    const company = await prisma.company.create({
      data: { name: `Report Co ${timestamp}` },
    });
    const category = await prisma.category.create({
      data: { name: `Report Cat ${timestamp}` },
    });

    const product = await prisma.product.create({
      data: {
        company: { connect: { id: company.id } },
        category: { connect: { id: category.id } },
        name: `Report Product ${timestamp}`,
        shortCode: `REP_${timestamp}`.slice(0, 16),
        hsn: "21069099",
        gstRateBp: 1200, // 12%
        mrpPaise: 20000, // ₹200.00
        packSize: 12,
        packLabel: "Carton of 12",
        reorderLevel: 50,
      },
    });
    testProductId = product.id;

    // Seed stock of 20 units (below reorderLevel of 50 -> deficit 30)
    await prisma.stockBalance.upsert({
      where: {
        productId_locationId: {
          productId: testProductId,
          locationId: shopLocationId,
        },
      },
      update: { qty: 20 },
      create: {
        productId: testProductId,
        locationId: shopLocationId,
        qty: 20,
      },
    });
  });

  describe("Stock Valuation Report", () => {
    it("computes accurate stock quantities, carton conversions, and valuation", async () => {
      const report = await reportsService.getStockValuationReport(
        UserRole.SUPER_ADMIN
      );

      expect(report.totalProducts).toBeGreaterThan(0);
      expect(report.totalUnits).toBeGreaterThan(0);
      expect(report.totalValuationPaise).toBeGreaterThan(0);

      const target = report.items.find((i) => i.productId === testProductId);
      expect(target).toBeDefined();
      if (!target) return;

      expect(target.totalQty).toBe(20);
      expect(target.cartonCount).toBe(1); // 20 / 12 = 1 ctn
      expect(target.looseCount).toBe(8); // 20 % 12 = 8 pcs
      expect(target.valuationPaise).toBe(20 * target.costPaise);
    });

    it("rejects unauthorized roles without STOCK_VIEW or REPORTS_VIEW", async () => {
      await expect(
        reportsService.getStockValuationReport(UserRole.DELIVERY)
      ).rejects.toThrow(/Not authorized/);
    });
  });

  describe("Low Stock Alert Report", () => {
    it("flags products with stock at or below reorder level with exact deficit", async () => {
      const report = await reportsService.getLowStockReport(UserRole.SUPER_ADMIN);

      const alertItem = report.items.find((i) => i.productId === testProductId);
      expect(alertItem).toBeDefined();
      if (!alertItem) return;

      expect(alertItem.currentStock).toBe(20);
      expect(alertItem.reorderLevel).toBe(50);
      expect(alertItem.deficit).toBe(30);
    });
  });

  describe("Daily Sales & Day-End Cash Reports", () => {
    it("aggregates sales, taxes, and split payments accurately for the business date", async () => {
      // Create a sale for 2 units
      const invoice = await billingService.finalizeInvoice(
        UserRole.SUPER_ADMIN,
        {
          channel: InvoiceChannel.SHOP,
          locationId: shopLocationId,
          idempotencyKey: `report_sale_${Date.now()}`,
          items: [{ productId: testProductId, qty: 2 }],
          payments: [
            { mode: PaymentMode.CASH, amountPaise: 20000 },
            { mode: PaymentMode.UPI, amountPaise: 20000 },
          ],
        }
      );

      expect(invoice.id).toBeDefined();

      // Retrieve Daily Sales Report for today
      const salesReport = await reportsService.getDailySalesReport(
        UserRole.SUPER_ADMIN,
        { date: todayStr }
      );

      expect(salesReport.date).toBe(todayStr);
      expect(salesReport.invoiceCount).toBeGreaterThan(0);
      expect(salesReport.totalUnitsSold).toBeGreaterThan(0);
      expect(salesReport.netSalesPaise).toBeGreaterThan(0);

      const cashPayment = salesReport.paymentsByMode.find(
        (p) => p.mode === PaymentMode.CASH
      );
      expect(cashPayment).toBeDefined();
      expect(cashPayment!.amountPaise).toBeGreaterThanOrEqual(20000);

      const upiPayment = salesReport.paymentsByMode.find(
        (p) => p.mode === PaymentMode.UPI
      );
      expect(upiPayment).toBeDefined();
      expect(upiPayment!.amountPaise).toBeGreaterThanOrEqual(20000);

      // Retrieve Day-End Cash Report
      const cashReport = await reportsService.getDayEndCashReport(
        UserRole.SUPER_ADMIN,
        todayStr
      );

      expect(cashReport.date).toBe(todayStr);
      expect(cashReport.totalCashPaise).toBeGreaterThanOrEqual(20000);
      expect(cashReport.transactionsCount).toBeGreaterThan(0);

      const matchedTx = cashReport.transactions.find(
        (tx) => tx.invoiceNumber === invoice.number
      );
      expect(matchedTx).toBeDefined();
      expect(matchedTx!.amountPaise).toBe(20000);
    });
  });
});
