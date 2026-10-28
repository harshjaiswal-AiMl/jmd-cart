"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { PartyType } from "@prisma/client";
import { PartyWithOutstanding, CreatePartyInput } from "@/modules/party/party.types";
import { createPartyAction, updatePartyAction } from "./actions";
import { CollectionModal } from "@/components/van/collection-modal";

interface PartiesClientProps {
  initialParties: PartyWithOutstanding[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  currentType?: string;
  currentSearch?: string;
  currentCreditOnly?: boolean;
}

export function PartiesClient({
  initialParties,
  totalCount,
  currentPage,
  pageSize,
  currentType = "ALL",
  currentSearch = "",
  currentCreditOnly = false,
}: PartiesClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [parties, setParties] = useState(initialParties);
  const [searchInput, setSearchInput] = useState(currentSearch);
  const [typeFilter, setTypeFilter] = useState<string>(currentType);
  const [creditFilter, setCreditFilter] = useState<boolean>(currentCreditOnly);

  // Sync state when props change
  useEffect(() => {
    setParties(initialParties);
  }, [initialParties]);

  useEffect(() => {
    setSearchInput(currentSearch);
  }, [currentSearch]);

  useEffect(() => {
    setTypeFilter(currentType);
  }, [currentType]);

  useEffect(() => {
    setCreditFilter(currentCreditOnly);
  }, [currentCreditOnly]);

  // URL query updater
  const updateUrl = (updates: {
    page?: number;
    type?: string;
    q?: string;
    creditOnly?: boolean;
  }) => {
    const params = new URLSearchParams(searchParams ? searchParams.toString() : "");

    if (updates.page !== undefined) {
      if (updates.page <= 1) {
        params.delete("page");
      } else {
        params.set("page", updates.page.toString());
      }
    }

    if (updates.type !== undefined) {
      if (updates.type === "ALL" || !updates.type) {
        params.delete("type");
      } else {
        params.set("type", updates.type);
      }
      params.delete("page"); // Reset to page 1 on filter change
    }

    if (updates.q !== undefined) {
      const trimmed = updates.q.trim();
      if (!trimmed) {
        params.delete("q");
      } else {
        params.set("q", trimmed);
      }
      params.delete("page"); // Reset to page 1 on search change
    }

    if (updates.creditOnly !== undefined) {
      if (!updates.creditOnly) {
        params.delete("creditOnly");
      } else {
        params.set("creditOnly", "true");
      }
      params.delete("page"); // Reset to page 1 on filter change
    }

    // Always enforce 100 limit
    params.set("limit", pageSize.toString());

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrl({ q: searchInput });
  };

  const handleTypeTabChange = (selectedType: string) => {
    setTypeFilter(selectedType);
    updateUrl({ type: selectedType });
  };

  const handleCreditToggle = (checked: boolean) => {
    setCreditFilter(checked);
    updateUrl({ creditOnly: checked });
  };

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<PartyWithOutstanding | null>(null);
  const [collectParty, setCollectParty] = useState<PartyWithOutstanding | null>(null);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [type, setType] = useState<PartyType>(PartyType.CUSTOMER);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gstin, setGstin] = useState("");
  const [address, setAddress] = useState("");
  const [creditEnabled, setCreditEnabled] = useState(false);
  const [creditLimitRs, setCreditLimitRs] = useState("");
  const [creditDays, setCreditDays] = useState("");
  const [openingBalanceRs, setOpeningBalanceRs] = useState("");
  const [tallyRef, setTallyRef] = useState("");

