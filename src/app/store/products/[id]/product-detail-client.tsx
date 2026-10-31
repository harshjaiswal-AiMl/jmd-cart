"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StoreProductItem } from "@/modules/store/store.service";
import { addToCartAction } from "@/app/store/cart/actions";
import { toggleWishlistAction } from "@/app/store/wishlist/actions";
import { StoreHeader } from "@/components/store/StoreHeader";
import { StoreFooter } from "@/components/store/StoreFooter";
import { formatPaise, paiseToRupees } from "@/lib/format-price";

interface ProductDetailClientProps {
  product: StoreProductItem;
  relatedProducts: StoreProductItem[];
  categories: Array<{ id: string; name: string }>;
  isLoggedIn?: boolean;
  userName?: string;
  initialInWishlist?: boolean;
  wishlistCount?: number;
  cartSummary?: {
    totalPieces: number;
    itemsCount: number;
    totalPaise: number;
  };
}

export function ProductDetailClient({
  product,
  relatedProducts = [],
  categories = [],
  isLoggedIn = false,
  userName = "",
  initialInWishlist = false,
  wishlistCount = 0,
  cartSummary = { totalPieces: 0, itemsCount: 0, totalPaise: 0 },
}: ProductDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedQty, setSelectedQty] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [cartState, setCartState] = useState(cartSummary);
  const [inWishlist, setInWishlist] = useState<boolean>(initialInWishlist);
  const [headerWishlistCount, setHeaderWishlistCount] = useState<number>(wishlistCount);

  const handleToggleWishlist = () => {
    if (!isLoggedIn) {
      router.push(`/login?callbackUrl=/store/products/${product.id}`);
      return;
    }

    const wasIn = inWishlist;
    setInWishlist(!wasIn);
    setHeaderWishlistCount((prev) => (wasIn ? Math.max(0, prev - 1) : prev + 1));
    setToastMessage(wasIn ? "Removed from Wishlist" : "Saved to Wishlist ❤️");
    setTimeout(() => setToastMessage(null), 3000);

    startTransition(async () => {
      try {
        const res = await toggleWishlistAction(product.id);
        if (res.success) {
          setHeaderWishlistCount(res.count);
        }
      } catch (e) {
        console.error(e);
      }
    });
  };

  const packSize = Math.max(1, product.packSize);
  const mrpRupees = formatPaise(product.mrpPaise);
  const basePricePaise = product.unitPricePaise ?? product.mrpPaise ?? 0;

  // Accurate Slab & Tier Price Resolution:
  const getUnitPricePaiseForQty = (qty: number): number => {
    if (!product.slabs || product.slabs.length === 0) {
      return basePricePaise;
    }
    const matching = product.slabs.filter((s) => s.minQty <= qty);
    if (matching.length === 0) {
      return basePricePaise;
    }
    const winner = matching[matching.length - 1];
    return winner.unitPricePaise > 0
      ? Math.min(basePricePaise, winner.unitPricePaise)
      : basePricePaise;
  };

  const getActiveSlabForQty = (qty: number) => {
    if (!product.slabs || product.slabs.length === 0) return null;
    const matching = product.slabs.filter((s) => s.minQty <= qty);
    return matching.length > 0 ? matching[matching.length - 1] : null;
  };

  const activeSlab = getActiveSlabForQty(selectedQty);
  const unitSellingPaise = getUnitPricePaiseForQty(selectedQty);
  const unitSellingRupees = formatPaise(unitSellingPaise);
  const totalAmountPaise = unitSellingPaise * selectedQty;
  const totalAmountRupees = formatPaise(totalAmountPaise);
  const perUnitSavingsPaise = Math.max(0, product.mrpPaise - unitSellingPaise);
  const perUnitSavingsRupees = formatPaise(perUnitSavingsPaise);
  const savingsPct =
    product.mrpPaise > 0 && product.mrpPaise > unitSellingPaise
      ? Math.round(((product.mrpPaise - unitSellingPaise) / product.mrpPaise) * 100)
      : 0;

  const packThreshold = product.slabs?.[1]?.minQty || 4;
  const cartonThreshold = product.slabs?.[2]?.minQty || Math.max(10, packSize);

  const s1UnitPricePaise = getUnitPricePaiseForQty(1);
  const s2UnitPricePaise = getUnitPricePaiseForQty(packThreshold);
  const s3UnitPricePaise = getUnitPricePaiseForQty(cartonThreshold);

  const s1Rate = formatPaise(s1UnitPricePaise);
  const s2Rate = formatPaise(s2UnitPricePaise);
  const s3Rate = formatPaise(s3UnitPricePaise);

  const s1DiscountPct =
    product.mrpPaise > 0 && product.mrpPaise > s1UnitPricePaise
      ? Math.round(((product.mrpPaise - s1UnitPricePaise) / product.mrpPaise) * 100)
      : 0;
  const s2DiscountPct =
    product.mrpPaise > 0 && product.mrpPaise > s2UnitPricePaise
      ? Math.round(((product.mrpPaise - s2UnitPricePaise) / product.mrpPaise) * 100)
      : 0;
  const s3DiscountPct =
    product.mrpPaise > 0 && product.mrpPaise > s3UnitPricePaise
      ? Math.round(((product.mrpPaise - s3UnitPricePaise) / product.mrpPaise) * 100)
      : 0;

  // Next-slab unlock nudge
  let nextSlabNudge: {
    qtyNeeded: number;
    nextTierName: string;
    nextDiscountPct: number;
    nextRateRupees: string;
    extraSaveRupees: string;
  } | null = null;

  if (selectedQty < packThreshold && s2DiscountPct > s1DiscountPct) {
    const qtyNeeded = packThreshold - selectedQty;
    const extraSaveRupees = formatPaise(s1UnitPricePaise - s2UnitPricePaise);
    nextSlabNudge = {
      qtyNeeded,
      nextTierName: "Kirana Pack",
      nextDiscountPct: s2DiscountPct,
      nextRateRupees: s2Rate,
      extraSaveRupees,
    };
  } else if (selectedQty >= packThreshold && selectedQty < cartonThreshold && s3DiscountPct > s2DiscountPct) {
    const qtyNeeded = cartonThreshold - selectedQty;
    const extraSaveRupees = formatPaise(s2UnitPricePaise - s3UnitPricePaise);
    nextSlabNudge = {
      qtyNeeded,
      nextTierName: `Full ${product.packLabel || "Carton"}`,
      nextDiscountPct: s3DiscountPct,
      nextRateRupees: s3Rate,
      extraSaveRupees,
    };
  }

  const handleAddToCart = (qtyToAdd: number) => {
    if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem("jmd_local_cart");
        const parsed = saved ? JSON.parse(saved) : {};
        parsed[product.id] = (parsed[product.id] || 0) + qtyToAdd;
        window.localStorage.setItem("jmd_local_cart", JSON.stringify(parsed));
      } catch (e) {
        // ignore
      }
    }

    setCartState((prev) => ({
      totalPieces: prev.totalPieces + qtyToAdd,
      itemsCount: prev.itemsCount + 1,
      totalPaise: prev.totalPaise + unitSellingPaise * qtyToAdd,
    }));
    setToastMessage(`✓ Added ${qtyToAdd}x ${product.name} to cart`);
    setTimeout(() => setToastMessage(null), 3000);

    if (isLoggedIn) {
      startTransition(async () => {
        try {
          await addToCartAction(product.id, qtyToAdd);
        } catch (e) {
          // ignore
        }
      });
    }
  };

  const handleBuyNow = (qtyToAdd: number) => {
    handleAddToCart(qtyToAdd);
    router.push("/store/checkout");
  };

  const handleRelatedQuickAdd = (p: StoreProductItem) => {
    if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem("jmd_local_cart");
        const parsed = saved ? JSON.parse(saved) : {};
        parsed[p.id] = (parsed[p.id] || 0) + 1;
        window.localStorage.setItem("jmd_local_cart", JSON.stringify(parsed));
      } catch (e) {
        // ignore
      }
    }

    setCartState((prev) => ({
      totalPieces: prev.totalPieces + 1,
      itemsCount: prev.itemsCount + 1,
      totalPaise: prev.totalPaise + (p.unitPricePaise || p.mrpPaise),
    }));
    setToastMessage(`✓ Added ${p.name} to cart`);
    setTimeout(() => setToastMessage(null), 3000);

    if (isLoggedIn) {
      startTransition(async () => {
        try {
          await addToCartAction(p.id, 1);
        } catch (e) {
          // ignore
        }
      });
    }
  };

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface antialiased flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-tertiary text-on-tertiary px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 animate-fade-in text-sm font-semibold border border-tertiary-fixed">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Store Header */}
      <StoreHeader
        cartCount={cartState.itemsCount}
        cartTotalRupees={paiseToRupees(cartState.totalPaise)}
        wishlistCount={headerWishlistCount}
        userName={userName}
        isLoggedIn={isLoggedIn}
        categories={categories}
        activeCategory={product.categoryId || ""}
      />

      <main className="flex-1 w-full pt-48 md:pt-40 pb-24 md:pb-12 bg-surface">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-on-surface-variant overflow-x-auto whitespace-nowrap py-1">
            <Link href="/" className="hover:text-primary transition-colors flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">home</span>
              <span>Home</span>
            </Link>
            <span className="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
            <Link href="/store" className="hover:text-primary transition-colors">
              Catalogue
            </Link>
            {product.categoryName && (
              <>
                <span className="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
                <Link
                  href={`/store?category=${product.categoryId}`}
                  className="hover:text-primary transition-colors"
                >
                  {product.categoryName}
                </Link>
              </>
            )}
            <span className="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
            <span className="text-on-surface font-semibold truncate max-w-xs">{product.name}</span>
          </nav>

          {/* Product Detail Two-Column Showcase */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* LEFT COLUMN: Packshot & Trust Badges (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-xs border border-surface-container-high relative flex flex-col items-center">
                {/* Product Image Stage */}
                <div className="relative w-full aspect-square bg-surface-container-low rounded-xl overflow-hidden flex items-center justify-center p-6 group">
                  {/* Heart Wishlist Button */}
                  <button
                    type="button"
                    onClick={handleToggleWishlist}
                    className="absolute top-3 right-3 z-20 w-10 h-10 rounded-full bg-surface-container-lowest/90 backdrop-blur-xs flex items-center justify-center border border-outline-variant/40 shadow-xs hover:scale-110 active:scale-95 transition-all"
                    title={inWishlist ? "Saved in Wishlist" : "Save to Wishlist"}
                  >
                    <span
                      className={`material-symbols-outlined text-[22px] transition-colors ${
                        inWishlist ? "text-red-500 fill-1" : "text-outline hover:text-red-500"
                      }`}
                      style={{
                        fontVariationSettings: inWishlist ? "'FILL' 1" : "'FILL' 0",
                      }}
                    >
                      favorite
                    </span>
                  </button>

                  {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-outline-variant">
                      <span className="material-symbols-outlined text-7xl text-primary/30 mb-2">inventory_2</span>
                      <span className="text-xs font-bold uppercase tracking-wider text-outline font-mono">
                        {product.shortCode}
                      </span>
                      {product.companyName && (
                        <span className="text-xs font-semibold text-on-surface-variant mt-1">
                          {product.companyName}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Stock Status Pill */}
                <div className="mt-3.5 w-full flex items-center justify-between text-xs px-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        product.isAvailable ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                      }`}
                    />
                    <span className="font-semibold text-on-surface">
                      {product.isAvailable ? "In Stock (Ready to Dispatch)" : "Currently Out of Stock"}
                    </span>
                  </div>
                  {product.weight && (
                    <span className="text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded text-[11px] font-medium">
                      Net Wt: {product.weight}
                    </span>
                  )}
                </div>
              </div>

              {/* Trust Badges */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-surface-container-lowest rounded-xl p-3 text-center border border-surface-container-high flex flex-col items-center justify-center">
                  <span className="material-symbols-outlined text-secondary text-[22px] mb-1">local_shipping</span>
                  <span className="text-xs font-bold text-on-surface">Express Delivery</span>
                  <span className="text-[11px] text-on-surface-variant">Same day in Saharsa</span>
                </div>
                <div className="bg-surface-container-lowest rounded-xl p-3 text-center border border-surface-container-high flex flex-col items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-[22px] mb-1">verified_user</span>
                  <span className="text-xs font-bold text-on-surface">100% Genuine</span>
                  <span className="text-[11px] text-on-surface-variant">Direct from brand</span>
                </div>
                <div className="bg-surface-container-lowest rounded-xl p-3 text-center border border-surface-container-high flex flex-col items-center justify-center">
                  <span className="material-symbols-outlined text-tertiary text-[22px] mb-1">receipt_long</span>
                  <span className="text-xs font-bold text-on-surface">GST Invoice</span>
                  <span className="text-[11px] text-on-surface-variant">B2B ITC eligible</span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Product Info, Packaging Variants, Pricing & Actions (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              {/* Product Header */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {product.companyName && (
                    <span className="text-xs font-bold text-primary tracking-wider uppercase bg-primary/10 px-2.5 py-0.5 rounded-full">
                      {product.companyName}
                    </span>
                  )}
                  {product.categoryName && (
                    <Link
                      href={`/store?categoryId=${product.categoryId || ""}`}
                      className="text-xs text-on-surface-variant hover:text-primary bg-surface-container-low hover:bg-primary/10 transition-colors px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 font-semibold border border-outline-variant/40 shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[13px] text-primary">category</span>
                      <span>{product.categoryName}</span>
                    </Link>
                  )}
                  <span className="text-xs text-outline font-mono">SKU: {product.shortCode}</span>
                </div>

                <h1 className="font-headline text-2xl lg:text-3xl text-on-surface font-extrabold tracking-tight mt-0.5">
                  {product.name}
                </h1>

                {/* Rating & Guarantee */}
                <div className="flex items-center gap-2.5 mt-1 text-xs">
                  <div className="flex items-center gap-1 bg-amber-500/10 text-amber-700 px-2 py-0.5 rounded font-bold">
                    <span className="material-symbols-outlined text-[15px] text-amber-500 fill-1">star</span>
                    <span>4.8</span>
                  </div>
                  <span className="text-on-surface-variant">Verified Quality</span>
                  <span className="text-outline">•</span>
                  <span className="text-emerald-700 font-medium flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px]">verified</span> Genuine Product
                  </span>
                </div>
              </div>

              {/* Packaging / Quantity Tier Options */}
              <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-xs border border-surface-container-high">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Select Packaging Unit / Volume Slab:
                  </span>
                  <span className="text-xs font-semibold text-secondary">
                    Automatic tier discount applies
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Single Unit */}
                  <button
                    type="button"
                    onClick={() => setSelectedQty(1)}
                    className={`relative text-left p-3 rounded-xl border transition-all cursor-pointer ${
                      selectedQty < packThreshold
                        ? "bg-primary-fixed/20 border-primary ring-1 ring-primary shadow-xs"
                        : "bg-surface-container-low border-transparent hover:bg-surface-container"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs font-bold text-on-surface">Single Unit</div>
                        <div className="text-[11px] text-on-surface-variant mt-0.5">
                          {product.weight || "1 Piece"}
                        </div>
                      </div>
                      {selectedQty < packThreshold && (
                        <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                      )}
                    </div>
                    <div className="mt-2 text-sm font-bold text-primary font-mono">
                      ₹{s1Rate}
                      <span className="text-[11px] text-outline line-through ml-1.5 font-normal">
                        ₹{mrpRupees}
                      </span>
                    </div>
                    {s1DiscountPct > 0 && (
                      <div className="mt-1.5">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200/60">
                          {s1DiscountPct}% OFF
                        </span>
                      </div>
                    )}
                  </button>

                  {/* Retailer Pack */}
                  <button
                    type="button"
                    onClick={() => setSelectedQty(packThreshold)}
                    className={`relative text-left p-3 rounded-xl border transition-all cursor-pointer ${
                      selectedQty >= packThreshold && selectedQty < cartonThreshold
                        ? "bg-primary-fixed/20 border-primary ring-1 ring-primary shadow-xs"
                        : "bg-surface-container-low border-transparent hover:bg-surface-container"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-on-surface">Kirana Pack</span>
                          <span className="bg-secondary text-white px-1.5 py-0.5 rounded text-[10px] font-bold shadow-2xs shrink-0">
                            Retailer Pack
                          </span>
                        </div>
                        <div className="text-[11px] text-on-surface-variant mt-0.5">
                          {packThreshold}+ units
                        </div>
                      </div>
                      {selectedQty >= packThreshold && selectedQty < cartonThreshold && (
                        <span className="material-symbols-outlined text-primary text-[18px] shrink-0">check_circle</span>
                      )}
                    </div>
                    <div className="mt-2 text-sm font-bold text-primary font-mono">
                      ₹{s2Rate} <span className="text-[11px] text-on-surface-variant font-normal">/ unit</span>
                    </div>
                    {s2DiscountPct > 0 && (
                      <div className="mt-1.5">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200/60">
                          {s2DiscountPct}% OFF
                        </span>
                      </div>
                    )}
                  </button>

                  {/* Full Carton */}
                  <button
                    type="button"
                    onClick={() => setSelectedQty(cartonThreshold)}
                    className={`relative text-left p-3 rounded-xl border transition-all cursor-pointer ${
                      selectedQty >= cartonThreshold
                        ? "bg-primary-fixed/20 border-primary ring-1 ring-primary shadow-xs"
                        : "bg-surface-container-low border-transparent hover:bg-surface-container"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-on-surface">1 Full {product.packLabel}</span>
                          <span className="bg-emerald-700 text-white px-1.5 py-0.5 rounded text-[10px] font-bold shadow-2xs shrink-0">
                            Best Wholesale
                          </span>
                        </div>
                        <div className="text-[11px] text-on-surface-variant mt-0.5">
                          {cartonThreshold}+ units
                        </div>
                      </div>
                      {selectedQty >= cartonThreshold && (
                        <span className="material-symbols-outlined text-primary text-[18px] shrink-0">check_circle</span>
                      )}
                    </div>
                    <div className="mt-2 text-sm font-bold text-primary font-mono">
                      ₹{s3Rate} <span className="text-[11px] text-on-surface-variant font-normal">/ unit</span>
                    </div>
                    {s3DiscountPct > 0 && (
                      <div className="mt-1.5">
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px] font-black border border-amber-200">
                          <span>🔥</span> {s3DiscountPct}% OFF
                        </span>
                      </div>
                    )}
                  </button>
                </div>

                {/* Smart Next-Slab Unlock Nudge */}
                {nextSlabNudge && (
                  <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-950 text-xs">
                    <div className="flex items-start sm:items-center gap-2 min-w-0">
                      <span className="material-symbols-outlined text-amber-600 text-[20px] shrink-0 mt-0.5 sm:mt-0">
                        bolt
                      </span>
                      <div className="leading-tight min-w-0">
                        <div>
                          Buy <strong>{nextSlabNudge.qtyNeeded} more</strong> to unlock{" "}
                          <strong>{nextSlabNudge.nextTierName} ({nextSlabNudge.nextDiscountPct}% OFF)</strong>!
                        </div>
                        <span className="block text-[11px] text-amber-800 font-medium mt-0.5">
                          Rate drops to ₹{nextSlabNudge.nextRateRupees}/unit (Save ₹{nextSlabNudge.extraSaveRupees} extra/pc)
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedQty((prev) => prev + nextSlabNudge!.qtyNeeded)}
                      className="self-end sm:self-auto shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shadow-2xs transition-transform active:scale-95 cursor-pointer"
                    >
                      + Add {nextSlabNudge.qtyNeeded}
                    </button>
                  </div>
                )}
              </div>

              {/* Price & Cart Actions Block */}
              <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-surface-container-high flex flex-col gap-4">
                {/* Price Display */}
                <div>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="font-headline text-3xl font-extrabold text-primary">
                      ₹{unitSellingRupees}
                    </span>
                    <span className="text-base text-outline line-through">MRP ₹{mrpRupees}</span>
                    {savingsPct > 0 && (
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs px-2.5 py-0.5 rounded-full font-bold">
                        Save ₹{perUnitSavingsRupees} ({savingsPct}% Off)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant mt-1.5 flex-wrap">
                    <span>Inclusive of all taxes</span>
                    <span className="text-outline">•</span>
                    <span className="text-tertiary font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px]">receipt</span>
                      {(product.gstRateBp / 100).toFixed(0)}% GST included
                    </span>
                  </div>
                </div>

                {/* Applied Pricing Tier Status */}
                <div className="pt-3 border-t border-surface-container flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-1.5 text-on-surface-variant flex-wrap min-w-0">
                    <span className="material-symbols-outlined text-secondary text-[18px] shrink-0">verified</span>
                    <span className="shrink-0">Applied Price:</span>
                    <strong className="text-on-surface font-semibold flex items-center gap-1 flex-wrap">
                      {selectedQty >= cartonThreshold ? (
                        <span className="text-amber-900 font-bold bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px] text-amber-600">military_tech</span>
                          Wholesale Carton Slab ({s3DiscountPct}% OFF)
                        </span>
                      ) : selectedQty >= packThreshold ? (
                        <span className="text-emerald-900 font-bold bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px] text-emerald-600">store</span>
                          Kirana Retailer Slab ({s2DiscountPct}% OFF)
                        </span>
                      ) : (
                        <span className="text-primary font-bold bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                          Customer Rate {s1DiscountPct > 0 ? `(${s1DiscountPct}% OFF)` : ""}
                        </span>
                      )}
                    </strong>
                  </div>
                  <span className="text-primary font-mono font-bold text-sm shrink-0">
                    Total: ₹{totalAmountRupees}
                  </span>
                </div>

                {/* Quantity Stepper & Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 pt-1">
                  {/* Stepper + Add to Cart Row on Mobile, All Inline on Desktop */}
                  <div className="flex items-center gap-2.5 sm:contents">
                    {/* Stepper */}
                    <div className="flex items-center justify-between bg-surface-container-low rounded-xl p-1 w-32 sm:w-36 shrink-0 border border-surface-container-high">
                      <button
                        type="button"
                        onClick={() => setSelectedQty((prev) => Math.max(1, prev - 1))}
                        className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-surface-container-lowest text-primary hover:bg-primary hover:text-on-primary transition-colors active:scale-95 shadow-xs font-bold text-base sm:text-lg cursor-pointer"
                        title="Decrease quantity"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={product.totalAvailableQty || 500}
                        value={selectedQty}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          setSelectedQty(Math.max(1, Math.min(val, product.totalAvailableQty || 500)));
                        }}
                        className="w-10 sm:w-12 text-center bg-transparent font-mono text-sm sm:text-base text-on-surface font-bold focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedQty((prev) => Math.min(product.totalAvailableQty || 500, prev + 1))
                        }
                        className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-surface-container-lowest text-primary hover:bg-primary hover:text-on-primary transition-colors active:scale-95 shadow-xs font-bold text-base sm:text-lg cursor-pointer"
                        title="Increase quantity"
                      >
                        +
                      </button>
                    </div>

                    {/* Add to Cart */}
                    <button
                      type="button"
                      disabled={isPending || !product.isAvailable}
                      onClick={() => handleAddToCart(selectedQty)}
                      className="flex-1 bg-surface-container-high hover:bg-surface-container-highest text-primary font-bold text-xs sm:text-sm py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl flex items-center justify-center gap-1.5 sm:gap-2 transition-all active:scale-[0.99] disabled:opacity-50 border border-outline-variant/60 cursor-pointer min-w-0"
                    >
                      <span className="material-symbols-outlined text-[16px] sm:text-[18px]">shopping_cart</span>
                      <span className="truncate">Add to Cart</span>
                    </button>
                  </div>

                  {/* Buy Now (Full width on mobile, 1-flex on desktop) */}
                  <button
                    type="button"
                    disabled={isPending || !product.isAvailable}
                    onClick={() => handleBuyNow(selectedQty)}
                    className="w-full sm:flex-1 bg-primary hover:bg-primary-container text-on-primary font-bold text-xs sm:text-sm py-2.5 sm:py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px] sm:text-[18px]">bolt</span>
                    <span>Buy Now</span>
                    <span className="opacity-40">•</span>
                    <span className="font-mono">₹{totalAmountRupees}</span>
                  </button>
                </div>

                {/* Bulk WhatsApp Link */}
                <div className="pt-1 flex items-center justify-between flex-wrap gap-2 text-xs border-t border-surface-container-high">
                  <a
                    href={`https://wa.me/916278223400?text=Namaste%2C%20I%20want%20to%20order%20bulk%20${encodeURIComponent(product.name)}%20in%20Saharsa`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold hover:underline"
                  >
                    <span className="material-symbols-outlined text-[17px]">chat</span>
                    <span>Buying 20+ cartons? Contact Bulk Sales Desk</span>
                  </a>
                  <span className="text-on-surface-variant">Fast dispatch across Saharsa</span>
                </div>
              </div>

              {/* Delivery Promise Card */}
              <div className="bg-surface-container-low rounded-xl p-3.5 flex items-center justify-between gap-3 border border-surface-container-high text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-secondary text-[22px]">local_shipping</span>
                  <div>
                    <span className="font-semibold text-on-surface block">Express Delivery in Saharsa</span>
                    <span className="text-on-surface-variant text-[11px]">
                      Orders delivered directly to your doorstep or retail store
                    </span>
                  </div>
                </div>
                <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap">
                  Same-Day Dispatch
                </span>
              </div>
            </div>
          </div>

          {/* Product Specifications & Slabs Tabs */}
          <div className="bg-surface-container-lowest rounded-2xl p-5 md:p-6 shadow-xs border border-surface-container-high">
            {/* Tab Navigation */}
            <div className="flex items-center gap-2 border-b border-surface-container-high overflow-x-auto pb-2">
              {[
                { title: "Product Specifications", icon: "tune" },
                { title: "Volume Pricing & Slabs", icon: "layers" },
                { title: "Delivery & Returns", icon: "local_shipping" },
              ].map((tab, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveTab(idx)}
                  className={`text-xs font-bold px-4 py-2 rounded-xl transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                    activeTab === idx
                      ? "text-primary bg-primary-fixed/30 border border-primary-fixed shadow-2xs"
                      : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                  <span>{tab.title}</span>
                </button>
              ))}
            </div>

            {/* Tab Content 0: Product Specs */}
            {activeTab === 0 && (
              <div className="pt-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-surface-container-low/60 rounded-xl p-4 border border-surface-container-high space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-surface-container">
                      <span className="text-on-surface-variant font-medium">Brand / Manufacturer</span>
                      <strong className="text-on-surface">{product.companyName || "Standard FMCG"}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-surface-container">
                      <span className="text-on-surface-variant font-medium">Net Weight / Volume</span>
                      <strong className="text-on-surface">{product.weight || "Standard Pack"}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-surface-container">
                      <span className="text-on-surface-variant font-medium">Carton / Master Pack</span>
                      <strong className="text-on-surface">{packSize} pcs per {product.packLabel}</strong>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-on-surface-variant font-medium">Category</span>
                      <strong className="text-on-surface">{product.categoryName || "Groceries"}</strong>
                    </div>
                  </div>

                  <div className="bg-surface-container-low/60 rounded-xl p-4 border border-surface-container-high space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-surface-container">
                      <span className="text-on-surface-variant font-medium">HSN Code</span>
                      <strong className="text-on-surface font-mono">{product.hsn}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-surface-container">
                      <span className="text-on-surface-variant font-medium">Applicable GST Rate</span>
                      <strong className="text-on-surface">{(product.gstRateBp / 100).toFixed(0)}%</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-surface-container">
                      <span className="text-on-surface-variant font-medium">Product Code / SKU</span>
                      <strong className="text-on-surface font-mono">{product.shortCode}</strong>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-on-surface-variant font-medium">Quality Verification</span>
                      <strong className="text-emerald-700">100% Genuine Sealed Stock</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab Content 1: Volume Pricing & Slabs */}
            {activeTab === 1 && (
              <div className="pt-5 space-y-4">
                {/* Mobile Card View (Zero horizontal scroll on small phones) */}
                <div className="md:hidden space-y-2.5">
                  <div
                    className={`p-3 rounded-xl border transition-all ${
                      selectedQty < packThreshold
                        ? "bg-primary-fixed/20 border-primary shadow-xs"
                        : "bg-surface-container-low border-surface-container-high"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-on-surface">🛒 Single Retail Pack</span>
                      <span className="font-mono font-bold text-primary text-sm">₹{s1Rate} /pc</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-on-surface-variant mt-1.5 pt-1.5 border-t border-surface-container">
                      <span>Quantity: 1 to {packThreshold - 1} Units</span>
                      <span className="font-semibold text-emerald-700">
                        Save ₹{formatPaise(Math.max(0, product.mrpPaise - getUnitPricePaiseForQty(1)))} /pc
                      </span>
                    </div>
                  </div>

                  <div
                    className={`p-3 rounded-xl border transition-all ${
                      selectedQty >= packThreshold && selectedQty < cartonThreshold
                        ? "bg-primary-fixed/20 border-primary shadow-xs"
                        : "bg-surface-container-low border-surface-container-high"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-on-surface">🏪 Kirana Retailer Pack</span>
                      <span className="font-mono font-bold text-primary text-sm">₹{s2Rate} /pc</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-on-surface-variant mt-1.5 pt-1.5 border-t border-surface-container">
                      <span>Quantity: {packThreshold} to {cartonThreshold - 1} Units</span>
                      <span className="font-semibold text-emerald-700">
                        Save ₹{formatPaise(Math.max(0, product.mrpPaise - getUnitPricePaiseForQty(packThreshold)))} /pc
                      </span>
                    </div>
                  </div>

                  <div
                    className={`p-3 rounded-xl border transition-all ${
                      selectedQty >= cartonThreshold
                        ? "bg-primary-fixed/20 border-primary shadow-xs"
                        : "bg-surface-container-low border-surface-container-high"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-on-surface">📦 Wholesale Full {product.packLabel}</span>
                      <span className="font-mono font-bold text-primary text-sm">₹{s3Rate} /pc</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-on-surface-variant mt-1.5 pt-1.5 border-t border-surface-container">
                      <span>Quantity: {cartonThreshold}+ Units</span>
                      <span className="font-semibold text-emerald-700">
                        Save ₹{formatPaise(Math.max(0, product.mrpPaise - getUnitPricePaiseForQty(cartonThreshold)))} /pc
                      </span>
                    </div>
                  </div>
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-surface-container-high text-on-surface-variant uppercase text-[11px]">
                        <th className="py-2.5 px-3">Order Quantity</th>
                        <th className="py-2.5 px-3">Price / Unit</th>
                        <th className="py-2.5 px-3">Savings off MRP</th>
                        <th className="py-2.5 px-3">Target Customer</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container">
                      <tr className={selectedQty < packThreshold ? "bg-primary-fixed/20 font-semibold" : ""}>
                        <td className="py-2.5 px-3">1 to {packThreshold - 1} Units</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-primary">₹{s1Rate}</td>
                        <td className="py-2.5 px-3 text-on-surface-variant">
                          ₹{formatPaise(Math.max(0, product.mrpPaise - getUnitPricePaiseForQty(1)))}/unit
                        </td>
                        <td className="py-2.5 px-3 text-on-surface-variant">Household / Retail Consumer</td>
                      </tr>
                      <tr
                        className={
                          selectedQty >= packThreshold && selectedQty < cartonThreshold
                            ? "bg-primary-fixed/20 font-semibold"
                            : ""
                        }
                      >
                        <td className="py-2.5 px-3">{packThreshold} to {cartonThreshold - 1} Units</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-primary">₹{s2Rate}</td>
                        <td className="py-2.5 px-3 text-emerald-700 font-semibold">
                          ₹{formatPaise(Math.max(0, product.mrpPaise - getUnitPricePaiseForQty(packThreshold)))}/unit
                        </td>
                        <td className="py-2.5 px-3 text-on-surface-variant">Kirana Store / Small Retailer</td>
                      </tr>
                      <tr className={selectedQty >= cartonThreshold ? "bg-primary-fixed/20 font-semibold" : ""}>
                        <td className="py-2.5 px-3">{cartonThreshold}+ Units (Full {product.packLabel})</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-primary">₹{s3Rate}</td>
                        <td className="py-2.5 px-3 text-emerald-700 font-semibold">
                          ₹{formatPaise(Math.max(0, product.mrpPaise - getUnitPricePaiseForQty(cartonThreshold)))}/unit
                        </td>
                        <td className="py-2.5 px-3 text-on-surface-variant">Wholesaler / Bulk Catering</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab Content 2: Delivery & Returns */}
            {activeTab === 2 && (
              <div className="pt-5 space-y-3 text-xs text-on-surface-variant leading-relaxed">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-surface-container-low/60 rounded-xl p-4 border border-surface-container-high space-y-2">
                    <h4 className="font-bold text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px] text-primary">local_shipping</span>
                      Delivery Coverage & Timeline
                    </h4>
                    <p>
                      We deliver across Saharsa Town and adjacent wards. In-stock items are dispatched the same day or next morning for fast arrival.
                    </p>
                  </div>

                  <div className="bg-surface-container-low/60 rounded-xl p-4 border border-surface-container-high space-y-2">
                    <h4 className="font-bold text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px] text-emerald-700">verified_user</span>
                      Replacement & Invoicing
                    </h4>
                    <p>
                      All goods are verified prior to dispatch. Transit damages or seal defects will be replaced promptly. Official GST tax invoices are provided for business customers.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Frequently Bought Together / Related Products */}
          {relatedProducts.length > 0 && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-headline text-lg sm:text-xl text-on-surface font-bold">
                    Related Products
                  </h2>
                  <p className="text-xs text-on-surface-variant">
                    Frequently purchased together with this item
                  </p>
                </div>
                <Link
                  href="/store"
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                >
                  View All <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
                {relatedProducts.map((rel) => {
                  const relMrpPaise = rel.mrpPaise || 0;
                  const relPricePaise = rel.unitPricePaise || rel.mrpPaise || 0;
                  const relSavingsPaise = Math.max(0, relMrpPaise - relPricePaise);

                  return (
                    <div
                      key={rel.id}
                      className="bg-surface-container-lowest rounded-xl p-3 shadow-xs border border-surface-container-high hover:shadow-md transition-shadow flex flex-col justify-between group"
                    >
                      <div>
                        <Link
                          href={`/store/products/${rel.id}`}
                          className="block relative w-full aspect-square bg-surface-container-low rounded-lg p-2 overflow-hidden mb-2"
                        >
                          {relSavingsPaise > 0 && (
                            <span className="absolute top-2 left-2 bg-emerald-700 text-white text-[10px] px-1.5 py-0.2 rounded font-bold z-10">
                              Save ₹{formatPaise(relSavingsPaise)}
                            </span>
                          )}
                          {rel.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={rel.imageUrl}
                              alt={rel.name}
                              className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-outline">
                              <span className="material-symbols-outlined text-3xl mb-1 text-primary/40">
                                shopping_basket
                              </span>
                              <span className="text-[10px] font-mono">{rel.shortCode}</span>
                            </div>
                          )}
                        </Link>

                        <div className="text-[11px] text-outline font-medium truncate">
                          {rel.companyName || "JMD Cart"} {rel.weight ? `• ${rel.weight}` : ""}
                        </div>
                        <h3 className="text-xs font-bold text-on-surface line-clamp-1 mt-0.5">
                          <Link
                            href={`/store/products/${rel.id}`}
                            className="hover:text-primary transition-colors"
                          >
                            {rel.name}
                          </Link>
                        </h3>
                      </div>

                      <div className="mt-3 pt-2 border-t border-surface-container flex items-center justify-between gap-1 min-w-0">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs sm:text-sm font-bold text-primary font-mono truncate">₹{formatPaise(relPricePaise)}</div>
                          {relSavingsPaise > 0 && (
                            <div className="text-[10px] sm:text-[11px] text-outline line-through truncate">₹{formatPaise(relMrpPaise)}</div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRelatedQuickAdd(rel)}
                          className="shrink-0 bg-surface-container-high hover:bg-primary hover:text-on-primary text-primary text-[11px] sm:text-xs px-2.5 py-1.5 rounded-lg transition-colors font-bold cursor-pointer"
                        >
                          + ADD
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Mobile Sticky Quick Buy Bar (Fixed at bottom for mobile, uncluttered with z-40) */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface-container-lowest/95 backdrop-blur-md border-t border-surface-container-high px-3 py-2 flex items-center justify-between gap-2 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <div className="min-w-0 shrink-0">
          <div className="text-[10px] text-on-surface-variant font-medium">Total Price</div>
          <div className="font-headline text-base sm:text-lg font-extrabold text-primary font-mono truncate">
            ₹{totalAmountRupees}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            disabled={isPending || !product.isAvailable}
            onClick={() => handleAddToCart(selectedQty)}
            className="px-2.5 sm:px-3 py-2 bg-surface-container-high hover:bg-surface-container-highest text-primary font-bold text-xs rounded-xl border border-outline-variant/60 active:scale-95 cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            + Cart ({selectedQty})
          </button>
          <button
            type="button"
            disabled={isPending || !product.isAvailable}
            onClick={() => handleBuyNow(selectedQty)}
            className="px-3 sm:px-4 py-2 bg-primary hover:bg-primary-container text-on-primary font-bold text-xs rounded-xl shadow-xs flex items-center gap-1 active:scale-95 cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <span>Buy Now</span>
            <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
          </button>
        </div>
      </div>

      {/* Store Footer */}
      <StoreFooter />
    </div>
  );
}
