import { UserRole } from "@prisma/client";
import {
  assertPermission,
  hasPermission,
  Permission,
  ForbiddenError,
} from "@/modules/auth/permissions";
import {
  returnsRepository,
  ReturnsRepository,
} from "./returns.repository";
import {
  CreateDebitNoteInput,
  createDebitNoteSchema,
  DebitNoteWithDetails,
  CompanyReturnReportFilter,
  StockWiseReturnReport,
} from "./returns.types";

export class ReturnsService {
  constructor(private readonly repo: ReturnsRepository = returnsRepository) {}

  /**
   * Finalizes a Return to Company and generates a formal GST Debit Note.
   * Atomically deducts inventory and debits the supplier account.
   */
  async createDebitNote(
    role: UserRole,
    actorId: string,
    input: CreateDebitNoteInput
  ): Promise<DebitNoteWithDetails> {
    assertPermission(role, Permission.RETURN_TO_COMPANY);
    const parsed = createDebitNoteSchema.parse(input);
    return this.repo.createDebitNote(parsed, actorId);
  }

  /**
   * Fetches debit note details for viewing or printing.
   */
  async getDebitNoteById(
    role: UserRole,
    id: string
  ): Promise<DebitNoteWithDetails | null> {
    if (
      !hasPermission(role, Permission.RETURN_TO_COMPANY) &&
      !hasPermission(role, Permission.REPORTS_VIEW) &&
      role !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenError("Not authorized to view debit notes");
    }

    return this.repo.getDebitNoteById(id);
  }

  /**
   * Lists debit notes with optional filters.
   */
  async listDebitNotes(
    role: UserRole,
    options?: {
      supplierId?: string;
      locationId?: string;
      startDate?: Date;
      endDate?: Date;
      search?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ items: DebitNoteWithDetails[]; totalCount: number }> {
    if (
      !hasPermission(role, Permission.RETURN_TO_COMPANY) &&
      !hasPermission(role, Permission.REPORTS_VIEW) &&
      role !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenError("Not authorized to list debit notes");
    }

    return this.repo.listDebitNotes(options);
  }

  /**
   * Generates stock-wise return to company analytics report.
   */
  async getStockWiseReturnReport(
    role: UserRole,
    filter: CompanyReturnReportFilter = {}
  ): Promise<StockWiseReturnReport> {
    if (
      !hasPermission(role, Permission.RETURN_TO_COMPANY) &&
      !hasPermission(role, Permission.REPORTS_VIEW) &&
      role !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenError("Not authorized to view company return report");
    }

    return this.repo.getStockWiseReturnReport(filter);
  }
}

export const returnsService = new ReturnsService();
