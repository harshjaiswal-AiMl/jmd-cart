"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { WishlistItemDto } from "@/modules/wishlist/wishlist.types";
import { removeFromWishlistAction, moveToCartAction } from "./actions";
import { StoreHeader } from "@/components/store/StoreHeader";
import { StoreFooter } from "@/components/store/StoreFooter";
import { formatRupees } from "@/lib/format-price";

interface WishlistClientProps {
  initialItems: WishlistItemDto[];
  cartCount?: number;
  cartTotalRupees?: number;
  categories?: Array<{ id: string; name: string }>;
  userName?: string;
  isLoggedIn?: boolean;
}

export function WishlistClient({
  initialItems,
  cartCount = 0,
  cartTotalRupees = 0,
  categories = [],
  userName = "",
  isLoggedIn = true,
}: WishlistClientProps) {
  const [items, setItems] = useState<WishlistItemDto[]>(initialItems);
  const [isPending, startTransition] = useTransition();
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleRemove = (productId: string, name: string) => {
    setActionLoadingId(productId);
    startTransition(async () => {
      try {
        const res = await removeFromWishlistAction(productId);
        if (res.success) {
          setItems((prev) => prev.filter((i) => i.productId !== productId));
          showToast(`Removed "${name}" from Wishlist`);
        }
      } finally {
        setActionLoadingId(null);
      }
    });
  };

  const handleMoveToCart = (productId: string, name: string) => {
    setActionLoadingId(productId);
    startTransition(async () => {
      try {
        const res = await moveToCartAction(productId, 1);
        if (res.success) {
          setItems((prev) => prev.filter((i) => i.productId !== productId));
          showToast(`Moved "${name}" to Basket! 🛒`);
        }
      } finally {
        setActionLoadingId(null);
      }
    });
  };

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface antialiased flex flex-col justify-between">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-inverse-surface text-inverse-on-surface text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="material-symbols-outlined text-[16px] text-primary">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Store Header */}
      <StoreHeader
        cartCount={cartCount}
        cartTotalRupees={cartTotalRupees}
        categories={categories}
        userName={userName}
        isLoggedIn={isLoggedIn}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-48 md:pt-40 pb-16 w-full flex-1">
        {/* Breadcrumb & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-surface-container-high">
          <div>
            <div className="flex items-center gap-2 text-xs text-outline mb-1">
              <Link href="/store" className="hover:text-primary transition-colors">
                Store
              </Link>
              <span>/</span>
              <span className="text-on-surface font-semibold">Wishlist</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="font-headline text-2xl sm:text-3xl font-extrabold tracking-tight text-on-surface flex items-center gap-2">
                <span className="text-red-500">❤️</span> My Saved Wishlist
              </h1>
              <span className="bg-red-50 text-red-600 border border-red-200 text-xs px-2.5 py-0.5 rounded-full font-bold">
                {items.length} {items.length === 1 ? "Item" : "Items"}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-1">
              Save your favorite grocery staples, mustard oils, and commercial master cartons to reorder or buy anytime.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/store"
              className="text-xs font-bold px-3 py-2 border border-outline-variant/60 rounded-xl text-on-surface hover:bg-surface-container-low transition-colors"
            >
              ← Continue Shopping
            </Link>
            <Link
              href="/store/cart"
              className="text-xs font-bold px-3.5 py-2 bg-primary hover:bg-primary-container text-on-primary rounded-xl transition-all shadow-xs flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">shopping_cart</span>
              <span>View Basket</span>
            </Link>
          </div>
        </div>

        {/* Empty State */}
        {items.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-3xl border border-surface-container-high/80 p-12 text-center max-w-lg mx-auto space-y-4 shadow-sm my-8">
            <div className="w-20 h-20 mx-auto rounded-full bg-red-50 text-red-500 flex items-center justify-center shadow-inner">
              <span className="material-symbols-outlined text-[40px]">favorite_border</span>
            </div>
            <h2 className="font-headline text-xl font-bold text-on-surface">
              Your Wishlist is Empty
            </h2>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Explore our Saharsa wholesale depot catalogue and tap the heart icon on any product to save it for later.
            </p>
            <div className="pt-2">
              <Link
                href="/store"
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-container text-on-primary font-bold text-xs rounded-xl transition-all shadow-sm"
              >
                <span>Browse Products</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            </div>
          </div>
        ) : (
          /* Wishlist Items Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((item) => {
              const isLoading = actionLoadingId === item.productId && isPending;

              return (
                <div
                  key={item.id}
                  className="group bg-surface-container-lowest rounded-2xl border border-surface-container-high/80 hover:border-primary/40 hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden relative"
                >
                  {/* Top Badges & Remove Button */}
                  <div className="absolute top-2.5 inset-x-2.5 z-10 flex items-center justify-between pointer-events-none">
                    {item.discountPercent > 0 ? (
                      <span className="bg-secondary text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-xs pointer-events-auto">
                        {item.discountPercent}% OFF
                      </span>
                    ) : (
                      <span />
                    )}

                    <button
                      onClick={() => handleRemove(item.productId, item.name)}
                      disabled={isLoading}
                      title="Remove from Wishlist"
                      className="pointer-events-auto w-8 h-8 rounded-full bg-surface-container-lowest/90 backdrop-blur-xs text-outline hover:text-error hover:bg-red-50 border border-surface-container-high flex items-center justify-center transition-all shadow-xs"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>

                  {/* Product Packshot */}
                  <Link
                    href={`/store/products/${item.productId}`}
                    className="block relative pt-10 pb-4 px-4 bg-surface-container-low/40 group-hover:bg-surface-container-low/70 transition-colors text-center"
                  >
                    <div className="w-full h-40 flex items-center justify-center">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <div className="w-24 h-24 rounded-2xl bg-surface-container-high/60 flex items-center justify-center text-outline text-3xl">
                          📦
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Content & Pricing */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      {/* Brand & Category */}
                      <div className="flex items-center gap-1.5 text-[11px] text-outline mb-1">
                        <span className="font-semibold text-primary truncate max-w-[120px]">
                          {item.companyName || "Daily Staples"}
                        </span>
                        {item.weight && (
                          <>
                            <span>•</span>
                            <span className="bg-surface-container-high/70 px-1.5 py-0.2 rounded text-[10px] font-bold text-on-surface">
                              {item.weight}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Product Name */}
                      <Link
                        href={`/store/products/${item.productId}`}
                        className="font-headline font-bold text-sm text-on-surface group-hover:text-primary transition-colors line-clamp-2 leading-snug"
                      >
                        {item.name}
                      </Link>

                      {/* Stock Status Badge */}
                      <div className="mt-2">
                        {item.inStock ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Ready for Express Dispatch
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            Restocking Soon
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Price Block & Action Button */}
                    <div className="pt-2 border-t border-surface-container-high/60 space-y-2.5">
                      <div className="flex items-baseline justify-between">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-headline text-lg font-black text-on-surface">
                            ₹{formatRupees(item.priceRupees)}
                          </span>
                          {item.mrpRupees > item.priceRupees && (
                            <span className="text-xs text-outline line-through">
                              ₹{formatRupees(item.mrpRupees)}
                            </span>
                          )}
                        </div>

                        {item.savingsRupees > 0 && (
                          <span className="text-[10px] font-bold text-secondary">
                            Save ₹{formatRupees(item.savingsRupees)}
                          </span>
                        )}
                      </div>

                      {/* Move to Cart Button */}
                      <button
                        onClick={() => handleMoveToCart(item.productId, item.name)}
                        disabled={isLoading || !item.inStock}
                        className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 ${
                          item.inStock
                            ? "bg-primary hover:bg-primary-container text-on-primary hover:shadow"
                            : "bg-surface-container-high text-outline cursor-not-allowed"
                        }`}
                      >
                        {isLoading ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            <span>Moving...</span>
                          </>
                        ) : item.inStock ? (
                          <>
                            <span className="material-symbols-outlined text-[16px]">shopping_bag</span>
                            <span>Move to Basket</span>
                          </>
                        ) : (
                          <span>Out of Stock</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <StoreFooter />
    </div>
  );
}
