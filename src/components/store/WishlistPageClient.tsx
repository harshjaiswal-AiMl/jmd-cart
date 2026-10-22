"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductCard } from "@/components/store/ProductCard";

interface WishlistProduct {
  id: string;
  name: string;
  slug?: string | null;
  companyName?: string | null;
  weight?: string | null;
  mrpPaise: number;
  unitPricePaise?: number;
  imageUrl?: string | null;
  isAvailable: boolean;
  totalAvailableQty: number;
}

export function WishlistPageClient() {
  const [items, setItems] = useState<WishlistProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWishlist = async () => {
    try {
      const res = await fetch("/api/store/v1/wishlist");
      if (res.ok) {
        const data = await res.json();
        setItems(data.data?.items || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWishlist();
    const handleUpdate = () => fetchWishlist();
    window.addEventListener("wishlist-updated", handleUpdate);
    return () => window.removeEventListener("wishlist-updated", handleUpdate);
  }, []);

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="mt-4 text-sm font-semibold text-on-surface-variant">
          Loading saved items...
        </span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-16 text-center bg-surface-container-lowest rounded-3xl border border-outline-variant/20 p-8 sm:p-12 shadow-sm max-w-lg mx-auto my-8">
        <div className="w-20 h-20 bg-surface-container-low rounded-full flex items-center justify-center mx-auto text-outline">
          <span className="material-symbols-outlined text-4xl">favorite_border</span>
        </div>
        <h2 className="mt-4 text-xl font-bold font-serif text-on-surface">Your Wishlist is Empty</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          Save your favourite pulses, oils, spices and essentials for quick reordering.
        </p>
        <Link
          href="/categories"
          className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-sm hover:bg-primary-container transition-colors shadow-sm"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="my-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {items.map((p) => (
          <ProductCard key={p.id} product={p as any} initialInWishlist={true} />
        ))}
      </div>
    </div>
  );
}
