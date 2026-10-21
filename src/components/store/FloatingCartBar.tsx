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
    <div className="fixed bottom-4 inset-x-4 max-w-lg mx-auto z-40 transition-all transform animate-bounce-short">
      <Link
        href="/store/checkout"
        className="w-full bg-primary hover:bg-primary-container text-on-primary py-3.5 px-5 rounded-2xl shadow-xl flex items-center justify-between transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-surface-container-lowest/15 flex items-center justify-center text-secondary-fixed">
            <span className="material-symbols-outlined text-[22px]">shopping_bag</span>
          </div>
          <div className="text-left">
            <div className="font-bold text-sm tracking-tight flex items-center gap-2">
              <span>
                {totalPieces} {totalPieces === 1 ? "Item" : "Items"} in Cart
              </span>
              <span className="opacity-40">•</span>
              <span className="font-headline text-base text-secondary-fixed">
                ₹{totalRupees.toLocaleString("en-IN")}
              </span>
            </div>
            {savingsRupees > 0 && (
              <div className="text-[11px] text-tertiary-fixed font-semibold">
                You are saving ₹{savingsRupees.toLocaleString("en-IN")} on this order!
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 font-bold text-xs bg-secondary px-3.5 py-1.5 rounded-xl shadow-xs group-hover:bg-secondary-container transition-colors">
          <span>Checkout</span>
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </div>
      </Link>
    </div>
  );
}
