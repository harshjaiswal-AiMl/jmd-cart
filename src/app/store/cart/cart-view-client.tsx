"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CartSummary } from "@/modules/cart/cart.service";
import { DeliveryZone } from "@/modules/delivery/delivery.types";
import { updateCartQtyAction, removeFromCartAction, clearCartAction } from "./actions";
import { StoreHeader } from "@/components/store/StoreHeader";
import { StoreFooter } from "@/components/store/StoreFooter";

interface CartViewClientProps {
  cart: CartSummary;
  deliveryZones?: DeliveryZone[];
  categories?: Array<{ id: string; name: string }>;
  userPhone?: string;
  userName?: string;
}

export function CartViewClient({
  cart,
  deliveryZones = [],
  categories = [],
  userName = "",
}: CartViewClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cartLines, setCartLines] = useState(cart.lines);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const selectedZone = deliveryZones[0] || {
    code: "TOWN",
    name: "Saharsa Town",
    minOrderPaise: 50000,
    freeDeliveryThresholdPaise: 200000,
    deliveryChargePaise: 4000,
    estimatedDeliveryHours: 4,
    active: true,
  };

  const totalPaise = cartLines.reduce((sum, l) => sum + l.pricing.lineTotalPaise, 0);
  const itemsCount = cartLines.length;
  const totalPieces = cartLines.reduce((sum, l) => sum + l.qty, 0);
  const isDeliveryFree = totalPaise >= selectedZone.freeDeliveryThresholdPaise;
  const deliveryFeePaise = isDeliveryFree ? 0 : selectedZone.deliveryChargePaise;
  const finalPayablePaise = totalPaise + deliveryFeePaise;
  const progressPercent = Math.min(100, Math.round((totalPaise / selectedZone.freeDeliveryThresholdPaise) * 100));
  const deficitPaise = Math.max(0, selectedZone.freeDeliveryThresholdPaise - totalPaise);
  const totalSavingsPaise = Math.max(0, cart.subtotalPaise - totalPaise);

  const handleQtyChange = (productId: string, newQty: number) => {
    if (newQty < 1) return;
    startTransition(async () => {
      await updateCartQtyAction(productId, newQty);
      setCartLines((prev) =>
        prev.map((l) =>
          l.productId === productId
            ? {
                ...l,
                qty: newQty,
                pricing: {
                  ...l.pricing,
                  qty: newQty,
                  lineTotalPaise: l.pricing.unitPricePaise * newQty,
                },
              }
            : l
        )
      );
      router.refresh();
    });
  };

  const handleRemove = (productId: string) => {
    startTransition(async () => {
      await removeFromCartAction(productId);
      setCartLines((prev) => prev.filter((l) => l.productId !== productId));
      setToastMessage("Item removed from cart");
      setTimeout(() => setToastMessage(null), 2500);
      router.refresh();
    });
  };

  const handleClear = () => {
    if (confirm("Are you sure you want to empty your entire cart?")) {
      startTransition(async () => {
        await clearCartAction();
        setCartLines([]);
        router.refresh();
      });
    }
  };

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface antialiased flex flex-col">
      {toastMessage && (
        <div className="fixed top-24 right-4 z-50 bg-tertiary text-on-tertiary px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-fade-in text-sm font-semibold border border-tertiary-fixed">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <StoreHeader
        cartCount={itemsCount}
        cartTotalRupees={Math.round(totalPaise / 100)}
        userName={userName}
        isLoggedIn={true}
        categories={categories}
      />

      <main className="flex-1 w-full pt-36 bg-surface">
        <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs text-secondary uppercase tracking-widest block font-bold font-headline">
                Saharsa Quick Commerce & Bulk Slabs
              </span>
              <h1 className="font-headline text-2xl lg:text-3xl text-primary font-bold">
                Your Shopping Cart ({itemsCount} {itemsCount === 1 ? "Item" : "Items"})
              </h1>
            </div>

            {cartLines.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                disabled={isPending}
                className="text-xs text-error hover:underline flex items-center gap-1 font-semibold"
              >
                <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                Empty Cart
              </button>
            )}
          </div>

          {cartLines.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high p-12 text-center space-y-4 max-w-lg mx-auto shadow-sm">
              <span className="material-symbols-outlined text-6xl text-primary/40 block">shopping_cart</span>
              <h2 className="text-xl font-bold text-on-surface font-headline">Your Cart is Empty</h2>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                You haven&apos;t added any FMCG grocery staples or wholesale packs yet. Browse our live catalog with wholesale volume slabs.
              </p>
              <div className="pt-2">
                <Link
                  href="/store"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-container text-on-primary font-bold text-xs rounded-xl transition-colors shadow-sm"
                >
                  <span>Explore Products</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Items (8 cols) */}
              <div className="lg:col-span-8 space-y-4">
                {/* Free Delivery Meter */}
                <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-surface-container-high flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary text-[22px]">local_shipping</span>
                      <span className="text-xs md:text-sm text-on-surface font-bold">
                        {isDeliveryFree ? (
                          <span className="text-tertiary">Congratulations! You unlocked Free Town Delivery!</span>
                        ) : (
                          <>
                            Add <span className="text-secondary font-bold">₹{Math.round(deficitPaise / 100)}</span> more to unlock <span className="text-tertiary font-bold">Free Delivery!</span>
                          </>
                        )}
                      </span>
                    </div>
                    <span className="text-[11px] bg-tertiary-fixed text-on-tertiary-fixed font-bold px-2.5 py-0.5 rounded-full">
                      ₹{Math.round(totalPaise / 100)} / ₹{Math.round(selectedZone.freeDeliveryThresholdPaise / 100)}
                    </span>
                  </div>

                  <div className="w-full bg-surface-container-high rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-secondary-container h-full rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                </div>

                {/* Cart Items List */}
                <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-surface-container-high flex flex-col gap-3">
                  {cartLines.map((line) => {
                    const lineMrp = Math.round(line.mrpPaise / 100);
                    const linePrice = Math.round(line.pricing.unitPricePaise / 100);
                    const lineTotal = Math.round(line.pricing.lineTotalPaise / 100);
                    const unitSavings = lineMrp - linePrice;

                    return (
                      <div
                        key={line.productId}
                        className="bg-surface-container-low p-4 rounded-xl flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between border border-surface-container-high"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-14 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0">
                            <span className="material-symbols-outlined text-[24px]">inventory_2</span>
                          </div>
                          <div>
                            <span className="text-[10px] bg-tertiary-fixed text-on-tertiary-fixed px-1.5 py-0.2 rounded font-bold">
                              {line.pricing.tier || "CUSTOMER"} Slab
                            </span>
                            <h3 className="text-xs font-bold text-on-surface mt-0.5">
                              <Link
                                href={`/store/products/${line.productId}`}
                                className="hover:text-primary transition-colors line-clamp-1"
                              >
                                {line.productName}
                              </Link>
                            </h3>
                            <div className="flex items-baseline gap-2 mt-1">
                              <span className="text-xs font-bold text-primary font-mono">₹{linePrice}</span>
                              {unitSavings > 0 && (
                                <>
                                  <span className="text-[11px] text-outline line-through">MRP ₹{lineMrp}</span>
                                  <span className="text-[10px] text-tertiary font-bold">Save ₹{unitSavings}/pc</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4">
                          <div className="flex items-center bg-surface-container-lowest rounded-lg p-1 shadow-sm border border-surface-container-high">
                            <button
                              type="button"
                              onClick={() => handleQtyChange(line.productId, line.qty - 1)}
                              className="w-7 h-7 flex items-center justify-center text-primary hover:bg-surface-container-low rounded font-bold"
                            >
                              -
                            </button>
                            <span className="w-8 text-center text-xs font-bold text-on-surface font-mono">
                              {line.qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleQtyChange(line.productId, line.qty + 1)}
                              className="w-7 h-7 flex items-center justify-center text-primary hover:bg-surface-container-low rounded font-bold"
                            >
                              +
                            </button>
                          </div>

                          <div className="text-right min-w-[70px]">
                            <div className="text-sm font-bold text-on-surface font-mono">₹{lineTotal}</div>
                            <div className="text-[10px] text-outline">₹{linePrice}/pc</div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemove(line.productId)}
                            className="text-outline hover:text-error transition-colors p-1"
                            title="Remove item"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Order Summary (4 cols) */}
              <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-40">
                <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-surface-container-high flex flex-col gap-4">
                  <h2 className="text-sm font-bold text-on-surface font-headline border-b border-surface-container pb-2">
                    Order Summary
                  </h2>

                  <div className="space-y-2 text-xs text-on-surface-variant">
                    <div className="flex justify-between">
                      <span>Total Items</span>
                      <span className="font-bold text-on-surface">{itemsCount} products ({totalPieces} pcs)</span>
                    </div>
                    <div className="flex justify-between text-tertiary font-semibold">
                      <span>Wholesale Slab Savings</span>
                      <span className="font-mono">- ₹{Math.round(totalSavingsPaise / 100)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Estimated Delivery</span>
                      <span className={isDeliveryFree ? "text-tertiary font-bold" : "text-on-surface font-mono"}>
                        {isDeliveryFree ? "FREE" : `₹${Math.round(deliveryFeePaise / 100)}`}
                      </span>
                    </div>

                    <div className="pt-3 border-t border-surface-container flex items-baseline justify-between text-base font-bold text-on-surface">
                      <span>Estimated Total</span>
                      <span className="text-primary text-xl font-bold font-mono">
                        ₹{Math.round(finalPayablePaise / 100)}
                      </span>
                    </div>
                  </div>

                  <Link
                    href="/store/checkout"
                    className="w-full py-3 bg-primary hover:bg-primary-container text-on-primary font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm text-center"
                  >
                    <span>Proceed to Checkout</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </Link>

                  <div className="flex items-center justify-center gap-3 text-[11px] text-outline pt-1">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">bolt</span> 30 Mins Saharsa
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">receipt_long</span> GST ITC Ready
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <StoreFooter />
    </div>
  );
}
