import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { IncentivesNavTabs } from "@/components/incentives/incentives-nav-tabs";
import { IncentiveBackfillClient } from "./backfill-client";

export const dynamic = "force-dynamic";

export default async function IncentiveBackfillPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const role = session.user.role;
  if (role !== UserRole.SUPER_ADMIN && role !== UserRole.ADMIN) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="border-b border-stone-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Historical Backfill Tool</h1>
          <p className="text-xs text-stone-500">
            Preview and retrospectively calculate incentive ledger entries for past finalized invoices without duplicates.
          </p>
        </div>
      </div>

      <IncentivesNavTabs />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <IncentiveBackfillClient />
      </div>
    </div>
  );
}
