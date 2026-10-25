import { UserRole } from "@prisma/client";
import { vanRepository } from "./van.repository";
import {
  createVanIssueSheetSchema,
  CreateVanIssueSheetInput,
  VanDayWithDetails,
  VanStockSummary,
  reconcileVanDaySchema,
  ReconcileVanDayInput,
  VanReconciliationReport,
  confirmCashHandoverSchema,
  ConfirmCashHandoverInput,
  CashHandoverWithDetails,
} from "./van.types";
import { assertPermission, Permission } from "@/modules/auth/permissions";
import { auditService } from "@/modules/audit/audit.service";

export class VanService {
  async listVanLocations(role: UserRole) {
    assertPermission(role, Permission.STOCK_VIEW);
    return vanRepository.listVanLocations();
  }

  async listVanDays(
    role: UserRole,
    filters?: {
      vanLocationId?: string;
      salespersonId?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ vanDays: VanDayWithDetails[]; total: number }> {
    assertPermission(role, Permission.STOCK_VIEW);
    return vanRepository.listVanDays(filters);
  }

  async getVanDayById(role: UserRole, id: string): Promise<VanDayWithDetails | null> {
    assertPermission(role, Permission.STOCK_VIEW);
    return vanRepository.getVanDayById(id);
  }

  async createVanIssueSheet(
    role: UserRole,
    actorId: string,
    input: CreateVanIssueSheetInput
  ): Promise<VanDayWithDetails> {
    assertPermission(role, Permission.VAN_ISSUE_LOAD);
    const parsed = createVanIssueSheetSchema.parse(input);

    const vanDay = await vanRepository.createVanIssueSheet(actorId, parsed);

    await auditService.log({
      actorId,
      action: "VAN_ISSUE_SHEET_CREATE",
      entity: "van_day",
      entityId: vanDay.id,
      after: {
        issueSheetNo: vanDay.issueSheetNo,
        vanLocationId: vanDay.vanLocationId,
        salespersonId: vanDay.salespersonId,
        lineCount: vanDay.lines.length,
      },
    });

    return vanDay;
  }

  async getVanStockSummary(role: UserRole, vanLocationId: string): Promise<VanStockSummary> {
    assertPermission(role, Permission.STOCK_VIEW);
    return vanRepository.getVanStockSummary(vanLocationId);
  }

  async getActiveVanDayForSalesperson(
    role: UserRole,
    salespersonId: string
  ): Promise<VanDayWithDetails | null> {
    assertPermission(role, Permission.STOCK_VIEW);
    return vanRepository.getActiveVanDayForSalesperson(salespersonId);
  }

  async getVanReconciliation(
    role: UserRole,
    vanDayId: string
  ): Promise<VanReconciliationReport> {
    assertPermission(role, Permission.VAN_RECONCILE);
    return vanRepository.getVanReconciliationData(vanDayId);
  }

  async reconcileVanDay(
    role: UserRole,
    actorId: string,
    input: ReconcileVanDayInput
  ): Promise<VanReconciliationReport> {
    assertPermission(role, Permission.VAN_RECONCILE);
    const parsed = reconcileVanDaySchema.parse(input);

    const report = await vanRepository.reconcileVanDay(actorId, parsed);

    await auditService.log({
      actorId,
      action: "VAN_DAY_RECONCILE",
      entity: "van_day",
      entityId: report.vanDay.id,
      after: {
        issueSheetNo: report.vanDay.issueSheetNo,
        status: report.vanDay.status,
        totalIssuedValuationPaise: report.financials.totalIssuedValuationPaise,
        totalSoldValuationPaise: report.financials.totalSoldValuationPaise,
        totalShortageValuationPaise: report.financials.totalShortageValuationPaise,
        totalExcessValuationPaise: report.financials.totalExcessValuationPaise,
        totalCashInHandPaise: report.financials.totalCashInHandPaise,
      },
    });

    return report;
  }

  async getCashHandoverByVanDay(
    role: UserRole,
    vanDayId: string
  ): Promise<CashHandoverWithDetails | null> {
    assertPermission(role, Permission.STOCK_VIEW);
    return vanRepository.getCashHandoverByVanDay(vanDayId);
  }

  async confirmCashHandover(
    role: UserRole,
    actorId: string,
    input: ConfirmCashHandoverInput
  ): Promise<CashHandoverWithDetails> {
    assertPermission(role, Permission.CONFIRM_CASH_HANDOVER);
    const parsed = confirmCashHandoverSchema.parse(input);

    const handover = await vanRepository.confirmCashHandover(actorId, parsed);

    await auditService.log({
      actorId,
      action: "CASH_HANDOVER_CONFIRM",
      entity: "cash_handover",
      entityId: handover.id,
      after: {
        vanDayId: handover.vanDayId,
        salespersonId: handover.salespersonId,
        receivedById: handover.receivedById,
        expectedCashPaise: handover.expectedCashPaise,
        receivedCashPaise: handover.receivedCashPaise,
        shortagePaise: handover.shortagePaise,
        excessPaise: handover.excessPaise,
        closedVanDay: handover.vanDay.issueSheetNo,
      },
    });

    return handover;
  }
}

export const vanService = new VanService();
