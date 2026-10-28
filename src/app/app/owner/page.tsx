import React from "react";
import Link from "next/link";
import { ShieldCheck, TrendingUp, AlertTriangle, ArrowRight, ExternalLink, Package, Truck, Calculator, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function OwnerAppPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [todayInvoices, pendingReceivables, pendingPickups, openVans] = await Promise.all([
    prisma.invoice.findMany({
      where: { createdAt: { gte: today }, status: "FINAL" },
      select: { totalPaise: true },
    }),
    prisma.invoice.findMany({
      where: { paymentStatus: { in: ["PENDING", "PARTIAL"] }, status: "FINAL" },
      select: { totalPaise: true, payments: { select: { amountPaise: true } } },
    }),
    prisma.counterPickup.count({ where: { status: "PENDING" } }),
    prisma.vanDay.count({ where: { status: "OPEN" } }),
  ]);

  const todayRevenuePaise = todayInvoices.reduce((s, i) => s + i.totalPaise, 0);
  const totalReceivablesPaise = pendingReceivables.reduce((sum, inv) => {
    const paid = inv.payments.reduce((s, p) => s + p.amountPaise, 0);
    return sum + Math.max(0, inv.totalPaise - paid);
  }, 0);

  return (
    <div className="space-y-4">
      {/* Executive Hero Banner */}
      <div className="bg-[#12355B] text-white p-5 rounded-3xl shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">Executive Overview</div>
            <h2 className="text-2xl font-black mt-0.5">JMD Owner</h2>
          </div>
          <Link
            href="/admin"
            className="px-4 py-2 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
          >
            <span>Full Panel</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10 text-xs">
          <div>
            <div className="text-white/70">Today&apos;s Revenue</div>
            <div className="text-lg font-black font-mono">₹{(todayRevenuePaise / 100).toFixed(2)}</div>
          </div>
          <div>
            <div className="text-white/70">Total Receivables</div>
            <div className="text-lg font-black font-mono text-amber-300">
              ₹{(totalReceivablesPaise / 100).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Live Operations Status Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/godown/dispatch"
          className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-[#12355B] transition-all flex flex-col justify-between"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mb-3">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500">Warehouse Queue</div>
            <div className="text-base font-black text-slate-900 mt-0.5">
              {pendingPickups} Cartons To Pack
            </div>
          </div>
        </Link>

        <Link
          href="/van"
          className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-[#12355B] transition-all flex flex-col justify-between"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500">Active Vans</div>
            <div className="text-base font-black text-slate-900 mt-0.5">
              {openVans} On The Road
            </div>
          </div>
        </Link>

        <Link
          href="/app/accounts"
          className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-[#12355B] transition-all flex flex-col justify-between"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-3">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500">Pending Payments</div>
            <div className="text-base font-black text-slate-900 mt-0.5">
              {pendingReceivables.length} Bills Uncollected
            </div>
          </div>
        </Link>

        <Link
          href="/admin/incentives"
          className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-[#12355B] transition-all flex flex-col justify-between"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center mb-3">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500">Staff Incentives</div>
            <div className="text-base font-black text-slate-900 mt-0.5">
              Monthly Hub &amp; Rules
            </div>
          </div>
        </Link>
      </div>

      {/* Quick Link to Full Desktop Panel */}
      <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-between">
        <div>
          <div className="font-bold text-xs text-slate-900">Desktop Management Panel</div>
          <div className="text-[11px] text-slate-500">Settings, catalog, parties, reports, user CRUD</div>
        </div>
        <Link
          href="/admin"
          className="px-3 py-1.5 rounded-xl bg-[#12355B] text-white font-bold text-xs flex items-center gap-1 shadow-xs hover:bg-[#0E2843] transition-colors"
        >
          <span>Open</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
