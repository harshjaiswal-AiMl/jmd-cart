"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface QuantityStepperProps {
  productId: string;
  initialQty?: number;
  maxQty?: number;
  packLabel?: string;
  isAvailable?: boolean;
  onQtyChange?: (newQty: number) => void;
}

export function QuantityStepper({
  productId,
  initialQty = 0,
  maxQty = 9999,
  packLabel = "Piece",
  isAvailable = true,
  onQtyChange,
}: QuantityStepperProps) {
  const [qty, setQty] = useState(initialQty);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (!isAvailable) {
    return (
      <span className="px-3 py-1.5 bg-surface-container text-outline text-xs font-bold rounded-lg cursor-not-allowed inline-flex items-center gap-1">
        <span className="material-symbols-outlined text-[14px]">block</span>
        Out of Stock
      </span>
    );
  }

  const updateServerCart = async (newQty: number) => {
    setLoading(true);
    try {
      const res = await fetch("/api/store/v1/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, qty: newQty }),
      });
      if (res.ok) {
        setQty(newQty);
        onQtyChange?.(newQty);
        router.refresh();
      }
    } catch {
      // rollback
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await updateServerCart(1);
  };

  const handleIncrement = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (qty >= maxQty) return;
    await updateServerCart(qty + 1);
  };

  const handleDecrement = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await updateServerCart(Math.max(0, qty - 1));
  };

  if (qty === 0) {
    return (
      <button
        type="button"
        onClick={handleAdd}
        disabled={loading}
        className="bg-secondary-container hover:bg-secondary text-on-secondary-container hover:text-on-secondary px-3.5 py-1.5 rounded-lg font-label-md text-label-md font-bold transition-colors flex items-center gap-1 shadow-sm active:scale-95 disabled:opacity-60"
        aria-label="Add to shopping cart"
      >
        {loading ? (
          <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
        ) : (
          <span className="material-symbols-outlined text-[16px]">add</span>
        )}
        <span>ADD</span>
      </button>
    );
  }

  return (
    <div
      className="flex items-center bg-surface-container rounded-lg p-0.5 shadow-sm border border-outline-variant/40"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={handleDecrement}
        disabled={loading}
        className="w-7 h-7 flex items-center justify-center text-primary font-bold hover:bg-surface-container-high rounded transition-colors disabled:opacity-50"
        aria-label="Decrease quantity"
      >
        <span className="material-symbols-outlined text-[16px]">remove</span>
      </button>
      <span className="px-2 font-label-md text-label-md font-bold text-on-surface tabular-nums min-w-[20px] text-center">
        {loading ? "..." : qty}
      </span>
      <button
        type="button"
        onClick={handleIncrement}
        disabled={loading || qty >= maxQty}
        className="w-7 h-7 flex items-center justify-center text-primary font-bold hover:bg-surface-container-high rounded transition-colors disabled:opacity-50"
        aria-label="Increase quantity"
      >
        <span className="material-symbols-outlined text-[16px]">add</span>
      </button>
    </div>
  );
}
