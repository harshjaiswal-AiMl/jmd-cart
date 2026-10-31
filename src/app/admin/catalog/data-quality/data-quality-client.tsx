"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import {
  DataQualityReportSummary,
  DataQualityProductItem,
  DataQualityIssueType,
} from "@/modules/catalog/data-quality.service";
import { bulkDeactivateProductsAction } from "./actions";
import { ProductImage } from "@/components/common/ProductImage";

interface DataQualityClientProps {
  initialReport: DataQualityReportSummary;
  readOnly?: boolean;
}

const ISSUE_DESCRIPTIONS: Record<DataQualityIssueType, string> = {
  NUMERIC_OR_SHORT_NAME: "Numeric or Short Name (< 3 chars)",
  PACK_SIZE_OUTLIER: "Pack Size Outlier (> 5000 or ≤ 0)",
  MISSING_PRICE: "Missing Price (MRP / A / B / C)",
  MISSING_BRAND_OR_CATEGORY: "Missing Brand or Category",
  DUPLICATE_NAME: "Duplicate Product Name",
  MISSING_IMAGE: "Missing Photo / Image",
  MISSING_WEIGHT: "Missing Weight / Unit",
};

export function DataQualityClient({
  initialReport,
  readOnly = false,
}: DataQualityClientProps) {
  const [report, setReport] = useState<DataQualityReportSummary>(initialReport);
  const [selectedIssue, setSelectedIssue] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ACTIVE");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Deactivation confirmation modal state
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [deactivateReason, setDeactivateReason] = useState("Catalog data-quality cleanup");
  const [isDeactivating, startDeactivateTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Filter items
  const filteredItems = useMemo(() => {
    return report.items.filter((item) => {
      // Must have at least one issue to be in data-quality audit view
      if (item.issues.length === 0) return false;

      // Filter by selected issue type
      if (selectedIssue !== "ALL" && !item.issues.includes(selectedIssue as DataQualityIssueType)) {
        return false;
      }

      // Filter by active status
      if (statusFilter === "ACTIVE" && !item.active) return false;
      if (statusFilter === "INACTIVE" && item.active) return false;

      // Filter by search query
      if (searchTerm.trim().length > 0) {
        const term = searchTerm.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(term);
        const matchesShortCode = item.shortCode.toLowerCase().includes(term);
        const matchesBrand = item.companyName?.toLowerCase().includes(term) ?? false;
        if (!matchesName && !matchesShortCode && !matchesBrand) return false;
      }

      return true;
    });
  }, [report.items, selectedIssue, statusFilter, searchTerm]);

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((i) => i.id)));
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    const headers = [
      "ID",
      "Short Code",
      "Product Name",
      "Brand",
      "Category",
      "Pack Size",
      "MRP (₹)",
      "List C (₹)",
      "Status",
      "Issues",
    ];

    const rows = filteredItems.map((item) => [
      item.id,
      item.shortCode,
      `"${item.name.replace(/"/g, '""')}"`,
      `"${(item.companyName || "").replace(/"/g, '""')}"`,
      `"${(item.categoryName || "").replace(/"/g, '""')}"`,
      item.packSize,
      item.mrpPaise != null ? (item.mrpPaise / 100).toFixed(2) : "0.00",
      item.priceCPaise != null ? (item.priceCPaise / 100).toFixed(2) : "0.00",
      item.active ? "ACTIVE" : "INACTIVE",
      `"${item.issueLabels.join("; ")}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `jmd-catalog-data-quality-${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Bulk Deactivation
  const handleConfirmDeactivate = () => {
    const idsToDeactivate = Array.from(selectedIds);
    if (idsToDeactivate.length === 0) return;

    startDeactivateTransition(async () => {
      try {
        const res = await bulkDeactivateProductsAction({
          productIds: idsToDeactivate,
          reason: deactivateReason,
        });

        // Update local report state
        setReport((prev) => ({
          ...prev,
          activeFlaggedCount: Math.max(0, prev.activeFlaggedCount - res.deactivatedCount),
          items: prev.items.map((item) =>
            selectedIds.has(item.id) ? { ...item, active: false } : item
          ),
        }));

        setSelectedIds(new Set());
        setConfirmModalOpen(false);
        setActionMessage(`Successfully deactivated ${res.deactivatedCount} product(s).`);
      } catch (err) {
        setActionMessage(err instanceof Error ? err.message : "Failed to deactivate products");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Notification */}
      {actionMessage && (
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-sm flex items-center justify-between shadow-sm">
          <span>{actionMessage}</span>
          <button
            onClick={() => setActionMessage(null)}
            className="text-blue-600 font-bold hover:underline ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Total Catalog Items
          </div>
          <div className="text-2xl font-black text-gray-900 mt-1">
            {report.totalProducts}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Flagged with Issues
          </div>
          <div className="text-2xl font-black text-amber-600 mt-1">
            {report.totalFlaggedProducts}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Active Flagged Items
          </div>
          <div className="text-2xl font-black text-red-600 mt-1">
            {report.activeFlaggedCount}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Clean Products
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {Math.max(0, report.totalProducts - report.totalFlaggedProducts)}
          </div>
        </div>
      </div>

      {/* Filter Tabs & Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
        {/* Issue Filter Chips */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedIssue("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedIssue === "ALL"
                ? "bg-[#790E11] text-white shadow"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            All Issues ({report.totalFlaggedProducts})
          </button>

          {(Object.keys(ISSUE_DESCRIPTIONS) as DataQualityIssueType[]).map((key) => {
            const count = report.issuesBreakdown[key] || 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedIssue(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedIssue === key
                    ? "bg-[#790E11] text-white shadow"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {ISSUE_DESCRIPTIONS[key]} ({count})
              </button>
            );
          })}
        </div>

        {/* Search & Actions Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-3 w-full md:w-auto flex-1">
            <input
              type="text"
              placeholder="Filter by name, short code, or brand..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-xs w-full md:w-80 shadow-sm focus:ring-[#790E11]"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white font-medium"
            >
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
              <option value="ALL">All Statuses</option>
            </select>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold rounded-lg shadow-sm transition"
            >
              📥 Export CSV
            </button>

            {!readOnly && (
              <button
                type="button"
                disabled={selectedIds.size === 0}
                onClick={() => setConfirmModalOpen(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-xs font-bold rounded-lg shadow-sm transition"
              >
                Deactivate Selected ({selectedIds.size})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-700 divide-y divide-gray-200">
            <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filteredItems.length > 0 && selectedIds.size === filteredItems.length
                    }
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-[#790E11] focus:ring-[#790E11]"
                  />
                </th>
                <th className="p-3 w-16">Photo</th>
                <th className="p-3">Product Name & Code</th>
                <th className="p-3">Brand & Category</th>
                <th className="p-3 text-right">Pack Size</th>
                <th className="p-3 text-right">Prices (MRP / List C)</th>
                <th className="p-3">Status</th>
                <th className="p-3">Identified Quality Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400 font-medium">
                    No products matched the selected filters.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-gray-50/80 transition-colors ${
                        isSelected ? "bg-amber-50/50" : ""
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(item.id)}
                          className="rounded border-gray-300 text-[#790E11] focus:ring-[#790E11]"
                        />
                      </td>

                      <td className="p-3">
                        <div className="w-10 h-10 rounded border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
                          <ProductImage
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-contain p-0.5"
                          />
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="font-bold text-gray-900">{item.name}</div>
                        <div className="font-mono text-[10px] text-gray-500 mt-0.5">
                          {item.shortCode}
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="font-semibold text-gray-800">
                          {item.companyName || (
                            <span className="text-red-600 font-bold">Unassigned Brand</span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {item.categoryName || (
                            <span className="text-red-600 font-bold">Unassigned Category</span>
                          )}
                        </div>
                      </td>

                      <td className="p-3 text-right font-mono font-bold">
                        <span
                          className={
                            item.packSize > 5000 || item.packSize <= 0
                              ? "text-red-600 bg-red-50 px-1 py-0.5 rounded"
                              : "text-gray-800"
                          }
                        >
                          {item.packSize}
                        </span>{" "}
                        <span className="text-[10px] text-gray-500 font-normal">
                          {item.packLabel}
                        </span>
                      </td>

                      <td className="p-3 text-right font-mono">
                        <div>
                          MRP:{" "}
                          <span className="font-bold text-gray-900">
                            {item.mrpPaise != null
                              ? `₹${(item.mrpPaise / 100).toFixed(2)}`
                              : "None"}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-500">
                          List C:{" "}
                          <span className="font-semibold">
                            {item.priceCPaise != null
                              ? `₹${(item.priceCPaise / 100).toFixed(2)}`
                              : "None"}
                          </span>
                        </div>
                      </td>

                      <td className="p-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            item.active
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {item.active ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>

                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {item.issueLabels.map((lbl, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200"
                            >
                              {lbl}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm Deactivation Modal */}
      {confirmModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-800 uppercase tracking-wider">
                Confirm Bulk Action
              </span>
              <h2 className="text-lg font-bold text-gray-900 mt-1">
                Deactivate {selectedIds.size} Flagged Product(s)?
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Deactivated products will immediately be excluded from the public storefront and
                shop POS pickers until reviewed. No data will be deleted.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-700">
                Reason / Audit Log Note
              </label>
              <input
                type="text"
                required
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
                placeholder="Reason for deactivation..."
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeactivating}
                onClick={handleConfirmDeactivate}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold disabled:opacity-50"
              >
                {isDeactivating ? "Deactivating..." : "Confirm Deactivation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
