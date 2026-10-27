import { prisma } from "@/lib/prisma";
import { InvoiceChannel, InvoiceStatus, UserRole } from "@prisma/client";
import { auditService } from "@/modules/audit/audit.service";
import { ForbiddenError } from "@/modules/auth/permissions";

export interface AgentSalesFilter {
  startDate?: Date;
  endDate?: Date;
  agentUserId?: string;
  locationId?: string;
  channel?: InvoiceChannel;
}

export interface AgentSalesSummaryRow {
  agentUserId: string;
  agentName: string;
  agentCode: string;
  role: string;
  invoiceCount: number;
  grossSalesPaise: number;
  cancelledCount: number;
  cancelledPaise: number;
  netSalesPaise: number;
  // EXTENSION POINT: Calculated incentive / commission for staff payouts
  commissionPaise: number;
}

export interface AgentSalesReport {
  period: {
    startDate: string;
    endDate: string;
  };
  totalInvoices: number;
  totalGrossSalesPaise: number;
  totalCancelledPaise: number;
  totalNetSalesPaise: number;
  agents: AgentSalesSummaryRow[];
  invoices: Array<{
    id: string;
    number: string;
    createdAt: Date;
    channel: string;
    locationName: string;
    customerName: string | null;
    customerPhone: string | null;
    status: InvoiceStatus;
    totalPaise: number;
    agentUserId: string | null;
    agentName: string;
    agentCode: string;
  }>;
}

export class AgentService {
  /**
   * Generates the next sequential agent code (e.g. AG001, AG002, ...).
   */
  async generateNextAgentCode(prefix = "AG"): Promise<string> {
    const users = await prisma.user.findMany({
      where: {
        agentCode: {
          not: null,
        },
      },
      select: { agentCode: true },
    });

    let maxNum = 0;
    const cleanPrefix = prefix.toUpperCase().trim();
    const regex = new RegExp(`^${cleanPrefix}(\\d+)$`, "i");

    for (const u of users) {
      if (!u.agentCode) continue;
      const match = u.agentCode.trim().match(regex);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }

    const nextNum = maxNum + 1;
    return `${cleanPrefix}${String(nextNum).padStart(3, "0")}`;
  }

