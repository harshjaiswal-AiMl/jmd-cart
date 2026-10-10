"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StoreProductItem } from "@/modules/store/store.service";
import { addToCartAction, updateCartQtyAction, removeFromCartAction } from "@/app/store/cart/actions";

interface CatalogueClientProps {
  initialProducts: StoreProductItem[];
  companies: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  currentSearch?: string;
  currentCompanyId?: string;
  currentCategoryId?: string;
  currentInStockOnly?: boolean;
  initialCartQuantities?: Record<string, number>;
  isLoggedIn?: boolean;
  cartSummary?: {
    totalPieces: number;
    itemsCount: number;
    totalPaise: number;
    savingsPaise: number;
  };
}

export function CatalogueClient({
  initialProducts,
  companies,
  categories,
  currentSearch = "",
  currentCompanyId = "",
  currentCategoryId = "",
  currentInStockOnly = false,
  initialCartQuantities = {},
  isLoggedIn = false,
  cartSummary,
}: CatalogueClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(currentSearch);
  const [selectedCompany, setSelectedCompany] = useState(currentCompanyId);
  const [selectedCategory, setSelectedCategory] = useState(currentCategoryId);
  const [inStockOnly, setInStockOnly] = useState(currentInStockOnly);

  // In-place cart quantities state per product ID
  const [cartQuantities, setCartQuantities] = useState<Record<string, number>>(initialCartQuantities);
  // Unit mode toggle per product: 'pcs' | 'carton'
  const [unitModes, setUnitModes] = useState<Record<string, "pcs" | "carton">>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Live computed cart totals
  const totalCartPieces = Object.values(cartQuantities).reduce((a, b) => a + b, 0);
  const totalCartLines = Object.values(cartQuantities).filter((q) => q > 0).length;

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

  // In-place 1-Tap Add / Stepper Handlers
  const handleAddFirstTap = async (product: StoreProductItem) => {
    if (!isLoggedIn) {
      router.push(`/login?callbackUrl=/store`);
      return;
    }

    const currentQty = cartQuantities[product.id] || 0;
    const mode = unitModes[product.id] || "pcs";
    const delta = mode === "carton" ? product.packSize : 1;
    const nextQty = currentQty + delta;

    setCartQuantities((prev) => ({ ...prev, [product.id]: nextQty }));
    setUpdatingId(product.id);

    try {
      await addToCartAction(product.id, delta);
    } catch {
      // Rollback on error
      setCartQuantities((prev) => ({ ...prev, [product.id]: currentQty }));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStepperChange = async (product: StoreProductItem, delta: number) => {
    if (!isLoggedIn) {
      router.push(`/login?callbackUrl=/store`);
      return;
    }

    const currentQty = cartQuantities[product.id] || 0;
    const nextQty = Math.max(0, currentQty + delta);

    setCartQuantities((prev) => {
      const copy = { ...prev };
      if (nextQty === 0) {
        delete copy[product.id];
      } else {
        copy[product.id] = nextQty;
      }
      return copy;
    });

    setUpdatingId(product.id);

    try {
      if (nextQty === 0) {
        await removeFromCartAction(product.id);
      } else {
        await updateCartQtyAction(product.id, nextQty);
      }
    } catch {
      // Rollback on error
      setCartQuantities((prev) => ({ ...prev, [product.id]: currentQty }));
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleUnitMode = (productId: string, current: "pcs" | "carton") => {
    const next = current === "pcs" ? "carton" : "pcs";
    setUnitModes((prev) => ({ ...prev, [productId]: next }));
  };

  return (
    <div className="space-y-6">
      {/* Search & Quick Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              🔍
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search FMCG products by name, company, or short code (e.g. Parle, Bikaji, Tea)..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1B998B] focus:border-[#1B998B]"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  applyFilters("", selectedCompany, selectedCategory, inStockOnly);
                }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-[#1B998B] hover:bg-teal-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm cursor-pointer"
          >
            Search
          </button>
        </form>

        {/* Popular Brand Strip */}
        <div>
          <div className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider flex items-center justify-between">
            <span>Popular FMCG Brands</span>
            {selectedCompany && (
              <button
                onClick={() => handleCompanyChange("")}
                className="text-[11px] text-[#1B998B] hover:underline cursor-pointer"
              >
                Clear Brand Filter
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => handleCompanyChange("")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                !selectedCompany
                  ? "bg-[#12355B] text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              All Brands
            </button>
            {companies.map((c) => (
              <button
                key={c.id}
                onClick={() => handleCompanyChange(c.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  selectedCompany === c.id
                    ? "bg-[#12355B] text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Category & Availability Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 mr-1">Categories:</span>
            <button
              onClick={() => handleCategoryChange("")}
              className={`px-2.5 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                !selectedCategory
                  ? "bg-[#1B998B] text-white font-medium"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                className={`px-2.5 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                  selectedCategory === cat.id
                    ? "bg-[#1B998B] text-white font-medium"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 select-none">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={() => {
                const next = !inStockOnly;
                setInStockOnly(next);
                applyFilters(search, selectedCompany, selectedCategory, next);
              }}
              className="rounded border-slate-300 text-[#1B998B] focus:ring-[#1B998B] h-3.5 w-3.5 cursor-pointer"
            />
            <span>In Stock Only</span>
          </label>
        </div>
      </div>

      {/* Product Grid */}
      {initialProducts.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
          <span className="text-4xl block">📦</span>
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
            className="mt-2 text-xs font-semibold text-[#1B998B] hover:underline cursor-pointer"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {initialProducts.map((product) => {
            const mrpRupees = (product.mrpPaise / 100).toFixed(2);
            // Highest discount slab for card preview
            const bestSlab = product.slabs[product.slabs.length - 1];
            const bestRateRupees = bestSlab
              ? (bestSlab.unitPricePaise / 100).toFixed(2)
              : mrpRupees;

            // In-place cart quantity for this product
            const qty = cartQuantities[product.id] || 0;
            const mode = unitModes[product.id] || "pcs";
            const isUpdating = updatingId === product.id;

            // Stock Display Policy (Section 4): Never show large exact numbers to buyers!
            let stockBadgeText = "In Stock";
            let stockBadgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";

            if (!product.isAvailable || product.totalAvailableQty === 0) {
              stockBadgeText = "Out of Stock";
              stockBadgeClass = "bg-rose-50 text-rose-700 border-rose-200";
            } else if (product.totalAvailableQty <= 10) {
              stockBadgeText = `Only ${product.totalAvailableQty} left`;
              stockBadgeClass = "bg-amber-50 text-amber-700 border-amber-200";
            }

            return (
              <div
                key={product.id}
                className="bg-white rounded-xl border border-slate-200 hover:border-teal-300 hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                {/* Image & Badges */}
                <div className="h-40 bg-slate-50 border-b border-slate-100 flex items-center justify-center relative p-3">
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

                  {/* Stock Chip (Section 4 Policy) */}
                  <div className="absolute top-2.5 right-2.5">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${stockBadgeClass}`}>
                      {stockBadgeText}
                    </span>
                  </div>

                  {/* Brand Badge */}
                  {product.companyName && (
                    <div className="absolute bottom-2 left-2.5">
                      <span className="bg-[#12355B] text-white text-[10px] font-semibold px-2 py-0.5 rounded shadow-sm">
                        {product.companyName}
                      </span>
                    </div>
                  )}
                </div>

                {/* Details & Live Pricing */}
                <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {product.categoryName || "FMCG"} • {product.shortCode}
                    </div>

                    <Link
                      href={`/store/products/${product.id}`}
                      className="font-bold text-[#12355B] hover:text-[#1B998B] transition-colors text-sm line-clamp-2 mt-0.5"
                    >
                      {product.name}
                    </Link>

                    <div className="text-xs text-slate-500 mt-0.5">
                      1 {product.packLabel} = <span className="font-semibold text-slate-700">{product.packSize} pcs</span>
                    </div>
                  </div>

                  {/* Pricing Matrix Preview */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-400">Retail MRP:</span>
                      <span className="text-xs text-slate-400 line-through font-mono">
                        ₹{mrpRupees}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between mt-0.5">
                      <span className="text-xs font-semibold text-[#1B998B]">Wholesale Rate:</span>
                      <span className="text-sm font-bold text-slate-900 font-mono">
                        ₹{bestRateRupees}
                        <span className="text-[10px] text-slate-500 font-normal"> /pc</span>
                      </span>
                    </div>

                    {bestSlab && (
                      <div className="mt-1 text-[11px] bg-amber-50 text-amber-800 p-1 rounded border border-amber-200 text-center font-medium">
                        Buy {bestSlab.minQty}+ pcs & save {(bestSlab.discountBp / 100).toFixed(0)}%!
                      </div>
                    )}
                  </div>

                  {/* One-Tap Blinkit/Zepto In-Place Add / Stepper */}
                  <div className="pt-1">
                    {!product.isAvailable ? (
                      <button
                        disabled
                        className="w-full py-2 bg-slate-100 text-slate-400 text-xs font-bold rounded-lg cursor-not-allowed border border-slate-200"
                      >
                        Out of Stock
                      </button>
                    ) : qty === 0 ? (
                      <div className="flex gap-1.5 items-center">
                        <button
                          onClick={() => handleAddFirstTap(product)}
                          disabled={isUpdating}
                          className="flex-1 py-2 px-3 bg-[#1B998B] hover:bg-teal-700 text-white text-xs font-black rounded-lg shadow-sm transition-transform active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <span>+ ADD</span>
                        </button>

                        {/* Unit Switch: Pieces vs Carton */}
                        <button
                          type="button"
                          onClick={() => toggleUnitMode(product.id, mode)}
                          className="px-2 py-1.5 border border-slate-300 hover:border-slate-400 text-[11px] font-bold rounded-lg text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Switch unit between loose Pieces and full Cartons"
                        >
                          {mode === "pcs" ? "Pcs" : "Ctn"}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 bg-teal-50 border border-[#1B998B] rounded-lg p-0.5 shadow-sm">
                        <button
                          onClick={() => {
                            const step = mode === "carton" ? product.packSize : 1;
                            handleStepperChange(product, -step);
                          }}
                          disabled={isUpdating}
                          className="w-8 h-7 bg-white text-[#1B998B] font-black text-sm rounded flex items-center justify-center hover:bg-teal-100 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          -
                        </button>

                        <div className="flex-1 text-center font-bold text-xs text-[#12355B]">
                          {qty} <span className="text-[10px] text-slate-500 font-normal">pcs</span>
                        </div>

                        <button
                          onClick={() => {
                            const step = mode === "carton" ? product.packSize : 1;
                            handleStepperChange(product, step);
                          }}
                          disabled={isUpdating}
                          className="w-8 h-7 bg-[#1B998B] text-white font-black text-sm rounded flex items-center justify-center hover:bg-teal-700 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          +
                        </button>

                        {/* Unit Mode Indicator */}
                        <button
                          type="button"
                          onClick={() => toggleUnitMode(product.id, mode)}
                          className="px-1.5 py-1 text-[10px] font-bold text-teal-800 bg-teal-100/60 rounded cursor-pointer hover:bg-teal-200"
                        >
                          {mode === "pcs" ? "pcs" : "ctn"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky Bottom Cart Bar (Blinkit/Zepto Pattern) */}
      {totalCartPieces > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-[#12355B] text-white py-3 px-4 shadow-2xl z-50 border-t border-teal-500/30 backdrop-blur-md">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🛒</span>
              <div>
                <div className="text-sm font-bold flex items-center gap-2">
                  <span>{totalCartLines} items ({totalCartPieces} pcs)</span>
                  <span className="text-[11px] bg-[#1B998B] text-white font-semibold px-2 py-0.5 rounded-full">
                    Wholesale Applied
                  </span>
                </div>
                <div className="text-xs text-teal-200">
                  ⚡ Free delivery on orders above ₹2,000 in Saharsa
                </div>
              </div>
            </div>

            <Link
              href="/store/cart"
              className="py-2.5 px-6 bg-[#1B998B] hover:bg-teal-600 text-white font-black text-sm rounded-xl shadow-lg transition-transform active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <span>View Cart & Checkout</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      )}

      {/* Floating In-App WhatsApp Support Button */}
      <a
        href="https://wa.me/919876543210?text=Hello%20JMD%20Cart%2C%20I%20have%20an%20inquiry%20regarding%20wholesale%20distribution%20in%20Saharsa"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-20 right-4 z-40 bg-[#25D366] hover:bg-emerald-600 text-white p-3 rounded-full shadow-lg flex items-center gap-2 text-xs font-bold transition-transform hover:scale-105"
        title="WhatsApp Order Support"
      >
        <span className="text-lg">💬</span>
        <span className="hidden sm:inline">WhatsApp Help</span>
      </a>
    </div>
  );
}
