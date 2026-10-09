"use client";

import { useState } from "react";
import Link from "next/link";
import { PartyType } from "@prisma/client";
import { PartyWithOutstanding, CreatePartyInput } from "@/modules/party/party.types";
import { createPartyAction, updatePartyAction } from "./actions";
import { CollectionModal } from "@/components/van/collection-modal";

interface PartiesClientProps {
  initialParties: PartyWithOutstanding[];
  totalCount: number;
}

export function PartiesClient({ initialParties, totalCount }: PartiesClientProps) {
  const [parties, setParties] = useState(initialParties);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [creditFilter, setCreditFilter] = useState<boolean>(false);

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
    setType(PartyType.CUSTOMER);
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

  // Filter parties
  const filteredParties = parties.filter((p) => {
    if (typeFilter !== "ALL" && p.type !== typeFilter) return false;
    if (creditFilter && !p.creditEnabled) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchPhone = p.phone?.toLowerCase().includes(q);
      const matchGstin = p.gstin?.toLowerCase().includes(q);
      const matchTally = p.tallyRef?.toLowerCase().includes(q);
      return matchName || matchPhone || matchGstin || matchTally;
    }
    return true;
  });

  // Calculate summary KPIs
  const totalReceivables = parties
    .filter((p) => p.type === PartyType.CUSTOMER && p.outstandingPaise > 0)
    .reduce((sum, p) => sum + p.outstandingPaise, 0);

  const creditEnabledCount = parties.filter((p) => p.creditEnabled).length;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Parties</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalCount}</p>
          <p className="text-xs text-gray-500 mt-1">{creditEnabledCount} credit enabled accounts</p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Total Outstanding (Receivables)
          </p>
          <p className="text-2xl font-bold text-red-600 mt-1">
            ₹{(totalReceivables / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-500 mt-1">Due from retailers and customers</p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-center">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Tally Integration</p>
              <p className="text-xs text-gray-500 mt-0.5">Bulk import Sundry Debtors & Creditors</p>
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

      {/* Action and Filter Bar */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search parties by name, mobile, GSTIN, Tally alias..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-80 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Types</option>
            <option value={PartyType.CUSTOMER}>Customers (Debtors)</option>
            <option value={PartyType.SUPPLIER}>Suppliers (Creditors)</option>
          </select>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={creditFilter}
              onChange={(e) => setCreditFilter(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Credit Enabled Only
          </label>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm"
        >
          + Add New Party
        </button>
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
              {filteredParties.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No parties found matching the selected filters.
                  </td>
                </tr>
              ) : (
                filteredParties.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{p.name}</div>
                      {p.tallyRef && (
                        <div className="text-xs text-gray-500 font-mono">Tally: {p.tallyRef}</div>
                      )}
                      {p.address && <div className="text-xs text-gray-400 truncate max-w-xs">{p.address}</div>}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          p.type === PartyType.CUSTOMER
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-purple-50 text-purple-700 border border-purple-200"
                        }`}
                      >
                        {p.type === PartyType.CUSTOMER ? "Customer" : "Supplier"}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-xs text-gray-600">
                      {p.phone ? <div>📞 {p.phone}</div> : <div className="text-gray-400">No phone</div>}
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
      </div>

      {/* Modal */}
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
                    <option value={PartyType.CUSTOMER}>Customer (Debtor)</option>
                    <option value={PartyType.SUPPLIER}>Supplier (Creditor)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">Mobile Number</label>
                  <input
                    type="text"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit mobile"
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
