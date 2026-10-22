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
    <aside
      id="stickyCartBar"
      className="fixed bottom-14 sm:bottom-4 inset-x-3 sm:inset-x-auto sm:right-6 max-w-md sm:max-w-sm mx-auto sm:mx-0 z-40 transition-transform animate-in fade-in slide-in-from-bottom-2"
      aria-label="Floating cart summary"
    >
      <div className="bg-surface-container-lowest/95 backdrop-blur-md rounded-xl p-3 shadow-2xl border border-outline-variant/40 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-lg bg-primary text-on-primary flex items-center justify-center font-bold flex-shrink-0 shadow-sm">
            <span className="font-label-md text-label-md">{totalPieces}</span>
          </div>
          <div>
            <div className="font-label-sm text-label-sm text-outline">
              {savingsRupees > 0 ? (
                <span className="text-tertiary-container font-semibold">
                  Save ₹{savingsRupees.toLocaleString("en-IN")}
                </span>
              ) : (
                "Cart Subtotal"
              )}
            </div>
            <div className="font-price-lg text-price-lg text-primary font-bold">
              ₹{totalRupees.toLocaleString("en-IN")}
            </div>
          </div>
        </div>
        <Link
          href="/cart"
          className="bg-secondary-container hover:bg-secondary text-on-secondary-container hover:text-on-secondary font-label-md text-label-md px-4 py-2.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap"
        >
          <span>View Cart</span>
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </Link>
      </div>
    </aside>
  );
}
