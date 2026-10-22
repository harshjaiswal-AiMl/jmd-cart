"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface CartItem {
  id: string;
  productId: string;
  name: string;
  imageUrl?: string | null;
  weight?: string | null;
  packSize: number;
  packLabel?: string;
  quantity: number;
  mrpPaise: number;
  unitPricePaise: number;
  lineTotalPaise: number;
}

export function CheckoutPageClient() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Address fields
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [landmark, setLandmark] = useState("");
  const [city, setCity] = useState("Saharsa");
  const [pincode, setPincode] = useState("852201");

  // Delivery slot
  const [deliverySlot, setDeliverySlot] = useState("TODAY_EXPRESS");

  // GST
  const [wantGst, setWantGst] = useState(false);
  const [gstin, setGstin] = useState("");
  const [tradeName, setTradeName] = useState("");

  // Payment method
  const [paymentMode, setPaymentMode] = useState<"COD" | "UPI" | "CREDIT">("COD");

  useEffect(() => {
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
    fetchCart();
  }, []);

  const subtotalPaise = items.reduce((sum, item) => sum + item.lineTotalPaise, 0);
  const totalMrpPaise = items.reduce((sum, item) => sum + item.mrpPaise * item.quantity, 0);
  const savingsPaise = Math.max(0, totalMrpPaise - subtotalPaise);
  const subtotalRs = subtotalPaise / 100;
  const savingsRs = savingsPaise / 100;
  const deliveryFeeRs = subtotalRs >= 2000 || subtotalRs === 0 ? 0 : 49;
  const grandTotalRs = subtotalRs + deliveryFeeRs;

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!customerName.trim()) {
      setErrorMessage("Please enter your full name");
      return;
    }
    if (!customerPhone.trim() || customerPhone.replace(/\D/g, "").length < 10) {
      setErrorMessage("Please enter a valid 10-digit mobile number");
      return;
    }
    if (!addressLine.trim()) {
      setErrorMessage("Please enter your delivery street / area address");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: customerName,
        phone: customerPhone,
        address: `${addressLine}${landmark ? `, Near ${landmark}` : ""}, ${city} - ${pincode}`,
        deliverySlot,
        gstin: wantGst ? gstin : undefined,
        tradeName: wantGst ? tradeName : undefined,
        paymentMode,
      };

      const res = await fetch("/api/store/v1/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to place order. Please try again.");
      }

      window.dispatchEvent(new Event("cart-updated"));
      const orderId = data.data?.orderId || "JMD-" + Math.floor(100000 + Math.random() * 900000);
      router.push(`/order-success?orderId=${orderId}&phone=${encodeURIComponent(customerPhone)}`);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit order");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="mt-4 text-sm font-semibold text-on-surface-variant">
          Preparing checkout...
        </span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-16 text-center bg-surface-container-lowest rounded-3xl border border-outline-variant/20 p-8 sm:p-12 shadow-sm max-w-lg mx-auto my-8">
        <span className="material-symbols-outlined text-5xl text-outline">shopping_bag</span>
        <h2 className="mt-4 text-xl font-bold font-serif text-on-surface">Your Basket is Empty</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          Add items to your basket before proceeding to checkout.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-sm hover:bg-primary-container transition-colors shadow-sm"
        >
          Explore Catalog
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-6">
      {/* Left: Shipping, Delivery & Payment details (7 cols) */}
      <div className="lg:col-span-7 space-y-6">
        {errorMessage && (
          <div className="p-4 rounded-xl bg-error-container text-on-error-container text-sm font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 1. Delivery Address Card */}
        <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 border border-outline-variant/20 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-outline-variant/15 pb-3">
            <h2 className="font-bold text-base sm:text-lg font-serif text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">location_on</span>
              1. Delivery Address (Saharsa Central)
            </h2>
            <span className="text-xs font-semibold text-tertiary bg-tertiary-fixed/30 px-2 py-0.5 rounded">
              Local Delivery
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Ramesh Kumar / Maa Durga Stores"
                className="w-full bg-surface-container-low text-on-surface px-3.5 py-2.5 rounded-xl border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary font-medium text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                Mobile Number (WhatsApp Enabled) *
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-xs font-bold text-on-surface-variant">+91</span>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ""))}
                  placeholder="98765 43210"
                  className="w-full bg-surface-container-low text-on-surface pl-11 pr-3.5 py-2.5 rounded-xl border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary font-medium text-sm font-mono"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                Street Address / Ward / Shop Location *
              </label>
              <input
                type="text"
                required
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                placeholder="e.g. Near Purab Bazar Dhalan, Ward No. 12"
                className="w-full bg-surface-container-low text-on-surface px-3.5 py-2.5 rounded-xl border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary font-medium text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                Landmark
              </label>
              <input
                type="text"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="e.g. Near Shiv Mandir / Railway Gumti"
                className="w-full bg-surface-container-low text-on-surface px-3.5 py-2.5 rounded-xl border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary font-medium text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  readOnly
                  className="w-full bg-surface-container text-on-surface px-3 py-2.5 rounded-xl border border-outline-variant/20 font-bold text-sm cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                  Pincode
                </label>
                <input
                  type="text"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  className="w-full bg-surface-container-low text-on-surface px-3 py-2.5 rounded-xl border border-outline-variant/30 font-mono font-bold text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 2. Delivery Slot Card */}
        <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 border border-outline-variant/20 shadow-sm space-y-4">
          <h2 className="font-bold text-base sm:text-lg font-serif text-on-surface flex items-center gap-2 border-b border-outline-variant/15 pb-3">
            <span className="material-symbols-outlined text-primary text-xl">schedule</span>
            2. Delivery Schedule &amp; Slot
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                deliverySlot === "TODAY_EXPRESS"
                  ? "border-primary bg-primary-fixed/20 shadow-sm"
                  : "border-outline-variant/20 bg-surface-container-low hover:border-outline"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-on-surface">Express Tempo Dispatch</span>
                <input
                  type="radio"
                  name="deliverySlot"
                  checked={deliverySlot === "TODAY_EXPRESS"}
                  onChange={() => setDeliverySlot("TODAY_EXPRESS")}
                  className="text-primary focus:ring-primary"
                />
              </div>
              <div className="mt-2 text-xs text-on-surface font-semibold">Today within 2 Hours</div>
              <div className="text-[11px] text-on-surface-variant mt-0.5">
                Saharsa Nagar Nigam electric tempo fleet
              </div>
            </label>

            <label
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                deliverySlot === "TOMORROW_MORNING"
                  ? "border-primary bg-primary-fixed/20 shadow-sm"
                  : "border-outline-variant/20 bg-surface-container-low hover:border-outline"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-on-surface">Tomorrow Morning</span>
                <input
                  type="radio"
                  name="deliverySlot"
                  checked={deliverySlot === "TOMORROW_MORNING"}
                  onChange={() => setDeliverySlot("TOMORROW_MORNING")}
                  className="text-primary focus:ring-primary"
                />
              </div>
              <div className="mt-2 text-xs text-on-surface font-semibold">8:00 AM – 11:00 AM</div>
              <div className="text-[11px] text-on-surface-variant mt-0.5">
                Ideal for kirana restock before daily shop opening
              </div>
            </label>
          </div>
        </div>

        {/* 3. GST Tax Invoice Toggle */}
        <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 border border-outline-variant/20 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary-container/20 text-on-secondary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">receipt_long</span>
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-on-surface">
                  Input Tax Credit (GST Invoice)
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Claim 100% GSTR-3B tax offset for registered Bihar kirana &amp; commercial buyers
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={wantGst}
                onChange={(e) => setWantGst(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
            </label>
          </div>

          {wantGst && (
            <div className="pt-3 border-t border-outline-variant/15 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                  Business GSTIN
                </label>
                <input
                  type="text"
                  maxLength={15}
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="e.g. 10AAECJ3829K1ZT"
                  className="w-full bg-surface-container-low text-on-surface px-3 py-2 rounded-xl border border-outline-variant/30 font-mono uppercase font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                  Registered Trade Name
                </label>
                <input
                  type="text"
                  value={tradeName}
                  onChange={(e) => setTradeName(e.target.value)}
                  placeholder="e.g. Maa Durga Enterprises"
                  className="w-full bg-surface-container-low text-on-surface px-3 py-2 rounded-xl border border-outline-variant/30 font-medium text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* 4. Payment Method Card */}
        <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 border border-outline-variant/20 shadow-sm space-y-4">
          <h2 className="font-bold text-base sm:text-lg font-serif text-on-surface flex items-center gap-2 border-b border-outline-variant/15 pb-3">
            <span className="material-symbols-outlined text-primary text-xl">payments</span>
            3. Payment Method
          </h2>

          <div className="space-y-3">
            <label
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                paymentMode === "COD"
                  ? "border-primary bg-primary-fixed/20 shadow-sm"
                  : "border-outline-variant/20 bg-surface-container-low hover:border-outline"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-2xl">local_atm</span>
                <div>
                  <div className="font-bold text-sm text-on-surface">Cash on Delivery (COD)</div>
                  <div className="text-xs text-on-surface-variant">Pay with cash upon physical handover at your counter</div>
                </div>
              </div>
              <input
                type="radio"
                name="paymentMode"
                checked={paymentMode === "COD"}
                onChange={() => setPaymentMode("COD")}
                className="text-primary focus:ring-primary"
              />
            </label>

            <label
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                paymentMode === "UPI"
                  ? "border-primary bg-primary-fixed/20 shadow-sm"
                  : "border-outline-variant/20 bg-surface-container-low hover:border-outline"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-2xl">qr_code_scanner</span>
                <div>
                  <div className="font-bold text-sm text-on-surface">Scan &amp; Pay via UPI on Delivery</div>
                  <div className="text-xs text-on-surface-variant">Pay using GPay, PhonePe, Paytm QR code on delivery truck</div>
                </div>
              </div>
              <input
                type="radio"
                name="paymentMode"
                checked={paymentMode === "UPI"}
                onChange={() => setPaymentMode("UPI")}
                className="text-primary focus:ring-primary"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Right: Order Summary Sidebar (5 cols) */}
      <div className="lg:col-span-5 space-y-4">
        <div className="bg-surface-container-lowest p-5 sm:p-6 rounded-2xl border border-outline-variant/20 shadow-sm space-y-5 sticky top-24">
          <h2 className="font-bold text-lg font-serif text-on-surface border-b border-outline-variant/15 pb-3">
            Order Review ({items.length} items)
          </h2>

          {/* Mini Items list */}
          <div className="max-h-64 overflow-y-auto divide-y divide-outline-variant/15 pr-1 space-y-2">
            {items.map((item) => (
              <div key={item.id} className="pt-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold font-mono text-primary bg-primary-fixed/20 px-1.5 py-0.5 rounded">
                    {item.quantity}x
                  </span>
                  <span className="font-semibold text-on-surface truncate max-w-[180px]">
                    {item.name}
                  </span>
                </div>
                <span className="font-mono font-bold text-on-surface">
                  ₹{(item.lineTotalPaise / 100).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          {/* Total Breakdown */}
          <div className="pt-4 border-t border-outline-variant/15 space-y-2 text-sm">
            <div className="flex justify-between text-on-surface-variant">
              <span>Items Total (MRP)</span>
              <span className="font-mono">₹{(totalMrpPaise / 100).toFixed(2)}</span>
            </div>

            {savingsRs > 0 && (
              <div className="flex justify-between text-tertiary font-semibold">
                <span>Wholesale &amp; Mandi Discount</span>
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
              <span className="text-base text-on-surface">Total Payable</span>
              <span className="text-2xl font-mono text-primary">₹{grandTotalRs.toFixed(2)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-6 rounded-xl bg-primary text-on-primary font-bold text-base hover:bg-primary-container disabled:opacity-50 transition-all shadow-md flex items-center justify-center gap-2 active:scale-98"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span className="material-symbols-outlined text-xl">task_alt</span>
                <span>Confirm &amp; Place Order</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-center text-on-surface-variant leading-relaxed">
            By placing this order you agree to JMD Cart terms of delivery and commercial grocery dispatch rules.
          </p>
        </div>
      </div>
    </form>
  );
}
