"use client";

import { useState } from "react";
import {
  Plus,
  Play,
  Trash2,
  Sparkles,
  Info,
} from "lucide-react";
import { IncentiveRuleScope } from "@prisma/client";
import {
  createRuleAction,
  deleteRuleAction,
  testCalculationAction,
} from "../actions";

interface RuleWithRelations {
  id: string;
  scope: IncentiveRuleScope;
  percentBp: number;
  validFrom: Date;
  validTo: Date | null;
  active: boolean;
  note: string | null;
  agentUser: { id: string; name: string; agentCode: string | null } | null;
  company: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  product: { id: string; name: string; shortCode: string | null } | null;
}

interface SelectOption {
  id: string;
  name: string;
  agentCode?: string | null;
  shortCode?: string | null;
  basePricePaise?: number;
}

export function IncentiveRulesClient({
  rules,
  agents,
  companies,
  categories,
  products,
}: {
  rules: RuleWithRelations[];
  agents: SelectOption[];
  companies: SelectOption[];
  categories: SelectOption[];
  products: SelectOption[];
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scope, setScope] = useState<IncentiveRuleScope>(IncentiveRuleScope.GLOBAL);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [percentString, setPercentString] = useState("1.00");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Simulator state
  const [simAgentId, setSimAgentId] = useState(agents[0]?.id || "");
  const [simProductId, setSimProductId] = useState(products[0]?.id || "");
  const [simPriceRupees, setSimPriceRupees] = useState("500");
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<{
    percentBp: number;
    amountPaise: number;
    ruleScope: string;
    explanation: string;
  } | null>(null);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const percentVal = parseFloat(percentString);
      if (isNaN(percentVal) || percentVal < 0 || percentVal > 100) {
        throw new Error("Percentage must be between 0 and 100");
      }
      const percentBp = Math.round(percentVal * 100);

      await createRuleAction({
        scope,
        percentBp,
        validFrom: new Date(),
        active: true,
        agentUserId: selectedAgentId || undefined,
        companyId: selectedCompanyId || undefined,
        categoryId: selectedCategoryId || undefined,
        productId: selectedProductId || undefined,
        note: note || undefined,
      });

      setIsModalOpen(false);
      setNote("");
      setPercentString("1.00");
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || "Failed to create rule");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm("Are you sure you want to deactivate and remove this commission rule?")) {
      return;
    }
    try {
      await deleteRuleAction(id);
    } catch (err: unknown) {
      alert((err as Error).message || "Failed to delete rule");
    }
  };

  const handleRunSimulator = async () => {
    setSimLoading(true);
    try {
      const pricePaise = Math.round(parseFloat(simPriceRupees || "0") * 100);
      const res = await testCalculationAction({
        agentUserId: simAgentId || undefined,
        productId: simProductId || undefined,
        pricePaise,
      });
      if (res.result) {
        setSimResult(res.result);
      }
    } catch (err: unknown) {
      alert((err as Error).message || "Simulation failed");
    } finally {
      setSimLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Rules list header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-stone-900">Active Commission Rules ({rules.length})</h2>
          <p className="text-xs text-stone-500">
            Rules evaluate from most specific (Agent+Product) to least specific (Global Default).
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-800 text-white text-xs font-semibold hover:bg-amber-900 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Add Commission Rule
        </button>
      </div>

      {/* Rules Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-stone-600 text-xs">Scope</th>
                <th className="px-4 py-3 text-left font-semibold text-stone-600 text-xs">Target Entity</th>
                <th className="px-4 py-3 text-right font-semibold text-stone-600 text-xs">Rate (%)</th>
                <th className="px-4 py-3 text-left font-semibold text-stone-600 text-xs">Valid From</th>
                <th className="px-4 py-3 text-left font-semibold text-stone-600 text-xs">Notes</th>
                <th className="px-4 py-3 text-center font-semibold text-stone-600 text-xs">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-stone-600 text-xs">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs text-stone-400">
                    No custom rules configured yet. The system default rate applies to all products.
                  </td>
                </tr>
              ) : (
                rules.map((rule) => {
                  let targetLabel = "All Catalog Products (Global)";
                  if (rule.scope === IncentiveRuleScope.AGENT) {
                    targetLabel = `Agent: ${rule.agentUser?.name} (${rule.agentUser?.agentCode || "No code"})`;
                  } else if (rule.scope === IncentiveRuleScope.BRAND) {
                    targetLabel = `Brand: ${rule.company?.name || "Unknown"}${rule.agentUser ? ` (Agent: ${rule.agentUser.name})` : ""}`;
                  } else if (rule.scope === IncentiveRuleScope.CATEGORY) {
                    targetLabel = `Category: ${rule.category?.name || "Unknown"}${rule.agentUser ? ` (Agent: ${rule.agentUser.name})` : ""}`;
                  } else if (rule.scope === IncentiveRuleScope.PRODUCT) {
                    targetLabel = `Product: ${rule.product?.name || "Unknown"}${rule.agentUser ? ` (Agent: ${rule.agentUser.name})` : ""}`;
                  }

                  return (
                    <tr key={rule.id} className="hover:bg-stone-50/70">
                      <td className="px-4 py-3 text-xs font-semibold text-stone-800">
                        <span className="px-2 py-0.5 rounded bg-stone-100 border border-stone-200 font-mono text-[11px]">
                          {rule.scope}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-stone-900 text-xs">
                        {targetLabel}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-amber-900 text-sm">
                        {(rule.percentBp / 100).toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-xs text-stone-500">
                        {new Date(rule.validFrom).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-xs text-stone-500 max-w-xs truncate">
                        {rule.note || "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            rule.active
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-stone-100 text-stone-500"
                          }`}
                        >
                          {rule.active ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1.5 text-stone-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                          title="Delete rule"
                          aria-label="Delete rule"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Simulator Section */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-600" />
          <h3 className="text-base font-bold text-stone-900">Incentive Resolution Simulator</h3>
        </div>
        <p className="text-xs text-stone-500">
          Simulate how the precedence cascade resolves for any agent, item, and selling price.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="sim-agent-select" className="block text-xs font-semibold text-stone-700 mb-1">
              Select Agent
            </label>
            <select
              id="sim-agent-select"
              value={simAgentId}
              onChange={(e) => setSimAgentId(e.target.value)}
              className="w-full rounded-lg border border-stone-300 p-2 text-xs text-stone-800 bg-stone-50 focus:ring-1 focus:ring-amber-600"
            >
              <option value="">No Agent (Counter Cashier)</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.agentCode || "No Code"})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="sim-product-select" className="block text-xs font-semibold text-stone-700 mb-1">
              Select Product
            </label>
            <select
              id="sim-product-select"
              value={simProductId}
              onChange={(e) => {
                setSimProductId(e.target.value);
                const prod = products.find((p) => p.id === e.target.value);
                if (prod?.basePricePaise) {
                  setSimPriceRupees((prod.basePricePaise / 100).toFixed(2));
                }
              }}
              className="w-full rounded-lg border border-stone-300 p-2 text-xs text-stone-800 bg-stone-50 focus:ring-1 focus:ring-amber-600"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.shortCode || "Item"})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="sim-price-input" className="block text-xs font-semibold text-stone-700 mb-1">
              Sale Price (₹)
            </label>
            <input
              id="sim-price-input"
              type="number"
              step="0.01"
              value={simPriceRupees}
              onChange={(e) => setSimPriceRupees(e.target.value)}
              className="w-full rounded-lg border border-stone-300 p-2 text-xs text-stone-800 bg-stone-50 focus:ring-1 focus:ring-amber-600"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleRunSimulator}
              disabled={simLoading}
              className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition-colors shadow-sm disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5 fill-white" />
              {simLoading ? "Calculating..." : "Run Test"}
            </button>
          </div>
        </div>

        {/* Simulation Output Card */}
        {simResult && (
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-800 text-white text-[11px] font-bold">
                  {simResult.ruleScope}
                </span>
                <span className="text-xs font-semibold text-stone-700">
                  Rate Applied: {(simResult.percentBp / 100).toFixed(2)}%
                </span>
              </div>
              <p className="text-xs text-stone-600 mt-1 flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-stone-400" />
                {simResult.explanation}
              </p>
            </div>

            <div className="bg-white px-5 py-3 rounded-xl border border-amber-200 text-right">
              <span className="text-[10px] uppercase font-bold text-stone-500">
                Calculated Incentive
              </span>
              <div className="text-xl font-black text-amber-900">
                ₹{(simResult.amountPaise / 100).toFixed(2)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Rule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-900">Create Commission Rule</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleCreateRule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Rule Scope
                </label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as IncentiveRuleScope)}
                  className="w-full rounded-lg border border-stone-300 p-2 text-xs text-stone-800 focus:ring-1 focus:ring-amber-600"
                >
                  <option value={IncentiveRuleScope.GLOBAL}>GLOBAL (Entire Catalog Default)</option>
                  <option value={IncentiveRuleScope.AGENT}>AGENT (Default for Specific Staff)</option>
                  <option value={IncentiveRuleScope.BRAND}>BRAND (All Products of Brand / Company)</option>
                  <option value={IncentiveRuleScope.CATEGORY}>CATEGORY (All Products in Category)</option>
                  <option value={IncentiveRuleScope.PRODUCT}>PRODUCT (Specific Product Item)</option>
                </select>
              </div>

              {/* Dynamic Target Selectors */}
              {(scope === IncentiveRuleScope.AGENT ||
                scope === IncentiveRuleScope.BRAND ||
                scope === IncentiveRuleScope.CATEGORY ||
                scope === IncentiveRuleScope.PRODUCT) && (
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Agent (Optional override for specific staff)
                  </label>
                  <select
                    value={selectedAgentId}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 p-2 text-xs text-stone-800 focus:ring-1 focus:ring-amber-600"
                  >
                    <option value="">Apply to all staff</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.agentCode || "No Code"})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {scope === IncentiveRuleScope.BRAND && (
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Brand / Company
                  </label>
                  <select
                    required
                    value={selectedCompanyId}
                    onChange={(e) => setSelectedCompanyId(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 p-2 text-xs text-stone-800 focus:ring-1 focus:ring-amber-600"
                  >
                    <option value="">Select Brand</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {scope === IncentiveRuleScope.CATEGORY && (
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Category
                  </label>
                  <select
                    required
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 p-2 text-xs text-stone-800 focus:ring-1 focus:ring-amber-600"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {scope === IncentiveRuleScope.PRODUCT && (
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Product
                  </label>
                  <select
                    required
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 p-2 text-xs text-stone-800 focus:ring-1 focus:ring-amber-600"
                  >
                    <option value="">Select Product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.shortCode || "Item"})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Commission Percentage (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    value={percentString}
                    onChange={(e) => setPercentString(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 p-2 pr-8 text-xs text-stone-800 focus:ring-1 focus:ring-amber-600"
                    placeholder="e.g. 2.50"
                  />
                  <span className="absolute right-3 top-2 text-xs font-bold text-stone-400">
                    %
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Note / Explanation
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 p-2 text-xs text-stone-800 focus:ring-1 focus:ring-amber-600"
                  placeholder="e.g. High margin festival promotion"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-amber-800 text-white text-xs font-semibold hover:bg-amber-900 transition-colors shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
