import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole, LocationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { vanService } from "@/modules/van/van.service";
import Link from "next/link";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { VanReconciliationClient } from "./van-reconciliation-client";

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
      orderBy: { name: "asc" },
    });
  }

  if (!van) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
          <h2 className="text-base font-bold text-white">No Van Assigned</h2>
          <p className="text-xs text-slate-400">
            Your user account is not currently assigned to any active delivery vehicle.
          </p>
          <Link
            href="/van"
            className="inline-block px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-white"
          >
            Back to Van Workspace
          </Link>
        </div>
      </div>
    );
  }

  // Find either active OPEN van day or the most recent van day for this van
  const activeVanDay = await prisma.vanDay.findFirst({
    where: {
      vanLocationId: van.id,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!activeVanDay) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/van"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-black text-white">Evening Return & Day End</h1>
            <p className="text-xs text-slate-400">{van.name}</p>
          </div>
        </div>

        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white">No Load Sheet Found</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No morning load sheet has been issued for {van.name} yet. Stock must be dispatched from Central Godown before performing evening reconciliation.
            </p>
          </div>
          <Link
            href="/van"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
          >
            Return to Van Workspace
          </Link>
        </div>
      </div>
    );
  }

  const report = await vanService.getVanReconciliation(
    session.user.role,
    activeVanDay.id
  );

  return (
    <VanReconciliationClient
      initialReport={report}
      userRole={session.user.role}
    />
  );
}
