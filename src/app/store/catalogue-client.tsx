"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StoreProductItem } from "@/modules/store/store.service";
import { addToCartAction, updateCartQtyAction, removeFromCartAction } from "@/app/store/cart/actions";
import { StoreHeader } from "@/components/store/StoreHeader";
import { StoreFooter } from "@/components/store/StoreFooter";
import { TrustRegionalStrip } from "@/components/store/TrustRegionalStrip";
import { FloatingCartBar } from "@/components/store/FloatingCartBar";

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
  userName?: string;
  userRole?: string;
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
  userName = "",
  cartSummary = { totalPieces: 0, itemsCount: 0, totalPaise: 0, savingsPaise: 0 },
}: CatalogueClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Filter States
  const [selectedCompany, setSelectedCompany] = useState(currentCompanyId);
  const [selectedCategory, setSelectedCategory] = useState(currentCategoryId);
  const [inStockOnly, setInStockOnly] = useState(currentInStockOnly);
  const [sortBy, setSortBy] = useState<"name" | "price-asc" | "price-desc">("name");

  // Cart Optimistic State
  const [cartQuantities, setCartQuantities] = useState<Record<string, number>>(initialCartQuantities);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Apply filters via URL
  const applyFilters = (companyId: string, categoryId: string, inStock: boolean) => {
    const params = new URLSearchParams();
    if (currentSearch) params.set("q", currentSearch);
    if (companyId) params.set("companyId", companyId);
    if (categoryId) params.set("categoryId", categoryId);
    if (inStock) params.set("inStockOnly", "true");

    startTransition(() => {
      router.push(`/store?${params.toString()}`);
    });
  };

  const handleCompanyChange = (companyId: string) => {
    setSelectedCompany(companyId);
    applyFilters(companyId, selectedCategory, inStockOnly);
  };

  const handleCategorySelect = (categoryId: string) => {
    const nextCat = selectedCategory === categoryId ? "" : categoryId;
    setSelectedCategory(nextCat);
    applyFilters(selectedCompany, nextCat, inStockOnly);
  };

  const handleInStockToggle = (checked: boolean) => {
    setInStockOnly(checked);
    applyFilters(selectedCompany, selectedCategory, checked);
  };

  // Cart Handlers
  const handleAddToCart = async (product: StoreProductItem) => {
    setUpdatingId(product.id);
    const newQty = (cartQuantities[product.id] || 0) + 1;
    setCartQuantities((prev) => ({ ...prev, [product.id]: newQty }));

    try {
      const res = await addToCartAction(product.id, 1);
      if (!res.success) {
        setCartQuantities((prev) => ({ ...prev, [product.id]: prev[product.id] - 1 }));
      }
    } catch {
      setCartQuantities((prev) => ({ ...prev, [product.id]: (prev[product.id] || 1) - 1 }));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUpdateQty = async (productId: string, delta: number) => {
    const currentQty = cartQuantities[productId] || 0;
    const nextQty = Math.max(0, currentQty + delta);

    setUpdatingId(productId);
    setCartQuantities((prev) => {
      const copy = { ...prev };
      if (nextQty === 0) delete copy[productId];
      else copy[productId] = nextQty;
      return copy;
    });

    try {
      if (nextQty === 0) {
        await removeFromCartAction(productId);
      } else {
        await updateCartQtyAction(productId, nextQty);
      }
    } catch {
      setCartQuantities((prev) => ({ ...prev, [productId]: currentQty }));
    } finally {
      setUpdatingId(null);
    }
  };

  // Calculate dynamic cart totals
  const totalCartCount = Object.values(cartQuantities).reduce((a, b) => a + b, 0);
  const totalCartRupees = Math.round(cartSummary.totalPaise / 100);
  const totalSavingsRupees = Math.round(cartSummary.savingsPaise / 100);

  // Sorting products
  const sortedProducts = [...initialProducts].sort((a, b) => {
    if (sortBy === "price-asc") {
      const priceA = a.slabs[0]?.unitPricePaise || a.mrpPaise;
      const priceB = b.slabs[0]?.unitPricePaise || b.mrpPaise;
      return priceA - priceB;
    }
    if (sortBy === "price-desc") {
      const priceA = a.slabs[0]?.unitPricePaise || a.mrpPaise;
      const priceB = b.slabs[0]?.unitPricePaise || b.mrpPaise;
      return priceB - priceA;
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between">
      {/* 1. Master Header with Theme */}
      <StoreHeader
        cartCount={totalCartCount}
        cartTotalRupees={totalCartRupees}
        currentSearch={currentSearch}
        activeCategory={selectedCategory}
        categories={categories}
        userName={userName}
        isLoggedIn={isLoggedIn}
      />

      <main className="w-full pt-36 bg-surface flex-1">
        {/* 2. Regional Guarantee Strip */}
        <TrustRegionalStrip />

        {/* 3. Hero Section with Commercial Split Bento (when not searching) */}
        {!currentSearch && !selectedCategory && !selectedCompany && (
          <section className="max-w-[1280px] mx-auto w-full px-4 lg:px-8 pt-6 pb-2">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              {/* Main Commercial Billboard */}
              <div className="lg:col-span-8 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 p-6 lg:p-10 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute -right-12 -top-12 w-64 h-64 bg-primary-container/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="relative z-10 max-w-xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary-fixed text-on-primary-fixed rounded-full text-xs font-bold uppercase tracking-wider mb-4 shadow-2xs">
                    <span className="material-symbols-outlined text-[15px]">storefront</span>
                    B2B Wholesale & Retail Portal • Saharsa Hub
                  </div>
                  <h1 className="font-headline text-3xl sm:text-4xl text-primary font-bold tracking-tight mb-3 leading-tight">
                    Stock Up for Your Shop & Kitchen
                  </h1>
                  <p className="text-sm sm:text-base text-on-surface-variant mb-6 leading-relaxed">
                    Direct distributor prices on daily essentials, verified regional pulses, mustard oils, and commercial master cartons. Rapid delivery across Saharsa town.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href="#products-grid"
                      className="bg-primary hover:bg-primary-container text-on-primary font-bold text-xs sm:text-sm px-6 py-3 rounded-xl shadow-sm transition-all flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[18px]">shopping_cart</span>
                      Shop Groceries
                    </a>
                    <Link
                      href="/store/wholesale"
                      className="bg-surface-container-low hover:bg-secondary-fixed text-secondary font-bold text-xs sm:text-sm px-6 py-3 rounded-xl shadow-2xs transition-all flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[18px]">warehouse</span>
                      Explore Wholesale Slabs
                    </Link>
                  </div>
                </div>

                {/* Metric highlights */}
                <div className="relative z-10 pt-8 mt-6 grid grid-cols-3 gap-3 border-t border-surface-container-high/60">
                  <div className="bg-surface-container-low/70 p-3 rounded-xl">
                    <span className="font-headline text-lg sm:text-xl text-primary font-bold block">930+</span>
                    <span className="text-[11px] text-on-surface-variant font-medium">Active SKUs in Godown</span>
                  </div>
                  <div className="bg-surface-container-low/70 p-3 rounded-xl">
                    <span className="font-headline text-lg sm:text-xl text-secondary font-bold block">₹38/pack</span>
                    <span className="text-[11px] text-on-surface-variant font-medium">Mustard Oil Starting</span>
                  </div>
                  <div className="bg-surface-container-low/70 p-3 rounded-xl">
                    <span className="font-headline text-lg sm:text-xl text-tertiary font-bold block">30 Mins</span>
                    <span className="text-[11px] text-on-surface-variant font-medium">Ward 1 to 20 Express</span>
                  </div>
                </div>
              </div>

              {/* Secondary Promo Bento Cards */}
              <div className="lg:col-span-4 flex flex-col gap-4">
                {/* Daily Mandi Rates Box */}
                <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant/30 flex flex-col justify-between flex-1 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-tertiary text-[20px]">trending_down</span>
                      <span className="font-bold text-xs text-on-surface">Today&apos;s Mandi Price Slabs</span>
                    </div>
                    <span className="px-2 py-0.5 bg-tertiary-fixed text-on-tertiary-fixed text-[10px] font-bold rounded">Live Rates</span>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center bg-surface-container-low px-3 py-2 rounded-lg text-xs">
                      <span className="font-medium text-on-surface">MDH Garam Masala 100g</span>
                      <span className="font-bold text-primary">₹78 <span className="text-[10px] text-outline line-through">₹118</span></span>
                    </div>
                    <div className="flex justify-between items-center bg-surface-container-low px-3 py-2 rounded-lg text-xs">
                      <span className="font-medium text-on-surface">Dawat Biryani Basmati 1kg</span>
                      <span className="font-bold text-primary">₹188 <span className="text-[10px] text-outline line-through">₹260</span></span>
                    </div>
                    <div className="flex justify-between items-center bg-surface-container-low px-3 py-2 rounded-lg text-xs">
                      <span className="font-medium text-on-surface">Saloni Mustard Oil 1L Pouch</span>
                      <span className="font-bold text-primary">₹142 <span className="text-[10px] text-outline line-through">₹175</span></span>
                    </div>
                  </div>
                  <Link
                    href="/store/wholesale"
                    className="mt-3 inline-flex items-center justify-center gap-1.5 w-full py-2 bg-surface-container text-primary font-bold text-xs rounded-lg hover:bg-primary hover:text-on-primary transition-colors"
                  >
                    View All Wholesale Slabs
                    <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                  </Link>
                </div>

                {/* Quick Logistics Banner */}
                <div className="bg-primary-container text-on-primary rounded-2xl p-5 shadow-sm flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] text-primary-fixed-dim uppercase tracking-wider block font-bold">Commercial Bulk Logistics</span>
                    <h4 className="font-headline text-sm font-bold">Pick-Up or E-Rickshaw Drop</h4>
                    <p className="text-[11px] text-primary-fixed opacity-90">Free town loading at Station Road Hub</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-on-primary flex-shrink-0 shadow-inner">
                    <span className="material-symbols-outlined text-[24px]">electric_rickshaw</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 4. Category Filter Chips Carousel */}
        <section className="max-w-[1280px] mx-auto px-4 lg:px-8 pt-6 pb-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-headline text-lg font-bold text-on-surface">Shop by Category</h2>
            {selectedCategory && (
              <button
                onClick={() => handleCategorySelect("")}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                <span>Clear Category</span>
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => handleCategorySelect("")}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border ${
                !selectedCategory
                  ? "bg-primary text-on-primary border-primary shadow-xs"
                  : "bg-surface-container-lowest text-on-surface-variant border-outline-variant/60 hover:bg-surface-container-low"
              }`}
            >
              <span>All Items</span>
              <span className="text-[10px] opacity-75">({sortedProducts.length})</span>
            </button>
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategorySelect(cat.id)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border ${
                    isSelected
                      ? "bg-primary text-on-primary border-primary shadow-xs"
                      : "bg-surface-container-lowest text-on-surface-variant border-outline-variant/60 hover:bg-surface-container-low"
                  }`}
                >
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 5. Main Catalog & Products Grid */}
        <section id="products-grid" className="max-w-[1280px] mx-auto px-4 lg:px-8 py-4">
          {/* Active Filter Bar & Controls */}
          <div className="bg-surface-container-lowest rounded-xl p-3 sm:p-4 mb-6 border border-outline-variant/40 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Brand Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-on-surface-variant font-medium">Brand:</span>
                <select
                  value={selectedCompany}
                  onChange={(e) => handleCompanyChange(e.target.value)}
                  className="bg-surface-container-low border border-outline-variant/60 rounded-lg px-2.5 py-1.5 font-bold text-xs text-on-surface focus:outline-none focus:border-primary"
                >
                  <option value="">All Brands (26)</option>
                  {companies.map((comp) => (
                    <option key={comp.id} value={comp.id}>
                      {comp.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* In-Stock Toggle */}
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-on-surface">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => handleInStockToggle(e.target.checked)}
                  className="w-4 h-4 accent-primary rounded cursor-pointer"
                />
                <span>In Stock Only</span>
              </label>

              {/* Active search chip */}
              {currentSearch && (
                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-fixed text-on-primary-fixed text-xs font-bold">
                  <span>&quot;{currentSearch}&quot;</span>
                  <button
                    onClick={() => {
                      const params = new URLSearchParams();
                      if (selectedCompany) params.set("companyId", selectedCompany);
                      if (selectedCategory) params.set("categoryId", selectedCategory);
                      router.push(`/store?${params.toString()}`);
                    }}
                    className="hover:text-primary"
                  >
                    <span className="material-symbols-outlined text-[13px]">close</span>
                  </button>
                </div>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 text-xs ml-auto">
              <span className="text-on-surface-variant font-medium">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-surface-container-low border border-outline-variant/60 rounded-lg px-2.5 py-1.5 font-bold text-xs text-on-surface focus:outline-none focus:border-primary"
              >
                <option value="name">Product Name (A-Z)</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
            </div>
          </div>

          {/* Product Cards Grid */}
          {sortedProducts.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 p-12 text-center space-y-3">
              <span className="text-4xl block">📦</span>
              <h3 className="font-headline text-lg font-bold text-on-surface">No products found</h3>
              <p className="text-xs text-on-surface-variant max-w-md mx-auto">
                No items match your active search or filters. Try resetting your search or brand filters to see the full warehouse catalog.
              </p>
              <button
                onClick={() => {
                  setSelectedCompany("");
                  setSelectedCategory("");
                  setInStockOnly(false);
                  router.push("/store");
                }}
                className="mt-3 px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-lg hover:bg-primary-container transition-colors"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
              {sortedProducts.map((product) => {
                const mrpRupees = Math.round(product.mrpPaise / 100);
                const bestSlab = product.slabs[0];
                const effectiveRateRupees = bestSlab
                  ? Math.round(bestSlab.unitPricePaise / 100)
                  : mrpRupees;
                const savingsRupees = mrpRupees > effectiveRateRupees ? mrpRupees - effectiveRateRupees : 0;
                const qty = cartQuantities[product.id] || 0;
                const isUpdating = updatingId === product.id;

                return (
                  <div
                    key={product.id}
                    className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 p-3 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Product Image / Brand Visual Tile */}
                      <Link
                        href={`/store/products/${product.id}`}
                        className="block h-36 sm:h-40 bg-surface-container-low rounded-xl border border-outline-variant/30 relative p-3 overflow-hidden group-hover:border-primary/40 transition-colors"
                      >
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-center text-outline">
                            <span className="material-symbols-outlined text-[32px]">inventory_2</span>
                            <span className="text-[10px] font-mono mt-1 uppercase">{product.shortCode}</span>
                          </div>
                        )}

                        {/* Top Badges */}
                        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                          {savingsRupees > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed text-[10px] font-black uppercase tracking-tight">
                              Save ₹{savingsRupees}
                            </span>
                          )}
                        </div>

                        {/* Stock status indicator */}
                        <div className="absolute bottom-2 left-2">
                          {product.isAvailable ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-tertiary bg-surface-container-lowest/90 px-1.5 py-0.5 rounded-full shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>
                              In stock
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-outline bg-surface-container-lowest/90 px-1.5 py-0.5 rounded-full">
                              Out of stock
                            </span>
                          )}
                        </div>
                      </Link>

                      {/* Product Metadata */}
                      <div className="mt-2.5 space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
                          <span className="font-bold text-secondary truncate">{product.companyName || "JMD"}</span>
                          {product.weight && <span className="text-outline font-medium">{product.weight}</span>}
                        </div>

                        <Link
                          href={`/store/products/${product.id}`}
                          className="font-bold text-xs text-on-surface hover:text-primary transition-colors line-clamp-2 leading-tight block"
                          title={product.name}
                        >
                          {product.name}
                        </Link>
                      </div>
                    </div>

                    {/* Pricing & Add Stepper */}
                    <div className="mt-3 pt-2.5 border-t border-surface-container-high/60 flex items-center justify-between gap-2">
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-headline text-sm font-bold text-primary">
                            ₹{effectiveRateRupees}
                          </span>
                          {mrpRupees > effectiveRateRupees && (
                            <span className="text-[10px] text-outline line-through">
                              ₹{mrpRupees}
                            </span>
                          )}
                        </div>
                        {product.packSize > 1 && (
                          <div className="text-[9px] text-on-surface-variant">
                            {product.packSize} pcs / carton
                          </div>
                        )}
                      </div>

                      {/* Add Button or Stepper */}
                      {!product.isAvailable ? (
                        <button
                          disabled
                          className="px-2.5 py-1 bg-surface-container text-outline text-[11px] font-bold rounded-lg cursor-not-allowed"
                        >
                          Sold
                        </button>
                      ) : qty === 0 ? (
                        <button
                          onClick={() => handleAddToCart(product)}
                          disabled={isUpdating}
                          className="px-3 py-1.5 bg-primary hover:bg-primary-container text-on-primary text-xs font-bold rounded-lg shadow-2xs transition-all active:scale-95 flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">add</span>
                          <span>ADD</span>
                        </button>
                      ) : (
                        <div className="flex items-center bg-primary text-on-primary rounded-lg p-0.5 shadow-2xs">
                          <button
                            onClick={() => handleUpdateQty(product.id, -1)}
                            disabled={isUpdating}
                            className="w-6 h-6 flex items-center justify-center hover:bg-primary-container rounded font-bold"
                          >
                            <span className="material-symbols-outlined text-[14px]">remove</span>
                          </button>
                          <span className="w-6 text-center text-xs font-bold">{qty}</span>
                          <button
                            onClick={() => handleUpdateQty(product.id, 1)}
                            disabled={isUpdating}
                            className="w-6 h-6 flex items-center justify-center hover:bg-primary-container rounded font-bold"
                          >
                            <span className="material-symbols-outlined text-[14px]">add</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* 6. Floating Cart Bar when items are selected */}
      <FloatingCartBar
        totalPieces={totalCartCount}
        totalRupees={totalCartRupees}
        savingsRupees={totalSavingsRupees}
      />

      {/* 7. Master Footer with Theme */}
      <StoreFooter />
    </div>
  );
}
