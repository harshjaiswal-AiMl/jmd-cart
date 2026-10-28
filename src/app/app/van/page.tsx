import React from "react";
import Link from "next/link";
import { Truck, Store, RotateCcw, Calculator, CheckCircle2, ChevronRight, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function VanAppPage() {
  const session = await auth();

  // Find assigned van
  const van = await prisma.location.findFirst({
    where: {
      type: "VAN",
      active: true,
      ...(session?.user?.id ? { assignedUserId: session.user.id } : {}),
    },
    include: {
      vanDays: {
        where: { status: "OPEN" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const activeVanDay = van?.vanDays?.[0] || null;

  return (
    <div className="space-y-4">
      {/* Hero Header */}
      <div className="bg-[#12355B] text-white p-5 rounded-3xl shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">Route Sales</div>
            <h2 className="text-2xl font-black mt-0.5">{van ? van.name : "JMD Van"}</h2>
          </div>
          <Link
            href="/van/billing"
            className="px-5 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
          >
            <Store className="w-4 h-4" />
            <span>Open Counter</span>
          </Link>
        </div>

        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
          <span className="text-white/70">Morning Load Status:</span>
          {activeVanDay ? (
            <span className="font-bold text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Dispatched • Sheet #{activeVanDay.issueSheetNo}</span>
            </span>
          ) : (
            <span className="font-bold text-amber-300 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Pending Morning Issue</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Grid Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/van/billing"
          className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-[#12355B] transition-all flex flex-col justify-between"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-900">Van Counter</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Issue bills by Peti &amp; Pcs on the road</p>
          </div>
        </Link>

        <Link
          href="/van/bills"
          className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-[#12355B] transition-all flex flex-col justify-between"
        >
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center mb-3">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-900">Today&apos;s Bills</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Reprint bluetooth slip &amp; view list</p>
          </div>
        </Link>

        <Link
          href="/van/collections"
          className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-[#12355B] transition-all flex flex-col justify-between"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-3">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-900">Cash Collections</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Record money collected vs pending</p>
          </div>
        </Link>

        <Link
          href="/van/reconciliation"
          className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-[#12355B] transition-all flex flex-col justify-between"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center mb-3">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-900">Day-End Close</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Return unsold stock &amp; submit cash</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
