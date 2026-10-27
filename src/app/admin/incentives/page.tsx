import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole, IncentiveEntryStatus, IncentivePayoutStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { incentiveService } from "@/modules/incentive/incentive.service";
import { IncentivesNavTabs } from "@/components/incentives/incentives-nav-tabs";
import { IncentivesDashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function IncentivesDashboardPage({
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

  const [year, month] = currentPeriod.split("-").map(Number);
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

  // Fetch all entries for this month
  const entries = await prisma.incentiveEntry.findMany({
    where: {
      createdAt: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
    include: {
      agentUser: {
        select: {
          id: true,
          name: true,
          agentCode: true,
          role: true,
        },
      },
      invoice: {
        select: {
          channel: true,
        },
      },
    },
  });

  // Fetch payouts for this period
  const payouts = await prisma.incentivePayout.findMany({
    where: { period: currentPeriod },
  });

  // Calculate stats
  let totalCreditedPaise = 0;
  let totalPendingPaise = 0;
  let totalReversedPaise = 0;
  let totalPaidPaise = 0;

  const agentMap = new Map<
    string,
    {
      id: string;
      name: string;
      agentCode: string | null;
      role: string;
      salesCount: number;
      creditedPaise: number;
      pendingPaise: number;
    }
  >();

  const channelMap: Record<string, number> = {
    SHOP: 0,
    VAN: 0,
    ONLINE: 0,
  };

  for (const entry of entries) {
    if (entry.status === IncentiveEntryStatus.CREDITED) {
      totalCreditedPaise += entry.amountPaise;
    } else if (entry.status === IncentiveEntryStatus.PENDING) {
      totalPendingPaise += entry.amountPaise;
    } else if (entry.status === IncentiveEntryStatus.REVERSED) {
      totalReversedPaise += Math.abs(entry.amountPaise);
    }

    const ch = entry.invoice?.channel || "SHOP";
    channelMap[ch] = (channelMap[ch] || 0) + entry.amountPaise;

    const agent = entry.agentUser;
    const existing = agentMap.get(agent.id) || {
      id: agent.id,
      name: agent.name,
      agentCode: agent.agentCode,
      role: agent.role,
      salesCount: 0,
      creditedPaise: 0,
      pendingPaise: 0,
    };

    if (entry.status === IncentiveEntryStatus.CREDITED) {
      existing.creditedPaise += entry.amountPaise;
      existing.salesCount += 1;
    } else if (entry.status === IncentiveEntryStatus.PENDING) {
      existing.pendingPaise += entry.amountPaise;
      existing.salesCount += 1;
    }
    agentMap.set(agent.id, existing);
  }

  for (const p of payouts) {
    if (p.status === IncentivePayoutStatus.PAID) {
      totalPaidPaise += p.totalPaise;
    }
  }

  const topAgents = Array.from(agentMap.values()).sort(
    (a, b) => b.creditedPaise - a.creditedPaise
  );

  // Staff missing agent codes alert
  const staffWithoutCodes = await prisma.user.findMany({
    where: {
      active: true,
      agentCode: null,
      role: {
        in: [UserRole.SHOP, UserRole.SALESPERSON, UserRole.DELIVERY],
      },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
    },
  });

  const settings = await incentiveService.getSettings();

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="border-b border-stone-200 bg-white px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-stone-900">Staff Incentives Hub</h1>
            <p className="text-xs text-stone-500">
              Manage multi-tier agent commissions, rules cascade, payouts & live ledger.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                settings.enabled
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-stone-100 text-stone-600 border border-stone-200"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  settings.enabled ? "bg-emerald-500" : "bg-stone-400"
                }`}
              />
              {settings.enabled ? "Incentives Active" : "Incentives Disabled"}
            </span>
          </div>
        </div>
      </div>

      <IncentivesNavTabs />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <IncentivesDashboardClient
          currentPeriod={currentPeriod}
          totalCreditedPaise={totalCreditedPaise}
          totalPendingPaise={totalPendingPaise}
          totalReversedPaise={totalReversedPaise}
          totalPaidPaise={totalPaidPaise}
          topAgents={topAgents}
          channelBreakdown={channelMap}
          staffWithoutCodes={staffWithoutCodes}
        />
      </div>
    </div>
  );
}
