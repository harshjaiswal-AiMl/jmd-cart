"use client";

import { useState, useTransition, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StoreProductItem } from "@/modules/store/store.service";
import { StoreBanner } from "@/modules/banners/banner.types";
import { addToCartAction, updateCartQtyAction, removeFromCartAction } from "@/app/store/cart/actions";
import { toggleWishlistAction } from "@/app/store/wishlist/actions";
import { StoreHeader } from "@/components/store/StoreHeader";
import { StoreFooter } from "@/components/store/StoreFooter";
import { TrustRegionalStrip } from "@/components/store/TrustRegionalStrip";
import { FloatingCartBar } from "@/components/store/FloatingCartBar";
import { StoreBannerCarousel } from "@/components/store/StoreBannerCarousel";

export interface CatalogueCategory {
  id: string;
  name: string;
  imageUrl?: string | null;
  productCount?: number;
}

interface CatalogueClientProps {
  initialProducts: StoreProductItem[];
  companies: Array<{ id: string; name: string }>;
  categories: CatalogueCategory[];
  banners?: StoreBanner[];
  currentSearch?: string;
  currentCompanyId?: string;
  currentCategoryId?: string;
  currentInStockOnly?: boolean;
  initialCartQuantities?: Record<string, number>;
  initialWishlistProductIds?: string[];
  initialWishlistCount?: number;
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalProducts: number;
    pageSize: number;
  };
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
  banners = [],
  currentSearch = "",
  currentCompanyId = "",
  currentCategoryId = "",
  currentInStockOnly = false,
  initialCartQuantities = {},
  initialWishlistProductIds = [],
  initialWishlistCount = 0,
  pagination = {
    currentPage: 1,
    totalPages: 1,
    totalProducts: initialProducts.length,
    pageSize: 32,
  },
  isLoggedIn = false,
  userName = "",
  cartSummary = { totalPieces: 0, itemsCount: 0, totalPaise: 0, savingsPaise: 0 },
}: CatalogueClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Filter States
  const [selectedCompany, setSelectedCompany] = useState(currentCompanyId);
  const [selectedCategory, setSelectedCategory] = useState(currentCategoryId);
  const [inStockOnly, setInStockOnly] = useState(currentInStockOnly);
  const [sortBy, setSortBy] = useState<"name" | "price-asc" | "price-desc">("name");

  // Category Rail Horizontal Scroll Reference (Senior UX)
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const scrollCategories = (offset: number) => {
    if (categoryScrollRef.current) {
      categoryScrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  // Cart Optimistic State (supports local guest storage + DB sync)
  const [cartQuantities, setCartQuantities] = useState<Record<string, number>>(initialCartQuantities);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Wishlist Optimistic State
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(
    () => new Set(initialWishlistProductIds)
  );
  const [wishlistCount, setWishlistCount] = useState<number>(initialWishlistCount);

  const handleToggleWishlist = (productId: string, productName: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isLoggedIn) {
      router.push("/login?callbackUrl=/store");
      return;
    }

    const wasIn = wishlistIds.has(productId);
    setWishlistIds((prev) => {
      const next = new Set(prev);
      if (wasIn) next.delete(productId);
      else next.add(productId);
      return next;
    });
    setWishlistCount((prev) => (wasIn ? Math.max(0, prev - 1) : prev + 1));
    setToastMessage(wasIn ? `Removed from Wishlist` : `Saved to Wishlist ❤️`);
    setTimeout(() => setToastMessage(null), 3000);

    startTransition(async () => {
      try {
        const res = await toggleWishlistAction(productId);
        if (res.success) {
          setWishlistCount(res.count);
        }
      } catch (err) {
        console.error("Wishlist error:", err);
      }
    });
  };

  // Clean start on mount: ensure no stale local storage items trick guest users
  useEffect(() => {
    if (!isLoggedIn && typeof window !== "undefined") {
      try {
        window.localStorage.removeItem("jmd_local_cart");
      } catch (e) {
        // ignore
      }
    }
  }, [isLoggedIn]);

  const saveLocalCart = (nextCart: Record<string, number>) => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("jmd_local_cart", JSON.stringify(nextCart));
      } catch (e) {
        // ignore
      }
    }
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 2800);
  };

  // Apply filters via URL
  const applyFilters = (
    companyId: string,
    categoryId: string,
    inStock: boolean,
    page: number = 1
  ) => {
    const params = new URLSearchParams();
    if (currentSearch) params.set("q", currentSearch);
    if (companyId) params.set("companyId", companyId);
    if (categoryId) params.set("categoryId", categoryId);
    if (inStock) params.set("inStockOnly", "true");
    if (page > 1) params.set("page", page.toString());

    startTransition(() => {
      router.push(`/store?${params.toString()}#products-grid`);
    });
  };

  const handleCompanyChange = (companyId: string) => {
    setSelectedCompany(companyId);
    applyFilters(companyId, selectedCategory, inStockOnly, 1);
  };

  const handleCategorySelect = (categoryId: string) => {
    const nextCat = selectedCategory === categoryId ? "" : categoryId;
    setSelectedCategory(nextCat);
    applyFilters(selectedCompany, nextCat, inStockOnly, 1);
  };

  const handleInStockToggle = (checked: boolean) => {
    setInStockOnly(checked);
    applyFilters(selectedCompany, selectedCategory, checked, 1);
  };

  const handlePageChange = (newPage: number) => {
    applyFilters(selectedCompany, selectedCategory, inStockOnly, newPage);
  };

  // Cart Handlers
  const handleAddToCart = async (product: StoreProductItem) => {
    setUpdatingId(product.id);
    const newQty = (cartQuantities[product.id] || 0) + 1;
    const next = { ...cartQuantities, [product.id]: newQty };
    setCartQuantities(next);
    saveLocalCart(next);
    triggerToast(`✓ Added ${product.name} to cart`);

    if (isLoggedIn) {
      try {
        const res = await addToCartAction(product.id, 1);
        if (!res.success) {
          // If server rejects, keep local optimistic or revert
        }
      } catch {
        // keep local state
      } finally {
        setUpdatingId(null);
      }
    } else {
      setUpdatingId(null);
    }
  };

  const handleUpdateQty = async (productId: string, delta: number) => {
    const currentQty = cartQuantities[productId] || 0;
    const nextQty = Math.max(0, currentQty + delta);

    setUpdatingId(productId);
    const next = { ...cartQuantities };
    if (nextQty === 0) {
      delete next[productId];
    } else {
      next[productId] = nextQty;
    }
    setCartQuantities(next);
    saveLocalCart(next);

    if (isLoggedIn) {
      try {
        if (nextQty === 0) {
          await removeFromCartAction(productId);
        } else {
          await updateCartQtyAction(productId, nextQty);
        }
      } catch {
        // keep local state
      } finally {
        setUpdatingId(null);
      }
    } else {
      setUpdatingId(null);
    }
  };

  // Calculate dynamic cart totals
  const totalCartCount = Object.values(cartQuantities).reduce((a, b) => a + b, 0);

  // Compute total rupees and savings dynamically from active products
  let calculatedRupees = 0;
  let calculatedSavings = 0;
  for (const [pId, qty] of Object.entries(cartQuantities)) {
    const p = initialProducts.find((item) => item.id === pId);
    if (p && qty > 0) {
      const mrp = Math.round(p.mrpPaise / 100);
      const rate = Math.round((p.unitPricePaise || p.slabs[0]?.unitPricePaise || p.mrpPaise) / 100);
      calculatedRupees += rate * qty;
      calculatedSavings += Math.max(0, mrp - rate) * qty;
    }
  }

  const totalCartRupees = calculatedRupees > 0 ? calculatedRupees : Math.round(cartSummary.totalPaise / 100);
  const totalSavingsRupees = calculatedSavings > 0 ? calculatedSavings : Math.round(cartSummary.savingsPaise / 100);

  // Sorting products - In-stock products ALWAYS appear first, out-of-stock items at the bottom
  const sortedProducts = [...initialProducts].sort((a, b) => {
    if (a.isAvailable !== b.isAvailable) {
      return a.isAvailable ? -1 : 1;
    }
    if (sortBy === "price-asc") {
      const priceA = a.unitPricePaise || a.slabs[0]?.unitPricePaise || a.mrpPaise;
      const priceB = b.unitPricePaise || b.slabs[0]?.unitPricePaise || b.mrpPaise;
      return priceA - priceB;
    }
    if (sortBy === "price-desc") {
      const priceA = a.unitPricePaise || a.slabs[0]?.unitPricePaise || a.mrpPaise;
      const priceB = b.unitPricePaise || b.slabs[0]?.unitPricePaise || b.mrpPaise;
      return priceB - priceA;
    }
    return a.name.localeCompare(b.name);
  });

  // Reorder picks (Top 6 staples)
  const reorderPicks = sortedProducts.slice(0, 6);

  // Active category item data
  const selectedCategoryData = useMemo(
    () => categories.find((c) => c.id === selectedCategory),
    [categories, selectedCategory]
  );

  // Group products by category for Zepto/Blinkit category-wise shelves
  const categoryShelves = useMemo(() => {
    const map = new Map<string, StoreProductItem[]>();
    for (const p of sortedProducts) {
      const cId = p.categoryId || "uncategorized";
      if (!map.has(cId)) {
        map.set(cId, []);
      }
      map.get(cId)!.push(p);
    }
    return map;
  }, [sortedProducts]);

  // Reusable Product Card with dynamic Category Badge and 1-tap Cart Stepper
  const renderProductCard = (product: StoreProductItem, showCategoryTag = true) => {
    const mrpRupees = Math.round(product.mrpPaise / 100);
    const effectiveRateRupees = Math.round(
      (product.unitPricePaise || product.slabs[0]?.unitPricePaise || product.mrpPaise) / 100
    );
    const savingsRupees = mrpRupees > effectiveRateRupees ? mrpRupees - effectiveRateRupees : 0;
    const qty = cartQuantities[product.id] || 0;
    const isUpdating = updatingId === product.id;

    return (
      <div
        key={product.id}
        className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 p-2.5 sm:p-3 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
      >
        <div>
          {/* Product Image Tile */}
          <Link
            href={`/store/products/${product.id}`}
            className="block aspect-square bg-surface-container-low rounded-xl border border-outline-variant/30 relative p-2 sm:p-3 overflow-hidden group-hover:border-primary/40 transition-colors"
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

            {/* Savings Badge */}
            {savingsRupees > 0 && (
              <div className="absolute top-2 left-2">
                <span className="px-1.5 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed text-[10px] font-black uppercase tracking-tight shadow-2xs">
                  Save ₹{savingsRupees}
                </span>
              </div>
            )}

            {/* Wishlist Heart Toggle Button */}
            <button
              type="button"
              onClick={(e) => handleToggleWishlist(product.id, product.name, e)}
              title={wishlistIds.has(product.id) ? "Saved in Wishlist" : "Add to Wishlist"}
              aria-label={wishlistIds.has(product.id) ? "Remove from Wishlist" : "Add to Wishlist"}
              className="absolute top-2 right-2 z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-surface-container-lowest/90 backdrop-blur-xs flex items-center justify-center border border-outline-variant/40 shadow-xs hover:scale-110 active:scale-90 transition-all pointer-events-auto"
            >
              <span
                className={`material-symbols-outlined text-[17px] sm:text-[19px] transition-colors ${
                  wishlistIds.has(product.id)
                    ? "text-red-500"
                    : "text-outline hover:text-red-500"
                }`}
                style={{
                  fontVariationSettings: wishlistIds.has(product.id) ? "'FILL' 1" : "'FILL' 0",
                }}
              >
                favorite
              </span>
            </button>

            {/* Stock Status Indicator */}
            <div className="absolute bottom-2 left-2">
              {product.isAvailable ? (
                <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-tertiary bg-surface-container-lowest/90 backdrop-blur-xs px-1.5 py-0.5 rounded-full shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>
                  In stock
                </span>
              ) : (
                <span className="text-[9px] sm:text-[10px] font-bold text-outline bg-surface-container-lowest/90 px-1.5 py-0.5 rounded-full">
                  Out of stock
                </span>
              )}
            </div>
          </Link>

          {/* Product Metadata */}
          <div className="mt-2 sm:mt-2.5 space-y-1">
            <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-on-surface-variant gap-1">
              <span className="font-bold text-secondary truncate">{product.companyName || "JMD"}</span>
              {product.weight && <span className="text-outline font-medium shrink-0">{product.weight}</span>}
            </div>

            {/* Zepto/Blinkit Style Category Tag Inside Product Card */}
            {showCategoryTag && product.categoryName && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (product.categoryId) handleCategorySelect(product.categoryId);
                }}
                className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-1.5 py-0.5 rounded transition-colors w-fit max-w-full truncate"
                title={`Filter by category: ${product.categoryName}`}
              >
                <span className="material-symbols-outlined text-[11px]">category</span>
                <span className="truncate">{product.categoryName}</span>
              </button>
            )}

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
        <div className="mt-3 pt-2 sm:pt-2.5 border-t border-surface-container-high/60 flex items-center justify-between gap-1 sm:gap-2">
          <div>
            <div className="flex items-baseline gap-1 sm:gap-1.5">
              <span className="font-headline text-xs sm:text-base font-bold text-primary">
                ₹{effectiveRateRupees}
              </span>
              {mrpRupees > effectiveRateRupees && (
                <span className="text-[9px] sm:text-[10px] text-outline line-through">
                  ₹{mrpRupees}
                </span>
              )}
            </div>
            {product.packSize > 1 && (
              <div className="text-[9px] text-on-surface-variant truncate">
                {product.packSize} pcs/ctn
              </div>
            )}
          </div>

          {/* Add Button or Stepper */}
          {!product.isAvailable ? (
            <button
              disabled
              className="px-2 py-1 bg-surface-container text-outline text-[10px] font-bold rounded-lg cursor-not-allowed"
            >
              Sold
            </button>
          ) : qty === 0 ? (
            <button
              onClick={() => handleAddToCart(product)}
              disabled={isUpdating}
              className="px-2.5 sm:px-3 py-1.5 bg-primary hover:bg-primary-container text-on-primary text-xs font-bold rounded-lg shadow-2xs transition-all active:scale-95 flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
              <span>ADD</span>
            </button>
          ) : (
            <div className="flex items-center bg-primary text-on-primary rounded-lg p-0.5 shadow-2xs">
              <button
                onClick={() => handleUpdateQty(product.id, -1)}
                disabled={isUpdating}
                className="w-5 sm:w-6 h-5 sm:h-6 flex items-center justify-center hover:bg-primary-container rounded font-bold"
              >
                <span className="material-symbols-outlined text-[13px]">remove</span>
              </button>
              <span className="w-5 sm:w-6 text-center text-xs font-bold">{qty}</span>
              <button
                onClick={() => handleUpdateQty(product.id, 1)}
                disabled={isUpdating}
                className="w-5 sm:w-6 h-5 sm:h-6 flex items-center justify-center hover:bg-primary-container rounded font-bold"
              >
                <span className="material-symbols-outlined text-[13px]">add</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between">
      {/* 1. Master Header with Full Responsive Navigation */}
      <StoreHeader
        cartCount={totalCartCount}
        cartTotalRupees={totalCartRupees}
        wishlistCount={wishlistCount}
        currentSearch={currentSearch}
        activeCategory={selectedCategory}
        categories={categories}
        userName={userName}
        isLoggedIn={isLoggedIn}
      />

      {/* Toast Notification Popup */}
      {toastMessage && (
        <div className="fixed top-24 md:top-28 right-4 z-50 animate-slide-in pointer-events-none">
          <div className="bg-primary text-on-primary px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs sm:text-sm font-semibold border border-primary-container">
            <span className="material-symbols-outlined text-[18px] text-secondary-fixed">check_circle</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="w-full pt-48 md:pt-40 pb-20 md:pb-8 bg-surface flex-1">
        {/* 2. Sliding Promotional Hero Carousel (Loaded from Backend Banners) */}
        {!currentSearch && !selectedCategory && !selectedCompany && (
          <StoreBannerCarousel banners={banners} />
        )}

        {/* 3. Regional Guarantee Strip */}
        <TrustRegionalStrip />

        {/* 4. Shop by Category (Zepto / Blinkit Visual Category Explorer) */}
        <section id="categories" className="max-w-[1280px] mx-auto px-3 sm:px-4 lg:px-8 pt-5 pb-3">
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[20px]">category</span>
              </div>
              <div>
                <h2 className="font-headline text-base sm:text-lg lg:text-xl font-bold text-on-surface leading-none">
                  Shop by Category
                </h2>
                <p className="text-[11px] text-on-surface-variant font-medium mt-0.5 hidden sm:block">
                  Explore {categories.length} FMCG &amp; grocery aisles with real-time warehouse stock
                </p>
              </div>
            </div>

            {selectedCategory && (
              <button
                onClick={() => handleCategorySelect("")}
                className="px-3 py-1.5 rounded-full text-xs font-bold text-primary bg-primary/10 hover:bg-primary hover:text-white transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <span>View All Aisles</span>
                <span className="material-symbols-outlined text-[13px]">close</span>
              </button>
            )}
          </div>

          {/* Blinkit/Zepto Category Rail with Floating Desktop Navigation Arrows */}
          <div className="relative group">
            {/* Left Floating Arrow Button */}
            <button
              type="button"
              onClick={() => scrollCategories(-340)}
              aria-label="Scroll categories left"
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-20 w-9 h-9 rounded-full bg-surface-container-lowest/95 backdrop-blur-md border border-outline-variant/60 shadow-md flex items-center justify-center text-on-surface hover:bg-primary hover:text-white transition-all active:scale-90 hidden md:flex cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>

            {/* Right Floating Arrow Button */}
            <button
              type="button"
              onClick={() => scrollCategories(340)}
              aria-label="Scroll categories right"
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-20 w-9 h-9 rounded-full bg-surface-container-lowest/95 backdrop-blur-md border border-outline-variant/60 shadow-md flex items-center justify-center text-on-surface hover:bg-primary hover:text-white transition-all active:scale-90 hidden md:flex cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>

            {/* Scrollable Container */}
            <div
              ref={categoryScrollRef}
              className="flex items-start gap-3 sm:gap-4 overflow-x-auto pb-3 pt-1 scrollbar-none px-1 scroll-smooth snap-x"
            >
              {/* All Staples Master Tile */}
              <button
                onClick={() => handleCategorySelect("")}
                className="group flex flex-col items-center shrink-0 w-[80px] sm:w-[96px] md:w-[104px] text-center transition-all focus:outline-none snap-start cursor-pointer"
              >
                <div
                  className={`w-[74px] h-[74px] sm:w-[90px] sm:h-[90px] md:w-[98px] md:h-[98px] rounded-2xl sm:rounded-3xl flex flex-col items-center justify-center p-2.5 transition-all duration-200 border ${
                    !selectedCategory
                      ? "bg-primary text-on-primary border-primary shadow-md scale-102 ring-4 ring-primary/20"
                      : "bg-surface-container-lowest text-on-surface-variant border-outline-variant/40 hover:border-primary/50 hover:bg-surface-container-low hover:shadow-md hover:-translate-y-0.5 shadow-2xs"
                  }`}
                >
                  <span className="material-symbols-outlined text-[32px] sm:text-[36px]" aria-hidden="true">
                    storefront
                  </span>
                </div>
                <span
                  className={`text-[11px] sm:text-xs font-bold mt-2 text-center leading-tight transition-colors line-clamp-1 ${
                    !selectedCategory ? "text-primary font-black" : "text-on-surface group-hover:text-primary"
                  }`}
                >
                  All Staples
                </span>
              </button>

              {/* Dynamic Categories from Database */}
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                const hasProducts = typeof cat.productCount === "number" && cat.productCount > 0;

                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCategorySelect(cat.id)}
                    className="group flex flex-col items-center shrink-0 w-[80px] sm:w-[96px] md:w-[104px] text-center transition-all focus:outline-none snap-start cursor-pointer"
                  >
                    <div
                      className={`w-[74px] h-[74px] sm:w-[90px] sm:h-[90px] md:w-[98px] md:h-[98px] rounded-2xl sm:rounded-3xl flex items-center justify-center p-2.5 relative overflow-hidden transition-all duration-200 border ${
                        isSelected
                          ? "bg-primary/10 border-2 border-primary shadow-md scale-102 ring-4 ring-primary/20"
                          : "bg-surface-container-lowest border-outline-variant/40 hover:border-primary/50 hover:bg-surface-container-low hover:shadow-md hover:-translate-y-0.5 shadow-2xs"
                      }`}
                    >
                      {cat.imageUrl ? (
                        <img
                          src={cat.imageUrl}
                          alt=""
                          aria-hidden="true"
                          className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-110 drop-shadow-xs"
                          loading="lazy"
                        />
                      ) : (
                        <span className="material-symbols-outlined text-[32px] text-primary" aria-hidden="true">
                          category
                        </span>
                      )}

                      {/* Status / Count Badge */}
                      {hasProducts ? (
                        <span
                          aria-hidden="true"
                          className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-surface-container-lowest/95 text-primary border border-primary/20 shadow-2xs leading-none"
                        >
                          {cat.productCount}
                        </span>
                      ) : (
                        <span
                          aria-hidden="true"
                          className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-surface-container-high/90 text-on-surface-variant/80 border border-outline-variant/30 leading-none"
                        >
                          Soon
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[11px] sm:text-xs font-bold mt-2 text-center leading-tight transition-colors line-clamp-2 max-w-[80px] sm:max-w-[96px] ${
                        isSelected ? "text-primary font-black" : "text-on-surface group-hover:text-primary"
                      }`}
                    >
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* 5. Quick Reorder / Frequent Kirana Restock Strip (Placed Below Categories) */}
        {!currentSearch && !selectedCategory && reorderPicks.length > 0 && (
          <section className="max-w-[1280px] mx-auto w-full px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
            <div className="bg-surface-container-low rounded-2xl p-4 sm:p-5 shadow-sm border border-outline-variant/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-[22px]">history</span>
                  <h3 className="font-headline text-sm sm:text-base font-bold text-on-surface">
                    Order Again • Top Kirana Restock Picks
                  </h3>
                </div>
                <span className="text-[11px] text-on-surface-variant font-medium hidden sm:inline">
                  ⚡ 1-Tap Fast Restock
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3">
                {reorderPicks.map((pick) => {
                  const mrp = Math.round(pick.mrpPaise / 100);
                  const price = pick.slabs[0] ? Math.round(pick.slabs[0].unitPricePaise / 100) : mrp;
                  const inCartQty = cartQuantities[pick.id] || 0;

                  return (
                    <div
                      key={pick.id}
                      className="bg-surface-container-lowest p-2.5 sm:p-3 rounded-xl shadow-2xs flex flex-col justify-between border border-outline-variant/30 hover:border-primary/40 transition-colors"
                    >
                      <div className="relative w-full aspect-square bg-surface-container-low rounded-lg mb-2 overflow-hidden flex items-center justify-center p-2 group">
                        <Link
                          href={`/store/products/${pick.id}`}
                          className="w-full h-full flex items-center justify-center"
                        >
                          {pick.imageUrl ? (
                            <img
                              src={pick.imageUrl}
                              alt={pick.name}
                              className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                              loading="lazy"
                            />
                          ) : (
                            <span className="material-symbols-outlined text-[28px] text-outline">inventory_2</span>
                          )}
                        </Link>
                        {/* Wishlist Heart Icon */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleWishlist(pick.id, pick.name, e)}
                          title={wishlistIds.has(pick.id) ? "Saved in Wishlist" : "Add to Wishlist"}
                          aria-label={wishlistIds.has(pick.id) ? "Remove from Wishlist" : "Add to Wishlist"}
                          className="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-full bg-surface-container-lowest/90 backdrop-blur-xs flex items-center justify-center border border-outline-variant/40 shadow-xs hover:scale-110 active:scale-90 transition-all pointer-events-auto"
                        >
                          <span
                            className={`material-symbols-outlined text-[15px] transition-colors ${
                              wishlistIds.has(pick.id) ? "text-red-500" : "text-outline hover:text-red-500"
                            }`}
                            style={{
                              fontVariationSettings: wishlistIds.has(pick.id) ? "'FILL' 1" : "'FILL' 0",
                            }}
                          >
                            favorite
                          </span>
                        </button>
                      </div>
                      <div>
                        <span className="text-[10px] text-secondary font-bold truncate block">
                          {pick.companyName || "JMD"} • {pick.weight || ""}
                        </span>
                        <Link
                          href={`/store/products/${pick.id}`}
                          className="font-bold text-xs text-on-surface hover:text-primary transition-colors line-clamp-1 block mt-0.5"
                          title={pick.name}
                        >
                          {pick.name}
                        </Link>
                        <div className="flex items-baseline justify-between mt-1 mb-2">
                          <span className="font-headline text-xs sm:text-sm font-bold text-primary">₹{price}</span>
                          {mrp > price && (
                            <span className="text-[10px] text-outline line-through">₹{mrp}</span>
                          )}
                        </div>
                      </div>

                      {inCartQty === 0 ? (
                        <button
                          onClick={() => handleAddToCart(pick)}
                          className="w-full py-1.5 bg-secondary-fixed text-on-secondary-fixed hover:bg-secondary hover:text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 shadow-2xs active:scale-95"
                        >
                          <span className="material-symbols-outlined text-[15px]">add</span> Add
                        </button>
                      ) : (
                        <div className="flex items-center justify-between bg-primary text-on-primary rounded-lg p-0.5">
                          <button
                            onClick={() => handleUpdateQty(pick.id, -1)}
                            className="w-6 h-6 flex items-center justify-center hover:bg-primary-container rounded"
                          >
                            <span className="material-symbols-outlined text-[13px]">remove</span>
                          </button>
                          <span className="text-xs font-bold">{inCartQty}</span>
                          <button
                            onClick={() => handleUpdateQty(pick.id, 1)}
                            className="w-6 h-6 flex items-center justify-center hover:bg-primary-container rounded"
                          >
                            <span className="material-symbols-outlined text-[13px]">add</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* 6. Main Catalog & Products Grid */}
        <section id="products-grid" className="max-w-[1280px] mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
          {/* Active Filter Bar & Controls */}
          <div className="bg-surface-container-lowest rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 border border-outline-variant/40 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              {/* Brand Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-on-surface-variant font-medium">Brand:</span>
                <select
                  value={selectedCompany}
                  onChange={(e) => handleCompanyChange(e.target.value)}
                  className="bg-surface-container-low border border-outline-variant/60 rounded-lg px-2.5 py-1.5 font-bold text-xs text-on-surface focus:outline-none focus:border-primary"
                >
                  <option value="">All Brands</option>
                  {companies.map((comp) => (
                    <option key={comp.id} value={comp.id}>
                      {comp.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* In-Stock Toggle */}
              <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer text-xs font-semibold text-on-surface">
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

          {/* Zepto / Blinkit Category Shelves vs Filtered Grid */}
          {!selectedCategory && !currentSearch && !selectedCompany ? (
            <div className="space-y-8 sm:space-y-10">
              {categories.map((cat) => {
                const shelfProducts = categoryShelves.get(cat.id) || [];
                if (shelfProducts.length === 0) return null;

                return (
                  <div key={cat.id} className="space-y-3.5">
                    {/* Shelf Header */}
                    <div className="flex items-center justify-between border-b border-outline-variant/30 pb-2.5">
                      <div className="flex items-center gap-2.5">
                        {cat.imageUrl && (
                          <div className="w-8 h-8 rounded-lg bg-surface-container-low p-1 overflow-hidden border border-outline-variant/30 flex items-center justify-center shrink-0">
                            <img
                              src={cat.imageUrl}
                              alt={cat.name}
                              className="w-full h-full object-contain"
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <h3 className="font-headline text-base sm:text-lg font-bold text-on-surface">
                            {cat.name}
                          </h3>
                          <span className="text-[11px] font-semibold text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded-full border border-outline-variant/30">
                            {cat.productCount || shelfProducts.length} items
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleCategorySelect(cat.id)}
                        className="text-xs font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1 group py-1 px-2.5 rounded-lg hover:bg-primary/5"
                      >
                        <span>See all</span>
                        <span className="material-symbols-outlined text-[15px] group-hover:translate-x-0.5 transition-transform">
                          arrow_forward
                        </span>
                      </button>
                    </div>

                    {/* Shelf Products Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                      {shelfProducts.map((product) => renderProductCard(product, true))}
                    </div>
                  </div>
                );
              })}

              {/* Uncategorized Products Shelf (if any) */}
              {(categoryShelves.get("uncategorized")?.length || 0) > 0 && (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between border-b border-outline-variant/30 pb-2.5">
                    <h3 className="font-headline text-base sm:text-lg font-bold text-on-surface">
                      Other Kirana Staples
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                    {categoryShelves.get("uncategorized")!.map((product) =>
                      renderProductCard(product, true)
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : sortedProducts.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 p-8 sm:p-12 text-center space-y-4 shadow-2xs">
              {selectedCategoryData ? (
                <>
                  <div className="w-20 h-20 mx-auto rounded-3xl bg-surface-container-low p-3 border border-outline-variant/40 shadow-xs flex items-center justify-center">
                    {selectedCategoryData.imageUrl ? (
                      <img
                        src={selectedCategoryData.imageUrl}
                        alt={selectedCategoryData.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="material-symbols-outlined text-4xl text-primary">inventory_2</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-headline text-lg sm:text-xl font-bold text-on-surface">
                      {selectedCategoryData.name} • Stock Incoming Soon
                    </h3>
                    <p className="text-xs sm:text-sm text-on-surface-variant max-w-md mx-auto leading-relaxed">
                      Fresh wholesale inventory for <strong>{selectedCategoryData.name}</strong> is currently being received at our central godown. Check out top available groceries below.
                    </p>
                  </div>
                  <button
                    onClick={() => handleCategorySelect("")}
                    className="mt-2 px-5 py-2.5 bg-primary text-on-primary text-xs font-bold rounded-xl hover:bg-primary/90 transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">storefront</span>
                    <span>Browse All Active Aisles</span>
                  </button>

                  {/* Immediate Recommended Products so the screen is never dead */}
                  {reorderPicks.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-outline-variant/30 text-left">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-primary text-[20px]">thumb_up</span>
                        <h4 className="font-headline text-sm sm:text-base font-bold text-on-surface">
                          Recommended Ready-to-Ship Kirana Staples
                        </h4>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3">
                        {reorderPicks.map((pick) => renderProductCard(pick, true))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Selected Category Header Banner */}
              {selectedCategoryData && (
                <div className="bg-gradient-to-r from-primary/8 via-surface-container-low to-surface-container-lowest border border-primary/20 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-3.5">
                    {selectedCategoryData.imageUrl && (
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-surface-container-lowest p-2 border border-primary/20 shadow-xs flex items-center justify-center shrink-0">
                        <img
                          src={selectedCategoryData.imageUrl}
                          alt={selectedCategoryData.name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
                          Selected Category Aisle
                        </span>
                        <span className="text-xs text-on-surface-variant font-semibold">
                          {sortedProducts.length} {sortedProducts.length === 1 ? "Product" : "Products"} Available
                        </span>
                      </div>
                      <h2 className="font-headline text-lg sm:text-2xl font-black text-on-surface mt-1">
                        {selectedCategoryData.name}
                      </h2>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCategorySelect("")}
                    className="px-3.5 py-2 rounded-xl border border-outline-variant/60 text-xs font-bold text-on-surface hover:bg-surface-container-low hover:border-primary/40 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">close</span>
                    <span className="hidden sm:inline">View All Categories</span>
                    <span className="sm:hidden">Clear</span>
                  </button>
                </div>
              )}

              {/* Filtered Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {sortedProducts.map((product) => renderProductCard(product, true))}
              </div>
            </div>
          )}

          {/* 6. Production-Grade Pagination Strip */}
          {pagination && (
            <div className="mt-8 pt-6 border-t border-surface-container-high/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-on-surface-variant font-medium">
                Showing{" "}
                <span className="font-bold text-on-surface">
                  {pagination.totalProducts === 0
                    ? 0
                    : (pagination.currentPage - 1) * pagination.pageSize + 1}
                </span>{" "}
                to{" "}
                <span className="font-bold text-on-surface">
                  {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalProducts)}
                </span>{" "}
                of{" "}
                <span className="font-bold text-on-surface">
                  {pagination.totalProducts.toLocaleString("en-IN")}
                </span>{" "}
                products
                {selectedCategory && (
                  <span className="text-primary font-semibold ml-1">
                    in {categories.find((c) => c.id === selectedCategory)?.name || "Category"}
                  </span>
                )}
                {currentSearch && (
                  <span className="text-secondary font-semibold ml-1">
                    matching &quot;{currentSearch}&quot;
                  </span>
                )}
              </div>

              {pagination.totalPages > 1 && (
                <div className="flex items-center gap-1.5 flex-wrap justify-center">
                  {/* Previous Button */}
                  <button
                    type="button"
                    disabled={pagination.currentPage <= 1}
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                    className="px-3 py-1.5 rounded-lg border border-outline-variant/60 text-xs font-bold text-on-surface hover:bg-surface-container-low transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                    <span>Prev</span>
                  </button>

                  {/* Page Numbers */}
                  {getPageNumbers(pagination.currentPage, pagination.totalPages).map((p, idx) =>
                    typeof p === "number" ? (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handlePageChange(p)}
                        className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-all shadow-2xs ${
                          p === pagination.currentPage
                            ? "bg-primary text-white shadow-xs"
                            : "bg-surface-container-lowest border border-outline-variant/60 text-on-surface hover:bg-surface-container-low"
                        }`}
                      >
                        {p}
                      </button>
                    ) : (
                      <span key={`dots-${idx}`} className="px-1 text-xs text-outline">
                        ...
                      </span>
                    )
                  )}

                  {/* Next Button */}
                  <button
                    type="button"
                    disabled={pagination.currentPage >= pagination.totalPages}
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                    className="px-3 py-1.5 rounded-lg border border-outline-variant/60 text-xs font-bold text-on-surface hover:bg-surface-container-low transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 shadow-2xs"
                  >
                    <span>Next</span>
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* 7. Floating Cart Bar when items are selected */}
      <FloatingCartBar
        totalPieces={totalCartCount}
        totalRupees={totalCartRupees}
        savingsRupees={totalSavingsRupees}
      />

      {/* 8. Master Footer */}
      <StoreFooter />
    </div>
  );
}

function getPageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, "...", total];
  }
  if (current >= total - 3) {
    return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, "...", current - 1, current, current + 1, "...", total];
}
