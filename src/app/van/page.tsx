import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole, LocationType, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { vanService } from "@/modules/van/van.service";
import { orderService } from "@/modules/order/order.service";
import { OrderSummary } from "@/modules/order/order.types";
import Link from "next/link";
import { formatISTDateTime } from "@/lib/date";
import { VanStockView } from "./van-stock-view";
import { VanHandedOverDeliveries } from "@/components/van/van-handed-over-deliveries";
import { Truck, FileText, ShoppingCart, Boxes, CheckCircle2, AlertCircle } from "lucide-react";

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

  // Fetch handed-over customer deliveries assigned to this salesperson / van
  let assignedOrders: OrderSummary[] = [];
  try {
    if (session.user.role === UserRole.SALESPERSON) {
      assignedOrders = await orderService.listOrdersForDelivery(session.user.id);
    } else if (session.user.role === UserRole.SUPER_ADMIN) {
      if (van?.assignedUserId) {
        assignedOrders = await orderService.listOrdersForDelivery(van.assignedUserId);
      }
      if (assignedOrders.length === 0) {
        const all = await orderService.listAllOrders();
        assignedOrders = all.filter(
          (o) => o.status === OrderStatus.DISPATCHED || o.status === OrderStatus.PROCESSING
        );
      }
    }
  } catch (err) {
    console.error("Failed to load assigned delivery orders:", err);
  }

  const pendingDeliveries = assignedOrders.filter(
    (o) => o.status !== OrderStatus.DELIVERED && o.status !== OrderStatus.CANCELLED
  );
  const pendingCashPaise = pendingDeliveries.reduce((sum, o) => sum + o.totalPaise, 0);

  // Today's Van Sales & Cash Collection metrics
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayInvoices = van
    ? await prisma.invoice.findMany({
        where: {
          locationId: van.id,
          createdAt: { gte: todayStart },
          status: "FINAL",
        },
        select: { totalPaise: true },
      })
    : [];
  const todaySalesPaise = todayInvoices.reduce((sum, inv) => sum + inv.totalPaise, 0);

  const todayPayments = van
    ? await prisma.payment.findMany({
        where: {
          invoice: { locationId: van.id },
          mode: "CASH",
          createdAt: { gte: todayStart },
        },
        select: { amountPaise: true },
      })
    : [];
  const cashInHandPaise = todayPayments.reduce((sum, p) => sum + p.amountPaise, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:px-6 space-y-6">
      {/* Top Banner & Vehicle Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span>Route Operations</span>
            <span>/</span>
            <span>Handheld Sales Portal</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>{van ? van.name : "Unassigned Van"}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              Saharsa Division
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Logged in as <strong className="text-slate-900">{session.user.name}</strong> • Daily route loading, customer deliveries &amp; mobile billing
          </p>
        </div>

        {stockSummary?.activeVanDay && (
          <div className="flex items-center gap-2">
            <Link
              href={`/godown/van-issues/${stockSummary.activeVanDay.id}/print`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition-colors shadow-xs"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Load Sheet</span>
            </Link>
            <Link
              href="/van/billing"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Start Billing</span>
            </Link>
          </div>
        )}
      </div>

      {/* 3 HUGE PRIMARY BUTTONS FOR VAN OPERATIONS (Prompt #14) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. NEW SALE */}
        <Link
          href="/van/billing"
          className="flex flex-col items-center justify-center p-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-3xl shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 text-center group border-2 border-emerald-500"
        >
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
            <ShoppingCart className="w-7 h-7 text-white" />
          </div>
          <span className="text-xl sm:text-2xl font-black tracking-tight">1. 🛒 NEW SALE</span>
          <span className="text-xs text-emerald-100 font-bold mt-1">Start 3-Step Field Invoice</span>
        </Link>

        {/* 2. MY STOCK */}
        <a
          href="#van-stock-matrix"
          className="flex flex-col items-center justify-center p-6 bg-slate-900 hover:bg-slate-800 text-white rounded-3xl shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 text-center group border-2 border-slate-700"
        >
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
            <Boxes className="w-7 h-7 text-blue-400" />
          </div>
          <span className="text-xl sm:text-2xl font-black tracking-tight">2. 📦 MY STOCK</span>
          <span className="text-xs text-slate-300 font-bold mt-1">
            {stockSummary?.totalPieces || 0} pcs loaded ({stockSummary?.inventory.length || 0} products)
          </span>
        </a>

        {/* 3. END OF DAY */}
        <Link
          href="/van/reconciliation"
          className="flex flex-col items-center justify-center p-6 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-3xl shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 text-center group border-2 border-amber-400"
        >
          <div className="w-14 h-14 rounded-2xl bg-black/10 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
            <CheckCircle2 className="w-7 h-7 text-slate-950" />
          </div>
          <span className="text-xl sm:text-2xl font-black tracking-tight">3. 🏁 END OF DAY</span>
          <span className="text-xs text-amber-950 font-bold mt-1">Daily Reconciliation &amp; Cash Handover</span>
        </Link>
      </div>

      {/* Handed-Over Customer Deliveries Section */}
      <VanHandedOverDeliveries
        orders={assignedOrders}
        salespersonName={session.user.name || undefined}
      />

      {!van ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center text-amber-900 space-y-3">
          <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
          <h3 className="font-bold text-base text-slate-900">No Van Assigned</h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            Your user account is not currently assigned to any delivery vehicle. Please contact the Godown Manager or Super Admin to assign your van.
          </p>
        </div>
      ) : (
        <>
          {/* Active Morning Load Sheet Card */}
          {stockSummary?.activeVanDay ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="font-bold text-slate-900 text-sm">
                    Active Morning Load: {stockSummary.activeVanDay.issueSheetNo}
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                    DISPATCHED
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Transferred from Central Godown on{" "}
                  <strong className="text-slate-900">
                    {formatISTDateTime(stockSummary.activeVanDay.date)}
                  </strong>
                  . Ready for customer billing.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/van/billing"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-xs"
                >
                  <span>Create Bill</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 shadow-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-slate-700 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>Awaiting Morning Dispatch</span>
                </div>
                <p className="text-xs text-slate-500">
                  No morning load sheet has been issued for {van.name} yet today. When the Godown team loads stock, it will appear here instantly.
                </p>
              </div>
              <Link
                href="/godown/van-issues"
                className="hidden sm:inline-flex text-xs font-semibold text-blue-600 hover:underline"
              >
                Godown Dispatch &rarr;
              </Link>
            </div>
          )}

          {/* Key Today Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-[11px] text-slate-500 uppercase font-bold tracking-wider">
                Today&apos;s Sales
              </p>
              <p className="text-2xl font-black text-slate-900 mt-1 font-mono">
                ₹{(todaySalesPaise / 100).toLocaleString("en-IN", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs bg-emerald-50/20">
              <p className="text-[11px] text-emerald-800 uppercase font-bold tracking-wider">
                Cash In Hand
              </p>
              <p className="text-2xl font-black text-emerald-700 mt-1 font-mono">
                ₹{(cashInHandPaise / 100).toLocaleString("en-IN", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-[11px] text-slate-500 uppercase font-bold tracking-wider">
                Available Stock
              </p>
              <p className="text-2xl font-black text-blue-600 mt-1">
                {stockSummary?.totalPieces || 0} pcs
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs bg-amber-50/30">
              <p className="text-[11px] text-amber-700 uppercase font-bold tracking-wider flex items-center justify-between">
                <span>Deliveries</span>
                <span className="text-[10px] bg-amber-200/80 px-1.5 py-0.2 rounded font-bold">
                  {pendingDeliveries.length} PENDING
                </span>
              </p>
              <p className="text-2xl font-black text-slate-900 mt-1 font-mono">
                ₹{(pendingCashPaise / 100).toLocaleString("en-IN", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
          </div>

          {/* Interactive Searchable Stock Matrix */}
          <div id="van-stock-matrix">
            <VanStockView
              inventory={stockSummary?.inventory || []}
              vanName={van.name}
              hasActiveLoad={!!stockSummary?.activeVanDay}
            />
          </div>
        </>
      )}
    </div>
  );
}
