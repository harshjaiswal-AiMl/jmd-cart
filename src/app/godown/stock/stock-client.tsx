"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ProductStockBalanceItem,
  StockSummaryKPIs,
} from "@/modules/stock/stock.types";
import { getStockBalancesAction } from "./actions";

interface LocationOption {
  id: string;
  name: string;
  type: string;
}

interface CompanyOption {
  id: string;
  name: string;
}

interface StockClientProps {
  locations: LocationOption[];
  companies: CompanyOption[];
  initialData: { items: ProductStockBalanceItem[]; total: number };
  initialKPIs: StockSummaryKPIs;
}

export function StockClient({
  locations,
  companies,
  initialData,
  initialKPIs,
}: StockClientProps) {
  const [data, setData] = useState(initialData);
  const [kpis] = useState(initialKPIs);
  const [locationId, setLocationId] = useState<string>("");
  const [companyId, setCompanyId] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [lowStockOnly, setLowStockOnly] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isPending, startTransition] = useTransition();

  const pageSize = 100;
  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));
  const startCount = data.total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endCount = Math.min(data.total, currentPage * pageSize);

  const handleFilter = (
    newLocationId = locationId,
    newCompanyId = companyId,
    newSearch = search,
    newLowStock = lowStockOnly,
    page = 1
  ) => {
    startTransition(async () => {
      try {
        const result = await getStockBalancesAction({
          locationId: newLocationId || undefined,
          companyId: newCompanyId || undefined,
          search: newSearch || undefined,
          lowStockOnly: newLowStock,
          limit: pageSize,
          offset: (page - 1) * pageSize,
        });
        setData(result);
        setCurrentPage(page);
      } catch (err) {
        console.error("Failed to filter stock:", err);
      }
    });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    handleFilter(locationId, companyId, search, lowStockOnly, newPage);
  };

  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, "...", totalPages];
    }
    if (currentPage >= totalPages - 3) {
      return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleFilter(locationId, companyId, search, lowStockOnly, 1);
  };

  const formatPaise = (paise: number) => {
    return (paise / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Total Products
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {kpis.totalProducts}
          </div>
          <div className="mt-1 text-xs text-gray-500">Active catalog items</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Godown Stock
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-600">
            {kpis.godownQty.toLocaleString("en-IN")}{" "}
            <span className="text-xs font-normal text-gray-500">pcs</span>
          </div>
          <div className="mt-1 text-xs text-gray-500">Bulk reserve units</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Shop Stock
          </div>
          <div className="mt-2 text-2xl font-bold text-indigo-600">
            {kpis.shopQty.toLocaleString("en-IN")}{" "}
            <span className="text-xs font-normal text-gray-500">pcs</span>
          </div>
          <div className="mt-1 text-xs text-gray-500">Loose counter units</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center justify-between">
            <span>Low Stock Alerts</span>
            {kpis.lowStockCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-800 rounded-full">
                Action Required
              </span>
            )}
          </div>
          <div className={`mt-2 text-2xl font-bold ${kpis.lowStockCount > 0 ? "text-red-600" : "text-emerald-600"}`}>
            {kpis.lowStockCount}
          </div>
          <div className="mt-1 text-xs text-gray-500">At or below reorder level</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
            <input
              type="text"
              placeholder="Search by product name, short code, or company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Search
            </button>
          </form>

          {/* Location filter */}
          <div className="w-full md:w-48">
            <select
              value={locationId}
              onChange={(e) => {
                const val = e.target.value;
                setLocationId(val);
                handleFilter(val, companyId, search, lowStockOnly);
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">All Locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.type})
                </option>
              ))}
            </select>
          </div>

          {/* Company filter */}
          <div className="w-full md:w-48">
            <select
              value={companyId}
              onChange={(e) => {
                const val = e.target.value;
                setCompanyId(val);
                handleFilter(locationId, val, search, lowStockOnly);
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">All Companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Low Stock Toggle */}
          <button
            type="button"
            onClick={() => {
              const next = !lowStockOnly;
              setLowStockOnly(next);
              handleFilter(locationId, companyId, search, next);
            }}
            className={`px-3.5 py-2 text-sm font-medium rounded-lg border transition-colors flex items-center justify-center gap-1.5 ${
              lowStockOnly
                ? "bg-red-50 border-red-300 text-red-700 hover:bg-red-100"
                : "bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100"
            }`}
          >
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                lowStockOnly ? "bg-red-600" : "bg-gray-400"
              }`}
            />
            {lowStockOnly ? "Showing Low Stock" : "Filter Low Stock"}
          </button>
        </div>
      </div>

      {/* Stock Balances Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">
            Stock Inventory Items {isPending && <span className="text-xs text-blue-600 ml-2 animate-pulse">(Updating...)</span>}
          </span>
          <span className="text-xs text-gray-500">Page {currentPage} of {totalPages} ({data.total} total products)</span>
        </div>

        {data.items.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">
            No products match the selected criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3">Product / Short Code</th>
                  <th className="px-4 py-3">Company / Category</th>
                  <th className="px-4 py-3">Pack Config</th>
                  <th className="px-4 py-3">MRP</th>
                  <th className="px-4 py-3">
                    {locationId ? "Location Stock" : "Total Stock"}
                  </th>
                  <th className="px-4 py-3">Location Breakdown</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.items.map((item) => {
                  const qty = item.locationQty !== undefined ? item.locationQty : item.totalQty;
                  const isCartonBreakable = item.packSize > 1;

                  return (
                    <tr key={item.productId} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-gray-900">{item.productName}</div>
                        <div className="text-xs text-gray-500 font-mono mt-0.5">
                          {item.shortCode} {item.hsn && `• HSN: ${item.hsn}`}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="text-gray-900">{item.companyName || "-"}</div>
                        <div className="text-xs text-gray-500">{item.categoryName || "-"}</div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="text-gray-900 font-medium">
                          {item.packSize} pcs / {item.packLabel}
                        </div>
                        <div className="text-xs text-gray-500">
                          Reorder at: {item.reorderLevel} pcs
                        </div>
                      </td>

                      <td className="px-4 py-3.5 font-medium text-gray-900">
                        ₹{formatPaise(item.mrpPaise)}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className={`text-base font-bold ${item.isLowStock ? "text-red-600" : "text-gray-900"}`}>
                          {qty.toLocaleString("en-IN")}{" "}
                          <span className="text-xs font-normal text-gray-500">pcs</span>
                        </div>
                        {isCartonBreakable && (
                          <div className="text-xs text-gray-500">
                            {item.packsCount} {item.packLabel}s
                            {item.looseCount > 0 && ` + ${item.looseCount} loose`}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                          {item.balances.map((b) => (
                            <span
                              key={b.locationId}
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                b.qty > 0
                                  ? "bg-gray-100 text-gray-800 border border-gray-200"
                                  : "bg-gray-50 text-gray-400"
                              }`}
                              title={`${b.locationName}: ${b.qty} pieces`}
                            >
                              <span className="font-semibold mr-1">{b.locationName}:</span>
                              {b.qty}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        {item.isLowStock ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            Adequate
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <Link
                          href={`/godown/stock/${item.productId}`}
                          className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                        >
                          Movement Ledger →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {data.total > 0 && (
          <div className="p-4 border-t border-gray-200 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-gray-600">
              Showing <span className="font-semibold text-gray-900">{startCount}</span> to{" "}
              <span className="font-semibold text-gray-900">{endCount}</span> of{" "}
              <span className="font-semibold text-gray-900">{data.total}</span> products (100 per page)
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                <button
                  type="button"
                  disabled={currentPage === 1 || isPending}
                  onClick={() => handlePageChange(currentPage - 1)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← Prev
                </button>

                <div className="flex items-center gap-1 flex-wrap">
                  {getPageNumbers().map((p, idx) =>
                    p === "..." ? (
                      <span key={`ellipsis-${idx}`} className="px-2 py-1 text-xs text-gray-400 font-semibold">
                        ...
                      </span>
                    ) : (
                      <button
                        key={`page-${p}`}
                        type="button"
                        disabled={isPending}
                        onClick={() => handlePageChange(p as number)}
                        className={`min-w-[32px] h-8 px-2 text-xs font-semibold rounded-lg transition-colors ${
                          currentPage === p
                            ? "bg-blue-600 text-white shadow-xs"
                            : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                </div>

                <button
                  type="button"
                  disabled={currentPage === totalPages || isPending}
                  onClick={() => handlePageChange(currentPage + 1)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
