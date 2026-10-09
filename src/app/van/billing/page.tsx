import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole, LocationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { vanService } from "@/modules/van/van.service";
import Link from "next/link";
import { ShoppingCart, AlertTriangle, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function VanBillingPage() {
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
          <h1 className="text-xl font-black text-white">Van Sales Billing</h1>
          <p className="text-xs text-slate-400">
            {van ? van.name : "Unassigned Van"} • Counter & Storefront Sales
          </p>
        </div>
      </div>

      {!stockSummary?.activeVanDay ? (
        <div className="bg-amber-950/40 border border-amber-800/80 rounded-2xl p-6 text-center text-amber-200 space-y-3">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
          <h3 className="font-bold text-base text-white">Morning Load Required</h3>
          <p className="text-xs text-amber-300/90 max-w-md mx-auto">
            You cannot issue sales bills until a morning load sheet is dispatched from the Central Godown to your van.
          </p>
          <Link
            href="/van"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
          >
            Return to Van Stock
          </Link>
        </div>
      ) : (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white">Ready for Offline Billing</h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Van Day <strong className="text-white">{stockSummary.activeVanDay.issueSheetNo}</strong> is active with {stockSummary.totalPieces} pieces loaded.
            </p>
          </div>
          <p className="text-xs text-slate-500 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 max-w-sm mx-auto">
            ⚡ Full mobile billing counter with IndexedDB offline drafts and automatic online sync will be available in Task 2.4.
          </p>
          <Link
            href="/van"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
          >
            View Available Stock
          </Link>
        </div>
      )}
    </div>
  );
}
