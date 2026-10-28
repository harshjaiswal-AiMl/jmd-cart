import React from "react";
import Link from "next/link";
import { Warehouse, Package, Truck, ArrowRight, Download, RefreshCw, AlertTriangle, Layers } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function GodownAppPage() {
  const [pendingCounterPickups, lowStockProducts] = await Promise.all([
    prisma.counterPickup.count({
      where: { status: "PENDING" },
    }),
    prisma.product.count({
      where: {
        active: true,
        stockBalances: {
          some: {
            qty: { lte: 10 },
          },
        },
      },
    }),
  ]);

  return (
    <div className="space-y-4">
      {/* Hero Header */}
      <div className="bg-[#12355B] text-white p-5 rounded-3xl shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">Main Godown</div>
            <h2 className="text-2xl font-black mt-0.5">JMD Godown</h2>
          </div>
          <Link
            href="/godown/dispatch"
            className="px-5 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
          >
            <Package className="w-4 h-4" />
            <span>Packing Queue</span>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10 text-xs">
          <div>
            <div className="text-white/70">Cartons To Pack</div>
            <div className="text-lg font-black font-mono">{pendingCounterPickups}</div>
          </div>
          <div>
            <div className="text-white/70">Low Stock Alert</div>
            <div className="text-lg font-black font-mono text-amber-300">{lowStockProducts} items</div>
          </div>
        </div>
      </div>

      {/* Main Grid Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/godown/dispatch"
          className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-[#12355B] transition-all flex flex-col justify-between"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mb-3">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-900">Packing Queue</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Carton-only bills from shop &amp; dispatch</p>
          </div>
        </Link>

        <Link
          href="/godown/stock"
          className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-[#12355B] transition-all flex flex-col justify-between"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-900">Stock Count</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Physical audit, counts &amp; adjustments</p>
          </div>
        </Link>

        <Link
          href="/godown/receive-goods"
          className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-[#12355B] transition-all flex flex-col justify-between"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center mb-3">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-900">Receive Goods</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Inbound supplier GRN &amp; bill scan</p>
          </div>
        </Link>

        <Link
          href="/godown/van-issues"
          className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-[#12355B] transition-all flex flex-col justify-between"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-3">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-900">Van Issues</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Morning load dispatch &amp; evening returns</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
