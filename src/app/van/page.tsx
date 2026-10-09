import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole, LocationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { vanService } from "@/modules/van/van.service";
import Link from "next/link";
import { formatISTDateTime } from "@/lib/date";
import { VanStockView } from "./van-stock-view";
import { Truck, FileText, ShoppingCart, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SalespersonVanPage() {
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

  // Find assigned van for this salesperson, or fallback to first van for admin
  let van = await prisma.location.findFirst({
    where: {
      type: LocationType.VAN,
      assignedUserId: session.user.id,
      active: true,
    },
    include: { assignedUser: true },
  });

  if (!van && session.user.role === UserRole.SUPER_ADMIN) {
    van = await prisma.location.findFirst({
      where: { type: LocationType.VAN, active: true },
      include: { assignedUser: true },
    });
  }

  const stockSummary = van
    ? await vanService.getVanStockSummary(session.user.role, van.id)
    : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:px-6 space-y-6">
      {/* Top Banner & Vehicle Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span>Route Operations</span>
            <span>/</span>
            <span>Handheld Sales Portal</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>{van ? van.name : "Unassigned Van"}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              Saharsa Division
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Logged in as <strong className="text-slate-200">{session.user.name}</strong> • Daily route loading & mobile billing
          </p>
        </div>

        {stockSummary?.activeVanDay && (
          <div className="flex items-center gap-2">
            <Link
              href={`/godown/van-issues/${stockSummary.activeVanDay.id}/print`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 transition-colors shadow-sm"
            >
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Load Sheet</span>
            </Link>
            <Link
              href="/van/billing"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-950"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Start Billing</span>
            </Link>
          </div>
        )}
      </div>

      {!van ? (
        <div className="bg-amber-950/40 border border-amber-800/80 rounded-2xl p-6 text-center text-amber-200 space-y-3">
          <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
          <h3 className="font-bold text-base text-white">No Van Assigned</h3>
          <p className="text-xs text-amber-300/90 max-w-md mx-auto">
            Your user account is not currently assigned to any delivery vehicle. Please contact the Godown Manager or Super Admin to assign your van.
          </p>
        </div>
      ) : (
        <>
          {/* Active Morning Load Sheet Card */}
          {stockSummary?.activeVanDay ? (
            <div className="bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-emerald-950/20">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="font-bold text-white text-sm">
                    Active Morning Load: {stockSummary.activeVanDay.issueSheetNo}
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    DISPATCHED
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Transferred from Central Godown on{" "}
                  <strong className="text-white">
                    {formatISTDateTime(stockSummary.activeVanDay.date)}
                  </strong>
                  . Ready for customer billing.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/van/billing"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shadow-md"
                >
                  <span>Create Bill</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-slate-300 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>Awaiting Morning Dispatch</span>
                </div>
                <p className="text-xs text-slate-400">
                  No morning load sheet has been issued for {van.name} yet today. When the Godown team loads stock, it will appear here instantly.
                </p>
              </div>
              <Link
                href="/godown/van-issues"
                className="hidden sm:inline-flex text-xs font-semibold text-emerald-400 hover:underline"
              >
                Godown Dispatch →
              </Link>
            </div>
          )}

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 shadow-sm">
              <p className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">
                Loaded Products
              </p>
              <p className="text-2xl font-black text-white mt-1">
                {stockSummary?.inventory.length || 0}
              </p>
            </div>

            <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 shadow-sm">
              <p className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">
                Available Pieces
              </p>
              <p className="text-2xl font-black text-blue-400 mt-1">
                {stockSummary?.totalPieces || 0} pcs
              </p>
            </div>

            <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 shadow-sm">
              <p className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">
                Inventory Valuation
              </p>
              <p className="text-2xl font-black text-emerald-400 mt-1">
                ₹{((stockSummary?.totalValuationPaise || 0) / 100).toLocaleString("en-IN", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>

            <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 shadow-sm">
              <p className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">
                Van Operational Status
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                {stockSummary?.activeVanDay ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white uppercase">On Route</span>
                  </>
                ) : (
                  <>
                    <Truck className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-300 uppercase">At Godown</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Interactive Searchable Stock Matrix */}
          <VanStockView
            inventory={stockSummary?.inventory || []}
            vanName={van.name}
            hasActiveLoad={!!stockSummary?.activeVanDay}
          />
        </>
      )}
    </div>
  );
}
