"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface CartItem {
  id: string;
  productId: string;
  name: string;
  shortCode?: string;
  imageUrl?: string | null;
  weight?: string | null;
  packSize: number;
  packLabel?: string;
  quantity: number;
  mrpPaise: number;
  unitPricePaise: number;
  gstRateBp: number;
  lineTotalPaise: number;
  totalAvailableQty: number;
}

export function CartPageClient() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({});

  const freeDeliveryThreshold = 2000; // Rs. 2,000 threshold

  const fetchCart = async () => {
    try {
      const res = await fetch("/api/store/v1/cart");
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
    fetchCart();
    const handleUpdate = () => fetchCart();
    window.addEventListener("cart-updated", handleUpdate);
    return () => window.removeEventListener("cart-updated", handleUpdate);
  }, []);

  const updateQuantity = async (productId: string, newQty: number) => {
    if (newQty < 1) {
      return removeItem(productId);
    }

    setIsUpdating((prev) => ({ ...prev, [productId]: true }));
    try {
      const res = await fetch("/api/store/v1/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: newQty }),
      });
      if (res.ok) {
        await fetchCart();
        window.dispatchEvent(new Event("cart-updated"));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsUpdating((prev) => ({ ...prev, [productId]: false }));
    }
  };

  const removeItem = async (productId: string) => {
    setIsUpdating((prev) => ({ ...prev, [productId]: true }));
    try {
      const res = await fetch("/api/store/v1/cart", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      if (res.ok) {
        await fetchCart();
        window.dispatchEvent(new Event("cart-updated"));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsUpdating((prev) => ({ ...prev, [productId]: false }));
    }
  };

  // Calculations
  const subtotalPaise = items.reduce((sum, item) => sum + item.lineTotalPaise, 0);
  const totalMrpPaise = items.reduce((sum, item) => sum + item.mrpPaise * item.quantity, 0);
  const savingsPaise = Math.max(0, totalMrpPaise - subtotalPaise);

  const subtotalRs = subtotalPaise / 100;
  const savingsRs = savingsPaise / 100;
  const deliveryFeeRs = subtotalRs >= freeDeliveryThreshold || subtotalRs === 0 ? 0 : 49;
  const grandTotalRs = subtotalRs + deliveryFeeRs;
  const amountNeededForFreeDelivery = Math.max(0, freeDeliveryThreshold - subtotalRs);
  const freeDeliveryProgress = Math.min(100, Math.round((subtotalRs / freeDeliveryThreshold) * 100));

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="mt-4 text-sm font-semibold text-on-surface-variant">
          Loading your basket...
        </span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-16 text-center bg-surface-container-lowest rounded-3xl border border-outline-variant/20 p-8 sm:p-12 shadow-sm max-w-2xl mx-auto my-8">
        <div className="w-20 h-20 bg-surface-container-low rounded-full flex items-center justify-center mx-auto text-outline">
          <span className="material-symbols-outlined text-4xl">shopping_cart</span>
        </div>
        <h2 className="mt-4 text-2xl font-bold font-serif text-on-surface">Your Basket is Empty</h2>
        <p className="mt-2 text-sm text-on-surface-variant max-w-md mx-auto">
          Explore our wide range of grains, edible oils, spices and daily kirana essentials with wholesale mandi discounts.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/categories"
            className="px-6 py-3 rounded-xl bg-primary text-on-primary font-bold text-sm hover:bg-primary-container transition-colors shadow-sm"
          >
            Explore Categories
          </Link>
          <Link
            href="/wholesale"
            className="px-6 py-3 rounded-xl bg-surface-container-low text-on-surface font-bold text-sm hover:bg-surface-container transition-colors"
          >
            View Wholesale Hub
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-6">
      {/* Left: Cart Items List (8 cols) */}
      <div className="lg:col-span-8 space-y-4">
        {/* Free Delivery Meter */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/20 shadow-sm">
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-on-surface mb-2">
            <span className="flex items-center gap-1.5 text-primary">
              <span className="material-symbols-outlined text-lg">local_shipping</span>
              {amountNeededForFreeDelivery === 0 ? (
                <span className="text-tertiary">Congratulations! You unlocked FREE Delivery</span>
              ) : (
                <span>Add ₹{amountNeededForFreeDelivery.toFixed(0)} more for FREE Delivery!</span>
              )}
            </span>
            <span className="text-on-surface-variant font-mono">{freeDeliveryProgress}%</span>
          </div>
          <div className="w-full h-2.5 bg-surface-container-low rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                amountNeededForFreeDelivery === 0 ? "bg-tertiary" : "bg-primary"
              }`}
              style={{ width: `${freeDeliveryProgress}%` }}
            />
          </div>
        </div>

        {/* Items Card */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden divide-y divide-outline-variant/15">
          <div className="p-4 bg-surface-container-low/50 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            <span>Items in Basket ({items.length})</span>
            <span>Total: ₹{subtotalRs.toFixed(2)}</span>
          </div>

          {items.map((item) => {
            const unitPrice = item.unitPricePaise / 100;
            const mrp = item.mrpPaise / 100;
            const isUpdatingItem = isUpdating[item.productId];

            const cartonsCount = Math.floor(item.quantity / Math.max(1, item.packSize));
            const looseCount = item.quantity % Math.max(1, item.packSize);

            return (
              <div key={item.id} className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-surface-container-low shrink-0 p-2 flex items-center justify-center">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain" />
                    ) : (
                      <span className="material-symbols-outlined text-outline text-2xl">inventory_2</span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-on-surface leading-snug">
                      {item.name}
                    </h3>
                    <div className="text-xs text-on-surface-variant flex items-center gap-2 mt-1">
                      {item.weight && <span>{item.weight}</span>}
                      {item.packSize > 1 && (
                        <span className="bg-surface-container px-2 py-0.5 rounded text-[11px] font-medium">
                          {cartonsCount > 0 ? `${cartonsCount} Box ` : ""}
                          {looseCount > 0 ? `+ ${looseCount} Loose` : ""}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="font-bold font-mono text-sm text-primary">₹{unitPrice.toFixed(2)}</span>
                      {mrp > unitPrice && (
                        <span className="text-xs font-mono text-outline line-through">₹{mrp.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-3">
                  <div className="text-right">
                    <span className="font-bold font-mono text-base text-on-surface">
                      ₹{(item.lineTotalPaise / 100).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-surface-container-low rounded-lg p-0.5 border border-outline-variant/30">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        disabled={isUpdatingItem}
                        className="w-8 h-8 flex items-center justify-center text-primary font-bold hover:bg-surface-container rounded"
                      >
                        -
                      </button>
                      <span className="w-9 text-center font-mono font-bold text-xs text-on-surface">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        disabled={isUpdatingItem}
                        className="w-8 h-8 flex items-center justify-center text-primary font-bold hover:bg-surface-container rounded"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.productId)}
                      disabled={isUpdatingItem}
                      className="p-1.5 text-outline hover:text-error rounded-lg hover:bg-error-container/20 transition-colors"
                      title="Remove item"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Bill Summary (4 cols) */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20 shadow-sm space-y-4">
          <h2 className="font-bold text-lg font-serif text-on-surface border-b border-outline-variant/15 pb-3">
            Order Bill Summary
          </h2>

          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between text-on-surface-variant">
              <span>Items Total (MRP)</span>
              <span className="font-mono">₹{(totalMrpPaise / 100).toFixed(2)}</span>
            </div>

            {savingsRs > 0 && (
              <div className="flex justify-between text-tertiary font-semibold">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">savings</span>
                  Instant Mandi Discount
                </span>
                <span className="font-mono">-₹{savingsRs.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-on-surface-variant">
              <span>Delivery Charges</span>
              <span className="font-mono">
                {deliveryFeeRs === 0 ? (
                  <span className="text-tertiary font-bold">FREE</span>
                ) : (
                  `₹${deliveryFeeRs.toFixed(2)}`
                )}
              </span>
            </div>

            <div className="pt-3 border-t border-outline-variant/15 flex justify-between items-baseline font-bold">
              <span className="text-base text-on-surface">To Pay</span>
              <span className="text-2xl font-mono text-primary">₹{grandTotalRs.toFixed(2)}</span>
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Inclusive of all taxes &amp; GST input credit invoice.
            </p>
          </div>

          {savingsRs > 0 && (
            <div className="bg-tertiary-fixed/30 text-tertiary p-3 rounded-xl text-xs font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-base">celebration</span>
              You are saving ₹{savingsRs.toFixed(2)} on this order!
            </div>
          )}

          <Link
            href="/checkout"
            className="w-full py-3.5 px-6 rounded-xl bg-primary text-on-primary font-bold text-sm sm:text-base hover:bg-primary-container transition-all shadow-md flex items-center justify-center gap-2"
          >
            <span>Proceed to Checkout</span>
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </Link>
        </div>

        {/* Saharsa Mandi Delivery Trust Card */}
        <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/20 text-xs text-on-surface-variant space-y-2">
          <div className="flex items-center gap-2 font-bold text-on-surface">
            <span className="material-symbols-outlined text-primary text-lg">verified_user</span>
            JMD Cart Guarantee
          </div>
          <p>
            Zero cancellation charges before packing. Same-day truck delivery available across Saharsa city, Sonbarsa, and Simri Bakhtiarpur.
          </p>
        </div>
      </div>
    </div>
  );
}
