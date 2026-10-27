import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { incentiveService } from "@/modules/incentive/incentive.service";
import { MyIncentivesClient } from "./my-incentives-client";

export const dynamic = "force-dynamic";

export default async function MyIncentivesPage({
  searchParams,
}: {
  searchParams?: Promise<{ period?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const sp = await searchParams;
  const now = new Date();
  const currentPeriod =
    sp?.period ||
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const data = await incentiveService.getMyIncentives(session.user.id, currentPeriod);

  return (
    <div className="min-h-screen bg-stone-50 p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">My Sales Commission & Incentives</h1>
          <p className="text-xs text-stone-500">
            Real-time tracking of your personal sales, commission status, and monthly disbursements.
          </p>
        </div>

        <MyIncentivesClient data={data} currentPeriod={currentPeriod} />
      </div>
    </div>
  );
}
