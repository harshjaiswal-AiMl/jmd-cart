import Link from "next/link";
import { auth } from "@/auth";

export default async function AdminDashboardPage() {
  const session = await auth();

  const links = [
    {
      title: "Catalog Master",
      desc: "Manage FMCG products, companies, and category hierarchies.",
      href: "/admin/catalog",
      color: "bg-blue-50 text-blue-800 border-blue-200",
    },
    {
      title: "Bulk CSV Import",
      desc: "Import 900+ row catalog with row-level error validation.",
      href: "/admin/catalog/import",
      color: "bg-indigo-50 text-indigo-800 border-indigo-200",
    },
    {
      title: "Quantity Price Slabs",
      desc: "Manage customer, retailer, and wholesaler dynamic tier pricing.",
      href: "/admin/pricing",
      color: "bg-purple-50 text-purple-800 border-purple-200",
    },
    {
      title: "Reports & Analytics",
      desc: "Stock valuation, low stock alerts, daily sales, and day-end cash register.",
      href: "/admin/reports",
      color: "bg-emerald-50 text-emerald-800 border-emerald-200",
    },
    {
      title: "Multi-Location Stock",
      desc: "Live inventory breakdown across Godown, Shop, and Delivery Vans.",
      href: "/godown/stock",
      color: "bg-teal-50 text-teal-800 border-teal-200",
    },
    {
      title: "Shop POS Register",
      desc: "Fast counter billing with instant search, carton conversion, and split tender.",
      href: "/shop/pos",
      color: "bg-amber-50 text-amber-800 border-amber-200",
    },
    {
      title: "Sales Invoices",
      desc: "Browse sales history, print A4/80mm receipts, and audit transactions.",
      href: "/shop/invoices",
      color: "bg-sky-50 text-sky-800 border-sky-200",
    },
    {
      title: "Business Settings",
      desc: "GSTIN, FSSAI, address, bank details, and role discount ceilings.",
      href: "/admin/settings",
      color: "bg-slate-50 text-slate-800 border-slate-200",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Administrator Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Welcome back, {session?.user?.name || "Administrator"}. IDMS Core Distribution System.
          </p>
        </div>
        <Link
          href="/shop/pos"
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition"
        >
          Open Shop POS
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`p-5 rounded-2xl border shadow-sm transition hover:shadow-md hover:scale-[1.01] flex flex-col justify-between ${item.color}`}
          >
            <div>
              <h2 className="font-bold text-sm">{item.title}</h2>
              <p className="text-xs opacity-80 mt-1">{item.desc}</p>
            </div>
            <span className="text-[11px] font-bold mt-4 block">Launch →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
