"use server";

import { auth } from "@/auth";
import { UserRole } from "@prisma/client";
import { agentService, AgentSalesFilter } from "@/modules/billing/agent.service";
import { prisma } from "@/lib/prisma";

export async function getAgentReportAction(filter: AgentSalesFilter = {}) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const allowedRoles: string[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ACCOUNTS];
  if (!allowedRoles.includes(session.user.role)) {
    throw new Error("Access denied: Administrator or Accounts role required");
  }

  return agentService.getAgentSalesReport(filter);
}

export async function reassignAgentAction(
  invoiceId: string,
  newAgentUserId: string,
  reason: string
) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Session expired" };
  }

  try {
    const res = await agentService.reassignInvoiceAgent({
      invoiceId,
      newAgentUserId,
      reason,
      actorId: session.user.id,
      actorRole: session.user.role as UserRole,
    });
    return res;
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Reassignment failed",
    };
  }
}

export async function getNextAgentCodeAction() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return agentService.generateNextAgentCode("AG");
}

export async function listAgentsAction() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  return prisma.user.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      role: true,
      agentCode: true,
    },
    orderBy: { name: "asc" },
  });
}
