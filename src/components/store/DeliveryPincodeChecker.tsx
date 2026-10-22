"use client";

import { useState } from "react";

export function DeliveryPincodeChecker() {
  const [pincode, setPincode] = useState("");
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pincode.trim()) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/store/v1/serviceability?pincode=${encodeURIComponent(pincode.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setResult(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-surface-container-lowest p-6 sm:p-8 rounded-2xl border border-outline-variant/20 shadow-sm space-y-4">
      <h2 className="text-lg font-bold font-serif text-on-surface flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-xl">pin_drop</span>
        Check Delivery Serviceability in Your Area
      </h2>
      <p className="text-xs text-on-surface-variant">
        Enter your 6-digit Bihar postal pincode to see dispatch options and delivery slots.
      </p>

      <form onSubmit={handleCheck} className="flex flex-col sm:flex-row items-stretch gap-2 max-w-md">
        <input
          type="text"
          maxLength={6}
          value={pincode}
          onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
          placeholder="e.g. 852201"
          className="flex-1 bg-surface-container-low text-on-surface px-4 py-2.5 rounded-xl border border-outline-variant/30 font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={isLoading || pincode.length !== 6}
          className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary-container disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center gap-1.5"
        >
          {isLoading ? "Checking..." : "Check Pincode"}
        </button>
      </form>

      {result && (
        <div
          className={`p-4 rounded-xl border mt-3 text-xs sm:text-sm ${
            result.serviceable
              ? "bg-tertiary-fixed/20 border-tertiary/30 text-on-surface"
              : "bg-error-container/20 border-error/30 text-on-surface"
          }`}
        >
          {result.serviceable ? (
            <div className="space-y-1">
              <div className="font-bold text-tertiary flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">check_circle</span>
                Pincode {result.pincode} is Serviceable! ({result.zoneName})
              </div>
              <div className="text-on-surface-variant">
                Estimated Delivery: <strong>Within {result.estimatedDeliveryHours} Hours</strong> from central warehouse.
              </div>
              <div className="text-on-surface-variant">
                FREE delivery on orders above ₹{(result.freeDeliveryThresholdPaise / 100).toFixed(0)}.
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="font-bold text-error flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">cancel</span>
                Pincode {result.pincode} is currently outside our regular express delivery route.
              </div>
              <p className="text-on-surface-variant text-xs">
                For commercial truck orders in surrounding blocks, please contact our wholesale mandi desk directly.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
