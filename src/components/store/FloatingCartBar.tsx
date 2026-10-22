"use client";

import Link from "next/link";

interface FloatingCartBarProps {
  totalPieces: number;
  totalRupees: number;
  savingsRupees?: number;
}

export function FloatingCartBar({
  totalPieces,
  totalRupees,
  savingsRupees = 0,
}: FloatingCartBarProps) {
  if (totalPieces <= 0) return null;

  return (
    <div className="fixed bottom-16 sm:bottom-5 inset-x-3 sm:inset-x-4 max-w-lg mx-auto z-40 transition-all duration-300">
      <Link
        href="/store/checkout"
        className="w-full bg-primary hover:bg-primary-container text-on-primary py-3 px-4 sm:px-5 rounded-2xl shadow-2xl flex items-center justify-between border border-primary-container/40 group active:scale-[0.98] transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-surface-container-lowest/15 flex items-center justify-center text-secondary-fixed shrink-0">
            <span className="material-symbols-outlined text-[22px]">shopping_bag</span>
          </div>
          <div className="text-left min-w-0">
            <div className="font-bold text-xs sm:text-sm tracking-tight flex items-center gap-1.5 sm:gap-2">
              <span className="whitespace-nowrap">
                {totalPieces} {totalPieces === 1 ? "Item" : "Items"} in Cart
              </span>
              <span className="opacity-40">•</span>
              <span className="font-headline text-sm sm:text-base text-secondary-fixed font-bold">
                ₹{totalRupees.toLocaleString("en-IN")}
              </span>
            </div>
            {savingsRupees > 0 && (
              <div className="text-[10px] sm:text-[11px] text-tertiary-fixed font-semibold truncate">
                ⚡ You are saving ₹{savingsRupees.toLocaleString("en-IN")} on this order!
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 font-bold text-xs bg-secondary text-white px-3 sm:px-4 py-2 rounded-xl shadow-xs group-hover:bg-secondary-container transition-colors shrink-0">
          <span>Checkout</span>
          <span className="material-symbols-outlined text-[16px] group-hover:translate-x-0.5 transition-transform">
            arrow_forward
          </span>
        </div>
      </Link>
    </div>
  );
}
