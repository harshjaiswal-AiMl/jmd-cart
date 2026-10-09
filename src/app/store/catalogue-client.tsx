"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { StoreProductItem } from "@/modules/store/store.service";

interface CatalogueClientProps {
  initialProducts: StoreProductItem[];
  companies: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  currentSearch?: string;
  currentCompanyId?: string;
  currentCategoryId?: string;
  currentInStockOnly?: boolean;
}

export function CatalogueClient({
  initialProducts,
  companies,
  categories,
  currentSearch = "",
  currentCompanyId = "",
  currentCategoryId = "",
  currentInStockOnly = false,
}: CatalogueClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(currentSearch);
  const [selectedCompany, setSelectedCompany] = useState(currentCompanyId);
  const [selectedCategory, setSelectedCategory] = useState(currentCategoryId);
  const [inStockOnly, setInStockOnly] = useState(currentInStockOnly);

  const applyFilters = (
    newSearch: string,
    newCompany: string,
    newCategory: string,
    newInStock: boolean
  ) => {
    const params = new URLSearchParams();
    if (newSearch.trim()) params.set("q", newSearch.trim());
    if (newCompany) params.set("company", newCompany);
    if (newCategory) params.set("category", newCategory);
    if (newInStock) params.set("inStock", "true");

    startTransition(() => {
      router.push(`/store?${params.toString()}`);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters(search, selectedCompany, selectedCategory, inStockOnly);
  };

  const handleCompanyChange = (companyId: string) => {
    const updated = selectedCompany === companyId ? "" : companyId;
    setSelectedCompany(updated);
    applyFilters(search, updated, selectedCategory, inStockOnly);
  };

  const handleCategoryChange = (categoryId: string) => {
    const updated = selectedCategory === categoryId ? "" : categoryId;
    setSelectedCategory(updated);
    applyFilters(search, selectedCompany, updated, inStockOnly);
  };

  const handleInStockToggle = () => {
    const updated = !inStockOnly;
    setInStockOnly(updated);
    applyFilters(search, selectedCompany, selectedCategory, updated);
  };

  return (
    <div className="space-y-6">
      {/* Search & Quick Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              🔍
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search FMCG products by name, brand, or code (e.g. Parle, Tea, Atta)..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            Search
          </button>
        </form>

        {/* Brand / Company Chips */}
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">
            Popular Brands
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => handleCompanyChange("")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                !selectedCompany
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              All Brands
            </button>
            {companies.map((c) => (
              <button
                key={c.id}
                onClick={() => handleCompanyChange(c.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedCompany === c.id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Category & In-Stock Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 mr-1">Categories:</span>
            <button
              onClick={() => handleCategoryChange("")}
              className={`px-2.5 py-0.5 rounded text-xs transition-colors ${
                !selectedCategory
                  ? "bg-slate-800 text-white font-medium"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                className={`px-2.5 py-0.5 rounded text-xs transition-colors ${
                  selectedCategory === cat.id
                    ? "bg-slate-800 text-white font-medium"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={handleInStockToggle}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
            />
            <span>In Stock Only</span>
          </label>
        </div>
      </div>

      {/* Product Grid */}
      {initialProducts.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
          <span className="text-4xl">📦</span>
          <h3 className="text-lg font-semibold text-slate-800">No products found</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            We couldn&apos;t find any items matching your current filters. Try searching with a different term or clearing filters.
          </p>
          <button
            onClick={() => {
              setSearch("");
              setSelectedCompany("");
              setSelectedCategory("");
              setInStockOnly(false);
              applyFilters("", "", "", false);
            }}
            className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700 underline"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {initialProducts.map((product) => {
            const mrpRupees = (product.mrpPaise / 100).toFixed(2);
            // Highest discount slab for card preview
            const bestSlab = product.slabs[product.slabs.length - 1];
            const bestRateRupees = bestSlab
              ? (bestSlab.unitPricePaise / 100).toFixed(2)
              : mrpRupees;

            return (
              <div
                key={product.id}
                className="bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all flex flex-col overflow-hidden group"
              >
                {/* Image Placeholder */}
                <div className="h-40 bg-slate-50 border-b border-slate-100 flex items-center justify-center relative p-4">
                  {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <div className="text-center text-slate-300 group-hover:scale-105 transition-transform">
                      <span className="text-4xl block">🛍️</span>
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">
                        {product.shortCode}
                      </span>
                    </div>
                  )}

                  {/* Stock Badge */}
                  <div className="absolute top-2.5 right-2.5">
                    {product.isAvailable ? (
                      <span className="bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                        In Stock ({product.totalAvailableQty})
                      </span>
                    ) : (
                      <span className="bg-rose-50 text-rose-700 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-rose-200">
                        Out of Stock
                      </span>
                    )}
                  </div>

                  {/* Brand Tag */}
                  {product.companyName && (
                    <div className="absolute bottom-2 left-2.5">
                      <span className="bg-slate-800 text-white text-[10px] font-semibold px-2 py-0.5 rounded shadow-sm">
                        {product.companyName}
                      </span>
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="text-xs text-slate-400 font-mono">
                      {product.categoryName || "General FMCG"} • {product.shortCode}
                    </div>
                    <Link
                      href={`/store/products/${product.id}`}
                      className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-sm line-clamp-2 mt-0.5"
                    >
                      {product.name}
                    </Link>
                    <div className="text-xs text-slate-500 mt-1">
                      Pack: {product.packSize} pcs per {product.packLabel}
                    </div>
                  </div>

                  {/* Pricing Matrix Preview */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-500">Retail MRP:</span>
                      <span className="text-xs text-slate-500 line-through font-mono">
                        ₹{mrpRupees}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between mt-0.5">
                      <span className="text-xs font-semibold text-blue-700">Wholesale / Slabs:</span>
                      <span className="text-sm font-bold text-slate-900 font-mono">
                        As low as ₹{bestRateRupees}
                      </span>
                    </div>

                    {bestSlab && (
                      <div className="mt-1 text-[11px] bg-blue-50 text-blue-700 p-1.5 rounded border border-blue-100 text-center font-medium">
                        Save {(bestSlab.discountBp / 100).toFixed(0)}% on orders of {bestSlab.minQty}+ pcs
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-2">
                    <Link
                      href={`/store/products/${product.id}`}
                      className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-semibold transition-colors"
                    >
                      View Price Slabs & Details →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
