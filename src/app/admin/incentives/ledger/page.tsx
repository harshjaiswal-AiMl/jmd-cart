import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { IncentivesNavTabs } from "@/components/incentives/incentives-nav-tabs";
import { IncentiveLedgerClient } from "./ledger-client";

export const dynamic = "force-dynamic";

export default async function IncentiveLedgerPage({
  searchParams,
}: {
  searchParams?: Promise<{
    agentId?: string;
    status?: string;
    type?: string;
    q?: string;
  }>;
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

  // Build where clause
  const where: any = {};
  if (sp?.agentId) where.agentUserId = sp.agentId;
  if (sp?.status) where.status = sp.status;
  if (sp?.type) where.type = sp.type;
  if (sp?.q) {
    where.OR = [
      { invoice: { number: { contains: sp.q, mode: "insensitive" } } },
      { agentUser: { name: { contains: sp.q, mode: "insensitive" } } },
      { agentUser: { agentCode: { contains: sp.q, mode: "insensitive" } } },
      { note: { contains: sp.q, mode: "insensitive" } },
    ];
  }

  const entries = await prisma.incentiveEntry.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      agentUser: {
        select: { id: true, name: true, agentCode: true },
      },
      invoice: {
        select: { id: true, number: true, totalPaise: true, customerPhone: true, customerName: true, channel: true },
      },
      order: {
        select: { id: true, orderNumber: true },
      },
    },
  });

  const agents = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, agentCode: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="border-b border-stone-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Incentive Audit Ledger</h1>
          <p className="text-xs text-stone-500">
            Append-only chronological audit log of all commission credits, status transitions, adjustments and reversals.
          </p>
        </div>
      </div>

      <IncentivesNavTabs />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <IncentiveLedgerClient
          entries={entries}
          agents={agents}
          currentFilters={{
            agentId: sp?.agentId || "",
            status: sp?.status || "",
            type: sp?.type || "",
            q: sp?.q || "",
          }}
          isSuperAdmin={role === UserRole.SUPER_ADMIN}
        />
      </div>
    </div>
  );
}
