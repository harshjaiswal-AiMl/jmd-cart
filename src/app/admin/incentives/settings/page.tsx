import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { incentiveService } from "@/modules/incentive/incentive.service";
import { IncentivesNavTabs } from "@/components/incentives/incentives-nav-tabs";
import { IncentiveSettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function IncentiveSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const role = session.user.role;
  if (role !== UserRole.SUPER_ADMIN && role !== UserRole.ADMIN) {
    redirect("/login");
  }

  const settings = await incentiveService.getSettings();

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="border-b border-stone-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Incentive System Settings</h1>
          <p className="text-xs text-stone-500">
            Control global commission calculation base, operational credit triggers, and eligible staff roles.
          </p>
        </div>
      </div>

      <IncentivesNavTabs />

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <IncentiveSettingsClient initialSettings={settings} />
      </div>
    </div>
  );
}
