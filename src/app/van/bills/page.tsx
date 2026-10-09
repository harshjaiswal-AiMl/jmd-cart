import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole, LocationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ReceiptText, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function VanBillsPage() {
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

  let van = await prisma.location.findFirst({
    where: {
      type: LocationType.VAN,
      assignedUserId: session.user.id,
      active: true,
    },
  });

  if (!van && session.user.role === UserRole.SUPER_ADMIN) {
    van = await prisma.location.findFirst({
      where: { type: LocationType.VAN, active: true },
    });
  }

  // Fetch recent invoices issued from this van location
  const invoices = van
    ? await prisma.invoice.findMany({
        where: { locationId: van.id },
        include: { party: true },
        orderBy: { createdAt: "desc" },
        take: 30,
      })
    : [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/van"
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-black text-white">Van Invoices Register</h1>
          <p className="text-xs text-slate-400">
            {van ? van.name : "Unassigned Van"} • Recent bills issued on route
          </p>
        </div>
      </div>

      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ReceiptText className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Route Sales History</h3>
          </div>
          <span className="text-xs text-slate-400">{invoices.length} Invoices</span>
        </div>

        {invoices.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <ReceiptText className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p className="text-sm font-medium">No route invoices recorded yet for this van.</p>
            <p className="text-xs text-slate-500">
              Invoices generated during daily sales rounds will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="p-4 flex items-center justify-between gap-3 hover:bg-slate-800/40"
              >
                <div>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {inv.number}
                  </span>
                  <p className="text-sm font-bold text-white mt-0.5">
                    {inv.party?.name || "Cash Customer"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {inv.status} • {inv.paymentStatus}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-white">
                    ₹{(inv.totalPaise / 100).toFixed(2)}
                  </span>
                  <div className="mt-1">
                    <Link
                      href={`/shop/invoices/${inv.id}/print`}
                      className="text-xs font-semibold text-emerald-400 hover:underline"
                    >
                      Print Receipt
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
