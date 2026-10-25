import Link from "next/link";
import { auth } from "@/auth";
import { autoConvertService } from "@/modules/godown/auto-convert.service";

export default async function GodownDashboardPage() {
  const session = await auth();
  const autoConvertSummary = await autoConvertService.getDailyAutoConvertSummary();

  const links = [
    {
      title: "Stock by Location",
      desc: "Live inventory breakdown and carton conversions across Godown and Shop.",
      href: "/godown/stock",
      color: "bg-teal-50 text-teal-800 border-teal-200",
    },
    {
      title: "Update Stock (Opening / Count / Adjust)",
      desc: "Enter opening stock, physical stock count, +/- adjustments, or bulk CSV upload without a GRN.",
      href: "/godown/stock/update",
      color: "bg-purple-50 text-purple-800 border-purple-200",
    },
    {
      title: "Receive Goods (GRN)",
      desc: "Record supplier goods received and update Godown ledger balances.",
      href: "/godown/purchases/new",
      color: "bg-emerald-50 text-emerald-800 border-emerald-200",
    },
    {
      title: "Purchase History",
      desc: "View past goods receipt notes and supplier delivery challans.",
      href: "/godown/purchases",
      color: "bg-blue-50 text-blue-800 border-blue-200",
    },
    {
      title: "Godown Operations & Auto-Convert Report",
      desc: "Carton → Loose conversion, daily auto-opened cartons report, reverse option, transfers & damage.",
      href: "/godown/operations",
      color: "bg-amber-50 text-amber-800 border-amber-200",
    },
    {
      title: "Van Load Sheets & Evening Return",
      desc: "Morning stock dispatch (Carton + Loose) and evening Van Stock-Wise Return to Godown.",
      href: "/godown/van-issues",
      color: "bg-indigo-50 text-indigo-800 border-indigo-200",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Godown &amp; Inventory Operations
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Logged in as {session?.user?.name || "Godown Staff"} • Main Warehouse (Fulfils Online &amp; Van Orders: Carton + Loose)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/management"
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-3.5 py-2.5 rounded-xl transition"
          >
            ← Management Hub
          </Link>
          <Link
            href="/godown/stock/update"
            className="bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition"
          >
            Update Stock
          </Link>
          <Link
            href="/godown/purchases/new"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition"
          >
            + New GRN Receipt
          </Link>
        </div>
      </div>

      {/* SAFEGUARD #1: Godown Keeper Notification Banner */}
      <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <span className="text-3xl">📦</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
                Godown Keeper Alert
              </span>
              <h2 className="text-base font-black text-slate-900">
                Aaj {autoConvertSummary.totalCartonsOpenedToday} carton auto-open hue (+
                {autoConvertSummary.totalLooseGeneratedToday} loose pieces)
              </h2>
            </div>
            <p className="text-xs text-slate-700 mt-1">
              Online order, van issue ya transfer me loose stock kam hone par system ne zaroorat ke hisaab se carton auto-open kiye. Physical stock match karne ya reverse karne ke liye report dekhein.
            </p>
          </div>
        </div>
        <Link
          href="/godown/operations"
          className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition text-center"
        >
          View Auto-Convert Report &amp; Reverse →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`p-6 rounded-2xl border shadow-sm transition hover:shadow-md hover:scale-[1.01] flex flex-col justify-between ${item.color}`}
          >
            <div>
              <h2 className="font-bold text-base">{item.title}</h2>
              <p className="text-xs opacity-80 mt-1.5">{item.desc}</p>
            </div>
            <span className="text-xs font-bold mt-4 block">Open Module →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
