"use client";

import Link from "next/link";
import { OwnerDashboardData } from "@/modules/dashboard/dashboard.types";
import {
  TrendingUp,
  Package,
  CreditCard,
  Truck,
  ShoppingBag,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Store,
  DollarSign,
  QrCode,
  FileText,
  Boxes,
  Users,
} from "lucide-react";

interface OwnerDashboardClientProps {
  data: OwnerDashboardData;
}

export function OwnerDashboardClient({ data }: OwnerDashboardClientProps) {
  const { metrics, channelBreakdown, topSellingProducts, criticalAlerts, recentActivities } = data;

  const quickLinks = [
    { title: "Shop POS", desc: "Counter billing", href: "/shop/pos", icon: Store, color: "text-amber-600 bg-amber-50" },
    { title: "Store Orders", desc: `${metrics.pendingOrdersCount} pending`, href: "/admin/orders", icon: ShoppingBag, color: "text-rose-600 bg-rose-50" },
    { title: "Van Reconcile", desc: `${metrics.pendingCashHandoverCount} cash handovers`, href: "/van/reconciliation", icon: Truck, color: "text-blue-600 bg-blue-50" },
    { title: "Party Ledgers", desc: "Credit & Ageing", href: "/admin/parties", icon: Users, color: "text-indigo-600 bg-indigo-50" },
    { title: "Inventory Stock", desc: "Godown & Vans", href: "/godown/stock", icon: Boxes, color: "text-teal-600 bg-teal-50" },
    { title: "Reports Hub", desc: "GST & Day Book", href: "/admin/reports", icon: FileText, color: "text-emerald-600 bg-emerald-50" },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Critical Actionable Alerts Banner */}
      {criticalAlerts.length > 0 && (
        <div className="space-y-2">
          {criticalAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm ${
                alert.severity === "CRITICAL"
                  ? "bg-rose-50/90 border-rose-200 text-rose-900"
                  : alert.severity === "WARNING"
                  ? "bg-amber-50/90 border-amber-200 text-amber-900"
                  : "bg-blue-50/90 border-blue-200 text-blue-900"
              }`}
            >
              <div className="flex items-center gap-3">
                <AlertTriangle
                  className={`w-5 h-5 flex-shrink-0 ${
                    alert.severity === "CRITICAL"
                      ? "text-rose-600 animate-pulse"
                      : alert.severity === "WARNING"
                      ? "text-amber-600"
                      : "text-blue-600"
                  }`}
                />
                <span className="text-xs sm:text-sm font-semibold">{alert.message}</span>
              </div>
              <Link
                href={alert.actionHref}
                className="self-start sm:self-auto text-xs font-bold px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-xs hover:bg-slate-50 transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <span>{alert.actionLabel}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* 2. Top Executive Metric Cards (4 Pillars) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pillar 1: Today's Total Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Today&apos;s Net Sales
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              ₹{(metrics.todaySalesPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Across {metrics.todaySalesCount} finalized invoices today
            </p>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
            <span className="flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-emerald-600" />
              Cash: ₹{(metrics.todayCashCollectedPaise / 100).toFixed(0)}
            </span>
            <span className="flex items-center gap-1">
              <QrCode className="w-3 h-3 text-purple-600" />
              UPI: ₹{(metrics.todayUpiCollectedPaise / 100).toFixed(0)}
            </span>
          </div>
        </div>

        {/* Pillar 2: Stock & Inventory Value */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Stock Valuation
            </span>
            <div className="p-2 bg-teal-50 text-teal-600 rounded-xl">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              ₹{(metrics.totalStockValuationPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {metrics.totalStockUnits.toLocaleString("en-IN")} units across Shop & Godown
            </p>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-600">Low stock items:</span>
            <span className={`font-bold ${metrics.totalLowStockCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
              {metrics.totalLowStockCount} items
            </span>
          </div>
        </div>

        {/* Pillar 3: Receivables & Party Credit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Outstanding Credit
            </span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              ₹{(metrics.totalReceivablesPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Active ledger debt across verified parties
            </p>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-600">Overdue debt:</span>
            <span className={`font-bold ${metrics.overdueReceivablesPaise > 0 ? "text-rose-600" : "text-slate-600"}`}>
              ₹{(metrics.overdueReceivablesPaise / 100).toFixed(0)} ({metrics.overduePartiesCount} parties)
            </span>
          </div>
        </div>

        {/* Pillar 4: Van Routes & Handover */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Van Day Closing
            </span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {metrics.activeVansCount} Active Vans
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {metrics.closedVansCount} routes closed today
            </p>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-600">Awaiting owner cash:</span>
            <span className={`font-bold ${metrics.pendingCashHandoverCount > 0 ? "text-rose-600 font-black animate-pulse" : "text-emerald-600"}`}>
              {metrics.pendingCashHandoverCount} routes
            </span>
          </div>
        </div>
      </div>

      {/* 3. Operational Quick Actions Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {quickLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between">
              <div className={`p-2 rounded-xl ${item.color}`}>
                <item.icon className="w-4 h-4" />
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="mt-3">
              <h4 className="text-xs font-bold text-slate-900">{item.title}</h4>
              <p className="text-[11px] text-slate-500 truncate">{item.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* 4. Two-Column Analytics: Channel Distribution & Top Selling Products */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Channel Distribution & Store Orders Status */}
        <div className="lg:col-span-6 space-y-6">
          {/* Sales by Channel Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Today&apos;s Sales by Channel</h3>
                <p className="text-xs text-slate-500">Shop Counter vs Delivery Vans vs Online Store</p>
              </div>
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                {data.asOfDate}
              </span>
            </div>

            <div className="space-y-3">
              {channelBreakdown.map((item) => {
                const label = item.channel === "SHOP" ? "Shop Counter POS" : item.channel === "VAN" ? "Van Sales (On-Route)" : "Online Store Orders";
                const barColor = item.channel === "SHOP" ? "bg-amber-500" : item.channel === "VAN" ? "bg-blue-600" : "bg-rose-500";
                return (
                  <div key={item.channel} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{label}</span>
                      <span className="font-bold text-slate-900">
                        ₹{(item.salesPaise / 100).toFixed(0)}{" "}
                        <span className="text-slate-400 font-normal">({item.percent}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span>Credit given today: ₹{(metrics.todayCreditGivenPaise / 100).toFixed(0)}</span>
              <Link href="/admin/reports?tab=sales" className="text-blue-600 font-bold hover:underline">
                View Sales Register →
              </Link>
            </div>
          </div>

          {/* Online Order Fulfillment Status */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Store Orders Pipeline</h3>
                <p className="text-xs text-slate-500">Live order fulfillment status across Saharsa town</p>
              </div>
              <Link href="/admin/orders" className="text-xs font-bold text-blue-600 hover:underline">
                Manage Orders →
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                <div className="text-xl font-black text-amber-700">{metrics.pendingOrdersCount}</div>
                <div className="text-[11px] font-semibold text-amber-800 mt-0.5">Pending Confirm</div>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                <div className="text-xl font-black text-blue-700">{metrics.confirmedOrdersCount}</div>
                <div className="text-[11px] font-semibold text-blue-800 mt-0.5">Packing / Ready</div>
              </div>
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                <div className="text-xl font-black text-purple-700">{metrics.outForDeliveryOrdersCount}</div>
                <div className="text-[11px] font-semibold text-purple-800 mt-0.5">Out for Van</div>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <div className="text-xl font-black text-emerald-700">{metrics.deliveredOrdersCount}</div>
                <div className="text-[11px] font-semibold text-emerald-800 mt-0.5">Delivered</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Top Selling Products Leaderboard & Recent Activity */}
        <div className="lg:col-span-6 space-y-6">
          {/* Top Selling Products */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Today&apos;s Fast-Moving Products</h3>
                <p className="text-xs text-slate-500">Highest volume FMCG SKUs sold today</p>
              </div>
              <Link href="/godown/stock" className="text-xs font-bold text-teal-600 hover:underline">
                Stock Matrix →
              </Link>
            </div>

            {topSellingProducts.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {topSellingProducts.map((p, idx) => (
                  <div key={p.productId} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="text-xs font-bold text-slate-900">{p.name}</div>
                        <span className="text-[10px] text-slate-500 font-mono">{p.shortCode}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-900">{p.qtySold} units</div>
                      <div className="text-[11px] text-slate-500">₹{(p.salesPaise / 100).toFixed(0)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No products sold yet today. Start billing at Shop POS or issue Van day sheets!
              </div>
            )}
          </div>

          {/* Recent Live Transactions Activity */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Live Activity Feed</h3>
                <p className="text-xs text-slate-500">Recent invoices and settlements across systems</p>
              </div>
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Live
              </span>
            </div>

            {recentActivities.length > 0 ? (
              <div className="space-y-3">
                {recentActivities.map((act) => (
                  <div key={act.id} className="flex items-start justify-between gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-slate-900">{act.title}</div>
                      <div className="text-[11px] text-slate-500">{act.description}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(act.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-lg border font-bold ${act.badgeColor}`}>
                      {act.badgeText}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No recent activity records found.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
