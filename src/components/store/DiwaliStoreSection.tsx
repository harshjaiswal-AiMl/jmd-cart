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
      {/* Festive CSS Keyframe Styles for Visible Lalten Swing, Bright Fairy Blinking & Burning Diya Flame */}
      <style>{`
        @keyframes festiveSwingLeft {
          0% { transform: rotate(-7deg); }
          50% { transform: rotate(1.5deg); }
          100% { transform: rotate(7.5deg); }
        }
        @keyframes festiveSwingRight {
          0% { transform: rotate(7.5deg); }
          50% { transform: rotate(-1.5deg); }
          100% { transform: rotate(-7deg); }
        }
        @keyframes festiveBlinkA {
          0%, 100% {
            opacity: 0.25;
            filter: drop-shadow(0 0 2px currentColor) brightness(0.7);
            transform: scale(0.85);
          }
          45% {
            opacity: 1;
            filter: drop-shadow(0 0 8px currentColor) drop-shadow(0 0 16px currentColor) brightness(1.6);
            transform: scale(1.25);
          }
        }
        @keyframes festiveBlinkB {
          0%, 100% {
            opacity: 1;
            filter: drop-shadow(0 0 8px currentColor) drop-shadow(0 0 16px currentColor) brightness(1.6);
            transform: scale(1.25);
          }
          50% {
            opacity: 0.2;
            filter: drop-shadow(0 0 1px currentColor) brightness(0.65);
            transform: scale(0.85);
          }
        }
        @keyframes festiveBlinkC {
          0%, 25%, 100% {
            opacity: 0.3;
            filter: drop-shadow(0 0 2px currentColor) brightness(0.7);
            transform: scale(0.88);
          }
          60%, 80% {
            opacity: 1;
            filter: drop-shadow(0 0 9px currentColor) drop-shadow(0 0 18px currentColor) brightness(1.7);
            transform: scale(1.3);
          }
        }
        @keyframes diyaFlameBurn {
          0%, 100% {
            transform: scaleY(1) scaleX(1) rotate(-1.5deg);
            filter: drop-shadow(0 -3px 6px #f59e0b) drop-shadow(0 -6px 12px rgba(249, 115, 22, 0.7));
          }
          20% {
            transform: scaleY(1.18) scaleX(0.9) rotate(3deg) translateY(-1px);
            filter: drop-shadow(0 -4px 9px #fbbf24) drop-shadow(0 -8px 16px rgba(234, 88, 12, 0.85));
          }
          40% {
            transform: scaleY(0.92) scaleX(1.08) rotate(-2.5deg);
            filter: drop-shadow(0 -2px 5px #f59e0b) drop-shadow(0 -4px 10px rgba(249, 115, 22, 0.6));
          }
          65% {
            transform: scaleY(1.22) scaleX(0.88) rotate(2deg) translateY(-1.5px);
            filter: drop-shadow(0 -5px 12px #fde047) drop-shadow(0 -10px 18px rgba(234, 88, 12, 0.9));
          }
          85% {
            transform: scaleY(0.96) scaleX(1.04) rotate(-1.5deg);
            filter: drop-shadow(0 -3px 7px #f59e0b) drop-shadow(0 -6px 13px rgba(249, 115, 22, 0.7));
          }
        }
        @keyframes diyaAuraPulse {
          0%, 100% {
            opacity: 0.45;
            transform: scale(0.92);
          }
          50% {
            opacity: 0.85;
            transform: scale(1.15);
          }
        }
        .festive-lantern-left {
          transform-origin: 50% 0px;
          animation: festiveSwingLeft 2.2s cubic-bezier(0.4, 0, 0.6, 1) infinite alternate;
        }
        .festive-lantern-right {
          transform-origin: 50% 0px;
          animation: festiveSwingRight 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite alternate;
        }
        .fairy-blink-a {
          animation: festiveBlinkA 1.1s ease-in-out infinite;
        }
        .fairy-blink-b {
          animation: festiveBlinkB 1.3s ease-in-out infinite;
        }
        .fairy-blink-c {
          animation: festiveBlinkC 0.95s ease-in-out infinite;
        }
        .diya-flame-animated {
          transform-origin: 34px 34px;
          animation: diyaFlameBurn 1.4s ease-in-out infinite alternate;
        }
        .diya-aura-animated {
          transform-origin: 34px 20px;
          animation: diyaAuraPulse 1.8s ease-in-out infinite;
        }
      `}</style>

      {/* Seamless Material Design 3 Showcase Container with Festive Accents */}
      <div className="relative rounded-3xl bg-surface-container-lowest border border-amber-300/70 p-3.5 sm:p-5 lg:p-6 shadow-xs overflow-hidden bg-gradient-to-b from-amber-500/[0.05] via-amber-500/[0.01] to-transparent">
        {/* Top Decorative Fairy String Lights Garland */}
        <FestiveFairyGarland />

        {/* Left Decorative Hanging Lalten (Lantern) - Visible on Phone & Laptop with Responsive Scale */}
        <div className="absolute -top-1 left-1.5 sm:left-5 md:left-8 z-20 pointer-events-none festive-lantern-left">
          <div className="sm:hidden">
            <LaltenSvg width={30} height={62} glowId="leftLaltenMob" />
          </div>
          <div className="hidden sm:block">
            <LaltenSvg width={44} height={86} glowId="leftLaltenDesk" />
          </div>
        </div>

        {/* Right Decorative Hanging Lalten (Lantern) - Visible on Phone & Laptop with Responsive Scale */}
        <div className="absolute -top-1 right-1.5 sm:right-5 md:right-8 z-20 pointer-events-none festive-lantern-right">
          <div className="sm:hidden">
            <LaltenSvg width={30} height={62} glowId="rightLaltenMob" />
          </div>
          <div className="hidden sm:block">
            <LaltenSvg width={44} height={86} glowId="rightLaltenDesk" />
          </div>
        </div>

        {/* Subtle festive background ambient glow */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-rose-400/10 rounded-full blur-3xl pointer-events-none" />

        {/* Section Header with Prominent Animated Burning Diya */}
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-3.5 pb-4 sm:pb-5 border-b border-amber-200/60 pt-2 px-8 sm:px-14 md:px-16">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Left Animated Diya with Burning Flame (Prominent on Phone & Laptop) */}
            <div className="shrink-0 drop-shadow-sm">
              <div className="sm:hidden">
                <AnimatedDiyaSvg width={38} height={32} glowId="hdrDiyaMob" />
              </div>
              <div className="hidden sm:block">
                <AnimatedDiyaSvg width={50} height={42} glowId="hdrDiyaDesk" />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-950 text-[10px] sm:text-xs font-black tracking-wide uppercase shadow-2xs mb-1">
                <span className="text-amber-600 animate-pulse">✨</span>
                <span>{showcase.bannerTag || "DIWALI SPECIAL • LIVE WAREHOUSE DISPATCH"}</span>
                <span className="text-amber-600 animate-pulse">✨</span>
              </div>

              <h2 className="font-headline text-lg sm:text-2xl lg:text-3xl font-black text-on-surface tracking-tight flex items-center gap-2">
                <span className="text-amber-950">{showcase.bannerTitle}</span>
              </h2>

              <p className="text-xs sm:text-sm text-on-surface-variant font-medium max-w-2xl mt-0.5 leading-relaxed line-clamp-2 sm:line-clamp-none">
                {showcase.bannerSubtitle}
              </p>
            </div>

            {/* Right Animated Diya on larger screens for symmetrical festival aesthetics */}
            <div className="shrink-0 drop-shadow-sm hidden lg:block">
              <AnimatedDiyaSvg width={50} height={42} glowId="hdrDiyaDeskRight" />
            </div>
          </div>

          {/* Quick Jump Navigation Pills */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none shrink-0 pt-0.5 max-w-full">
            {showcase.shelves.map((shelf) => (
              <a
                key={shelf.key}
                href={`#diwali-${shelf.key}`}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-surface-container-low hover:bg-amber-100/90 border border-outline-variant/50 hover:border-amber-400 text-on-surface hover:text-amber-950 text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap active:scale-95 flex items-center gap-1 shadow-2xs"
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
 * Traditional Indian Clay Diya (Deepak) with Animated Flickering Burning Flame
 */
export function AnimatedDiyaSvg({
  width = 50,
  height = 42,
  className = "",
  glowId = "diyaGlow",
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
      viewBox="0 0 68 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Clay Terracotta Lamp Body Gradients */}
        <linearGradient id={`${glowId}-clay`} x1="0" y1="28" x2="68" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="25%" stopColor="#d97706" />
          <stop offset="60%" stopColor="#b45309" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
        <radialGradient id={`${glowId}-oil`} cx="50%" cy="40%" r="50%">
          <stop offset="0%" stopColor="#fef08a" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#f59e0b" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#b45309" stopOpacity="0.95" />
        </radialGradient>

        {/* Multi-layered Burning Fire Gradients */}
        <radialGradient id={`${glowId}-flame-outer`} cx="50%" cy="80%" r="70%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="35%" stopColor="#f97316" />
          <stop offset="70%" stopColor="#ea580c" />
          <stop offset="100%" stopColor="#c2410c" stopOpacity="0.95" />
        </radialGradient>
        <radialGradient id={`${glowId}-flame-core`} cx="50%" cy="75%" r="65%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor="#fffbeb" />
          <stop offset="70%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#facc15" />
        </radialGradient>

        {/* Ambient Warm Golden Aura Glow Filter */}
        <radialGradient id={`${glowId}-ambient`} cx="50%" cy="45%" r="50%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.85" />
          <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
        </radialGradient>
        <filter id={`${glowId}-blur`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4.5" />
        </filter>
      </defs>

      {/* 1. Pulsing Ambient Radiant Warmth / Light Aura Behind Flame */}
      <circle
        cx="34"
        cy="20"
        r="18"
        fill={`url(#${glowId}-ambient)`}
        filter={`url(#${glowId}-blur)`}
        className="diya-aura-animated"
      />

      {/* 2. Terracotta Clay Lamp Base Shadow */}
      <ellipse cx="34" cy="51" rx="22" ry="4" fill="#78350f" fillOpacity="0.35" />

      {/* 3. Clay Diya Curved Body (Terracotta Deep Plate with Flared Wings) */}
      <path
        d="M8 38 C8 48, 20 53, 34 53 C48 53, 60 48, 60 38 C60 34, 53 34, 44 36 C38 37.5, 30 37.5, 24 36 C15 34, 8 34, 8 38 Z"
        fill={`url(#${glowId}-clay)`}
        stroke="#78350f"
        strokeWidth="1.2"
      />

      {/* 4. Golden Decorative Traditional Etchings on Clay Rim */}
      <path
        d="M14 42 Q34 50 54 42"
        stroke="#fbbf24"
        strokeWidth="1"
        strokeDasharray="2 2"
        strokeOpacity="0.75"
        fill="none"
      />
      <circle cx="24" cy="46" r="1.2" fill="#fef08a" />
      <circle cx="34" cy="48" r="1.5" fill="#fef08a" />
      <circle cx="44" cy="46" r="1.2" fill="#fef08a" />

      {/* 5. Ghee / Oil Pool Reservoir Inside Bowl */}
      <ellipse
        cx="34"
        cy="36"
        rx="21"
        ry="5"
        fill={`url(#${glowId}-oil)`}
        stroke="#d97706"
        strokeWidth="0.8"
      />

      {/* 6. Cotton Wick (Baati) Emerging from the Pool */}
      <path
        d="M34 36 C34 30, 33 26, 34 22"
        stroke="#78350f"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="34" cy="22" r="1.4" fill="#fbbf24" />

      {/* 7. Animated Burning Dancing Flame */}
      <g className="diya-flame-animated">
        {/* Outer Vibrant Orange Flame with Sharp Dancing Tip */}
        <path
          d="M34 2 C37 11, 44 15, 44 23 C44 29.5, 39.5 34, 34 34 C28.5 34, 24 29.5, 24 23 C24 15, 31 11, 34 2 Z"
          fill={`url(#${glowId}-flame-outer)`}
        />

        {/* Inner Golden-Yellow Hot Flame */}
        <path
          d="M34 7 C36 14, 41 17, 41 23 C41 27.5, 38 31, 34 31 C30 31, 27 27.5, 27 23 C27 17, 32 14, 34 7 Z"
          fill={`url(#${glowId}-flame-core)`}
        />

        {/* White-Hot Flame Ember Heart */}
        <path
          d="M34 13 C35 17, 38 19, 38 23.5 C38 26.5, 36.2 28.5, 34 28.5 C31.8 28.5, 30 26.5, 30 23.5 C30 19, 33 17, 34 13 Z"
          fill="#ffffff"
          opacity="0.95"
        />

        {/* Blue Flame Root at Wick Tip */}
        <ellipse cx="34" cy="30" rx="4" ry="2.2" fill="#3b82f6" opacity="0.85" />
        <ellipse cx="34" cy="30" rx="2" ry="1.2" fill="#93c5fd" opacity="0.9" />
      </g>
    </svg>
  );
}

/**
 * Festive Fairy String Lights Garland across the top edge with Vibrant Blinking
 */
function FestiveFairyGarland() {
  const bulbs = [
    { x: "3%", color: "#f59e0b", blinkClass: "fairy-blink-a", delay: "0s" },
    { x: "11%", color: "#f43f5e", blinkClass: "fairy-blink-b", delay: "0.2s" },
    { x: "19%", color: "#fbbf24", blinkClass: "fairy-blink-c", delay: "0.5s" },
    { x: "27%", color: "#10b981", blinkClass: "fairy-blink-a", delay: "0.1s" },
    { x: "35%", color: "#f59e0b", blinkClass: "fairy-blink-b", delay: "0.6s" },
    { x: "43%", color: "#f97316", blinkClass: "fairy-blink-c", delay: "0.3s" },
    { x: "51%", color: "#fbbf24", blinkClass: "fairy-blink-a", delay: "0.7s" },
    { x: "59%", color: "#f43f5e", blinkClass: "fairy-blink-b", delay: "0.4s" },
    { x: "67%", color: "#10b981", blinkClass: "fairy-blink-c", delay: "0.15s" },
    { x: "75%", color: "#f59e0b", blinkClass: "fairy-blink-a", delay: "0.55s" },
    { x: "83%", color: "#f97316", blinkClass: "fairy-blink-b", delay: "0.25s" },
    { x: "91%", color: "#fbbf24", blinkClass: "fairy-blink-c", delay: "0.45s" },
    { x: "97%", color: "#f43f5e", blinkClass: "fairy-blink-a", delay: "0.35s" },
  ];

  return (
    <div className="absolute top-0 left-0 right-0 h-7 overflow-hidden pointer-events-none select-none z-10">
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
          strokeWidth="1.4"
          strokeOpacity="0.5"
        />
      </svg>

      {/* Hanging Twinkling Fairy Bulbs with Multi-color Blinking */}
      {bulbs.map((b, i) => (
        <div
          key={i}
          className={`absolute top-0.5 -translate-x-1/2 flex flex-col items-center ${b.blinkClass}`}
          style={{
            left: b.x,
            animationDelay: b.delay,
          }}
        >
          {/* Miniature Cap */}
          <div className="w-1.5 h-1 bg-amber-900 rounded-t-[1px]" />
          {/* Glowing Glass Teardrop Bulb with Vibrant Multi-layered Shadow */}
          <div
            className="w-2.5 h-3 rounded-b-full rounded-t-xs"
            style={{
              backgroundColor: b.color,
              boxShadow: `0 0 8px 2px ${b.color}, 0 0 14px 4px ${b.color}80`,
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
              <h3 className="font-headline text-base sm:text-lg font-bold text-on-surface flex items-center gap-1.5">
                <span>{shelf.title}</span>
                <AnimatedDiyaSvg width={22} height={18} glowId={`shelfDiya-${shelf.key}`} className="inline-block shrink-0" />
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
