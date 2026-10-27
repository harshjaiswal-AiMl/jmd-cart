import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { agentService } from "@/modules/billing/agent.service";
import { prisma } from "@/lib/prisma";
import { AgentSalesClient } from "./agent-sales-client";

export const dynamic = "force-dynamic";

export default async function AgentSalesReportPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/reports/agent-sales");
  }

  const allowedRoles: string[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ACCOUNTS];
  if (!allowedRoles.includes(session.user.role)) {
    return (
      <div className="p-8 text-center text-sm font-semibold text-red-700 bg-red-50 rounded-2xl border border-red-200">
        Access restricted to Administrators and Accounts personnel.
      </div>
    );
  }

  // Initial report: last 30 days
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);

  const [initialReport, agents, locations] = await Promise.all([
    agentService.getAgentSalesReport({
      startDate: thirtyDaysAgo,
      endDate: now,
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, role: true, agentCode: true },
      orderBy: { name: "asc" },
    }),
    prisma.location.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <AgentSalesClient
      initialReport={initialReport}
      agents={agents}
      locations={locations}
      isAdmin={session.user.role === UserRole.SUPER_ADMIN || session.user.role === UserRole.ADMIN}
    />
  );
}