  /**
   * Admin reassignment of an invoice's agent for incentive corrections.
   * Logs old and new agent in the audit trail.
   */
  async reassignInvoiceAgent(params: {
    invoiceId: string;
    newAgentUserId: string;
    reason: string;
    actorId: string;
    actorRole: UserRole;
  }): Promise<{ success: boolean; invoiceNumber: string; newAgentCode: string }> {
    if (
      params.actorRole !== UserRole.SUPER_ADMIN &&
      params.actorRole !== UserRole.ADMIN
    ) {
      throw new ForbiddenError("Only Administrators can reassign invoice agents.");
    }

    if (!params.reason || params.reason.trim().length < 3) {
      throw new Error("A valid reason (minimum 3 characters) is required for reassignment.");
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.invoiceId },
      include: {
        agentUser: { select: { id: true, name: true, agentCode: true } },
      },
    });

    if (!invoice) {
      throw new Error(`Invoice with ID ${params.invoiceId} not found.`);
    }

    const newAgent = await prisma.user.findUnique({
      where: { id: params.newAgentUserId },
      select: { id: true, name: true, agentCode: true },
    });

    if (!newAgent) {
      throw new Error(`Target user ${params.newAgentUserId} does not exist.`);
    }

    const oldAgentSnapshot = {
      agentUserId: invoice.agentUserId,
      agentCodeSnapshot: invoice.agentCodeSnapshot,
      agentName: invoice.agentUser?.name || null,
    };

    const newAgentCode = newAgent.agentCode || "NO_CODE";

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        agentUserId: newAgent.id,
        agentCodeSnapshot: newAgent.agentCode ?? null,
      },
    });

    await auditService.log({
      actorId: params.actorId,
      action: "INVOICE_AGENT_REASSIGNED",
      entity: "Invoice",
      entityId: invoice.id,
      before: oldAgentSnapshot,
      after: {
        agentUserId: newAgent.id,
        agentCodeSnapshot: newAgent.agentCode,
        agentName: newAgent.name,
        reason: params.reason.trim(),
      },
    });

    return {
      success: true,
      invoiceNumber: invoice.number,
      newAgentCode,
    };
  }

  /**
   * Retrieves aggregated sales performance grouped by agent.
   * Excludes cancelled invoices from gross and net sales metrics.
   */
  async getAgentSalesReport(filter: AgentSalesFilter = {}): Promise<AgentSalesReport> {
    const whereClause: Record<string, unknown> = {};

    if (filter.startDate || filter.endDate) {
      whereClause.createdAt = {
        ...(filter.startDate ? { gte: filter.startDate } : {}),
        ...(filter.endDate ? { lte: filter.endDate } : {}),
      };
    }

    if (filter.agentUserId) {
      whereClause.agentUserId = filter.agentUserId;
    }

    if (filter.locationId) {
      whereClause.locationId = filter.locationId;
    }

    if (filter.channel) {
      whereClause.channel = filter.channel;
    }

    const invoices = await prisma.invoice.findMany({
      where: whereClause,
      include: {
        agentUser: {
          select: {
            id: true,
            name: true,
            agentCode: true,
            role: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            agentCode: true,
            role: true,
          },
        },
        location: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const agentMap = new Map<string, AgentSalesSummaryRow>();

    let totalInvoices = 0;
    let totalGrossSalesPaise = 0;
    let totalCancelledPaise = 0;
    let totalNetSalesPaise = 0;

    const invoiceList = invoices.map((inv) => {
      const isCancelled = inv.status === InvoiceStatus.CANCELLED;
      const effectiveAgentId = inv.agentUserId || inv.createdBy || "UNASSIGNED";
      const agentObj = inv.agentUser || inv.creator;
      const agentName = agentObj?.name || (inv.agentUserId ? "Unknown Agent" : "Direct / Counter");
      const agentCode = inv.agentCodeSnapshot || agentObj?.agentCode || "—";
      const agentRole = agentObj?.role || "STAFF";

      if (!agentMap.has(effectiveAgentId)) {
        agentMap.set(effectiveAgentId, {
          agentUserId: effectiveAgentId,
          agentName,
          agentCode,
          role: agentRole,
          invoiceCount: 0,
          grossSalesPaise: 0,
          cancelledCount: 0,
          cancelledPaise: 0,
          netSalesPaise: 0,
          commissionPaise: 0,
        });
      }

      const row = agentMap.get(effectiveAgentId)!;

      if (isCancelled) {
        row.cancelledCount += 1;
        row.cancelledPaise += inv.totalPaise;
        totalCancelledPaise += inv.totalPaise;
      } else {
        row.invoiceCount += 1;
        row.grossSalesPaise += inv.totalPaise;
        row.netSalesPaise += inv.totalPaise;

        totalInvoices += 1;
        totalGrossSalesPaise += inv.totalPaise;
        totalNetSalesPaise += inv.totalPaise;

        // =========================================================================
        // EXTENSION POINT: Commission / Incentive Calculation Rule
        // Future commission policy (e.g. 1.5% on FMCG or tiered bonus on target)
        // can plug in here without modifying core billing or ledger schemas.
        // Current default: 0 paise (tracked purely on net sales turnover).
        // =========================================================================
        row.commissionPaise = 0;
      }

      return {
        id: inv.id,
        number: inv.number,
        createdAt: inv.createdAt,
        channel: inv.channel,
        locationName: inv.location?.name || "Shop",
        customerName: inv.customerName,
        customerPhone: inv.customerPhone,
        status: inv.status,
        totalPaise: inv.totalPaise,
        agentUserId: inv.agentUserId,
        agentName,
        agentCode,
      };
    });

    const agents = Array.from(agentMap.values()).sort(
      (a, b) => b.netSalesPaise - a.netSalesPaise
    );

    return {
      period: {
        startDate: filter.startDate ? filter.startDate.toISOString() : "All-time",
        endDate: filter.endDate ? filter.endDate.toISOString() : "Present",
      },
      totalInvoices,
      totalGrossSalesPaise,
      totalCancelledPaise,
      totalNetSalesPaise,
      agents,
      invoices: invoiceList,
    };
  }
}

export const agentService = new AgentService();
