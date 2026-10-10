"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StoreProductItem } from "@/modules/store/store.service";
import { addToCartAction, updateCartQtyAction, removeFromCartAction } from "@/app/store/cart/actions";

interface CategoryTile {
  id: string;
  name: string;
  query: string;
  iconBg: string;
  icon: string;
}

const CATEGORY_TILES: CategoryTile[] = [
  { id: "grains", name: "Atta, Rice & Dal", query: "Rice & Grains", iconBg: "bg-[#FDAF18]", icon: "🌾" },
  { id: "spices", name: "Masala & Spices", query: "Spices & Masala", iconBg: "bg-[#FC830D]", icon: "🌶️" },
  { id: "oils", name: "Oil, Ghee & Salt", query: "Edible Oils", iconBg: "bg-[#075828]", icon: "🫒" },
  { id: "snacks", name: "Snacks & Namkeen", query: "Namkeen & Snacks", iconBg: "bg-[#C63312]", icon: "🥨" },
  { id: "biscuits", name: "Biscuits", query: "Biscuits", iconBg: "bg-[#790E11]", icon: "🍪" },
  { id: "tea", name: "Tea & Coffee", query: "Tea & Beverages", iconBg: "bg-[#D97706]", icon: "☕" },
  { id: "drinks", name: "Drinks & Juices", query: "Beverages", iconBg: "bg-[#F97316]", icon: "🧃" },
  { id: "cleaning", name: "Cleaning Essentials", query: "Home Care", iconBg: "bg-[#047857]", icon: "🧼" },
];

