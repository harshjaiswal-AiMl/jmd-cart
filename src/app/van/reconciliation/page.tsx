import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole, LocationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { vanService } from "@/modules/van/van.service";
import Link from "next/link";
import { ArrowLeftRight, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function VanReconciliationPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (
    session.user.role !== UserRole.SALESPERSON &&
    session.user.role !== UserRole.SUPER_ADMIN
  ) {
    redirect("/login");
  }

  let van = await prisma.location.findFirst({
    where: {
      type: LocationType.VAN,
      assignedUserId: session.user.id,
      active: true,
    },
  });

  if (!van && session.user.role === UserRole.SUPER_ADMIN) {
    van = await prisma.location.findFirst({
      where: { type: LocationType.VAN, active: true },
    });
  }

  const stockSummary = van
    ? await vanService.getVanStockSummary(session.user.role, van.id)
    : null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/van"
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-black text-white">Evening Return & Day End</h1>
          <p className="text-xs text-slate-400">
            {van ? van.name : "Unassigned Van"} • Stock reconciliation & cash handover
          </p>
        </div>
      </div>

      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-xl">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
          <ArrowLeftRight className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-white">Route Closing & Cash Handover</h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {stockSummary?.activeVanDay
              ? `Current active sheet: ${stockSummary.activeVanDay.issueSheetNo}. Unsold stock returns to Central Godown upon day closing.`
              : "No open morning issue sheet is currently active for this van."}
          </p>
        </div>
        <p className="text-xs text-slate-500 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 max-w-sm mx-auto">
          🤝 Day-end physical return verification, shortage/excess calculations, and cash handover will be finalized in Task 2.8 and 2.9.
        </p>
        <Link
          href="/van"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
        >
          Return to Stock Matrix
        </Link>
      </div>
    </div>
  );
}
