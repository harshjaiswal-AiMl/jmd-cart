"use client";

import { useState } from "react";
import Link from "next/link";
import { StoreProductItem } from "@/modules/store/store.service";

export function ProductDetailClient({ product }: { product: StoreProductItem }) {
  const [selectedQty, setSelectedQty] = useState(1);

  const mrpRupees = (product.mrpPaise / 100).toFixed(2);

  // Find active winning slab for current selected quantity
  const activeSlab = [...product.slabs]
    .reverse()
    .find((s) => selectedQty >= s.minQty);

  const unitDiscountBp = activeSlab ? activeSlab.discountBp : 0;
  const unitRatePaise = Math.round((product.mrpPaise * (10000 - unitDiscountBp)) / 10000);
  const unitRateRupees = (unitRatePaise / 100).toFixed(2);
  const totalAmountRupees = ((unitRatePaise * selectedQty) / 100).toFixed(2);
  const totalSavingsRupees = (((product.mrpPaise - unitRatePaise) * selectedQty) / 100).toFixed(2);

  const currentTier = activeSlab ? activeSlab.tier : "CUSTOMER";

  // Carton calculations
  const cartons = Math.floor(selectedQty / product.packSize);
  const loose = selectedQty % product.packSize;

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/store" className="hover:text-blue-600 transition-colors">
          Store
        </Link>
        <span>/</span>
        {product.companyName && (
          <>
            <Link
              href={`/store?company=${product.companyId}`}
              className="hover:text-blue-600 transition-colors"
            >
              {product.companyName}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-slate-900 font-medium truncate">{product.name}</span>
      </nav>

      {/* Main Product Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left: Product Image / Visual */}
        <div className="bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center justify-center p-8 min-h-[320px] relative">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.name}
              className="max-h-72 max-w-full object-contain"
            />
          ) : (
            <div className="text-center text-slate-300">
              <span className="text-6xl block mb-2">🛍️</span>
              <span className="text-xs uppercase tracking-widest text-slate-400 font-mono font-bold">
                {product.shortCode}
              </span>
            </div>
          )}

          <div className="absolute top-4 left-4 flex gap-2">
            {product.companyName && (
              <span className="bg-slate-900 text-white text-xs font-semibold px-2.5 py-1 rounded shadow-sm">
                {product.companyName}
              </span>
            )}
            {product.categoryName && (
              <span className="bg-slate-100 text-slate-700 text-xs font-medium px-2.5 py-1 rounded border border-slate-200">
                {product.categoryName}
              </span>
            )}
          </div>

          <div className="absolute top-4 right-4">
            {product.isAvailable ? (
              <span className="bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full border border-emerald-200">
                In Stock ({product.totalAvailableQty} pcs)
              </span>
            ) : (
              <span className="bg-rose-50 text-rose-700 text-xs font-semibold px-3 py-1 rounded-full border border-rose-200">
                Out of Stock
              </span>
            )}
          </div>
        </div>

        {/* Right: Pricing, Dynamic Slabs & Quantity Stepper */}
        <div className="space-y-6 flex flex-col justify-between">
          <div className="space-y-3">
            <div>
              <div className="text-xs font-mono text-slate-400">HSN: {product.hsn} • GST: {(product.gstRateBp / 100).toFixed(0)}%</div>
              <h1 className="text-2xl font-bold text-slate-900 mt-1">{product.name}</h1>
              <div className="text-xs text-slate-500 mt-1">
                Pack specification: <strong className="text-slate-800">{product.packSize} pieces</strong> per {product.packLabel}
              </div>
            </div>

            {/* Price Preview Card */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-500">Retail MRP per Piece:</span>
                <span className="text-sm text-slate-500 line-through font-mono">₹{mrpRupees}</span>
              </div>

              <div className="flex items-baseline justify-between pt-1 border-t border-slate-200">
                <div>
                  <span className="text-xs font-bold text-slate-900">Your Slab Price:</span>
                  <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold">
                    {currentTier} TIER
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-extrabold text-blue-600 font-mono">₹{unitRateRupees}</span>
                  <span className="text-xs text-slate-500"> / pc</span>
                </div>
              </div>

              {unitDiscountBp > 0 && (
                <div className="text-xs text-emerald-700 font-semibold bg-emerald-50 p-2 rounded border border-emerald-100 flex justify-between items-center">
                  <span>{(unitDiscountBp / 100).toFixed(0)}% Wholesale Discount Applied!</span>
                  <span>Saving ₹{totalSavingsRupees} total</span>
                </div>
              )}
            </div>

            {/* Interactive Quantity Stepper */}
            <div className="space-y-2 pt-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Select Order Quantity (Pieces):
              </label>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedQty((prev) => Math.max(1, prev - 1))}
                  className="w-10 h-10 rounded-lg border border-slate-300 hover:bg-slate-100 text-lg font-bold flex items-center justify-center transition-colors"
                >
                  -
                </button>

                <input
                  type="number"
                  min="1"
                  value={selectedQty}
                  onChange={(e) => setSelectedQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 text-center font-bold text-lg font-mono border border-slate-300 rounded-lg py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />

                <button
                  type="button"
                  onClick={() => setSelectedQty((prev) => prev + 1)}
                  className="w-10 h-10 rounded-lg border border-slate-300 hover:bg-slate-100 text-lg font-bold flex items-center justify-center transition-colors"
                >
                  +
                </button>

                {/* Carton shortcuts */}
                <div className="flex gap-1.5 ml-2">
                  <button
                    type="button"
                    onClick={() => setSelectedQty(product.packSize)}
                    className="px-2.5 py-1.5 border border-slate-200 hover:border-blue-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    1 {product.packLabel} ({product.packSize})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedQty(product.packSize * 5)}
                    className="px-2.5 py-1.5 border border-slate-200 hover:border-blue-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    5 {product.packLabel}s ({product.packSize * 5})
                  </button>
                </div>
              </div>

              {/* Carton breakdown readout */}
              <div className="text-xs text-slate-500">
                Equivalent to: <strong className="text-slate-800">{cartons} {product.packLabel}{cartons !== 1 ? "s" : ""}</strong>
                {loose > 0 && <span> + <strong className="text-slate-800">{loose} loose pcs</strong></span>}
              </div>
            </div>
          </div>

          {/* Dynamic Price Slabs Table */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Quantity Price Slabs
            </h3>

            <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Order Min Qty</th>
                    <th className="py-2 px-3">Discount</th>
                    <th className="py-2 px-3">Unit Rate</th>
                    <th className="py-2 px-3">Buyer Tier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className={selectedQty < (product.slabs[0]?.minQty ?? Infinity) ? "bg-blue-50 font-semibold" : ""}>
                    <td className="py-2 px-3">1 - {(product.slabs[0]?.minQty ?? 2) - 1} pcs</td>
                    <td className="py-2 px-3">0%</td>
                    <td className="py-2 px-3 font-mono">₹{mrpRupees}</td>
                    <td className="py-2 px-3">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px]">
                        CUSTOMER
                      </span>
                    </td>
                  </tr>

                  {product.slabs.map((slab) => {
                    const isWinning = activeSlab?.minQty === slab.minQty;
                    return (
                      <tr
                        key={slab.minQty}
                        className={`transition-colors ${
                          isWinning ? "bg-blue-50 font-semibold text-blue-900" : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="py-2 px-3 font-mono">{slab.minQty}+ pcs</td>
                        <td className="py-2 px-3 text-emerald-600 font-bold">
                          {(slab.discountBp / 100).toFixed(0)}% OFF
                        </td>
                        <td className="py-2 px-3 font-mono">
                          ₹{(slab.unitPricePaise / 100).toFixed(2)}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            slab.tier === "WHOLESALER"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-blue-100 text-blue-800"
                          }`}>
                            {slab.tier}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add to Cart / Order Action */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs text-slate-500">Total Estimated Amount:</div>
              <div className="text-2xl font-black text-slate-900 font-mono">₹{totalAmountRupees}</div>
            </div>

            <Link
              href="/store"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-sm transition-colors flex items-center gap-2"
            >
              <span>Back to Store Catalogue</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
