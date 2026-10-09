import { UserRole, InvoiceChannel } from "@prisma/client";
import { getISTDayRange } from "@/lib/date";
import {
  assertPermission,
  hasPermission,
  Permission,
  ForbiddenError,
} from "@/modules/auth/permissions";
import {
  reportsRepository,
  ReportsRepository,
} from "./reports.repository";
import {
  StockValuationReport,
  LowStockReport,
  DailySalesReport,
  DailySalesReportFilter,
  DayEndCashReport,
} from "./reports.types";

export class ReportsService {
  constructor(private readonly repo: ReportsRepository = reportsRepository) {}

  /**
   * Retrieves full stock inventory and valuation report across all branches.
   */
  async getStockValuationReport(role: UserRole): Promise<StockValuationReport> {
    if (
      !hasPermission(role, Permission.STOCK_VIEW) &&
      !hasPermission(role, Permission.REPORTS_VIEW) &&
      role !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenError("Not authorized to view stock valuation report");
    }

    return this.repo.getStockValuationReport();
  }

  /**
   * Retrieves low stock items that have fallen to or below reorder levels.
   */
  async getLowStockReport(
    role: UserRole,
    customThreshold?: number
  ): Promise<LowStockReport> {
    if (
      !hasPermission(role, Permission.STOCK_VIEW) &&
      !hasPermission(role, Permission.REPORTS_VIEW) &&
      role !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenError("Not authorized to view low stock alerts report");
    }

    return this.repo.getLowStockReport(customThreshold);
  }

  /**
   * Generates comprehensive daily sales and tax report.
   */
  async getDailySalesReport(
    role: UserRole,
    filters: DailySalesReportFilter = {}
  ): Promise<DailySalesReport> {
    if (
      !hasPermission(role, Permission.REPORTS_VIEW) &&
      role !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenError("Not authorized to view daily sales reports");
    }

    const { startUtc, endUtc, dateStr } = getISTDayRange(filters.date);
    return this.repo.getDailySalesReport(
      startUtc,
      endUtc,
      dateStr,
      filters.channel,
      filters.locationId
    );
  }

  /**
   * Generates day-end cash register report for cashier drawer reconciliation.
   */
  async getDayEndCashReport(
    role: UserRole,
    dateStr?: string,
    locationId?: string
  ): Promise<DayEndCashReport> {
    if (
      !hasPermission(role, Permission.REPORTS_VIEW) &&
      !hasPermission(role, Permission.POS_CASH_CLOSE) &&
      role !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenError("Not authorized to view day-end cash report");
    }

    const range = getISTDayRange(dateStr);
    return this.repo.getDayEndCashReport(
      range.startUtc,
      range.endUtc,
      range.dateStr,
      locationId
    );
  }
}

export const reportsService = new ReportsService();
