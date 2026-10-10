"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { CartSummary } from "@/modules/cart/cart.service";
import { DeliveryZone } from "@/modules/delivery/delivery.types";
import { checkoutCartAction, CheckoutActionResult } from "./actions";

import { PaymentModeSettings } from "@/modules/settings/settings.types";

interface CheckoutClientProps {
  cart: CartSummary;
  deliveryZones: DeliveryZone[];
  paymentSettings: PaymentModeSettings;
  isCreditParty?: boolean;
  creditPartyName?: string;
  userPhone?: string;
  userName?: string;
  userAddress?: string;
}

function PlaceOrderButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md transition-colors disabled:opacity-50 text-center flex items-center justify-center gap-2"
    >
      {pending ? (
        <>
          <span className="animate-spin text-lg">⏳</span>
          <span>Placing Order & Reserving Stock...</span>
        </>
      ) : (
        <>
          <span>Confirm & Place Order</span>
          <span>✓</span>
        </>
      )}
    </button>
  );
}

export function CheckoutClient({
  cart,
  deliveryZones,
  paymentSettings,
  isCreditParty = false,
  creditPartyName,
  userPhone = "",
  userName = "",
  userAddress = "",
}: CheckoutClientProps) {
  const [selectedZoneCode, setSelectedZoneCode] = useState<string>(
    deliveryZones.length > 0 ? deliveryZones[0].code : "TOWN"
  );

  // Default payment selection based on active settings
  const defaultMode = paymentSettings.codEnabled
    ? "COD"
    : paymentSettings.upiDeliveryEnabled
    ? "UPI_DELIVERY"
    : isCreditParty && paymentSettings.creditEnabledForCreditParties
    ? "CREDIT"
    : paymentSettings.onlineGatewayEnabled
    ? "ONLINE_GATEWAY"
    : "COD";

  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string>(defaultMode);

  const [state, formAction] = useFormState<CheckoutActionResult | undefined, FormData>(
    checkoutCartAction,
    undefined
  );

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
  const minOrderMet = cart.totalPaise >= selectedZone.minOrderPaise;

  const mrpTotalRupees = (cart.subtotalPaise / 100).toFixed(2);
  const discountRupees = (cart.lineDiscountPaise / 100).toFixed(2);
  const taxableRupees = (cart.taxablePaise / 100).toFixed(2);
  const taxRupees = (cart.totalTaxPaise / 100).toFixed(2);
  const itemsTotalRupees = (cart.totalPaise / 100).toFixed(2);
  const deliveryFeeRupees = (deliveryFeePaise / 100).toFixed(2);
  const finalPayableRupees = (finalPayablePaise / 100).toFixed(2);

  if (state?.success && state.orderNumber) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 md:p-12 text-center max-w-xl mx-auto shadow-sm space-y-6">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl font-bold">
          ✓
        </div>

        <div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-wider border border-emerald-200">
            Order Placed Successfully
          </span>
          <h2 className="text-2xl font-black text-slate-900 mt-2">
            Order #{state.orderNumber}
          </h2>
          <p className="text-sm text-slate-600 mt-2">
            Thank you, <span className="font-semibold">{userName || "Customer"}</span>! Your order has been placed and inventory is reserved at our Saharsa distribution godown.
          </p>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-500">Destination:</span>
            <span className="font-semibold text-slate-800">{selectedZone.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Dispatch Window:</span>
            <span className="font-semibold text-slate-800">
              Within {selectedZone.estimatedDeliveryHours || 24} hours
            </span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-sm">
            <span>Total Payable:</span>
            <span className="font-mono text-blue-600">₹{finalPayableRupees}</span>
          </div>
          <div className="text-[11px] text-slate-500 pt-1">
            Payment Mode: Cash on Delivery / UPI upon arrival. Dispatcher will verify details before departure.
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link
            href="/store"
            className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors text-center"
          >
            ← Back to Store
          </Link>
          <Link
            href="/store/orders"
            className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-semibold text-sm transition-colors text-center"
          >
            View My Orders
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Checkout & Delivery Details</h1>
          <p className="text-xs text-slate-500">
            Confirm your destination zone, delivery address, and contact number.
          </p>
        </div>
        <Link
          href="/store/cart"
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
        >
          ← Edit Shopping Cart ({cart.itemsCount} items)
        </Link>
      </div>

      {state?.error && (
        <div className="p-4 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-sm font-medium flex items-center gap-2">
          <span>⚠️</span>
          <span>{state.error}</span>
        </div>
      )}

      <form action={formAction} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Form: Delivery Information */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">1. Delivery Destination & Address</h3>
            <p className="text-xs text-slate-500">
              Our Saharsa distribution van fleet will deliver directly to your retail counter or doorstep.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Delivery Zone / Destination Area
              </label>
              <select
                name="deliveryZoneCode"
                value={selectedZoneCode}
                onChange={(e) => setSelectedZoneCode(e.target.value)}
                className="mt-1 block w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:ring-blue-500 focus:border-blue-500"
              >
                {deliveryZones.map((z) => (
                  <option key={z.code} value={z.code}>
                    {z.name} (Free delivery above ₹{(z.freeDeliveryThresholdPaise / 100).toFixed(0)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Full Delivery Address & Landmark
              </label>
              <textarea
                name="deliveryAddress"
                defaultValue={userAddress}
                required
                rows={3}
                placeholder="Shop Name / House No., Landmark, Road/Ward, Saharsa, Bihar - 852201"
                className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Contact Mobile Number
                </label>
                <input
                  type="tel"
                  name="contactPhone"
                  defaultValue={userPhone}
                  required
                  maxLength={10}
                  placeholder="9876543210"
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Customer / Business Name
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  defaultValue={userName}
                  className="mt-1 block w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-600 cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Delivery Notes / Dispatch Instructions (Optional)
              </label>
              <input
                type="text"
                name="customerNotes"
                placeholder="e.g. Call before delivery, deliver in morning before 11 AM"
                className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Payment Mode</h3>
                <p className="text-xs text-slate-500">
                  Select your preferred settlement method for this delivery.
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 font-semibold rounded-full border border-blue-200">
                Settlement
              </span>
            </div>

            <input type="hidden" name="paymentMode" value={selectedPaymentMode} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* 1. Cash on Delivery */}
              {paymentSettings.codEnabled && (
                <label
                  onClick={() => setSelectedPaymentMode("COD")}
                  className={`relative flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    selectedPaymentMode === "COD"
                      ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentModeRadio"
                    value="COD"
                    checked={selectedPaymentMode === "COD"}
                    onChange={() => setSelectedPaymentMode("COD")}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">Cash on Delivery</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold uppercase">
                        COD
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Hand cash to delivery van agent upon bill verification and receipt generation.
                    </p>
                  </div>
                </label>
              )}

              {/* 2. UPI QR on Delivery */}
              {paymentSettings.upiDeliveryEnabled && (
                <label
                  onClick={() => setSelectedPaymentMode("UPI_DELIVERY")}
                  className={`relative flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    selectedPaymentMode === "UPI_DELIVERY"
                      ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentModeRadio"
                    value="UPI_DELIVERY"
                    checked={selectedPaymentMode === "UPI_DELIVERY"}
                    onChange={() => setSelectedPaymentMode("UPI_DELIVERY")}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">UPI QR on Delivery</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded font-bold uppercase">
                        Van QR
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Scan dynamic delivery boy UPI QR code via Google Pay, PhonePe, or Paytm.
                    </p>
                  </div>
                </label>
              )}

              {/* 3. Party Credit (Only for verified credit parties) */}
              {paymentSettings.creditEnabledForCreditParties && isCreditParty && (
                <label
                  onClick={() => setSelectedPaymentMode("CREDIT")}
                  className={`relative flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    selectedPaymentMode === "CREDIT"
                      ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentModeRadio"
                    value="CREDIT"
                    checked={selectedPaymentMode === "CREDIT"}
                    onChange={() => setSelectedPaymentMode("CREDIT")}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">Ledger Credit</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-bold uppercase">
                        Approved
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Charge against verified distributor ledger ({creditPartyName || "Active Credit Account"}).
                    </p>
                  </div>
                </label>
              )}

              {/* 4. Online Payment Gateway (Disabled/Off by default) */}
              {paymentSettings.onlineGatewayEnabled ? (
                <label
                  onClick={() => setSelectedPaymentMode("ONLINE_GATEWAY")}
                  className={`relative flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    selectedPaymentMode === "ONLINE_GATEWAY"
                      ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentModeRadio"
                    value="ONLINE_GATEWAY"
                    checked={selectedPaymentMode === "ONLINE_GATEWAY"}
                    onChange={() => setSelectedPaymentMode("ONLINE_GATEWAY")}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        Online Gateway ({paymentSettings.gatewayProvider.toUpperCase()})
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold uppercase">
                        Live
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Pay instantly with Netbanking, Debit/Credit Card, or Instant UPI.
                    </p>
                  </div>
                </label>
              ) : (
                <div className="relative flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed">
                  <input
                    type="radio"
                    name="paymentModeRadio"
                    disabled
                    className="mt-1 h-4 w-4 text-slate-400 cursor-not-allowed"
                  />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-500">Online Payment Gateway</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded font-bold uppercase">
                        Offline / Disabled
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Prepaid gateway payments currently turned off per distributor policy. Please settle on delivery.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-800 flex items-start gap-2">
              <span className="text-blue-600 font-bold">ℹ️</span>
              <div>
                <span className="font-bold">Distributor Payment Policy:</span> In accordance with FMCG distributor operations in Saharsa, orders are primarily verified at van arrival and settled via Cash or Van QR, unless pre-arranged on approved ledger credit.
              </div>
            </div>
          </div>
        </div>

        {/* Right Summary Card */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 sticky top-24">
            <h3 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
              Order Summary ({cart.itemsCount} Items)
            </h3>

            {/* Selected Zone Threshold Banner */}
            {isDeliveryFree ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2">
                <span>🎉</span>
                <span>FREE Delivery applied for {selectedZone.name}!</span>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                <span className="font-bold block">Standard Delivery Fee: ₹{(selectedZone.deliveryChargePaise / 100).toFixed(0)}</span>
                <p>
                  Add ₹{(deficitToFreeDeliveryPaise / 100).toFixed(2)} more to qualify for free van delivery.
                </p>
              </div>
            )}

            {!minOrderMet && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-semibold">
                ⚠️ Order total does not meet the minimum order requirement of ₹{(selectedZone.minOrderPaise / 100).toFixed(0)} for {selectedZone.name}.
              </div>
            )}

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Retail MRP Total:</span>
                <span className="font-mono font-medium">₹{mrpTotalRupees}</span>
              </div>

              {cart.lineDiscountPaise > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Dynamic Slab Discount ({cart.buyerTag}):</span>
                  <span className="font-mono">- ₹{discountRupees}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-600 pt-2 border-t border-slate-100">
                <span>Taxable Value:</span>
                <span className="font-mono font-medium">₹{taxableRupees}</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>GST (CGST + SGST):</span>
                <span className="font-mono font-medium">₹{taxRupees}</span>
              </div>

              {cart.roundOffPaise !== 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Round-off:</span>
                  <span className="font-mono">
                    {cart.roundOffPaise > 0 ? "+" : ""}₹{(cart.roundOffPaise / 100).toFixed(2)}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-slate-700 pt-2 border-t border-slate-100">
                <span>Items Subtotal:</span>
                <span className="font-mono font-medium">₹{itemsTotalRupees}</span>
              </div>

              <div className="flex justify-between items-center text-slate-700">
                <span>Delivery Charge:</span>
                <span className={`font-mono font-semibold ${isDeliveryFree ? "text-emerald-600" : "text-slate-900"}`}>
                  {isDeliveryFree ? "FREE" : `+ ₹${deliveryFeeRupees}`}
                </span>
              </div>

              <div className="flex justify-between items-baseline pt-3 border-t border-slate-200 text-slate-900">
                <span className="text-sm font-bold">Total Amount:</span>
                <span className="text-2xl font-black font-mono text-blue-600">
                  ₹{finalPayableRupees}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <PlaceOrderButton disabled={!minOrderMet} />
            </div>

            <div className="text-[11px] text-slate-400 text-center leading-tight">
              By confirming, inventory is reserved from Saharsa central warehouse. One combined invoice will be issued upon dispatch.
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
