import { UserRole } from "@prisma/client";
import { vanRepository } from "./van.repository";
import {
  createVanIssueSheetSchema,
  CreateVanIssueSheetInput,
  VanDayWithDetails,
  VanStockSummary,
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
}

export const vanService = new VanService();