  const openAddModal = () => {
    setEditingParty(null);
    setName("");
    setType(
      typeFilter !== "ALL" && Object.values(PartyType).includes(typeFilter as PartyType)
        ? (typeFilter as PartyType)
        : PartyType.CUSTOMER
    );
    setPhone("");
    setEmail("");
    setGstin("");
    setAddress("");
    setCreditEnabled(false);
    setCreditLimitRs("");
    setCreditDays("");
    setOpeningBalanceRs("");
    setTallyRef("");
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (p: PartyWithOutstanding) => {
    setEditingParty(p);
    setName(p.name);
    setType(p.type);
    setPhone(p.phone || "");
    setEmail(p.email || "");
    setGstin(p.gstin || "");
    setAddress(p.address || "");
    setCreditEnabled(p.creditEnabled);
    setCreditLimitRs((p.creditLimitPaise / 100).toString());
    setCreditDays(p.creditDays.toString());
    setOpeningBalanceRs((p.outstandingPaise / 100).toString());
    setTallyRef(p.tallyRef || "");
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFormError(null);

    const creditLimitPaise = Math.round((parseFloat(creditLimitRs) || 0) * 100);
    const parsedDays = parseInt(creditDays, 10) || 0;
    const openingOutstandingPaise = Math.round((parseFloat(openingBalanceRs) || 0) * 100);

    const payload: CreatePartyInput = {
      name,
      type,
      phone: phone || undefined,
      email: email || undefined,
      gstin: gstin ? gstin.toUpperCase() : undefined,
      address: address || undefined,
      creditEnabled: creditEnabled || creditLimitPaise > 0,
      creditLimitPaise,
      creditDays: parsedDays,
      openingOutstandingPaise,
      tallyRef: tallyRef || undefined,
      active: true,
    };

    if (editingParty) {
      const res = await updatePartyAction({
        id: editingParty.id,
        ...payload,
      });

      if (res.success && res.data) {
        setParties((prev) =>
          prev.map((item) => (item.id === editingParty.id ? (res.data as PartyWithOutstanding) : item))
        );
        setIsModalOpen(false);
      } else {
        setFormError(res.error || "Failed to update party");
      }
    } else {
      const res = await createPartyAction(payload);
      if (res.success && res.data) {
        setParties((prev) => [res.data as PartyWithOutstanding, ...prev]);
        setIsModalOpen(false);
      } else {
        setFormError(res.error || "Failed to create party");
      }
    }
    setLoading(false);
  };

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const fromItem = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const toItem = Math.min(currentPage * pageSize, totalCount);

  // Generate page buttons
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  // Helper for type badges
  const renderTypeBadge = (partyType: PartyType) => {
    switch (partyType) {
      case PartyType.CUSTOMER:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            Customer
          </span>
        );
      case PartyType.RETAILER:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            Retailer
          </span>
        );
      case PartyType.WHOLESALER:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
            Wholesaler
          </span>
        );
      case PartyType.SUPPLIER:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
            Supplier
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200">
            {partyType}
          </span>
        );
    }
  };

  // Calculate summary KPIs for current view
  const totalReceivables = parties
    .filter((p) => p.type !== PartyType.SUPPLIER && p.outstandingPaise > 0)
    .reduce((sum, p) => sum + p.outstandingPaise, 0);

  const creditEnabledCount = parties.filter((p) => p.creditEnabled).length;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Parties</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-gray-900">{totalCount.toLocaleString("en-IN")}</span>
            <span className="text-xs text-gray-500 font-medium">({totalPages} pages @ 100/page)</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {creditEnabledCount} credit accounts on this page
          </p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Total Outstanding (Receivables)
          </p>
          <p className="text-2xl font-bold text-red-600 mt-1">
            ₹{(totalReceivables / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-500 mt-1">Current page receivables</p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-center">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Tally Integration</p>
              <p className="text-xs text-gray-500 mt-0.5">1,660+ Parties Imported & Verified</p>
            </div>
            <Link
              href="/admin/parties/import"
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
            >
              Import CSV
            </Link>
          </div>
        </div>
      </div>

      {/* Type Tabs */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-1.5 flex flex-wrap gap-1.5 items-center">
        {[
          { key: "ALL", label: "All Parties" },
          { key: PartyType.CUSTOMER, label: "Customers" },
          { key: PartyType.RETAILER, label: "Retailers" },
          { key: PartyType.WHOLESALER, label: "Wholesalers" },
          { key: PartyType.SUPPLIER, label: "Suppliers" },
        ].map((tab) => {
          const isActive = typeFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTypeTabChange(tab.key)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Action and Filter Bar */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <input
              type="text"
              placeholder="Search by name, phone, GSTIN, Tally alias... (Press Enter)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  updateUrl({ q: "" });
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="submit"
            className="px-3.5 py-2 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors shadow-sm"
          >
            Search
          </button>

          <select
            value={typeFilter}
            onChange={(e) => handleTypeTabChange(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Types</option>
            <option value={PartyType.CUSTOMER}>Customers</option>
            <option value={PartyType.RETAILER}>Retailers</option>
            <option value={PartyType.WHOLESALER}>Wholesalers</option>
            <option value={PartyType.SUPPLIER}>Suppliers</option>
          </select>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={creditFilter}
              onChange={(e) => handleCreditToggle(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Credit Enabled Only
          </label>
        </form>

        <div className="flex items-center gap-2">
          <button
            onClick={openAddModal}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 shadow-sm"
          >
            + Add New Party
          </button>
        </div>
      </div>

      {/* Top Pagination Bar Summary */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600 px-1">
        <div>
          Showing <span className="font-semibold text-gray-900">{fromItem}</span> to{" "}
          <span className="font-semibold text-gray-900">{toItem}</span> of{" "}
          <span className="font-semibold text-gray-900">{totalCount.toLocaleString("en-IN")}</span> parties{" "}
          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono text-[11px] font-medium border border-gray-200">
            100 per page
          </span>
          {isPending && <span className="ml-2 text-blue-600 font-medium animate-pulse">Loading...</span>}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 mr-1">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage <= 1 || isPending}
              onClick={() => updateUrl({ page: currentPage - 1 })}
              className="px-2 py-1 border border-gray-300 rounded bg-white text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ‹ Prev
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages || isPending}
              onClick={() => updateUrl({ page: currentPage + 1 })}
              className="px-2 py-1 border border-gray-300 rounded bg-white text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next ›
            </button>
          </div>
        )}
      </div>

      {/* Parties Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-gray-50 text-gray-700 font-semibold">
              <tr>
                <th className="px-4 py-3">Party Name / Alias</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Contact & GSTIN</th>
                <th className="px-4 py-3">Credit Terms</th>
                <th className="px-4 py-3 text-right">Outstanding (₹)</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {parties.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    <p className="text-sm font-medium text-gray-700">No parties found matching the selected filters.</p>
                    <p className="text-xs text-gray-400 mt-1">Try resetting search or selecting a different tab.</p>
                  </td>
                </tr>
              ) : (
                parties.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{p.name}</div>
                      {p.tallyRef && (
                        <div className="text-xs text-gray-500 font-mono">Tally: {p.tallyRef}</div>
                      )}
                      {p.address && <div className="text-xs text-gray-400 truncate max-w-xs">{p.address}</div>}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {renderTypeBadge(p.type)}
                        {p.type === PartyType.SUPPLIER && p.companyId && (
                          <Link
                            href={`/admin/catalog?companyId=${p.companyId}`}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors"
                            title="View brand products in catalog"
                          >
                            🏷️ Brand
                          </Link>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-xs text-gray-600">
                      {p.phone ? (
                        <div className="font-mono text-gray-800 font-medium">📞 {p.phone}</div>
                      ) : (
                        <div className="text-gray-400 italic">No phone</div>
                      )}
                      {p.gstin && <div className="font-mono text-gray-700 mt-0.5">GST: {p.gstin}</div>}
                    </td>

                    <td className="px-4 py-3">
                      {p.creditEnabled ? (
                        <div className="text-xs space-y-0.5">
                          <div className="font-medium text-green-700">
                            Limit: ₹{(p.creditLimitPaise / 100).toLocaleString("en-IN")}
                          </div>
                          <div className="text-gray-500">Period: {p.creditDays} days</div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Cash Only</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right font-medium">
                      {p.outstandingPaise > 0 ? (
                        <span className="text-red-600 font-semibold">
                          ₹{(p.outstandingPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })} Dr
                        </span>
                      ) : p.outstandingPaise < 0 ? (
                        <span className="text-green-600">
                          ₹{(Math.abs(p.outstandingPaise) / 100).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}{" "}
                          Cr
                        </span>
                      ) : (
                        <span className="text-gray-400">₹0.00</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/admin/parties/${p.id}/ledger`}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 border border-blue-200"
                          title="View Ledger Statement"
                        >
                          Ledger
                        </Link>
                        <button
                          onClick={() => setCollectParty(p)}
                          className="text-xs text-emerald-700 hover:text-emerald-800 font-medium px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 border border-emerald-200"
                          title="Record Collection Voucher"
                        >
                          Collect
                        </button>
                        <button
                          onClick={() => openEditModal(p)}
                          className="text-xs text-gray-600 hover:text-gray-900 font-medium px-2 py-1 rounded hover:bg-gray-100 border border-gray-200"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination Bar */}
        <div className="bg-gray-50 px-4 py-3.5 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-xs text-gray-700 flex items-center gap-2">
            <span>
              Showing <strong className="font-semibold">{fromItem}</strong> to{" "}
              <strong className="font-semibold">{toItem}</strong> of{" "}
              <strong className="font-semibold">{totalCount.toLocaleString("en-IN")}</strong> parties
            </span>
            <span className="text-gray-400">|</span>
            <span className="font-mono text-gray-500 font-medium">100 parties per page</span>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1 flex-wrap justify-center">
              <button
                type="button"
                disabled={currentPage <= 1 || isPending}
                onClick={() => updateUrl({ page: 1 })}
                className="px-2.5 py-1 text-xs border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                title="First Page"
              >
                « First
              </button>
              <button
                type="button"
                disabled={currentPage <= 1 || isPending}
                onClick={() => updateUrl({ page: currentPage - 1 })}
                className="px-2.5 py-1 text-xs border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ‹ Prev
              </button>

              {getPageNumbers().map((pg, idx) => {
                if (pg === "...") {
                  return (
                    <span key={`dots-${idx}`} className="px-2 py-1 text-xs text-gray-400 select-none">
                      ...
                    </span>
                  );
                }
                const pageNum = Number(pg);
                const isCurrent = pageNum === currentPage;
                return (
                  <button
                    key={`page-${pageNum}`}
                    type="button"
                    disabled={isPending}
                    onClick={() => updateUrl({ page: pageNum })}
                    className={`min-w-[32px] px-2 py-1 text-xs rounded transition-colors font-medium ${
                      isCurrent
                        ? "bg-blue-600 text-white shadow-sm border border-blue-600"
                        : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                type="button"
                disabled={currentPage >= totalPages || isPending}
                onClick={() => updateUrl({ page: currentPage + 1 })}
                className="px-2.5 py-1 text-xs border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next ›
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages || isPending}
                onClick={() => updateUrl({ page: totalPages })}
                className="px-2.5 py-1 text-xs border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Last Page"
              >
                Last »
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal for Add / Edit Party */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {editingParty ? "Edit Party & Credit Terms" : "Add New Party"}
            </h2>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4 text-sm">
              <div>
                <label className="block font-medium text-gray-700 mb-1">
                  Party / Ledger Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ramesh Kirana Store"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Party Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as PartyType)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-blue-500"
                  >
                    <option value={PartyType.CUSTOMER}>Customer</option>
                    <option value={PartyType.RETAILER}>Retailer</option>
                    <option value={PartyType.WHOLESALER}>Wholesaler</option>
                    <option value={PartyType.SUPPLIER}>Supplier</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">Mobile Number</label>
                  <input
                    type="text"
                    maxLength={15}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Mobile number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">GSTIN (Optional)</label>
                  <input
                    type="text"
                    maxLength={15}
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="15-character GSTIN"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 font-mono text-xs uppercase"
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">Tally Alias / Ref</label>
                  <input
                    type="text"
                    value={tallyRef}
                    onChange={(e) => setTallyRef(e.target.value)}
                    placeholder="e.g. TALLY-L-102"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Address / Location</label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Market area, Saharsa"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 text-xs"
                />
              </div>

              {/* Credit Terms Section */}
              <div className="border-t border-gray-200 pt-3">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    id="creditEnabled"
                    checked={creditEnabled}
                    onChange={(e) => setCreditEnabled(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="creditEnabled" className="font-medium text-gray-900 cursor-pointer">
                    Enable Credit Facility
                  </label>
                </div>

                {creditEnabled && (
                  <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-md border border-gray-200">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Credit Limit (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={creditLimitRs}
                        onChange={(e) => setCreditLimitRs(e.target.value)}
                        placeholder="e.g. 50000"
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Credit Period (Days)</label>
                      <input
                        type="number"
                        min="0"
                        max="365"
                        value={creditDays}
                        onChange={(e) => setCreditDays(e.target.value)}
                        placeholder="e.g. 15"
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">
                  Opening Outstanding Balance (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={openingBalanceRs}
                  onChange={(e) => setOpeningBalanceRs(e.target.value)}
                  placeholder="Positive: Party owes; Negative: Advance / Credit"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 text-xs"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Initial balance imported from Tally. Recorded as an opening ledger adjustment.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs font-medium disabled:opacity-50"
                >
                  {loading ? "Saving..." : editingParty ? "Update Party" : "Create Party"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Collection Modal */}
      <CollectionModal
        party={
          collectParty
            ? {
                id: collectParty.id,
                name: collectParty.name,
                phone: collectParty.phone,
                outstandingPaise: collectParty.outstandingPaise,
              }
            : null
        }
        isOpen={!!collectParty}
        onClose={() => setCollectParty(null)}
        onSuccess={() => {
          window.location.reload();
        }}
      />
    </div>
  );
}
