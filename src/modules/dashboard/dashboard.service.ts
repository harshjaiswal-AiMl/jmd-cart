import { UserRole } from "@prisma/client";
import { assertPermission, hasPermission, Permission, ForbiddenError } from "@/modules/auth/permissions";
import { dashboardRepository, DashboardRepository } from "./dashboard.repository";
import { OwnerDashboardData } from "./dashboard.types";

export class DashboardService {
  constructor(private readonly repo: DashboardRepository = dashboardRepository) {}

  /**
   * Retrieves aggregated business health metrics for the Owner / Super Admin.
   * Enforces strict RBAC guard (Super Admin and authorized executive roles).
   */
  async getOwnerDashboardData(
    role: UserRole,
    dateStr?: string
  ): Promise<OwnerDashboardData> {
    if (
      role !== UserRole.SUPER_ADMIN &&
      !hasPermission(role, Permission.SYSTEM_ADMIN) &&
      !hasPermission(role, Permission.REPORTS_VIEW)
    ) {
      throw new ForbiddenError("Not authorized to view owner executive dashboard");
    }

    return this.repo.getOwnerDashboardData(dateStr);
  }
}

export const dashboardService = new DashboardService();
