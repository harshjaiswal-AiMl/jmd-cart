"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CartSummary } from "@/modules/cart/cart.service";
import { DeliveryZone } from "@/modules/delivery/delivery.types";
import { updateCartQtyAction, removeFromCartAction, clearCartAction } from "./actions";

interface CartViewClientProps {
  cart: CartSummary;
  deliveryZones?: DeliveryZone[];
  userPhone?: string;
  userName?: string;
}

export function CartViewClient({
  cart,
  deliveryZones = [],
  userPhone,
  userName,
}: CartViewClientProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedZoneCode, setSelectedZoneCode] = useState<string>(
    deliveryZones.length > 0 ? deliveryZones[0].code : "TOWN"
  );

  const handleQtyChange = (productId: string, newQty: number) => {
    startTransition(async () => {
      await updateCartQtyAction(productId, newQty);
    });
  };

  const handleRemove = (productId: string) => {
    startTransition(async () => {
      await removeFromCartAction(productId);
    });
  };

  const handleClear = () => {
    if (confirm("Are you sure you want to clear your cart?")) {
      startTransition(async () => {
        await clearCartAction();
      });
    }
  };

  const selectedZone = deliveryZones.find((z) => z.code === selectedZoneCode) || deliveryZones[0] || {
    code: "TOWN",
    name: "Saharsa Town",
    minOrderPaise: 50000,
    freeDeliveryThresholdPaise: 200000,
    deliveryChargePaise: 5000,
    estimatedDeliveryHours: 4,
    active: true,
  };

  const isDeliveryFree = cart.totalPaise >= selectedZone.freeDeliveryThresholdPaise;
  const deliveryFeePaise = isDeliveryFree ? 0 : selectedZone.deliveryChargePaise;
  const finalPayablePaise = cart.totalPaise + deliveryFeePaise;
  const deficitToFreeDeliveryPaise = isDeliveryFree
    ? 0
    : Math.max(0, selectedZone.freeDeliveryThresholdPaise - cart.totalPaise);

  const mrpTotalRupees = (cart.subtotalPaise / 100).toFixed(2);
  const discountRupees = (cart.lineDiscountPaise / 100).toFixed(2);
  const taxableRupees = (cart.taxablePaise / 100).toFixed(2);
  const taxRupees = (cart.totalTaxPaise / 100).toFixed(2);
  const itemsTotalRupees = (cart.totalPaise / 100).toFixed(2);
  const deliveryFeeRupees = (deliveryFeePaise / 100).toFixed(2);
  const finalPayableRupees = (finalPayablePaise / 100).toFixed(2);

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case "WHOLESALER":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "RETAILER":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  if (cart.itemsCount === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 max-w-lg mx-auto shadow-sm">
        <span className="text-5xl block">🛒</span>
        <h2 className="text-xl font-bold text-slate-800">Your Cart is Empty</h2>
        <p className="text-sm text-slate-500">
          Looks like you haven&apos;t added any FMCG products to your cart yet. Explore our wholesale catalog to unlock quantity discounts.
        </p>
        <div className="pt-2">
          <Link
            href="/store"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-colors shadow-sm"
          >
            <span>Start Shopping</span>
            <span>→</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Buyer Tag / Dynamic Pricing Banner */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-2xl p-5 md:p-6 text-white shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-200">
              Live Order Buyer Classification:
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getTierBadge(cart.buyerTag)}`}>
              {cart.buyerTag} PRICING
            </span>
          </div>
          <p className="text-xs text-blue-100 mt-1 max-w-xl">
            {cart.buyerTag === "WHOLESALER"
              ? "Wholesaler tier unlocked! You are receiving the distributor's deepest quantity rate across applicable bulk lines."
              : cart.buyerTag === "RETAILER"
              ? "Retailer wholesale pricing unlocked! Add full cartons to unlock top wholesaler rates."
              : "Standard customer rates. Increase order pieces or order full cartons to unlock retailer wholesale slabs!"}
          </p>
        </div>

        {cart.lineDiscountPaise > 0 && (
          <div className="bg-white/10 px-4 py-2.5 rounded-xl border border-white/20 text-right backdrop-blur-sm">
            <div className="text-[11px] text-blue-100 uppercase tracking-wider font-medium">Wholesale Savings</div>
            <div className="text-lg font-black text-emerald-300 font-mono">₹{discountRupees} OFF</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Cart Line Items */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">
              Order Items ({cart.itemsCount} products, {cart.totalPieces} pcs)
            </h2>
            <button
              onClick={handleClear}
              disabled={isPending}
              className="text-xs text-rose-600 hover:text-rose-700 hover:underline font-semibold"
            >
              Clear Cart
            </button>
          </div>

          <div className="space-y-3">
            {cart.lines.map((line) => {
              const lineMrpRupees = ((line.mrpPaise * line.qty) / 100).toFixed(2);
              const lineUnitRupees = (line.pricing.unitPricePaise / 100).toFixed(2);
              const lineTotalRupees = (line.pricing.lineTotalPaise / 100).toFixed(2);
              const hasDiscount = line.pricing.slabDiscountBp > 0;

              return (
                <div
                  key={line.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-slate-300 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  {/* Product Info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center shrink-0 p-1">
                      {line.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={line.imageUrl}
                          alt={line.productName}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-xl">🛍️</span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="text-[11px] font-mono text-slate-400">
                        {line.companyName ? `${line.companyName} • ` : ""}
                        {line.shortCode}
                      </div>
                      <Link
                        href={`/store/products/${line.productId}`}
                        className="font-bold text-sm text-slate-900 hover:text-blue-600 truncate block"
                      >
                        {line.productName}
                      </Link>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Pack: {line.packSize} pcs per {line.packLabel}
                        <span className="ml-2 font-medium text-slate-700">
                          ({line.cartonsCount} {line.packLabel}{line.cartonsCount !== 1 ? "s" : ""}
                          {line.looseCount > 0 ? ` + ${line.looseCount} loose` : ""})
                        </span>
                      </div>

                      {hasDiscount && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded border border-emerald-200">
                            {(line.pricing.slabDiscountBp / 100).toFixed(0)}% SLAB OFF
                          </span>
                          <span className="text-[10px] text-slate-400 line-through font-mono">
                            MRP ₹{(line.mrpPaise / 100).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quantity Stepper & Price */}
                  <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleQtyChange(line.productId, line.qty - 1)}
                        disabled={isPending}
                        className="w-8 h-8 rounded-lg border border-slate-300 hover:bg-slate-100 text-sm font-bold flex items-center justify-center transition-colors disabled:opacity-50"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={line.qty}
                        onChange={(e) =>
                          handleQtyChange(line.productId, parseInt(e.target.value) || 1)
                        }
                        disabled={isPending}
                        className="w-16 text-center font-bold text-sm font-mono border border-slate-300 rounded-lg py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        onClick={() => handleQtyChange(line.productId, line.qty + 1)}
                        disabled={isPending}
                        className="w-8 h-8 rounded-lg border border-slate-300 hover:bg-slate-100 text-sm font-bold flex items-center justify-center transition-colors disabled:opacity-50"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-right min-w-[90px]">
                      <div className="text-base font-extrabold text-slate-900 font-mono">
                        ₹{lineTotalRupees}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        @ ₹{lineUnitRupees} / pc
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemove(line.productId)}
                      disabled={isPending}
                      className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                      title="Remove from cart"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Order Summary Card */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 sticky top-24">
            <h3 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
              Price & Tax Breakdown
            </h3>

            {/* Delivery Destination Zone Selector */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Delivery Destination</span>
                <span className="text-[11px] text-blue-600 font-medium">
                  {selectedZone.estimatedDeliveryHours ? `~${selectedZone.estimatedDeliveryHours}h dispatch` : "Van delivery"}
                </span>
              </div>
              <select
                value={selectedZoneCode}
                onChange={(e) => setSelectedZoneCode(e.target.value)}
                className="w-full text-xs font-semibold px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-blue-500 focus:border-blue-500"
              >
                {deliveryZones.map((z) => (
                  <option key={z.code} value={z.code}>
                    {z.name} (Free above ₹{(z.freeDeliveryThresholdPaise / 100).toFixed(0)})
                  </option>
                ))}
              </select>

              {/* Free delivery deficit banner */}
              {isDeliveryFree ? (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                  <span>🎉</span>
                  <span>FREE Delivery Unlocked for {selectedZone.name}!</span>
                </div>
              ) : (
                <div className="text-[11px] text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-md border border-amber-200 leading-tight">
                  <span className="font-bold">Add ₹{(deficitToFreeDeliveryPaise / 100).toFixed(2)} more</span> of items for FREE delivery to {selectedZone.name} (Standard fee: ₹{(selectedZone.deliveryChargePaise / 100).toFixed(0)}).
                </div>
              )}
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Retail MRP Total:</span>
                <span className="font-mono font-medium">₹{mrpTotalRupees}</span>
              </div>

              {cart.lineDiscountPaise > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Dynamic Slab Discount:</span>
                  <span className="font-mono">- ₹{discountRupees}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-600 pt-2 border-t border-slate-100">
                <span>Taxable Amount:</span>
                <span className="font-mono font-medium">₹{taxableRupees}</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>GST (CGST + SGST split):</span>
                <span className="font-mono font-medium">₹{taxRupees}</span>
              </div>

              {cart.roundOffPaise !== 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Round-off:</span>
                  <span className="font-mono">
                    {cart.roundOffPaise > 0 ? "+" : ""}
                    ₹{(cart.roundOffPaise / 100).toFixed(2)}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-slate-600 pt-2 border-t border-slate-100">
                <span>Items Subtotal:</span>
                <span className="font-mono font-medium">₹{itemsTotalRupees}</span>
              </div>

              <div className="flex justify-between items-center text-slate-700">
                <span>Delivery Charges ({selectedZone.code}):</span>
                <span className={`font-mono font-semibold ${isDeliveryFree ? "text-emerald-600" : "text-slate-900"}`}>
                  {isDeliveryFree ? "FREE" : `+ ₹${deliveryFeeRupees}`}
                </span>
              </div>

              <div className="flex justify-between items-baseline pt-3 border-t border-slate-200 text-slate-900">
                <span className="text-sm font-bold">Estimated Payable:</span>
                <span className="text-2xl font-black font-mono text-blue-600">
                  ₹{finalPayableRupees}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => alert(`Ready to Checkout to ${selectedZone.name}! Task 3.5 Checkout & Order Reservation next up.`)}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-sm transition-colors text-center block"
              >
                Proceed to Checkout →
              </button>
            </div>

            <div className="pt-2 text-center">
              <Link
                href="/store"
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold hover:underline"
              >
                ← Continue Adding FMCG Products
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
