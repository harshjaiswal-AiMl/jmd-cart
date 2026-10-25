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
    name: "Standard Delivery",
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
  const progressPercent = Math.min(
    100,
    Math.round((totalPaise / selectedZone.freeDeliveryThresholdPaise) * 100)
  );
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
    if (confirm("Are you sure you want to empty your shopping cart?")) {
      startTransition(async () => {
        await clearCartAction();
        setCartLines([]);
        router.refresh();
      });
    }
  };

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface antialiased flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-24 right-4 z-50 bg-tertiary text-on-tertiary px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 animate-fade-in text-sm font-semibold border border-tertiary-fixed">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Store Header */}
      <StoreHeader
        cartCount={itemsCount}
        cartTotalRupees={Math.round(totalPaise / 100)}
        userName={userName}
        isLoggedIn={true}
        categories={categories}
      />

      {/* Main Container - pt-48 on mobile (192px) guarantees zero overlap with 178px fixed mobile header */}
      <main className="flex-1 w-full pt-48 md:pt-40 pb-28 md:pb-16 bg-surface">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
          {/* Cart Title & Quick Summary Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-container-high pb-4">
            <div>
              <h1 className="font-headline text-2xl lg:text-3xl text-on-surface font-black tracking-tight">
                Shopping Cart
              </h1>
              <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                {itemsCount} {itemsCount === 1 ? "Product" : "Products"} • {totalPieces} Total Pieces
              </p>
            </div>

            {cartLines.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                disabled={isPending}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 transition-colors cursor-pointer px-2.5 py-1 rounded-lg hover:bg-rose-50"
              >
                <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                Empty Cart
              </button>
            )}
          </div>

          {cartLines.length === 0 ? (
            /* Empty Cart View */
            <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high p-12 text-center space-y-4 max-w-md mx-auto shadow-xs my-8">
              <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center mx-auto text-primary/40">
                <span className="material-symbols-outlined text-4xl">shopping_cart</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-on-surface font-headline">Your Cart is Empty</h2>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                  Looks like you haven&apos;t added any groceries or staples to your cart yet.
                </p>
              </div>
              <div className="pt-2">
                <Link
                  href="/store"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-container text-on-primary font-bold text-xs rounded-xl transition-all shadow-xs"
                >
                  <span>Start Shopping</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Top High-Visibility Subtotal Banner (Flipkart/Amazon style) */}
              <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-xs border border-surface-container-high flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-on-surface-variant font-medium block">
                    Subtotal ({itemsCount} {itemsCount === 1 ? "item" : "items"}):
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-headline text-2xl font-black text-primary font-mono">
                      ₹{Math.round(finalPayablePaise / 100).toLocaleString("en-IN")}
                    </span>
                    {totalSavingsPaise > 0 && (
                      <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        You save ₹{Math.round(totalSavingsPaise / 100)}
                      </span>
                    )}
                  </div>
                </div>

                <Link
                  href="/store/checkout"
                  className="px-5 py-2.5 bg-primary hover:bg-primary-container text-on-primary font-bold text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer"
                >
                  <span>Proceed to Buy</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              </div>

              {/* Free Delivery Meter */}
              <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-xs border border-surface-container-high space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-700 text-[20px]">
                      local_shipping
                    </span>
                    <span className="font-semibold text-on-surface">
                      {isDeliveryFree ? (
                        <span className="text-emerald-700 font-bold">
                          🎉 You have unlocked Free Delivery!
                        </span>
                      ) : (
                        <>
                          Add <span className="font-bold text-primary font-mono">₹{Math.round(deficitPaise / 100)}</span> more for <span className="text-emerald-700 font-bold">Free Delivery</span>
                        </>
                      )}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-on-surface-variant font-medium">
                    ₹{Math.round(totalPaise / 100)} / ₹{Math.round(selectedZone.freeDeliveryThresholdPaise / 100)}
                  </span>
                </div>

                <div className="w-full bg-surface-container-high rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Grid: Cart Items (8 cols) & Order Summary (4 cols) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
                {/* Left Column: Cart Items */}
                <div className="lg:col-span-8 space-y-3">
                  <div className="bg-surface-container-lowest rounded-2xl shadow-xs border border-surface-container-high divide-y divide-surface-container overflow-hidden">
                    {cartLines.map((line) => {
                      const lineMrp = Math.round(line.mrpPaise / 100);
                      const linePrice = Math.round(line.pricing.unitPricePaise / 100);
                      const lineTotal = Math.round(line.pricing.lineTotalPaise / 100);
                      const unitSavings = lineMrp - linePrice;

                      return (
                        <div
                          key={line.productId}
                          className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between hover:bg-surface-container-low/40 transition-colors"
                        >
                          {/* Product Info */}
                          <div className="flex items-center gap-3.5 min-w-0 flex-1">
                            <Link
                              href={`/store/products/${line.productId}`}
                              className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-white border border-surface-container-high p-1.5 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs group"
                            >
                              {line.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={line.imageUrl}
                                  alt={line.productName}
                                  className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                                />
                              ) : (
                                <span className="material-symbols-outlined text-[28px] text-outline">
                                  inventory_2
                                </span>
                              )}
                            </Link>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {line.companyName && (
                                  <span className="text-[10px] text-primary font-bold uppercase tracking-wider">
                                    {line.companyName}
                                  </span>
                                )}
                                {line.weight && (
                                  <span className="text-[10px] bg-surface-container-low text-on-surface-variant font-medium px-1.5 py-0.2 rounded">
                                    {line.weight}
                                  </span>
                                )}
                              </div>

                              <h3 className="text-xs sm:text-sm font-bold text-on-surface mt-0.5 line-clamp-2">
                                <Link
                                  href={`/store/products/${line.productId}`}
                                  className="hover:text-primary transition-colors"
                                >
                                  {line.productName}
                                </Link>
                              </h3>

                              <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                                <span className="text-sm sm:text-base font-bold text-primary font-mono">
                                  ₹{linePrice}
                                </span>
                                {unitSavings > 0 && (
                                  <>
                                    <span className="text-xs text-outline line-through">
                                      ₹{lineMrp}
                                    </span>
                                    <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded">
                                      Save ₹{unitSavings}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Stepper & Line Total Box */}
                          <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pt-2 sm:pt-0 border-t sm:border-0 border-surface-container">
                            {/* Stepper */}
                            <div className="flex items-center bg-surface-container-low rounded-lg p-1 border border-surface-container-high">
                              <button
                                type="button"
                                onClick={() => handleQtyChange(line.productId, line.qty - 1)}
                                className="w-8 h-8 flex items-center justify-center text-primary hover:bg-surface-container-lowest rounded font-bold text-base transition-colors cursor-pointer"
                                title="Decrease"
                              >
                                -
                              </button>
                              <span className="w-8 text-center text-xs font-bold text-on-surface font-mono">
                                {line.qty}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleQtyChange(line.productId, line.qty + 1)}
                                className="w-8 h-8 flex items-center justify-center text-primary hover:bg-surface-container-lowest rounded font-bold text-base transition-colors cursor-pointer"
                                title="Increase"
                              >
                                +
                              </button>
                            </div>

                            {/* Line Total */}
                            <div className="text-right min-w-[80px]">
                              <div className="text-xs text-outline font-medium">Subtotal:</div>
                              <div className="text-sm sm:text-base font-extrabold text-on-surface font-mono">
                                ₹{lineTotal}
                              </div>
                            </div>

                            {/* Delete Item */}
                            <button
                              type="button"
                              onClick={() => handleRemove(line.productId)}
                              className="text-outline hover:text-rose-600 transition-colors p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer"
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

                {/* Right Column: Order Summary (Sticky Desktop) */}
                <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-40">
                  <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-xs border border-surface-container-high flex flex-col gap-4">
                    <h2 className="text-sm font-bold text-on-surface font-headline border-b border-surface-container pb-2">
                      Price Details ({itemsCount} {itemsCount === 1 ? "Item" : "Items"})
                    </h2>

                    <div className="space-y-2.5 text-xs text-on-surface-variant">
                      <div className="flex justify-between">
                        <span>Total Items MRP</span>
                        <span className="font-mono font-semibold text-on-surface line-through">
                          ₹{Math.round(cart.subtotalPaise / 100)}
                        </span>
                      </div>

                      {totalSavingsPaise > 0 && (
                        <div className="flex justify-between text-emerald-700 font-semibold">
                          <span>Wholesale Slab Savings</span>
                          <span className="font-mono">- ₹{Math.round(totalSavingsPaise / 100)}</span>
                        </div>
                      )}

                      <div className="flex justify-between">
                        <span>Items Price</span>
                        <span className="font-mono font-bold text-on-surface">
                          ₹{Math.round(totalPaise / 100)}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span>Delivery Fee</span>
                        <span className={isDeliveryFree ? "text-emerald-700 font-bold" : "text-on-surface font-mono"}>
                          {isDeliveryFree ? "FREE" : `₹${Math.round(deliveryFeePaise / 100)}`}
                        </span>
                      </div>

                      <div className="pt-3 border-t border-surface-container flex items-baseline justify-between text-base font-bold text-on-surface">
                        <span>Total Amount</span>
                        <span className="text-primary text-2xl font-black font-mono">
                          ₹{Math.round(finalPayablePaise / 100)}
                        </span>
                      </div>
                    </div>

                    <Link
                      href="/store/checkout"
                      className="w-full py-3 bg-primary hover:bg-primary-container text-on-primary font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm text-center cursor-pointer"
                    >
                      <span>Proceed to Checkout</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </Link>

                    <div className="flex items-center justify-center gap-3 text-[11px] text-outline pt-1">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">lock</span>
                        <span>Secure Checkout</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">verified</span>
                        <span>100% Genuine</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile Sticky Bottom Checkout Bar (Ensures total is NEVER hidden on phone!) */}
              <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface-container-lowest/95 backdrop-blur-md border-t border-surface-container-high px-4 py-2.5 flex items-center justify-between gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
                <div>
                  <div className="text-[10px] text-on-surface-variant font-medium">Total Amount</div>
                  <div className="font-headline text-lg font-black text-primary font-mono">
                    ₹{Math.round(finalPayablePaise / 100)}
                  </div>
                  {isDeliveryFree && (
                    <div className="text-[10px] text-emerald-700 font-bold">Free Delivery</div>
                  )}
                </div>

                <Link
                  href="/store/checkout"
                  className="px-5 py-2.5 bg-primary hover:bg-primary-container text-on-primary font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <span>Checkout ({totalPieces} pcs)</span>
                  <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                </Link>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Store Footer */}
      <StoreFooter />
    </div>
  );
}
