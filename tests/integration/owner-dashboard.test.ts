import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { dashboardService } from "@/modules/dashboard/dashboard.service";
import { UserRole, LocationType, InvoiceChannel, PaymentMode } from "@prisma/client";
import { ForbiddenError } from "@/modules/auth/permissions";

describe("Owner Executive Dashboard (Task 4.1)", () => {
  let superAdminId: string;

  beforeAll(async () => {
    const admin = await prisma.user.findFirst({
      where: { role: UserRole.SUPER_ADMIN },
    });
    if (!admin) {
      throw new Error("Super admin required for dashboard tests");
    }
    superAdminId = admin.id;
  });

  describe("RBAC Permissions", () => {
    it("allows SUPER_ADMIN to retrieve owner dashboard data", async () => {
      const data = await dashboardService.getOwnerDashboardData(UserRole.SUPER_ADMIN);

      expect(data).toBeDefined();
      expect(data.asOfDate).toBeDefined();
      expect(data.metrics).toBeDefined();
      expect(data.channelBreakdown).toBeDefined();
      expect(data.topSellingProducts).toBeDefined();
      expect(data.criticalAlerts).toBeDefined();
      expect(data.recentActivities).toBeDefined();
    });

    it("rejects unauthorized staff roles (e.g. SHOP, SALESPERSON, DELIVERY, CUSTOMER)", async () => {
      await expect(
        dashboardService.getOwnerDashboardData(UserRole.SHOP)
      ).rejects.toThrow(ForbiddenError);

      await expect(
        dashboardService.getOwnerDashboardData(UserRole.SALESPERSON)
      ).rejects.toThrow(ForbiddenError);

      await expect(
        dashboardService.getOwnerDashboardData(UserRole.DELIVERY)
      ).rejects.toThrow(ForbiddenError);

      await expect(
        dashboardService.getOwnerDashboardData(UserRole.CUSTOMER)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("KPI Metrics Aggregation", () => {
    it("aggregates sales, cash, upi, stock valuation, and receivables in integer paise", async () => {
      const data = await dashboardService.getOwnerDashboardData(UserRole.SUPER_ADMIN);

      const { metrics } = data;
      expect(metrics.todaySalesPaise).toBeGreaterThanOrEqual(0);
      expect(metrics.todaySalesCount).toBeGreaterThanOrEqual(0);
      expect(metrics.todayCashCollectedPaise).toBeGreaterThanOrEqual(0);
      expect(metrics.todayUpiCollectedPaise).toBeGreaterThanOrEqual(0);
      expect(metrics.totalStockValuationPaise).toBeGreaterThanOrEqual(0);
      expect(metrics.totalStockUnits).toBeGreaterThanOrEqual(0);
      expect(metrics.totalReceivablesPaise).toBeGreaterThanOrEqual(0);
    });

    it("returns channel distribution breakdown for SHOP, VAN, and ONLINE channels", async () => {
      const data = await dashboardService.getOwnerDashboardData(UserRole.SUPER_ADMIN);

      expect(data.channelBreakdown.length).toBe(3);
      const channels = data.channelBreakdown.map((c) => c.channel);
      expect(channels).toContain(InvoiceChannel.SHOP);
      expect(channels).toContain(InvoiceChannel.VAN);
      expect(channels).toContain(InvoiceChannel.ONLINE);

      for (const ch of data.channelBreakdown) {
        expect(ch.salesPaise).toBeGreaterThanOrEqual(0);
        expect(ch.invoicesCount).toBeGreaterThanOrEqual(0);
        expect(ch.percent).toBeGreaterThanOrEqual(0);
      }
    });

    it("returns recent activity stream with formatted transaction badges", async () => {
      const data = await dashboardService.getOwnerDashboardData(UserRole.SUPER_ADMIN);

      expect(Array.isArray(data.recentActivities)).toBe(true);
      if (data.recentActivities.length > 0) {
        const first = data.recentActivities[0];
        expect(first.title).toBeDefined();
        expect(first.description).toBeDefined();
        expect(first.badgeText).toBeDefined();
        expect(first.timestamp).toBeInstanceOf(Date);
      }
    });
  });
});
