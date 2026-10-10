import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { dashboardService } from "@/modules/dashboard/dashboard.service";
import { OwnerDashboardClient } from "./owner-dashboard-client";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Super Admin executive dashboard
  const userRole = session.user.role as UserRole;
  const dashboardData = await dashboardService.getOwnerDashboardData(userRole);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Executive Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Owner Executive Dashboard
            </h1>
            <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold uppercase tracking-wider">
              Super Admin
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Welcome back, {session.user.name || "Sachin Prakash"}. Real-time business control center for FMCG Distribution in Saharsa.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/shop/pos"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition flex items-center gap-1.5"
          >
            <span>Open Shop POS</span>
            <span>⚡</span>
          </Link>
          <Link
            href="/admin/settings"
            className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold text-xs px-3.5 py-2.5 rounded-xl shadow-xs transition"
          >
            Settings
          </Link>
        </div>
      </div>

      {/* Main Dashboard Client */}
      <OwnerDashboardClient data={dashboardData} />
    </div>
  );
}
