import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { purchaseService } from "@/modules/purchase/purchase.service";
import Link from "next/link";

export default async function PurchasesListPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== UserRole.SUPER_ADMIN && session.user.role !== UserRole.GODOWN) {
    redirect("/login");
  }

  const { purchases } = await purchaseService.listPurchases(session.user.role, { limit: 50 });

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Purchase Receipts (GRN)</h1>
            <p className="text-sm text-gray-600">
              Record incoming stock deliveries from manufacturers and suppliers directly into Godown inventory.
            </p>
          </div>

          <div>
            <Link
              href="/godown/purchases/new"
              className="inline-flex items-center justify-center px-4 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              + Record Stock Receipt (GRN)
            </Link>
          </div>
        </div>

        {/* Purchases Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Recent Goods Received Notes</span>
            <span className="text-xs text-gray-500">{purchases.length} records</span>
          </div>

          {purchases.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-500 text-sm">No purchase receipts recorded yet.</p>
              <div className="mt-4">
                <Link
                  href="/godown/purchases/new"
                  className="text-sm font-semibold text-blue-600 hover:underline"
                >
                  Create your first GRN →
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs font-semibold uppercase tracking-wider text-left">
                  <tr>
                    <th className="px-4 py-3">Bill / Invoice #</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3 text-center">Items</th>
                    <th className="px-4 py-3 text-right">Total Amount (₹)</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3">Received At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {purchases.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/75 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 font-mono">
                        {p.billNo}
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-medium">
                        {p.supplier?.name || "Direct / Unlisted"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{p.location.name}</td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {p.items.length} lines ({p.items.reduce((s, it) => s + it.qty, 0)} pcs)
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 font-mono">
                        ₹{(p.totalPaise / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(p.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