const SEARCH_PLACEHOLDERS = [
  'Search "Bikaji bhujia"',
  'Search "MDH garam masala"',
  'Search "India Gate basmati"',
  'Search "Engine mustard oil"',
  'Search "atta 10 kg"',
  'Search "Tata tea gold"',
];

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
  userRole = "",
  cartSummary = { totalPieces: 0, itemsCount: 0, totalPaise: 0, savingsPaise: 0 },
}: CatalogueClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState(currentSearch);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [selectedCompany, setSelectedCompany] = useState(currentCompanyId);
  const [selectedCategory, setSelectedCategory] = useState(currentCategoryId);
  const [inStockOnly, setInStockOnly] = useState(currentInStockOnly);

  // In-place cart quantities state per product ID
  const [cartQuantities, setCartQuantities] = useState<Record<string, number>>(initialCartQuantities);
  // Unit mode toggle per product: 'pcs' | 'carton'
  const [unitModes, setUnitModes] = useState<Record<string, "pcs" | "carton">>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % SEARCH_PLACEHOLDERS.length);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  // Compute live cart statistics
  const totalCartPieces = useMemo(
    () => Object.values(cartQuantities).reduce((a, b) => a + b, 0),
    [cartQuantities]
  );
  const totalCartLines = useMemo(
    () => Object.values(cartQuantities).filter((q) => q > 0).length,
    [cartQuantities]
  );

  // Approximate live total paise
  const liveTotalPaise = useMemo(() => {
    let total = 0;
    for (const p of initialProducts) {
      const q = cartQuantities[p.id] || 0;
      if (q > 0) {
        const slab = [...p.slabs].reverse().find((s) => q >= s.minQty);
        const unitPrice = slab ? slab.unitPricePaise : p.mrpPaise;
        total += unitPrice * q;
      }
    }
    return total > 0 ? total : cartSummary.totalPaise;
  }, [cartQuantities, initialProducts, cartSummary.totalPaise]);

  const liveTotalRupees = Math.round(liveTotalPaise / 100);
  const freeDeliveryThresholdRupees = 2000;
  const remainingForFreeDelivery = Math.max(0, freeDeliveryThresholdRupees - liveTotalRupees);
  const freeDeliveryProgress = Math.min(
    100,
    Math.round((liveTotalRupees / freeDeliveryThresholdRupees) * 100)
  );

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

  const handleCategoryTileClick = (catQuery: string) => {
    // Find matching category in categories list if present
    const matched = categories.find((c) =>
      c.name.toLowerCase().includes(catQuery.toLowerCase()) ||
      catQuery.toLowerCase().includes(c.name.toLowerCase())
    );
    if (matched) {
      const updated = selectedCategory === matched.id ? "" : matched.id;
      setSelectedCategory(updated);
      applyFilters("", selectedCompany, updated, inStockOnly);
    } else {
      // Fallback: search by query
      setSearch(catQuery);
      applyFilters(catQuery, selectedCompany, "", inStockOnly);
    }
  };

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
      {/* 1. TOP HEADER (White with Maroon accents matching Stitch S1) */}
      <header className="bg-white border-b border-[#EAD9CC] sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-20 flex items-center justify-between gap-4">
            {/* Brand Logo & Tagline */}
            <Link href="/store" className="flex items-center gap-3 shrink-0 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/jmd-cart-logo.png"
                alt="JMD Cart Logo"
                className="h-12 w-12 object-contain group-hover:scale-105 transition-transform"
              />
              <div className="flex flex-col">
                <span className="text-2xl font-black tracking-tight text-[#790E11] leading-none">
                  JMD Cart
                </span>
                <span className="text-[11px] font-medium text-[#2A1010]/70 mt-0.5 tracking-tight">
                  Bharosa Ghar Tak.
                </span>
              </div>
            </Link>

            {/* Wide Rotating Search Bar */}
            <div className="flex-1 max-w-xl mx-2 hidden sm:block">
              <form onSubmit={handleSearchSubmit} className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  🔍
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    mounted
                      ? SEARCH_PLACEHOLDERS[placeholderIndex]
                      : 'Search "Bikaji bhujia"'
                  }
                  className="w-full pl-10 pr-20 py-2.5 bg-white border border-[#EAD9CC] rounded-full text-sm placeholder-gray-400 text-[#2A1010] focus:outline-none focus:ring-2 focus:ring-[#790E11] focus:border-[#790E11] transition-all shadow-xs"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      applyFilters("", selectedCompany, selectedCategory, inStockOnly);
                    }}
                    className="absolute inset-y-0 right-14 pr-2 flex items-center text-gray-400 hover:text-gray-600 text-xs"
                  >
                    ✕
                  </button>
                )}
                <button
                  type="submit"
                  className="absolute inset-y-1 right-1 px-4 bg-[#790E11] hover:bg-[#5E0A0D] text-white text-xs font-bold rounded-full transition-colors flex items-center justify-center cursor-pointer"
                >
                  Search
                </button>
              </form>
            </div>

            {/* User Controls & Cart Button */}
            <div className="flex items-center gap-3 shrink-0">
              {isLoggedIn ? (
                <>
                  <div className="text-right hidden md:block">
                    <div className="text-xs font-bold text-[#2A1010] truncate max-w-[140px]">
                      {userName}
                    </div>
                    <div className="text-[10px] text-[#790E11] font-mono">
                      {userRole}
                    </div>
                  </div>
                  <Link
                    href="/store/orders"
                    className="text-xs font-semibold px-3 py-2 border border-[#EAD9CC] hover:bg-[#FEFDF7] text-[#2A1010] rounded-lg transition-colors"
                  >
                    📦 Orders
                  </Link>
                  <Link
                    href="/logout"
                    className="text-xs font-medium px-2 py-2 text-gray-500 hover:text-[#790E11] transition-colors"
                    title="Logout"
                  >
                    Logout
                  </Link>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    href="/login?callbackUrl=/store"
                    className="text-xs font-bold px-4 py-2 border border-[#790E11] text-[#790E11] hover:bg-[#790E11] hover:text-white rounded-lg transition-colors"
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    className="text-xs font-medium px-3 py-2 text-gray-600 hover:text-[#2A1010] rounded-lg transition-colors hidden sm:block"
                  >
                    Register
                  </Link>
                </div>
              )}

              {/* My Cart Button (Maroon-700) */}
              <Link
                href="/store/cart"
                className="flex items-center gap-2 px-4 py-2 bg-[#790E11] hover:bg-[#5E0A0D] text-white rounded-lg text-xs font-bold shadow transition-transform active:scale-95 cursor-pointer"
              >
                <span>🛒 My Cart</span>
                {totalCartPieces > 0 ? (
                  <span className="bg-[#FDAF18] text-[#2A1010] text-[11px] font-black px-2 py-0.5 rounded-full">
                    {totalCartPieces}
                  </span>
                ) : (
                  <span className="text-white/60 text-[11px]">0</span>
                )}
              </Link>
            </div>
          </div>

          {/* Mobile Search Bar Row */}
          <div className="pb-3 block sm:hidden">
            <form onSubmit={handleSearchSubmit} className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 text-xs">
                🔍
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  mounted
                    ? SEARCH_PLACEHOLDERS[placeholderIndex]
                    : 'Search "Bikaji bhujia"'
                }
                className="w-full pl-8 pr-16 py-2 bg-white border border-[#EAD9CC] rounded-full text-xs placeholder-gray-400 text-[#2A1010] focus:outline-none focus:ring-1 focus:ring-[#790E11]"
              />
              <button
                type="submit"
                className="absolute inset-y-1 right-1 px-3 bg-[#790E11] text-white text-[10px] font-bold rounded-full"
              >
                Search
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* 2. LOCATION & TRUST TRANSPARENCY STRIP */}
      <div className="bg-[#FFF9ED] border-y border-[#EAD9CC]/60 py-2.5 px-4 text-xs text-[#2A1010]">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Delivering Chip */}
          <div className="inline-flex items-center gap-1.5 bg-[#FFF1D6] text-[#790E11] px-3 py-1 rounded-full text-xs font-bold border border-[#FDAF18]/40 shadow-2xs">
            <span>📍</span>
            <span>Delivering in Saharsa town</span>
          </div>

          {/* Three Trust Indicators */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 font-medium text-xs text-[#2A1010]">
            <div className="flex items-center gap-1.5">
              <span className="text-[#075828] font-black text-sm">✔</span>
              <span>Free delivery above ₹2,000</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[#075828] font-black text-sm">✔</span>
              <span>GST invoice on every order</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[#075828] font-black text-sm">✔</span>
              <span>Genuine products</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* 3. HERO BANNER (Maroon to Orange Gradient per Stitch S1) */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#790E11] via-[#9B1D20] to-[#FC830D] p-6 sm:p-8 text-white shadow-md">
          <div className="max-w-2xl relative z-10 space-y-2">
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
              Stock up for your shop. <br />
              <span className="text-[#FDAF18]">Bharosa Ghar Tak.</span>
            </h1>
            <p className="text-sm sm:text-base text-white/90 font-medium">
              Wholesale, retail and home delivery in Saharsa town
            </p>
          </div>
          <div className="mt-4 sm:mt-0 sm:absolute sm:right-8 sm:bottom-8 z-10">
            <a
              href="#products-section"
              className="inline-block px-6 py-3 bg-[#FDAF18] hover:bg-[#FC830D] text-[#2A1010] font-black text-sm rounded-xl shadow-lg transition-transform hover:scale-105 active:scale-95 text-center"
            >
              Shop now
            </a>
          </div>
        </section>

        {/* 4. SHOP BY CATEGORY (8 Warm Cream Tiles #FFF4E3 per Stitch S1) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-[#2A1010]">Shop by category</h2>
            <button
              onClick={() => {
                setSelectedCategory("");
                applyFilters(search, selectedCompany, "", inStockOnly);
              }}
              className="text-xs font-bold text-[#790E11] hover:underline cursor-pointer"
            >
              See all &gt;
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {CATEGORY_TILES.map((cat) => {
              const isActive =
                selectedCategory &&
                categories.find((c) => c.id === selectedCategory)?.name.includes(cat.query);
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryTileClick(cat.query)}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all cursor-pointer border ${
                    isActive
                      ? "bg-[#FFF1D6] border-[#790E11] shadow-sm scale-105"
                      : "bg-[#FFF4E3] border-[#EAD9CC]/50 hover:border-[#FDAF18] hover:shadow-xs hover:scale-102"
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-full ${cat.iconBg} flex items-center justify-center text-xl text-white shadow-xs mb-2`}
                  >
                    {cat.icon}
                  </div>
                  <span className="text-xs font-bold text-[#2A1010] text-center leading-tight">
                    {cat.name}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 5. POPULAR FMCG BRANDS STRIP */}
        {companies.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Popular FMCG Brands
              </span>
              {selectedCompany && (
                <button
                  onClick={() => handleCompanyChange("")}
                  className="text-xs text-[#790E11] font-semibold hover:underline"
                >
                  Clear Brand Filter
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleCompanyChange("")}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer border ${
                  !selectedCompany
                    ? "bg-[#790E11] text-white border-[#790E11]"
                    : "bg-white text-[#2A1010] border-[#EAD9CC] hover:bg-[#FFF4E3]"
                }`}
              >
                All Brands
              </button>
              {companies.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleCompanyChange(c.id)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer border ${
                    selectedCompany === c.id
                      ? "bg-[#790E11] text-white border-[#790E11]"
                      : "bg-white text-[#2A1010] border-[#EAD9CC] hover:bg-[#FFF4E3]"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* 6. FREE DELIVERY PROGRESS BAR */}
        <section className="bg-white rounded-xl border border-[#EAD9CC] p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-[#2A1010]">
              {remainingForFreeDelivery === 0 ? (
                <span className="text-[#075828]">
                  🎉 You have unlocked Free Delivery in Saharsa town!
                </span>
              ) : (
                <span>
                  Add ₹{remainingForFreeDelivery} more for{" "}
                  <strong className="text-[#790E11]">Free Delivery</strong>
                </span>
              )}
            </span>
            <span className="text-gray-500 text-[11px]">
              ₹{liveTotalRupees} / ₹2,000
            </span>
          </div>
          <div className="h-2.5 w-full bg-[#FFF4E3] rounded-full overflow-hidden border border-[#EAD9CC]/50">
            <div
              className="h-full bg-gradient-to-r from-[#790E11] to-[#FC830D] rounded-full transition-all duration-300"
              style={{ width: `${freeDeliveryProgress}%` }}
            />
          </div>
        </section>

        {/* 7. BULK DEALS PRODUCT GRID (Matching Stitch S1 Mockup) */}
        <section id="products-section" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-[#2A1010]">
              Bulk deals: buy 12+ and save more
            </h2>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-700 select-none">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={() => {
                    const next = !inStockOnly;
                    setInStockOnly(next);
                    applyFilters(search, selectedCompany, selectedCategory, next);
                  }}
                  className="rounded border-[#EAD9CC] text-[#790E11] focus:ring-[#790E11] h-3.5 w-3.5"
                />
                <span>In Stock Only</span>
              </label>
              <button
                onClick={() => {
                  setSelectedCategory("");
                  setSelectedCompany("");
                  setSearch("");
                  applyFilters("", "", "", false);
                }}
                className="text-xs font-bold text-[#790E11] hover:underline"
              >
                See all &gt;
              </button>
            </div>
          </div>

          {initialProducts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#EAD9CC] p-12 text-center space-y-3">
              <span className="text-4xl block">📦</span>
              <h3 className="text-lg font-bold text-[#2A1010]">No products found</h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                No items match your active search or filters. Try clearing your filters to see the full Saharsa catalogue.
              </p>
              <button
                onClick={() => {
                  setSearch("");
                  setSelectedCompany("");
                  setSelectedCategory("");
                  setInStockOnly(false);
                  applyFilters("", "", "", false);
                }}
                className="mt-2 text-xs font-bold text-[#790E11] hover:underline cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {initialProducts.map((product) => {
                const mrpRupees = Math.round(product.mrpPaise / 100);
                const bestSlab = product.slabs[product.slabs.length - 1];
                const bestRateRupees = bestSlab
                  ? Math.round(bestSlab.unitPricePaise / 100)
                  : mrpRupees;

                const qty = cartQuantities[product.id] || 0;
                const mode = unitModes[product.id] || "pcs";
                const isUpdating = updatingId === product.id;

                // Stock Display Policy (Phase 3 Rule): Never expose raw high counts
                let stockBadgeText = "In stock";
                let stockBadgeClass = "bg-[#E3F3E6] text-[#075828]";

                if (!product.isAvailable || product.totalAvailableQty === 0) {
                  stockBadgeText = "Out of stock";
                  stockBadgeClass = "bg-[#FEE2E2] text-[#991B1B]";
                } else if (product.totalAvailableQty <= 10) {
                  stockBadgeText = `Only ${product.totalAvailableQty} left`;
                  stockBadgeClass = "bg-[#FEF3C7] text-[#B45309]";
                }

                return (
                  <div
                    key={product.id}
                    className="bg-white rounded-2xl border border-[#EAD9CC] p-3 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Product Image Tile with In-Place ADD Stepper Button */}
                      <div className="h-44 bg-[#FFFDF7] rounded-xl border border-[#EAD9CC]/50 flex items-center justify-center relative p-3 overflow-hidden">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="text-center text-gray-300">
                            <span className="text-4xl block">🛒</span>
                            <span className="text-[10px] uppercase font-mono text-gray-400">
                              {product.shortCode}
                            </span>
                          </div>
                        )}

                        {/* Floating ADD Button / Stepper (Bottom-Right of Photo) */}
                        <div className="absolute bottom-2.5 right-2.5 z-10">
                          {!product.isAvailable ? (
                            <button
                              disabled
                              className="px-3 py-1 bg-gray-100 text-gray-400 text-xs font-bold rounded-lg border border-gray-200 cursor-not-allowed"
                            >
                              ADD
                            </button>
                          ) : qty === 0 ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleAddFirstTap(product)}
                                disabled={isUpdating}
                                className="px-3.5 py-1.5 bg-white border-2 border-[#790E11] hover:bg-[#790E11] hover:text-white text-[#790E11] text-xs font-black rounded-lg shadow-sm transition-colors active:scale-95 cursor-pointer disabled:opacity-50"
                              >
                                ADD
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleUnitMode(product.id, mode)}
                                className="px-1.5 py-1 text-[10px] font-bold text-gray-600 bg-[#FFF4E3] border border-[#EAD9CC] rounded-lg"
                                title="Switch unit: Pieces or Carton"
                              >
                                {mode === "pcs" ? "pcs" : "ctn"}
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 bg-[#790E11] text-white rounded-lg p-0.5 shadow-sm">
                              <button
                                onClick={() => {
                                  const step = mode === "carton" ? product.packSize : 1;
                                  handleStepperChange(product, -step);
                                }}
                                disabled={isUpdating}
                                className="w-6 h-6 flex items-center justify-center font-black text-sm hover:bg-[#5E0A0D] rounded transition-colors"
                              >
                                -
                              </button>
                              <span className="px-1.5 text-xs font-black">{qty}</span>
                              <button
                                onClick={() => {
                                  const step = mode === "carton" ? product.packSize : 1;
                                  handleStepperChange(product, step);
                                }}
                                disabled={isUpdating}
                                className="w-6 h-6 flex items-center justify-center font-black text-sm hover:bg-[#5E0A0D] rounded transition-colors"
                              >
                                +
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Pricing and Details per Mockup */}
                      <div className="mt-3 space-y-1.5">
                        {/* Price Badge + Strikethrough MRP */}
                        <div className="flex items-baseline gap-2">
                          <span className="inline-block bg-[#E3F3E6] text-[#075828] text-sm font-black px-2 py-0.5 rounded">
                            ₹{bestRateRupees}
                          </span>
                          {mrpRupees > bestRateRupees && (
                            <span className="text-xs text-gray-400 line-through">
                              ₹{mrpRupees}
                            </span>
                          )}
                        </div>

                        {/* Product Title */}
                        <Link
                          href={`/store/products/${product.id}`}
                          className="font-bold text-[#2A1010] hover:text-[#790E11] text-sm line-clamp-2 block leading-snug"
                        >
                          {product.name}
                        </Link>

                        {/* Pack Size */}
                        <div className="text-xs text-gray-500">
                          1 pack ({product.packSize} {product.packLabel.toLowerCase()})
                        </div>

                        {/* Slab Hint Chip */}
                        {bestSlab && (
                          <div className="inline-block bg-[#FFF1D6] text-[#790E11] text-xs font-bold px-2 py-0.5 rounded">
                            Buy {bestSlab.minQty}+ ₹{Math.round(bestSlab.unitPricePaise / 100)} each
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stock Status Chip */}
                    <div className="mt-3 pt-2 border-t border-[#EAD9CC]/40 flex items-center justify-between">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${stockBadgeClass}`}>
                        {stockBadgeText}
                      </span>
                      {product.companyName && (
                        <span className="text-[10px] font-semibold text-gray-400 truncate max-w-[120px]">
                          {product.companyName}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* 8. STICKY BOTTOM CART BAR (Matching Blinkit/Zepto & Stitch S1) */}
      {totalCartPieces > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-[#5E0A0D] text-white py-3.5 px-4 shadow-2xl z-50 border-t border-[#FDAF18]/40">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🛒</span>
              <div>
                <div className="text-sm font-black flex items-center gap-2">
                  <span>
                    {totalCartLines} items ({totalCartPieces} pcs)
                  </span>
                  <span className="text-xs font-bold text-[#FDAF18]">
                    • ₹{liveTotalRupees}
                  </span>
                </div>
                <div className="text-xs text-white/80">
                  {remainingForFreeDelivery === 0
                    ? "Free delivery applied in Saharsa town!"
                    : `Add ₹${remainingForFreeDelivery} more for free delivery`}
                </div>
              </div>
            </div>

            <Link
              href="/store/cart"
              className="py-2.5 px-6 bg-[#FC830D] hover:bg-[#FDAF18] text-[#2A1010] font-black text-sm rounded-xl shadow-lg transition-transform active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <span>View Cart</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      )}

      {/* 9. FLOATING WHATSAPP HELP BUTTON */}
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

      {/* 10. FOOTER (Deep Maroon #5E0A0D per Stitch Design) */}
      <footer className="mt-16 bg-[#5E0A0D] text-white/90 border-t border-[#FDAF18]/30 py-10 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-white">JMD Cart</span>
              <span className="text-xs bg-[#FDAF18] text-[#2A1010] font-bold px-2 py-0.5 rounded">
                Saharsa
              </span>
            </div>
            <p className="text-xs text-white/70 mt-2">
              A unit of Jai Mata Di. Integrated FMCG Distribution Management System serving retailers and wholesalers across Saharsa, Bihar.
            </p>
            <p className="text-xs text-[#FDAF18] font-bold mt-2">
              Bharosa Ghar Tak.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
              Customer &amp; Wholesaler Support
            </h4>
            <ul className="text-xs space-y-1.5 text-white/80">
              <li>📍 Main Market &amp; Godown Hub, Saharsa, Bihar</li>
              <li>📞 Phone: +91 98765 43210</li>
              <li>⚡ Daily Delivery Routes: Morning &amp; Afternoon Vans</li>
              <li>📑 100% Tax Compliant GST Billing</li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
              Quick Links
            </h4>
            <div className="flex flex-col gap-1.5 text-xs text-white/80">
              <Link href="/store" className="hover:text-white">Storefront Catalogue</Link>
              <Link href="/store/cart" className="hover:text-white">Shopping Cart</Link>
              <Link href="/store/orders" className="hover:text-white">Order History &amp; Tracking</Link>
              <Link href="/login" className="hover:text-white">Staff / Admin Login</Link>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-white/10 text-center text-[11px] text-white/60">
          © {new Date().getFullYear()} JMD Cart. All rights reserved. Built for speed, live inventory, and GST compliance.
        </div>
      </footer>
    </div>
  );
}
