"use client";

import { useState } from "react";
import { CheckCircle2, ShieldCheck, Settings } from "lucide-react";
import { UserRole } from "@prisma/client";
import { IncentiveSettings } from "@/modules/incentive/incentive.types";
import { saveIncentiveSettingsAction } from "../actions";

const ALL_ROLES = [
  { role: UserRole.SHOP, label: "SHOP (Cashier / Counter Staff)" },
  { role: UserRole.SALESPERSON, label: "SALESPERSON (Van Sales Driver)" },
  { role: UserRole.DELIVERY, label: "DELIVERY (Delivery Rider)" },
  { role: UserRole.WAREHOUSE_MANAGER, label: "WAREHOUSE_MANAGER" },
  { role: UserRole.GODOWN, label: "GODOWN (Warehouse Staff)" },
  { role: UserRole.ADMIN, label: "ADMIN" },
];

export function IncentiveSettingsClient({
  initialSettings,
}: {
  initialSettings: IncentiveSettings;
}) {
  const [settings, setSettings] = useState<IncentiveSettings>(initialSettings);
  const [ratePercent, setRatePercent] = useState(
    (initialSettings.defaultPercentBp / 100).toFixed(2)
  );
  const [submitting, setSubmitting] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleToggleRole = (role: UserRole) => {
    const current = settings.eligibleRoles || [];
    if (current.includes(role)) {
      setSettings({
        ...settings,
        eligibleRoles: current.filter((r) => r !== role),
      });
    } else {
      setSettings({
        ...settings,
        eligibleRoles: [...current, role],
      });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSavedSuccess(false);
    setErrorMsg("");

    try {
      const parsedRate = parseFloat(ratePercent);
      if (isNaN(parsedRate) || parsedRate < 0 || parsedRate > 100) {
        throw new Error("Default percentage must be between 0 and 100");
      }

      const payload: IncentiveSettings = {
        ...settings,
        defaultPercentBp: Math.round(parsedRate * 100),
      };

      await saveIncentiveSettingsAction(payload);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Failed to update settings");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {savedSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          Settings saved successfully!
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
          {errorMsg}
        </div>
      )}

      {/* General Switch */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-stone-900">Incentive Engine Master Switch</h2>
            <p className="text-xs text-stone-500">
              When disabled, new sales and order handovers will not generate incentive ledger entries.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
            aria-label="Toggle Incentive Engine Master Switch"
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              settings.enabled ? "bg-emerald-600" : "bg-stone-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                settings.enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Global Default Percentage & Base */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-5 shadow-sm">
        <h2 className="text-base font-bold text-stone-900">Calculation Formula & Default Rate</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Global Default Commission Rate (%)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                required
                value={ratePercent}
                onChange={(e) => setRatePercent(e.target.value)}
                className="w-full rounded-lg border border-stone-300 p-2 pr-8 text-xs text-stone-800 focus:ring-1 focus:ring-amber-600"
              />
              <span className="absolute right-3 top-2 text-xs font-bold text-stone-400">%</span>
            </div>
            <p className="text-[11px] text-stone-400 mt-1">
              Applied when no specific product, brand, category, or agent rule matches.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Calculation Base Amount
            </label>
            <select
              value={settings.base}
              onChange={(e) =>
                setSettings({ ...settings, base: e.target.value as any })
              }
              className="w-full rounded-lg border border-stone-300 p-2 text-xs text-stone-800 focus:ring-1 focus:ring-amber-600"
            >
              <option value="NET_PAYABLE">Bill Net Payable Amount (Recommended)</option>
              <option value="BILL_TOTAL">Bill Grand Total (before discounts)</option>
              <option value="PRODUCT_SUBTOTAL">Product Subtotal (taxable lines only)</option>
              <option value="MARGIN_ESTIMATE">Estimated Gross Margin (Price - Cost)</option>
            </select>
            <p className="text-[11px] text-stone-400 mt-1">
              The base figure multiplied by the commission percentage.
            </p>
          </div>
        </div>
      </div>

      {/* Operational Triggers */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-5 shadow-sm">
        <h2 className="text-base font-bold text-stone-900">Operational Timing & Credit Triggers</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Delivery / Dispatch Credit Timing
            </label>
            <select
              value={settings.creditTrigger}
              onChange={(e) =>
                setSettings({ ...settings, creditTrigger: e.target.value as any })
              }
              className="w-full rounded-lg border border-stone-300 p-2 text-xs text-stone-800 focus:ring-1 focus:ring-amber-600"
            >
              <option value="ON_HANDOVER">On Handover to Delivery Rider (Warehouse)</option>
              <option value="ON_DELIVERY">On Successful Customer Delivery Confirmation</option>
            </select>
            <p className="text-[11px] text-stone-400 mt-1">
              Counter and Van sales credit at invoice immediately. Delivery sales credit upon this trigger.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Credit (Khata) Sales Timing
            </label>
            <select
              value={settings.creditSales}
              onChange={(e) =>
                setSettings({ ...settings, creditSales: e.target.value as any })
              }
              className="w-full rounded-lg border border-stone-300 p-2 text-xs text-stone-800 focus:ring-1 focus:ring-amber-600"
            >
              <option value="ON_SALE">Credit on Sale (Invoice Generation)</option>
              <option value="ON_COLLECTION">Credit only after Payment Collection</option>
            </select>
            <p className="text-[11px] text-stone-400 mt-1">
              How commissions for retailer/wholesaler credit purchases are handled.
            </p>
          </div>
        </div>
      </div>

      {/* Eligible Roles */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-4 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-stone-900">Eligible Staff Roles</h2>
          <p className="text-xs text-stone-500">
            Select system roles that automatically earn commissions on their issued invoices:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {ALL_ROLES.map(({ role, label }) => {
            const isChecked = settings.eligibleRoles.includes(role);
            return (
              <label
                key={role}
                className="flex items-center gap-2.5 p-3 rounded-lg border border-stone-200 hover:bg-stone-50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggleRole(role)}
                  className="rounded border-stone-300 text-amber-800 focus:ring-amber-600"
                />
                <span className="text-xs font-medium text-stone-800">{label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-800 text-white text-xs font-semibold hover:bg-amber-900 transition-colors shadow-sm disabled:opacity-50"
        >
          <ShieldCheck className="h-4 w-4" />
          {submitting ? "Saving Changes..." : "Save Incentive Settings"}
        </button>
      </div>
    </form>
  );
}
