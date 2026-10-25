import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { hasPermission, Permission } from "@/modules/auth/permissions";
import { stockService } from "@/modules/stock/stock.service";
import { formatISTDateTime } from "@/lib/date";
import { MovementType } from "@prisma/client";

interface PageProps {
  params: Promise<{ productId: string }>;
}

export default async function ProductStockLedgerPage({ params }: PageProps) {
  const { productId } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!hasPermission(session.user.role, Permission.STOCK_VIEW)) {
    redirect("/login");
  }

  const [details, movements] = await Promise.all([
    stockService.getProductStockDetails(session.user.role, productId),
    stockService.getProductMovements(session.user.role, productId, { limit: 100 }),
  ]);

  if (!details) {
    notFound();
  }

  const { product, balances, totalQty, isLowStock } = details;

  const formatPaise = (paise: number) => {
    return (paise / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getMovementBadge = (type: MovementType) => {
    switch (type) {
      case "PURCHASE_RECEIPT":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "TRANSFER":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "CARTON_BREAK":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "DAMAGE":
        return "bg-red-100 text-red-800 border-red-200";
      case "ADJUSTMENT":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "SALE":
        return "bg-teal-100 text-teal-800 border-teal-200";
      case "SALE_CANCEL":
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "VAN_ISSUE":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "VAN_RETURN":
        return "bg-cyan-100 text-cyan-800 border-cyan-200";
      case "RETURN_TO_COMPANY":
        return "bg-orange-100 text-orange-800 border-orange-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Link href="/godown/stock" className="hover:text-blue-600 font-medium">
              ← Back to Stock Overview
            </Link>
            <span>/</span>
            <span className="text-gray-900 font-semibold">{product.name}</span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/godown/operations"
              className="px-3.5 py-2 text-xs font-medium rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
            >
              Transfer / Break Cartons →
            </Link>
          </div>
        </div>

        {/* Product Details Header Card */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
                <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-semibold bg-gray-100 text-gray-800 border border-gray-200">
                  {product.shortCode}
                </span>
                {isLowStock ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                    Low Stock
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    In Stock
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
                {product.companyName && (
                  <div>
                    <span className="font-semibold text-gray-700">Company:</span> {product.companyName}
                  </div>
                )}
                {product.categoryName && (
                  <div>
                    <span className="font-semibold text-gray-700">Category:</span> {product.categoryName}
                  </div>
                )}
                <div>
                  <span className="font-semibold text-gray-700">HSN:</span> {product.hsn}
                </div>
                <div>
                  <span className="font-semibold text-gray-700">GST:</span> {(product.gstRateBp / 100).toFixed(0)}%
                </div>
                <div>
                  <span className="font-semibold text-gray-700">MRP:</span> ₹{formatPaise(product.mrpPaise)}
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Pack:</span> {product.packSize} pcs / {product.packLabel}
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Reorder Level:</span> {product.reorderLevel} pcs
                </div>
              </div>
            </div>

            {/* Total Aggregate Stock */}
            <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-100 text-right">
              <div className="text-xs font-medium text-blue-700 uppercase tracking-wider">
                Total Available Stock
              </div>
              <div className="text-3xl font-extrabold text-blue-900 mt-1">
                {totalQty.toLocaleString("en-IN")}{" "}
                <span className="text-sm font-normal text-blue-600">pcs</span>
              </div>
              {product.packSize > 1 && (
                <div className="text-xs text-blue-800 mt-1">
                  {Math.floor(totalQty / product.packSize)} {product.packLabel}s
                  {totalQty % product.packSize > 0 && ` + ${totalQty % product.packSize} loose`}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Location Balances Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {balances.map((loc) => (
            <div
              key={loc.locationId}
              className={`p-4 rounded-xl border shadow-sm ${
                loc.qty > 0
                  ? "bg-white border-gray-200"
                  : "bg-gray-50/70 border-gray-200 text-gray-400"
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-gray-600 uppercase">
                <span>{loc.locationName}</span>
                <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                  {loc.locationType}
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-gray-900">
                {loc.qty.toLocaleString("en-IN")}{" "}
                <span className="text-xs font-normal text-gray-500">pcs</span>
              </div>
              {product.packSize > 1 && (
                <div className="mt-1 text-xs text-gray-500">
                  {loc.packsCount} {product.packLabel}s
                  {loc.looseCount > 0 && ` + ${loc.looseCount} loose`}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Chronological Stock Movements Ledger */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Chronological Movement Ledger</h2>
              <p className="text-xs text-gray-500">
                Immutable audit trail of all receipts, transfers, breaks, damages, and adjustments in Indian Standard Time (IST).
              </p>
            </div>
            <span className="text-xs font-medium text-gray-500">
              {movements.length} recorded movements
            </span>
          </div>

          {movements.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm">
              No stock movements recorded yet for this product.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3">Date & Time (IST)</th>
                    <th className="px-4 py-3">Movement Type</th>
                    <th className="px-4 py-3">Movement Route</th>
                    <th className="px-4 py-3">Quantity</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Reason / Remarks</th>
                    <th className="px-4 py-3">Performed By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {movements.map((m) => {
                    const hasPacks = product.packSize > 1 && m.qty >= product.packSize;

                    return (
                      <tr key={m.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs font-mono text-gray-700">
                          {formatISTDateTime(m.createdAt)}
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${getMovementBadge(
                              m.type
                            )}`}
                          >
                            {m.type}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-xs text-gray-700">
                          {m.fromLocationName && m.toLocationName ? (
                            <span>
                              {m.fromLocationName} <span className="text-gray-400">→</span>{" "}
                              <span className="font-semibold text-gray-900">{m.toLocationName}</span>
                            </span>
                          ) : m.toLocationName ? (
                            <span>
                              <span className="text-gray-400">Received at </span>
                              <span className="font-semibold text-gray-900">{m.toLocationName}</span>
                            </span>
                          ) : m.fromLocationName ? (
                            <span>
                              <span className="text-gray-400">Deducted from </span>
                              <span className="font-semibold text-gray-900">{m.fromLocationName}</span>
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="font-bold text-gray-900">
                            {m.qty.toLocaleString("en-IN")}{" "}
                            <span className="text-xs font-normal text-gray-500">pcs</span>
                          </div>
                          {hasPacks && (
                            <div className="text-[11px] text-gray-500">
                              {m.packsCount} {product.packLabel}s
                              {m.looseCount > 0 && ` + ${m.looseCount} pcs`}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-xs font-mono text-gray-700">
                          {m.referenceType ? (
                            <div>
                              <span className="font-semibold">{m.referenceType}</span>
                              {m.referenceId && <div className="text-[11px] text-gray-500">{m.referenceId}</div>}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-xs text-gray-600 max-w-xs truncate">
                          {m.reason || <span className="text-gray-400">-</span>}
                        </td>

                        <td className="px-4 py-3.5 text-xs text-gray-700">
                          {m.creatorName || (m.createdBy ? <span className="font-mono text-[11px]">{m.createdBy.slice(0, 8)}</span> : <span className="text-gray-400">System</span>)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
