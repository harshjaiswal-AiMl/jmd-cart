import Link from "next/link";
import { auth } from "@/auth";

export default async function GodownDashboardPage() {
  const session = await auth();

  const links = [
    {
      title: "Stock by Location",
      desc: "Live inventory breakdown and carton conversions across Godown and Shop.",
      href: "/godown/stock",
      color: "bg-teal-50 text-teal-800 border-teal-200",
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
      title: "Godown Operations",
      desc: "Internal stock transfers, carton breaking, damage, adjustments, and audits.",
      href: "/godown/operations",
      color: "bg-amber-50 text-amber-800 border-amber-200",
    },
    {
      title: "Van Load Sheets",
      desc: "Morning stock dispatch into delivery vans and formal issue sheets.",
      href: "/godown/van-issues",
      color: "bg-indigo-50 text-indigo-800 border-indigo-200",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Godown & Inventory Operations
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Logged in as {session?.user?.name || "Godown Staff"} • Main Warehouse
          </p>
        </div>
        <Link
          href="/godown/purchases/new"
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition"
        >
          + New GRN Receipt
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
