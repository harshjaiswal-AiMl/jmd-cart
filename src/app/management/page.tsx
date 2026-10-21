import Link from "next/link";
import { auth } from "@/auth";
import { autoConvertService } from "@/modules/godown/auto-convert.service";
import { prisma } from "@/lib/prisma";
import { LocationType } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function ManagementPortalPage() {
  const session = await auth();
  const user = session?.user;

  const [autoConvertSummary, godownLocation, shopLocation] = await Promise.all([
    autoConvertService.getDailyAutoConvertSummary(10),
    prisma.location.findFirst({ where: { type: LocationType.GODOWN, active: true } }),
    prisma.location.findFirst({ where: { type: LocationType.SHOP, active: true } }),
  ]);

  const [godownStockAgg, shopStockAgg, pendingOrdersCount] = await Promise.all([
    godownLocation
      ? prisma.stockBalance.aggregate({
          where: { locationId: godownLocation.id, qty: { gt: 0 } },
          _sum: { qty: true },
          _count: { productId: true },
        })
      : Promise.resolve({ _sum: { qty: 0 }, _count: { productId: 0 } }),
    shopLocation
      ? prisma.stockBalance.aggregate({
          where: { locationId: shopLocation.id, qty: { gt: 0 } },
          _sum: { qty: true },
          _count: { productId: true },
        })
      : Promise.resolve({ _sum: { qty: 0 }, _count: { productId: 0 } }),
    prisma.order.count({
      where: { status: { in: ["PENDING", "CONFIRMED", "PROCESSING"] } },
    }),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Top Subdomain Header */}
      <header className="bg-[#5E0A0D] border-b border-[#FDAF18]/30 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/jmd-cart-logo.png"
              alt="JMD Cart"
              className="h-10 w-10 object-contain bg-white rounded-lg p-0.5"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight text-white">
                  management.jmdcart.com
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#FDAF18] text-[#2A1010]">
                  Backend Hub
                </span>
              </div>
              <p className="text-[11px] text-white/75">
                Warehouse • Godown • Van Marketing • Shop POS • Delivery • GST Billing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 transition"
            >
              🌐 View Public Store (jmdcart.com)
            </Link>
            {user ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#FDAF18] hidden sm:inline">
                  {user.name} ({user.role})
                </span>
                <Link
                  href="/logout"
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition"
                >
                  Logout
                </Link>
              </div>
            ) : (
              <Link
                href="/login?callbackUrl=/management"
                className="text-xs font-bold px-4 py-2 rounded-lg bg-[#FDAF18] hover:bg-[#FC830D] text-[#2A1010] transition"
              >
                Staff Login
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Safeguard #1: Auto-Converted Cartons Notification Banner */}
        <div
          className={`rounded-2xl p-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            autoConvertSummary.totalCartonsOpenedToday > 0
              ? "bg-amber-950/60 border-amber-500/50 text-amber-100"
              : "bg-slate-900 border-slate-800 text-slate-300"
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">📦</span>
            <div>
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                <span>
                  Aaj {autoConvertSummary.totalCartonsOpenedToday} carton auto-open hue
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  +{autoConvertSummary.totalLooseGeneratedToday} loose pcs generated
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Rule active: Online orders aur Van marketing ke loose + carton dono Main Godown se fulfil ho rahe hain. Loose kam hone par carton auto-open hota hai.
              </p>
            </div>
          </div>
          <Link
            href="/godown/operations#auto-convert-report"
            className="shrink-0 text-xs font-bold px-4 py-2 rounded-xl bg-[#FDAF18] text-[#2A1010] hover:bg-[#FC830D] transition text-center"
          >
            View Auto-Converted Report →
          </Link>
        </div>

        {/* Live Fulfilment Rule Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-1">
            <div className="text-xs text-emerald-400 font-bold uppercase tracking-wider">
              Main Godown Stock (Online + Van Source)
            </div>
            <div className="text-2xl font-black text-white">
              {(godownStockAgg._sum.qty ?? 0).toLocaleString("en-IN")} pcs
            </div>
            <div className="text-xs text-slate-400">
              Across {godownStockAgg._count.productId} active SKUs (Cartons + Loose)
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-1">
            <div className="text-xs text-sky-400 font-bold uppercase tracking-wider">
              Shop Counter Stock (Walk-In Loose Only)
            </div>
            <div className="text-2xl font-black text-white">
              {(shopStockAgg._sum.qty ?? 0).toLocaleString("en-IN")} pcs
            </div>
            <div className="text-xs text-slate-400">
              Across {shopStockAgg._count.productId} retail counter SKUs
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-1">
            <div className="text-xs text-amber-400 font-bold uppercase tracking-wider">
              Active Online Orders (Godown Fulfilment)
            </div>
            <div className="text-2xl font-black text-white">
              {pendingOrdersCount} orders
            </div>
            <div className="text-xs text-slate-400">
              Fulfilled 100% from Godown (Carton + Loose)
            </div>
          </div>
        </div>

        {/* Management Portals Grid */}
        <div>
          <h2 className="text-lg font-black text-white mb-4">
            Department &amp; Operations Portals (management.jmdcart.com)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/admin"
              className="bg-slate-900 hover:bg-slate-800/90 border border-slate-800 hover:border-[#FDAF18]/50 rounded-2xl p-5 transition group"
            >
              <div className="text-2xl mb-2">👑</div>
              <h3 className="text-base font-bold text-white group-hover:text-[#FDAF18]">
                Owner &amp; Admin Dashboard
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Master catalog, wholesale slabs, party khata, cash handover &amp; settings.
              </p>
            </Link>

            <Link
              href="/godown"
              className="bg-slate-900 hover:bg-slate-800/90 border border-slate-800 hover:border-[#FDAF18]/50 rounded-2xl p-5 transition group"
            >
              <div className="text-2xl mb-2">🏭</div>
              <h3 className="text-base font-bold text-white group-hover:text-[#FDAF18]">
                Main Godown &amp; Warehouse
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Carton + loose tracking, manual/auto carton open, purchase GRN &amp; van load sheets.
              </p>
            </Link>

            <Link
              href="/godown/operations"
              className="bg-slate-900 hover:bg-slate-800/90 border border-slate-800 hover:border-[#FDAF18]/50 rounded-2xl p-5 transition group"
            >
              <div className="text-2xl mb-2">📦</div>
              <h3 className="text-base font-bold text-white group-hover:text-[#FDAF18]">
                Carton Kholo → Loose Convert &amp; Report
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Convert Godown cartons to loose, view Daily Auto-Converted Cartons Report &amp; reverse entries.
              </p>
            </Link>

            <Link
              href="/admin/orders"
              className="bg-slate-900 hover:bg-slate-800/90 border border-slate-800 hover:border-[#FDAF18]/50 rounded-2xl p-5 transition group"
            >
              <div className="text-2xl mb-2">🛒</div>
              <h3 className="text-base font-bold text-white group-hover:text-[#FDAF18]">
                Online Orders &amp; Godown Pick Lists
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Confirm online orders, generate GST invoices (auto-converts Godown cartons for loose), assign delivery.
              </p>
            </Link>

            <Link
              href="/van"
              className="bg-slate-900 hover:bg-slate-800/90 border border-slate-800 hover:border-[#FDAF18]/50 rounded-2xl p-5 transition group"
            >
              <div className="text-2xl mb-2">🚐</div>
              <h3 className="text-base font-bold text-white group-hover:text-[#FDAF18]">
                Marketing / Van Sales PWA
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Takes Carton + Loose from Godown, spot billing, and evening Carton + Loose return to Godown.
              </p>
            </Link>

            <Link
              href="/shop/pos"
              className="bg-slate-900 hover:bg-slate-800/90 border border-slate-800 hover:border-[#FDAF18]/50 rounded-2xl p-5 transition group"
            >
              <div className="text-2xl mb-2">🏪</div>
              <h3 className="text-base font-bold text-white group-hover:text-[#FDAF18]">
                Shop Walk-In POS Counter
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Walk-in counter sales fulfilled directly from Shop loose stock.
              </p>
            </Link>

            <Link
              href="/delivery"
              className="bg-slate-900 hover:bg-slate-800/90 border border-slate-800 hover:border-[#FDAF18]/50 rounded-2xl p-5 transition group"
            >
              <div className="text-2xl mb-2">🚚</div>
              <h3 className="text-base font-bold text-white group-hover:text-[#FDAF18]">
                Delivery Staff App
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Assigned online orders, route address, COD/UPI collection &amp; proof of delivery.
              </p>
            </Link>

            <Link
              href="/admin/reports"
              className="bg-slate-900 hover:bg-slate-800/90 border border-slate-800 hover:border-[#FDAF18]/50 rounded-2xl p-5 transition group"
            >
              <div className="text-2xl mb-2">📊</div>
              <h3 className="text-base font-bold text-white group-hover:text-[#FDAF18]">
                GST, Daybook &amp; Tally Reports
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                GSTR-1, HSN summary, party ageing, daily sales &amp; Tally XML export.
              </p>
            </Link>

            <Link
              href="/godown/van-issues"
              className="bg-slate-900 hover:bg-slate-800/90 border border-slate-800 hover:border-[#FDAF18]/50 rounded-2xl p-5 transition group"
            >
              <div className="text-2xl mb-2">📋</div>
              <h3 className="text-base font-bold text-white group-hover:text-[#FDAF18]">
                Van Issue &amp; Evening Return Report
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Morning carton + loose load sheets &amp; evening stock-wise return reconciliation to Godown.
              </p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
