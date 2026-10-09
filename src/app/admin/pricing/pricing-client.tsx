"use client";

import { useState, useTransition } from "react";
import {
  PriceSlabRule,
  SlabScope,
  BuyerTier,
} from "@/modules/pricing/pricing.types";
import { createPricingSlabAction, deletePricingSlabAction } from "./actions";

interface OptionItem {
  id: string;
  name: string;
}

interface PricingClientProps {
  initialSlabs: PriceSlabRule[];
  companies: OptionItem[];
  categories: OptionItem[];
  products: OptionItem[];
}

export function PricingClient({
  initialSlabs,
  companies,
  categories,
  products,
}: PricingClientProps) {
  const [slabs, setSlabs] = useState<PriceSlabRule[]>(initialSlabs);
  const [scope, setScope] = useState<SlabScope>(SlabScope.GLOBAL);
  const [targetId, setTargetId] = useState<string>("");
  const [minQty, setMinQty] = useState<string>("10");
  const [discountPercent, setDiscountPercent] = useState<string>("8");
  const [tier, setTier] = useState<BuyerTier>(BuyerTier.RETAILER);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCreateSlab = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const minQtyNum = parseInt(minQty, 10);
    const discountPercentNum = parseFloat(discountPercent);

    if (isNaN(minQtyNum) || minQtyNum < 1) {
      setError("Minimum quantity must be at least 1 piece.");
      return;
    }

    if (isNaN(discountPercentNum) || discountPercentNum < 0 || discountPercentNum > 100) {
      setError("Discount percentage must be between 0% and 100%.");
      return;
    }

    const discountBp = Math.round(discountPercentNum * 100);

    let targetName: string | null = null;
    if (scope === SlabScope.PRODUCT) {
      targetName = products.find((p) => p.id === targetId)?.name ?? null;
    } else if (scope === SlabScope.CATEGORY) {
      targetName = categories.find((c) => c.id === targetId)?.name ?? null;
    } else if (scope === SlabScope.COMPANY) {
      targetName = companies.find((c) => c.id === targetId)?.name ?? null;
    } else {
      targetName = "All Products (Global)";
    }

    startTransition(async () => {
      try {
        const created = await createPricingSlabAction({
          scope,
          targetId: scope === SlabScope.GLOBAL ? null : targetId || null,
          targetName,
          minQty: minQtyNum,
          discountBp,
          tier,
        });

        setSlabs((prev) => [...prev, created]);
        setSuccess(`Price slab for ${created.tier} created successfully!`);
        setMinQty("10");
        setDiscountPercent("8");
        setTargetId("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create price slab");
      }
    });
  };

  const handleDeleteSlab = (id: string) => {
    if (!confirm("Are you sure you want to delete this price slab?")) return;
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        await deletePricingSlabAction(id);
        setSlabs((prev) => prev.filter((s) => s.id !== id));
        setSuccess("Price slab deleted successfully.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete price slab");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Alert notifications */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg">
          {success}
        </div>
      )}

      {/* Add New Slab Form Card */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Add Price Slab Rule</h2>
        <p className="text-xs text-gray-500 mb-4">
          Configure quantity-based percentage discounts off MRP and automatic buyer tagging (Retailer / Wholesaler).
          Resolution order: Product &gt; Category &gt; Company &gt; Global.
        </p>

        <form onSubmit={handleCreateSlab} className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {/* Scope */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Scope</label>
            <select
              value={scope}
              onChange={(e) => {
                setScope(e.target.value as SlabScope);
                setTargetId("");
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value={SlabScope.GLOBAL}>Global (All)</option>
              <option value={SlabScope.COMPANY}>Company (Brand)</option>
              <option value={SlabScope.CATEGORY}>Category</option>
              <option value={SlabScope.PRODUCT}>Specific Product</option>
            </select>
          </div>

          {/* Target */}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Target Entity</label>
            {scope === SlabScope.GLOBAL ? (
              <input
                type="text"
                disabled
                value="Global (Applies to all products)"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
              />
            ) : scope === SlabScope.COMPANY ? (
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Select Company...</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : scope === SlabScope.CATEGORY ? (
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Select Category...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Select Product...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Min Qty */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Min Qty (Pcs)</label>
            <input
              type="number"
              min="1"
              value={minQty}
              onChange={(e) => setMinQty(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Discount % */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Discount %</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Buyer Tier Tag */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Auto Buyer Tier</label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as BuyerTier)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value={BuyerTier.CUSTOMER}>Customer (Walk-in)</option>
              <option value={BuyerTier.RETAILER}>Retailer</option>
              <option value={BuyerTier.WHOLESALER}>Wholesaler</option>
            </select>
          </div>

          {/* Submit */}
          <div className="md:col-span-6 flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {isPending ? "Adding Slab..." : "+ Add Slab Rule"}
            </button>
          </div>
        </form>
      </div>

      {/* Slabs List Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">Active Price Slabs</span>
          <span className="text-xs text-gray-500">{slabs.length} configured rules</span>
        </div>

        {slabs.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">
            No price slabs configured.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3">Priority / Scope</th>
                  <th className="px-4 py-3">Target Entity</th>
                  <th className="px-4 py-3">Min Qty</th>
                  <th className="px-4 py-3">Discount Off MRP</th>
                  <th className="px-4 py-3">Auto Buyer Tag</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {slabs.map((slab) => {
                  const scopeBadgeColor =
                    slab.scope === SlabScope.PRODUCT
                      ? "bg-purple-100 text-purple-800 border-purple-200"
                      : slab.scope === SlabScope.CATEGORY
                      ? "bg-blue-100 text-blue-800 border-blue-200"
                      : slab.scope === SlabScope.COMPANY
                      ? "bg-amber-100 text-amber-800 border-amber-200"
                      : "bg-gray-100 text-gray-800 border-gray-200";

                  const tierBadgeColor =
                    slab.tier === BuyerTier.WHOLESALER
                      ? "bg-emerald-100 text-emerald-800"
                      : slab.tier === BuyerTier.RETAILER
                      ? "bg-blue-100 text-blue-800"
                      : "bg-gray-100 text-gray-700";

                  return (
                    <tr key={slab.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${scopeBadgeColor}`}
                        >
                          {slab.scope}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 font-medium text-gray-900">
                        {slab.targetName || "All Products (Global)"}
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="font-bold text-gray-900">{slab.minQty}</span>{" "}
                        <span className="text-xs text-gray-500">pcs or more</span>
                      </td>

                      <td className="px-4 py-3.5 font-semibold text-emerald-600">
                        {(slab.discountBp / 100).toFixed(2)}%{" "}
                        <span className="text-xs text-gray-400 font-mono">
                          ({slab.discountBp} bp)
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${tierBadgeColor}`}
                        >
                          {slab.tier}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteSlab(slab.id)}
                          disabled={isPending}
                          className="text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                        >
                          Delete
                        </button>
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
  );
}
