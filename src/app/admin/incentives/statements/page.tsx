import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { incentiveService } from "@/modules/incentive/incentive.service";
import { IncentivesNavTabs } from "@/components/incentives/incentives-nav-tabs";
import { IncentiveStatementsClient } from "./statements-client";

export const dynamic = "force-dynamic";

export default async function IncentiveStatementsPage({
  searchParams,
}: {
  searchParams?: Promise<{ period?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const role = session.user.role;
  if (role !== UserRole.SUPER_ADMIN && role !== UserRole.ADMIN) {
    redirect("/login");
  }

  const sp = await searchParams;
  const now = new Date();
  const currentPeriod =
    sp?.period ||
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Get all active agents/staff with an agentCode or eligible roles
  const agents = await prisma.user.findMany({
    where: {
      active: true,
      OR: [
        { agentCode: { not: null } },
        { role: { in: [UserRole.SHOP, UserRole.SALESPERSON, UserRole.DELIVERY] } },
      ],
    },
    select: {
      id: true,
      name: true,
      agentCode: true,
      role: true,
      phone: true,
    },
    orderBy: { name: "asc" },
  });

  // Compute statements for each agent
  const statements = await Promise.all(
    agents.map(async (agent) => {
      const stmt = await incentiveService.getMonthlyStatement(agent.id, currentPeriod);
      return {
        ...stmt,
        agentRole: agent.role,
        agentPhone: agent.phone,
      };
    })
  );

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="border-b border-stone-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Monthly Payout Statements</h1>
          <p className="text-xs text-stone-500">
            Review monthly agent earnings, approve net statements, and record bank/cash/UPI disbursements.
          </p>
        </div>
      </div>

      <IncentivesNavTabs />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <IncentiveStatementsClient
          currentPeriod={currentPeriod}
          statements={statements}
        />
      </div>
    </div>
  );
}
