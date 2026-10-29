import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { vanService } from "@/modules/van/van.service";
import Link from "next/link";
import { formatISTDateTime } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function VanIssuesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== UserRole.SUPER_ADMIN && session.user.role !== UserRole.GODOWN) {
    redirect("/login");
  }

  const { vanDays, total } = await vanService.listVanDays(session.user.role);

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <Link href="/godown" className="hover:underline">
                Godown
              </Link>
              <span>/</span>
              <span>Van Operations</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Van Issue & Load Sheets</h1>
            <p className="text-sm text-gray-600">
              Morning stock dispatch from Central Godown into route delivery vans.
            </p>
          </div>

          <Link
            href="/godown/van-issues/new"
            className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium shadow-sm"
          >
            + Load Van (New Issue Sheet)
          </Link>
        </div>

        {/* List of Van Issue Sheets */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-gray-700 font-semibold">
                <tr>
                  <th className="px-4 py-3">Issue Sheet No</th>
                  <th className="px-4 py-3">Date & Time (IST)</th>
                  <th className="px-4 py-3">Delivery Van</th>
                  <th className="px-4 py-3">Assigned Salesperson</th>
                  <th className="px-4 py-3 text-center">Items Loaded</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {vanDays.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No van issue sheets recorded yet. Click &quot;Load Van&quot; above to dispatch stock.
                    </td>
                  </tr>
                ) : (
                  vanDays.map((vd) => {
                    const totalPieces = vd.lines.reduce((sum, l) => sum + l.issuedQty, 0);

                    return (
                      <tr key={vd.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono font-medium text-blue-600">
                          {vd.issueSheetNo}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {formatISTDateTime(vd.date)}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {vd.vanLocation.name}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700">
                          <div>{vd.salesperson.name}</div>
                          <div className="text-gray-400">📞 {vd.salesperson.phone}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            {vd.lines.length} lines ({totalPieces} pcs)
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                              vd.status === "OPEN"
                                ? "bg-amber-100 text-amber-800"
                                : vd.status === "RECONCILED"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {vd.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                          {vd.status === "OPEN" ? (
                            <>
                              <Link
                                href={`/godown/van-issues/${vd.id}/edit`}
                                className="text-xs text-blue-700 hover:text-blue-900 font-semibold px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 border border-blue-200"
                              >
                                ✏️ Edit Load
                              </Link>
                              <Link
                                href={`/godown/van-issues/${vd.id}/reconcile`}
                                className="text-xs text-amber-700 hover:text-amber-900 font-semibold px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 border border-amber-200"
                              >
                                🔄 Reconcile Return
                              </Link>
                            </>
                          ) : (
                            <Link
                              href={`/godown/van-issues/${vd.id}/reconcile`}
                              className="text-xs text-indigo-700 hover:text-indigo-900 font-semibold px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 border border-indigo-200"
                            >
                              📋 View Report
                            </Link>
                          )}
                          <Link
                            href={`/godown/van-issues/${vd.id}/print`}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50"
                          >
                            🖨️ Load Sheet
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
