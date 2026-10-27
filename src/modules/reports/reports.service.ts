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
  PartyAgeingReport,
  PartyAgeingFilter,
  Gstr1Report,
  DayBookReport,
  SalesRegisterReport,
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

  /**
   * Generates accounts receivables and overdue ageing report across debtor parties.
   */
  async getPartyAgeingReport(
    role: UserRole,
    filters: PartyAgeingFilter = {}
  ): Promise<PartyAgeingReport> {
    if (
      !hasPermission(role, Permission.ACCOUNTS_VIEW) &&
      role !== UserRole.SUPER_ADMIN &&
      role !== UserRole.ADMIN
    ) {
      throw new ForbiddenError("Not authorized to view accounts ageing report");
    }

    return this.repo.getPartyAgeingReport(filters);
  }

  /**
   * Generates GSTR-1 outward supplies report with Table 4A (B2B), Table 7 (B2CS),
   * Table 12 (HSN summary), and Rate breakdown for CA GST filing.
   */
  async getGstr1Report(
    role: UserRole,
    periodMonth?: string // YYYY-MM
  ): Promise<Gstr1Report> {
    if (
      !hasPermission(role, Permission.REPORTS_VIEW) &&
      !hasPermission(role, Permission.ACCOUNTS_VIEW) &&
      role !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenError("Not authorized to view GSTR-1 reports");
    }

    const currentPeriod = periodMonth || new Date().toISOString().slice(0, 7);
    const [yearStr, monthStr] = currentPeriod.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const startDateUtc = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDateUtc = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    return this.repo.getGstr1Report(startDateUtc, endDateUtc, currentPeriod);
  }

  /**
   * Generates Day Book report combining Sales, Purchases, Receipts, and Returns.
   */
  async getDayBookReport(
    role: UserRole,
    dateStr?: string // YYYY-MM-DD
  ): Promise<DayBookReport> {
    if (
      !hasPermission(role, Permission.REPORTS_VIEW) &&
      !hasPermission(role, Permission.ACCOUNTS_VIEW) &&
      role !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenError("Not authorized to view Day Book");
    }

    const { startUtc, endUtc, dateStr: istDate } = getISTDayRange(dateStr);
    return this.repo.getDayBookReport(startUtc, endUtc, istDate);
  }

  /**
   * Generates formal Sales Register across custom date range.
   */
  async getSalesRegisterReport(
    role: UserRole,
    startDateStr?: string,
    endDateStr?: string
  ): Promise<SalesRegisterReport> {
    if (
      !hasPermission(role, Permission.REPORTS_VIEW) &&
      !hasPermission(role, Permission.ACCOUNTS_VIEW) &&
      role !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenError("Not authorized to view Sales Register");
    }

    const start = startDateStr ? getISTDayRange(startDateStr).startUtc : getISTDayRange().startUtc;
    const end = endDateStr ? getISTDayRange(endDateStr).endUtc : getISTDayRange().endUtc;

    return this.repo.getSalesRegisterReport(start, end, startDateStr, endDateStr);
  }
}

export const reportsService = new ReportsService();
