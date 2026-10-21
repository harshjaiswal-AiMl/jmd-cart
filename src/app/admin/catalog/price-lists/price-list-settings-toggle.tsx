"use client";

import { useState, useTransition } from "react";
import { toggleQuantityTierPricingAction } from "../actions";

export function PriceListSettingsToggle({
  initialEnabled,
}: {
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      await toggleQuantityTierPricingAction(next);
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-gray-900">
            Quantity-Based Tier / Auto Buyer-Tag Override
          </h3>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              enabled
                ? "bg-emerald-100 text-emerald-800"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {enabled ? "ON" : "OFF (Default)"}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          When ON, the effective unit price is the cheaper of the party&apos;s own A/B/C list price
          and the quantity-slab tier price. When OFF, party list price (A/B/C) is used directly.
        </p>
      </div>

      <button
        type="button"
        disabled={isPending}
        onClick={handleToggle}
        role="switch"
        aria-checked={enabled}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          enabled ? "bg-[#075828]" : "bg-gray-300"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
