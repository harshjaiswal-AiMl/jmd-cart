import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole, LocationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { vanService } from "@/modules/van/van.service";
import Link from "next/link";
import { formatISTDateTime } from "@/lib/date";

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

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <span>Van Operations</span>
              <span>/</span>
              <span>Daily Route Workspace</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {van ? van.name : "Delivery Van Workspace"}
            </h1>
            <p className="text-sm text-gray-600">
              Welcome, {session.user.name} ({session.user.role}). Daily route loading, on-van stock, and billing.
            </p>
          </div>

          {stockSummary?.activeVanDay && (
            <Link
              href={`/godown/van-issues/${stockSummary.activeVanDay.id}/print`}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-sm"
            >
              📄 Print Today&apos;s Load Sheet
            </Link>
          )}
        </div>

        {!van ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center text-amber-800 text-sm">
            No delivery van is currently assigned to your staff profile. Please contact the Super Admin to assign your route van.
          </div>
        ) : (
          <>
            {/* Active Load Status Banner */}
            {stockSummary?.activeVanDay ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="font-bold text-emerald-950 text-sm">
                      Morning Van Load Active: {stockSummary.activeVanDay.issueSheetNo}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-700 mt-1">
                    Dispatched from Central Godown on {formatISTDateTime(stockSummary.activeVanDay.date)}. Ready for route billing.
                  </p>
                </div>

                <Link
                  href={`/godown/van-issues/${stockSummary.activeVanDay.id}/print`}
                  className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  View Load Sheet →
                </Link>
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs text-blue-800">
                ℹ️ No active morning issue sheet recorded for today yet. When Godown dispatches stock to {van.name}, your load sheet will appear here automatically.
              </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <p className="text-xs text-gray-500 uppercase font-semibold">Total On-Van Items</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stockSummary?.inventory.length || 0}
                </p>
              </div>

              <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <p className="text-xs text-gray-500 uppercase font-semibold">Total Stock Pieces</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">
                  {stockSummary?.totalPieces || 0} pcs
                </p>
              </div>

              <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <p className="text-xs text-gray-500 uppercase font-semibold">Estimated Valuation</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">
                  ₹{((stockSummary?.totalValuationPaise || 0) / 100).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>

              <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <p className="text-xs text-gray-500 uppercase font-semibold">Route Status</p>
                <p className="text-sm font-bold text-gray-900 mt-2">
                  {stockSummary?.activeVanDay ? "ON ROUTE" : "AT GODOWN"}
                </p>
              </div>
            </div>

            {/* On-Van Inventory Table */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-sm font-bold text-gray-900">Current On-Van Inventory Matrix</h3>
                <span className="text-xs text-gray-500">Location: {van.name}</span>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                  <thead className="bg-gray-50 text-gray-700 font-semibold">
                    <tr>
                      <th className="px-4 py-3">Product Name</th>
                      <th className="px-4 py-3">Item Code</th>
                      <th className="px-4 py-3">Pack Size</th>
                      <th className="px-4 py-3 text-center">Cartons</th>
                      <th className="px-4 py-3 text-center">Loose Pcs</th>
                      <th className="px-4 py-3 text-right">Total Available</th>
                      <th className="px-4 py-3 text-right">MRP (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {!stockSummary || stockSummary.inventory.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                          Van currently has 0 inventory. Contact Godown to load morning stock.
                        </td>
                      </tr>
                    ) : (
                      stockSummary.inventory.map((item) => (
                        <tr key={item.product.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-medium text-gray-900">
                            {item.product.name}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-gray-500">
                            {item.product.shortCode}
                          </td>
                          <td className="px-4 py-2.5 text-gray-600">
                            {item.product.packSize} pcs / {item.product.packLabel}
                          </td>
                          <td className="px-4 py-2.5 text-center font-bold text-gray-800">
                            {item.cartons > 0 ? `${item.cartons} ctn` : "-"}
                          </td>
                          <td className="px-4 py-2.5 text-center text-gray-700">
                            {item.loosePieces > 0 ? `${item.loosePieces} pcs` : "-"}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-blue-600">
                            {item.qty} pcs
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-700">
                            ₹{(item.product.mrpPaise / 100).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
