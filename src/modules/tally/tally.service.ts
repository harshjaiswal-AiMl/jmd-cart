import { UserRole } from "@prisma/client";
import { assertPermission, hasPermission, Permission, ForbiddenError } from "@/modules/auth/permissions";
import { getISTDayRange, getISTDateString } from "@/lib/date";
import { tallyRepository, TallyRepository } from "./tally.repository";
import { buildTallyXml, buildTallyCsv } from "./tally.serializer";
import { TallyExportFilter, TallyExportResult } from "./tally.types";

export class TallyExportService {
  constructor(private readonly repo: TallyRepository = tallyRepository) {}

  /**
   * Generates Tally-compatible XML or CSV export of sales invoices and receipts.
   * Restricts access strictly to Super Admin and Accounts roles.
   */
  async exportVouchers(
    role: UserRole,
    filter: TallyExportFilter = {}
  ): Promise<TallyExportResult> {
    if (
      role !== UserRole.SUPER_ADMIN &&
      !hasPermission(role, Permission.ACCOUNTS_VIEW) &&
      !hasPermission(role, Permission.REPORTS_VIEW)
    ) {
      throw new ForbiddenError("Not authorized to export vouchers for Tally");
    }

    const format = filter.format || "XML";
    const startDateStr = filter.startDate || getISTDateString();
    const endDateStr = filter.endDate || getISTDateString();

    const startUtc = getISTDayRange(startDateStr).startUtc;
    const endUtc = getISTDayRange(endDateStr).endUtc;

    const [salesVouchers, receiptVouchers] = await Promise.all([
      filter.voucherTypes?.length && !filter.voucherTypes.includes("SALES")
        ? Promise.resolve([])
        : this.repo.getSalesVouchers(startUtc, endUtc),
      filter.voucherTypes?.length && !filter.voucherTypes.includes("RECEIPT")
        ? Promise.resolve([])
        : this.repo.getReceiptVouchers(startUtc, endUtc),
    ]);

    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === "XML") {
      content = buildTallyXml(salesVouchers, receiptVouchers);
      filename = `tally_vouchers_${startDateStr}_to_${endDateStr}.xml`;
      mimeType = "application/xml";
    } else {
      content = buildTallyCsv(salesVouchers, receiptVouchers);
      filename = `tally_vouchers_${startDateStr}_to_${endDateStr}.csv`;
      mimeType = "text/csv";
    }

    const totalSalesPaise = salesVouchers.reduce((sum, v) => sum + v.totalPaise, 0);
    const totalReceiptsPaise = receiptVouchers.reduce((sum, v) => sum + v.amountPaise, 0);

    return {
      filename,
      mimeType,
      content,
      summary: {
        startDate: startDateStr,
        endDate: endDateStr,
        salesCount: salesVouchers.length,
        receiptsCount: receiptVouchers.length,
        totalSalesPaise,
        totalReceiptsPaise,
      },
    };
  }
}

export const tallyExportService = new TallyExportService();
