"use client";

import React from "react";
import Link from "next/link";
import { DiwaliShowcaseData, DiwaliShowcaseShelf } from "@/modules/diwali/diwali.types";
import { StoreProductItem } from "@/modules/store/store.service";
import { formatPaise } from "@/lib/format-price";

interface DiwaliStoreSectionProps {
  showcase: DiwaliShowcaseData;
  cartQuantities: Record<string, number>;
  onAddToCart: (product: StoreProductItem) => void;
  onUpdateQty: (productId: string, delta: number) => void;
  onToggleWishlist?: (productId: string, productName: string, e: React.MouseEvent) => void;
  wishlistIds?: Set<string>;
  updatingId?: string | null;
}

export function DiwaliStoreSection({
  showcase,
  cartQuantities,
  onAddToCart,
  onUpdateQty,
  onToggleWishlist,
  wishlistIds = new Set(),
  updatingId,
}: DiwaliStoreSectionProps) {
  if (!showcase || !showcase.enabled || showcase.shelves.length === 0) {
    return null;
  }

  return (
    <section
      id="diwali-store"
      className="max-w-[1280px] mx-auto px-3 sm:px-4 lg:px-8 pt-2 pb-6"
    >
      {/* Festive Showcase Container */}
      <div className="relative rounded-3xl bg-gradient-to-br from-[#4a0511] via-[#2c0309] to-[#150104] text-white p-4 sm:p-6 lg:p-7 shadow-[0_12px_40px_-10px_rgba(217,119,6,0.35)] border border-amber-500/40 overflow-hidden">
        {/* Decorative Golden Diya & Lantern Background Accents */}
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Festive Header Banner */}
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 sm:pb-6 border-b border-amber-500/20">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[10px] sm:text-xs font-black tracking-wide uppercase shadow-xs mb-2">
              <span className="animate-pulse">✨</span>
              <span>{showcase.bannerTag || "DIWALI SPECIAL • LIVE WAREHOUSE DISPATCH"}</span>
              <span className="animate-pulse">🪔</span>
            </div>

            <h2 className="font-headline text-xl sm:text-2xl lg:text-3xl font-black text-amber-200 tracking-tight flex items-center gap-2">
              <span>{showcase.bannerTitle}</span>
            </h2>

            <p className="text-xs sm:text-sm text-amber-100/80 font-medium max-w-2xl mt-1 leading-relaxed">
              {showcase.bannerSubtitle}
            </p>
          </div>

          {/* Quick Jump Pills for 3 Shelves */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none shrink-0 pt-1">
            {showcase.shelves.map((shelf) => (
              <a
                key={shelf.key}
                href={`#diwali-${shelf.key}`}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-amber-400 hover:text-stone-900 border border-white/15 text-white text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap active:scale-95 flex items-center gap-1"
              >
                <span>{shelf.badge.split(" ")[0]}</span>
                <span>{shelf.title.replace("Diwali ", "").replace("Festive ", "")}</span>
              </a>
            ))}
          </div>
        </div>

        {/* 3 Festive Shelves: Gifts, Sweets, Dry Fruits */}
        <div className="relative z-10 space-y-7 sm:space-y-8 pt-5 sm:pt-6">
          {showcase.shelves.map((shelf) => (
            <DiwaliShelfRow
              key={shelf.key}
              shelf={shelf}
              cartQuantities={cartQuantities}
              onAddToCart={onAddToCart}
              onUpdateQty={onUpdateQty}
              onToggleWishlist={onToggleWishlist}
              wishlistIds={wishlistIds}
              updatingId={updatingId}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

interface DiwaliShelfRowProps {
  shelf: DiwaliShowcaseShelf;
  cartQuantities: Record<string, number>;
  onAddToCart: (product: StoreProductItem) => void;
  onUpdateQty: (productId: string, delta: number) => void;
  onToggleWishlist?: (productId: string, productName: string, e: React.MouseEvent) => void;
  wishlistIds: Set<string>;
  updatingId?: string | null;
}

function DiwaliShelfRow({
  shelf,
  cartQuantities,
  onAddToCart,
  onUpdateQty,
  onToggleWishlist,
  wishlistIds,
  updatingId,
}: DiwaliShelfRowProps) {
  return (
    <div id={`diwali-${shelf.key}`} className="space-y-3 scroll-mt-28">
      {/* Shelf Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/15 pb-2">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-xl bg-gradient-to-br ${shelf.accentColor} flex items-center justify-center text-amber-200 shadow-sm border border-amber-400/40 shrink-0`}
          >
            <span className="material-symbols-outlined text-[20px]">{shelf.icon}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-headline text-base sm:text-lg font-bold text-amber-100">
                {shelf.title}
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[9px] font-bold uppercase tracking-wider border border-amber-400/30">
                {shelf.badge}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-amber-200/70 font-medium">
              {shelf.subtitle}
            </p>
          </div>
        </div>

        <span className="text-[11px] font-semibold text-amber-300/80 hidden sm:inline-block">
          {shelf.products.length} {shelf.products.length === 1 ? "Product" : "Products"} Curated
        </span>
      </div>

      {/* 5-Product Row: Responsive Snap Carousel on Mobile, 5-col Grid on Desktop */}
      <div className="flex overflow-x-auto pb-2 sm:pb-0 gap-3 sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 sm:gap-3.5 scrollbar-none snap-x snap-mandatory">
        {shelf.products.map((product) => {
          const mrpPaise = product.mrpPaise || 0;
          const effectiveRatePaise = product.unitPricePaise || product.slabs[0]?.unitPricePaise || mrpPaise;
          const savingsPaise = mrpPaise > effectiveRatePaise ? mrpPaise - effectiveRatePaise : 0;
          const qty = cartQuantities[product.id] || 0;
          const isUpdating = updatingId === product.id;
          const inWishlist = wishlistIds.has(product.id);

          const discountPct =
            mrpPaise > 0 && mrpPaise > effectiveRatePaise
              ? Math.round(((mrpPaise - effectiveRatePaise) / mrpPaise) * 100)
              : 0;

          return (
            <div
              key={product.id}
              className="min-w-[190px] w-[190px] sm:min-w-0 sm:w-auto shrink-0 snap-start bg-white rounded-2xl p-2.5 sm:p-3 shadow-md hover:shadow-xl transition-all flex flex-col justify-between text-stone-900 border border-amber-200/80 group"
            >
              <div>
                {/* Product Thumbnail Box */}
                <div className="relative aspect-square rounded-xl bg-amber-50/50 p-2 sm:p-3 flex items-center justify-center border border-amber-100 overflow-hidden group-hover:border-amber-400 transition-colors">
                  <Link href={`/store/products/${product.id}`} className="w-full h-full block">
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-stone-400">
                        <span className="material-symbols-outlined text-3xl">inventory_2</span>
                        <span className="text-[9px] font-mono mt-1 uppercase">{product.shortCode}</span>
                      </div>
                    )}
                  </Link>

                  {/* Festive Pick Tag */}
                  <div className="absolute top-1.5 left-1.5 pointer-events-none">
                    <span className="px-1.5 py-0.5 rounded bg-amber-600 text-white text-[9px] font-black uppercase tracking-tight shadow-xs flex items-center gap-0.5">
                      <span>🪔</span>
                      <span>Diwali Pick</span>
                    </span>
                  </div>

                  {/* Wishlist Button */}
                  {onToggleWishlist && (
                    <button
                      type="button"
                      onClick={(e) => onToggleWishlist(product.id, product.name, e)}
                      className={`absolute top-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow-xs transition-transform active:scale-90 ${
                        inWishlist
                          ? "bg-rose-50 text-rose-600 border border-rose-200"
                          : "bg-white/90 text-stone-400 hover:text-rose-600"
                      }`}
                      title={inWishlist ? "In Wishlist" : "Add to Wishlist"}
                    >
                      <span className="material-symbols-outlined text-[15px]">
                        {inWishlist ? "favorite" : "favorite"}
                      </span>
                    </button>
                  )}
                </div>

                {/* Company & Weight */}
                <div className="flex items-center justify-between text-[10px] text-stone-500 font-semibold mt-2 px-0.5">
                  <span className="text-amber-800 font-bold uppercase truncate max-w-[100px]">
                    {product.companyName || "Festive Select"}
                  </span>
                  {product.weight && (
                    <span className="bg-stone-100 text-stone-600 px-1 py-0.2 rounded font-mono">
                      {product.weight}
                    </span>
                  )}
                </div>

                {/* Product Title */}
                <h4 className="text-xs font-bold text-stone-900 mt-1 line-clamp-2 min-h-[32px] leading-tight px-0.5">
                  <Link
                    href={`/store/products/${product.id}`}
                    className="hover:text-amber-700 transition-colors"
                  >
                    {product.name}
                  </Link>
                </h4>
              </div>

              {/* Price & Stepper Row */}
              <div className="pt-2.5 mt-2 border-t border-stone-100">
                <div className="flex items-end justify-between gap-1.5 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-1 flex-wrap">
                      <span className="font-headline text-base sm:text-lg font-black text-amber-900 font-mono">
                        ₹{formatPaise(effectiveRatePaise)}
                      </span>
                      {mrpPaise > effectiveRatePaise && (
                        <span className="text-[11px] text-stone-400 line-through font-mono">
                          ₹{formatPaise(mrpPaise)}
                        </span>
                      )}
                    </div>
                    {discountPct > 0 && (
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded block truncate">
                        {discountPct}% OFF • Save ₹{formatPaise(savingsPaise)}
                      </span>
                    )}
                  </div>

                  {product.isAvailable ? (
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full shrink-0">
                      In Stock
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded-full shrink-0">
                      Restocking
                    </span>
                  )}
                </div>

                {/* Add / Stepper Button */}
                {qty > 0 ? (
                  <div className="w-full flex items-center justify-between bg-amber-50 border border-amber-300 rounded-xl p-0.5 shadow-2xs">
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => onUpdateQty(product.id, -1)}
                      className="w-7 h-7 flex items-center justify-center text-amber-900 hover:bg-amber-200/60 rounded font-bold text-sm cursor-pointer transition-colors"
                      title="Decrease"
                    >
                      -
                    </button>
                    <span className="text-xs font-black text-amber-950 font-mono px-1">
                      {isUpdating ? "..." : qty}
                    </span>
                    <button
                      type="button"
                      disabled={isUpdating || !product.isAvailable}
                      onClick={() => onUpdateQty(product.id, 1)}
                      className="w-7 h-7 flex items-center justify-center text-amber-900 hover:bg-amber-200/60 rounded font-bold text-sm cursor-pointer transition-colors"
                      title="Increase"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isUpdating || !product.isAvailable}
                    onClick={() => onAddToCart(product)}
                    className="w-full py-1.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[15px]">add_shopping_cart</span>
                    <span>{product.isAvailable ? "ADD" : "OUT OF STOCK"}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
