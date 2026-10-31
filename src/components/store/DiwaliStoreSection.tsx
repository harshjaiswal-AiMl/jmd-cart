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
      className="max-w-[1280px] mx-auto px-3 sm:px-4 lg:px-8 pt-1 pb-6"
    >
      {/* Festive CSS Keyframe Styles for Gentle Lalten Sway & Twinkling Lights */}
      <style>{`
        @keyframes festiveSwingLeft {
          0% { transform: rotate(-2.5deg); }
          100% { transform: rotate(3deg); }
        }
        @keyframes festiveSwingRight {
          0% { transform: rotate(3deg); }
          100% { transform: rotate(-2.5deg); }
        }
        @keyframes festiveBulbTwinkle {
          0%, 100% { opacity: 0.75; transform: scale(0.92); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        .festive-lantern-left {
          transform-origin: top center;
          animation: festiveSwingLeft 4.2s ease-in-out infinite alternate;
        }
        .festive-lantern-right {
          transform-origin: top center;
          animation: festiveSwingRight 4.8s ease-in-out infinite alternate;
        }
        .fairy-bulb {
          animation: festiveBulbTwinkle 2.2s ease-in-out infinite;
        }
      `}</style>

      {/* Seamless Material Design 3 Showcase Container with Festive Accents */}
      <div className="relative rounded-3xl bg-surface-container-lowest border border-amber-300/70 p-3.5 sm:p-5 lg:p-6 shadow-xs overflow-hidden bg-gradient-to-b from-amber-500/[0.05] via-amber-500/[0.01] to-transparent">
        {/* Top Decorative Fairy String Lights Garland */}
        <FestiveFairyGarland />

        {/* Left Decorative Hanging Lalten (Lantern) */}
        <div className="absolute -top-1 left-3 sm:left-5 md:left-7 z-20 pointer-events-none hidden sm:block festive-lantern-left">
          <LaltenSvg width={42} height={80} glowId="leftLalten" />
        </div>

        {/* Right Decorative Hanging Lalten (Lantern) */}
        <div className="absolute -top-1 right-3 sm:right-5 md:right-7 z-20 pointer-events-none festive-lantern-right">
          <LaltenSvg width={42} height={80} glowId="rightLalten" />
        </div>

        {/* Subtle festive background ambient glow */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-rose-400/10 rounded-full blur-3xl pointer-events-none" />

        {/* Section Header */}
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-3.5 pb-4 sm:pb-5 border-b border-amber-200/60 pt-2 sm:px-8 md:px-12">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-900 text-[10px] sm:text-xs font-black tracking-wide uppercase shadow-2xs mb-1.5">
              <span className="text-amber-600 animate-pulse">✨</span>
              <span>{showcase.bannerTag || "DIWALI SPECIAL • LIVE WAREHOUSE DISPATCH"}</span>
              <span className="text-amber-600 animate-pulse">🪔</span>
            </div>

            <h2 className="font-headline text-xl sm:text-2xl lg:text-3xl font-black text-on-surface tracking-tight flex items-center gap-2">
              <span className="text-amber-900">{showcase.bannerTitle}</span>
            </h2>

            <p className="text-xs sm:text-sm text-on-surface-variant font-medium max-w-2xl mt-0.5 leading-relaxed">
              {showcase.bannerSubtitle}
            </p>
          </div>

          {/* Quick Jump Navigation Pills */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none shrink-0 pt-0.5">
            {showcase.shelves.map((shelf) => (
              <a
                key={shelf.key}
                href={`#diwali-${shelf.key}`}
                className="px-3 py-1.5 rounded-xl bg-surface-container-low hover:bg-amber-100/90 border border-outline-variant/50 hover:border-amber-400 text-on-surface hover:text-amber-950 text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap active:scale-95 flex items-center gap-1 shadow-2xs"
              >
                <span>{shelf.badge.split(" ")[0]}</span>
                <span>{shelf.title.replace("Diwali ", "").replace("Festive ", "")}</span>
              </a>
            ))}
          </div>
        </div>

        {/* 3 Festive Shelves: Gifts, Sweets, Dry Fruits */}
        <div className="relative z-10 space-y-6 sm:space-y-7 pt-4 sm:pt-5">
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

/**
 * Traditional Hanging Diwali Lalten / Akash Kandil Vector
 */
function LaltenSvg({
  width = 42,
  height = 80,
  className = "",
  glowId = "laltenGlow",
}: {
  width?: number;
  height?: number;
  className?: string;
  glowId?: string;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 60 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <radialGradient id={`${glowId}-core`} cx="50%" cy="48%" r="48%">
          <stop offset="0%" stopColor="#fffbeb" stopOpacity="1" />
          <stop offset="35%" stopColor="#fef08a" stopOpacity="0.95" />
          <stop offset="65%" stopColor="#f59e0b" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#d97706" stopOpacity="0.9" />
        </radialGradient>
        <linearGradient id={`${glowId}-brass`} x1="0" y1="0" x2="60" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#92400e" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
        <filter id={`${glowId}-halo`} x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" />
        </filter>
      </defs>

      {/* Hanging Golden Wire */}
      <line x1="30" y1="0" x2="30" y2="16" stroke="#b45309" strokeWidth="1.5" strokeDasharray="2 1.5" />
      <circle cx="30" cy="16" r="2.5" fill="#f59e0b" stroke="#78350f" strokeWidth="0.8" />

      {/* Top Hanging Ring & Brass Roof */}
      <path d="M22 20 C22 17, 38 17, 38 20 Z" fill={`url(#${glowId}-brass)`} />
      <path d="M14 25 L46 25 L38 20 L22 20 Z" fill={`url(#${glowId}-brass)`} stroke="#78350f" strokeWidth="0.6" />

      {/* Amber Ambient Glow Behind Body */}
      <ellipse cx="30" cy="46" rx="16" ry="18" fill="#f59e0b" opacity="0.3" filter={`url(#${glowId}-halo)`} />

      {/* Lalten Faceted Glass Body */}
      <path
        d="M17 25 L43 25 L50 46 L30 64 L10 46 Z"
        fill={`url(#${glowId}-core)`}
        stroke="#b45309"
        strokeWidth="1.4"
      />

      {/* Inner Glowing Flame Core */}
      <ellipse cx="30" cy="44" rx="4.5" ry="8" fill="#ffffff" opacity="0.95" />
      <ellipse cx="30" cy="44" rx="2.5" ry="5" fill="#fef08a" />

      {/* Traditional Metal Ribs / Cage */}
      <line x1="30" y1="25" x2="30" y2="64" stroke="#92400e" strokeWidth="1.2" opacity="0.8" />
      <line x1="22" y1="25" x2="18" y2="48" stroke="#92400e" strokeWidth="0.9" opacity="0.75" />
      <line x1="38" y1="25" x2="42" y2="48" stroke="#92400e" strokeWidth="0.9" opacity="0.75" />
      <line x1="13" y1="36" x2="47" y2="36" stroke="#92400e" strokeWidth="0.8" opacity="0.7" />
      <line x1="12" y1="46" x2="48" y2="46" stroke="#92400e" strokeWidth="0.8" opacity="0.7" />

      {/* Bottom Cap */}
      <polygon points="24,64 36,64 33,68 27,68" fill={`url(#${glowId}-brass)`} stroke="#78350f" strokeWidth="0.6" />
      <circle cx="30" cy="69" r="1.8" fill="#fbbf24" stroke="#92400e" strokeWidth="0.5" />

      {/* Hanging Golden Tassels (Kandil Jhoomar) */}
      <path d="M25 68 Q24 78 22 90" stroke="#f59e0b" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M28 69 Q27 80 26 94" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M30 69 L30 96" stroke="#fbbf24" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M32 69 Q33 80 34 94" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M35 68 Q36 78 38 90" stroke="#f59e0b" strokeWidth="1.3" strokeLinecap="round" />

      {/* Golden Pearls / Beads on Tassels */}
      <circle cx="22" cy="90" r="1.4" fill="#fef08a" stroke="#d97706" strokeWidth="0.4" />
      <circle cx="26" cy="94" r="1.5" fill="#fef08a" stroke="#d97706" strokeWidth="0.4" />
      <circle cx="30" cy="96" r="1.8" fill="#ffffff" stroke="#f59e0b" strokeWidth="0.5" />
      <circle cx="34" cy="94" r="1.5" fill="#fef08a" stroke="#d97706" strokeWidth="0.4" />
      <circle cx="38" cy="90" r="1.4" fill="#fef08a" stroke="#d97706" strokeWidth="0.4" />
    </svg>
  );
}

/**
 * Festive Fairy String Lights Garland across the top edge
 */
function FestiveFairyGarland() {
  const bulbs = [
    { x: "3%", color: "#f59e0b", delay: "0s" },
    { x: "11%", color: "#f43f5e", delay: "0.5s" },
    { x: "19%", color: "#fbbf24", delay: "1.1s" },
    { x: "27%", color: "#10b981", delay: "0.3s" },
    { x: "35%", color: "#f59e0b", delay: "0.8s" },
    { x: "43%", color: "#f97316", delay: "1.4s" },
    { x: "51%", color: "#fbbf24", delay: "0.2s" },
    { x: "59%", color: "#f43f5e", delay: "0.9s" },
    { x: "67%", color: "#10b981", delay: "0.6s" },
    { x: "75%", color: "#f59e0b", delay: "1.2s" },
    { x: "83%", color: "#f97316", delay: "0.4s" },
    { x: "91%", color: "#fbbf24", delay: "1.0s" },
    { x: "97%", color: "#f43f5e", delay: "0.7s" },
  ];

  return (
    <div className="absolute top-0 left-0 right-0 h-6 overflow-hidden pointer-events-none select-none z-10">
      {/* Decorative Scalloped Golden Wire */}
      <svg
        className="w-full h-3.5"
        preserveAspectRatio="none"
        viewBox="0 0 1200 16"
        fill="none"
      >
        <path
          d="M0,2 Q50,12 100,2 Q150,12 200,2 Q250,12 300,2 Q350,12 400,2 Q450,12 500,2 Q550,12 600,2 Q650,12 700,2 Q750,12 800,2 Q850,12 900,2 Q950,12 1000,2 Q1050,12 1100,2 Q1150,12 1200,2"
          stroke="#d97706"
          strokeWidth="1.2"
          strokeOpacity="0.45"
        />
      </svg>

      {/* Hanging Twinkling Fairy Bulbs */}
      {bulbs.map((b, i) => (
        <div
          key={i}
          className="absolute top-0.5 -translate-x-1/2 flex flex-col items-center fairy-bulb"
          style={{
            left: b.x,
            animationDelay: b.delay,
          }}
        >
          {/* Miniature Cap */}
          <div className="w-1.5 h-1 bg-amber-800 rounded-t-[1px]" />
          {/* Glowing Glass Teardrop Bulb */}
          <div
            className="w-2 h-2.5 rounded-b-full rounded-t-xs shadow-xs"
            style={{
              backgroundColor: b.color,
              boxShadow: `0 0 6px 1px ${b.color}`,
            }}
          />
        </div>
      ))}
    </div>
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
    <div id={`diwali-${shelf.key}`} className="space-y-2.5 sm:space-y-3 scroll-mt-28">
      {/* Shelf Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/50 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-300/60 flex items-center justify-center text-amber-900 shadow-2xs shrink-0">
            <span className="material-symbols-outlined text-[19px]">{shelf.icon}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-headline text-base sm:text-lg font-bold text-on-surface">
                {shelf.title}
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-amber-100/90 text-amber-900 text-[9px] font-black uppercase tracking-wider border border-amber-300/60">
                {shelf.badge}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-on-surface-variant font-medium">
              {shelf.subtitle}
            </p>
          </div>
        </div>

        <span className="text-[11px] font-semibold text-amber-900/80 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200/60 hidden sm:inline-block">
          {shelf.products.length} {shelf.products.length === 1 ? "Product" : "Products"} Curated
        </span>
      </div>

      {/* Grid: 2 clean cards on mobile, 3 on tablet, 5 on desktop matching main catalogue */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
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
              className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 p-2.5 sm:p-3 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Product Image Box - Exactly matching standard catalogue card */}
                <Link
                  href={`/store/products/${product.id}`}
                  className="block aspect-square bg-surface-container-low rounded-xl border border-outline-variant/30 relative p-2 sm:p-3 overflow-hidden group-hover:border-primary/40 transition-colors"
                >
                  {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
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

                  {/* Savings / Festive Badge */}
                  {(savingsPaise > 0 || discountPct > 0) ? (
                    <div className="absolute top-2 left-2 max-w-[calc(100%-2.5rem)] pointer-events-none">
                      <span className="px-1.5 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed text-[9px] sm:text-[10px] font-black uppercase tracking-tight shadow-2xs truncate block">
                        {discountPct > 0 ? `${discountPct}% OFF` : `Save ₹${formatPaise(savingsPaise)}`}
                      </span>
                    </div>
                  ) : (
                    <div className="absolute top-2 left-2 pointer-events-none">
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/90 text-white text-[9px] font-black uppercase tracking-tight shadow-2xs flex items-center gap-0.5">
                        <span>🪔</span>
                        <span>Diwali</span>
                      </span>
                    </div>
                  )}

                  {/* Wishlist Button */}
                  {onToggleWishlist && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onToggleWishlist(product.id, product.name, e);
                      }}
                      title={inWishlist ? "Saved in Wishlist" : "Add to Wishlist"}
                      aria-label={inWishlist ? "Remove from Wishlist" : "Add to Wishlist"}
                      className="absolute top-2 right-2 z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-surface-container-lowest/90 backdrop-blur-xs flex items-center justify-center border border-outline-variant/40 shadow-xs hover:scale-110 active:scale-90 transition-all pointer-events-auto"
                    >
                      <span
                        className={`material-symbols-outlined text-[17px] sm:text-[19px] transition-colors ${
                          inWishlist ? "text-red-500" : "text-outline hover:text-red-500"
                        }`}
                        style={{
                          fontVariationSettings: inWishlist ? "'FILL' 1" : "'FILL' 0",
                        }}
                      >
                        favorite
                      </span>
                    </button>
                  )}

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
                    <span className="font-bold text-secondary truncate">
                      {product.companyName || "Festive Select"}
                    </span>
                    {product.weight && (
                      <span className="text-outline font-medium shrink-0">{product.weight}</span>
                    )}
                  </div>

                  {product.categoryName && (
                    <div className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded transition-colors w-fit max-w-full truncate">
                      <span className="material-symbols-outlined text-[11px]">category</span>
                      <span className="truncate">{product.categoryName}</span>
                    </div>
                  )}

                  <Link
                    href={`/store/products/${product.id}`}
                    className="font-bold text-xs text-on-surface hover:text-primary transition-colors line-clamp-2 leading-tight block h-8 sm:h-9"
                    title={product.name}
                  >
                    {product.name}
                  </Link>
                </div>
              </div>

              {/* Pricing & Add Stepper Row */}
              <div className="mt-2.5 pt-2 border-t border-surface-container-high/60 flex items-center justify-between gap-1.5 min-w-0">
                <div className="min-w-0 flex-1 flex flex-col justify-center">
                  <div className="flex items-baseline gap-1 min-w-0 flex-wrap">
                    <span className="font-headline text-xs sm:text-sm md:text-base font-bold text-primary font-mono tracking-tight shrink-0">
                      ₹{formatPaise(effectiveRatePaise)}
                    </span>
                    {mrpPaise > effectiveRatePaise && (
                      <span className="text-[9px] sm:text-[10px] text-outline line-through shrink-0">
                        ₹{formatPaise(mrpPaise)}
                      </span>
                    )}
                  </div>
                  {product.packSize > 1 ? (
                    <div
                      className="text-[9px] text-on-surface-variant truncate font-medium"
                      title={`${product.packSize} pcs/ctn`}
                    >
                      {product.packSize} pcs/ctn
                    </div>
                  ) : discountPct > 0 ? (
                    <div className="text-[9px] text-tertiary truncate font-semibold">
                      Save ₹{formatPaise(savingsPaise)}
                    </div>
                  ) : null}
                </div>

                {/* Add Button or Stepper */}
                <div className="shrink-0">
                  {!product.isAvailable ? (
                    <button
                      disabled
                      className="px-2 py-1 bg-surface-container text-outline text-[10px] font-bold rounded-lg cursor-not-allowed"
                    >
                      Sold
                    </button>
                  ) : qty === 0 ? (
                    <button
                      onClick={() => onAddToCart(product)}
                      disabled={isUpdating}
                      className="h-7 sm:h-8 px-2 sm:px-2.5 bg-primary hover:bg-primary-container text-on-primary text-[11px] sm:text-xs font-bold rounded-lg shadow-2xs transition-all active:scale-95 flex items-center justify-center gap-0.5 sm:gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[13px] sm:text-[14px]">add</span>
                      <span>ADD</span>
                    </button>
                  ) : (
                    <div className="h-7 sm:h-8 flex items-center bg-primary text-on-primary rounded-lg p-0.5 shadow-2xs">
                      <button
                        onClick={() => onUpdateQty(product.id, -1)}
                        disabled={isUpdating}
                        aria-label="Decrease quantity"
                        className="w-5 sm:w-6 h-full flex items-center justify-center hover:bg-white/20 rounded active:scale-90 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[13px]">remove</span>
                      </button>
                      <span className="min-w-[18px] sm:min-w-[20px] text-center text-[11px] sm:text-xs font-bold font-mono px-0.5">
                        {qty}
                      </span>
                      <button
                        onClick={() => onUpdateQty(product.id, 1)}
                        disabled={isUpdating}
                        aria-label="Increase quantity"
                        className="w-5 sm:w-6 h-full flex items-center justify-center hover:bg-white/20 rounded active:scale-90 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[13px]">add</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
