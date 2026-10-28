import React from "react";
import Link from "next/link";
import { Store, ShoppingCart, Clock, CheckCircle, Package, ArrowRight, AlertCircle, FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function ShopAppPage() {
  const session = await auth();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [todayInvoices, pendingPayments] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        channel: "SHOP",
        createdAt: { gte: today },
      },
      select: {
        id: true,
        number: true,
        totalPaise: true,
        paymentStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.invoice.findMany({
      where: {
        paymentStatus: { in: ["PENDING", "PARTIAL"] },
        channel: "SHOP",
      },
      select: {
        id: true,
        number: true,
        customerName: true,
        customerPhone: true,
        totalPaise: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const totalSalesPaise = todayInvoices.reduce((s, i) => s + i.totalPaise, 0);

  return (
    <div className="space-y-4">
      {/* Quick Launch Hero */}
      <div className="bg-[#12355B] text-white p-5 rounded-3xl shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">Shop Counter</div>
            <h2 className="text-2xl font-black mt-0.5">JMD POS</h2>
          </div>
          <Link
            href="/shop/pos"
            className="px-5 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Open POS</span>
          </Link>
        </div>

        {/* Daily Stats */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10 text-xs">
          <div>
            <div className="text-white/70">Today&apos;s Sales</div>
            <div className="text-lg font-black font-mono">₹{(totalSalesPaise / 100).toFixed(2)}</div>
          </div>
          <div>
            <div className="text-white/70">Bills Finalized</div>
            <div className="text-lg font-black font-mono">{todayInvoices.length}</div>
          </div>
        </div>
      </div>

      {/* Main Grid Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/shop/pos"
          className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-[#12355B] transition-all flex flex-col justify-between"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-900">New Bill</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Start counter sale, add items &amp; tender</p>
          </div>
        </Link>

        <Link
          href="/shop/invoices"
          className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-[#12355B] transition-all flex flex-col justify-between"
        >
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center mb-3">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-900">Invoices</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Reprint receipts &amp; view history</p>
          </div>
        </Link>

        <Link
          href="/godown/stock"
          className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-[#12355B] transition-all flex flex-col justify-between"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center mb-3">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-900">Stock Check</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Live shop &amp; godown inventory levels</p>
          </div>
        </Link>

        <Link
          href="/shop/my-incentives"
          className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-[#12355B] transition-all flex flex-col justify-between"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-3">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-900">My Incentives</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Track commissions on bills issued</p>
          </div>
        </Link>
      </div>

      {/* Pending Payments Alert Section */}
      {pendingPayments.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-bold text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>Uncollected Bills ({pendingPayments.length})</span>
            </div>
            <Link href="/app/accounts" className="text-amber-800 font-bold hover:underline flex items-center gap-1">
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="divide-y divide-amber-200/60 bg-white/60 rounded-xl px-3 py-1">
            {pendingPayments.map((p) => (
              <div key={p.id} className="py-2 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-slate-900">{p.number}</div>
                  <div className="text-[10px] text-slate-500">
                    {p.customerName || "Customer"} {p.customerPhone && `• ${p.customerPhone}`}
                  </div>
                </div>
                <div className="font-mono font-bold text-amber-900">
                  ₹{(p.totalPaise / 100).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
