"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  updateBusinessDetailsAction,
  updateRoleDiscountLimitsAction,
  updateVerificationSettingsAction,
  updateDeliverySettingsAction,
  updatePaymentModeSettingsAction,
  SettingsActionResult,
} from "./actions";
import { AllSettings, DeliveryZone } from "@/modules/settings/settings.types";
import { useState } from "react";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
    >
      {pending ? "Saving..." : "Save Changes"}
    </button>
  );
}

export function BusinessDetailsForm({
  initialData,
}: {
  initialData: AllSettings["businessDetails"];
}) {
  const [state, formAction] = useFormState<SettingsActionResult | undefined, FormData>(
    updateBusinessDetailsAction,
    undefined
  );

  return (
    <form action={formAction} className="space-y-6 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
      <div className="border-b border-gray-200 pb-4">
        <h3 className="text-lg font-semibold text-gray-900">Business Details</h3>
        <p className="text-sm text-gray-500">Legal entity name, GSTIN, FSSAI and contact details printed on tax invoices.</p>
      </div>

      {state?.error && (
        <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
          {state.error}
        </div>
      )}

      {state?.success && (
        <div className="p-3 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm">
          Business details updated successfully!
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Legal Name</label>
          <input
            type="text"
            name="legalName"
            defaultValue={initialData.legalName}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Trade Name</label>
          <input
            type="text"
            name="tradeName"
            defaultValue={initialData.tradeName}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">GSTIN (15 Digits)</label>
          <input
            type="text"
            name="gstin"
            defaultValue={initialData.gstin}
            placeholder="10AAAAA0000A1Z5"
            maxLength={15}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm uppercase focus:ring-blue-500 focus:border-blue-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">FSSAI License (14 Digits)</label>
          <input
            type="text"
            name="fssai"
            defaultValue={initialData.fssai}
            placeholder="10421000000001"
            maxLength={14}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 font-mono"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">Address</label>
          <input
            type="text"
            name="address"
            defaultValue={initialData.address}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Official Mobile / Phone</label>
          <input
            type="text"
            name="phone"
            defaultValue={initialData.phone}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Official Email</label>
          <input
            type="email"
            name="email"
            defaultValue={initialData.email}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Bank Name</label>
          <input
            type="text"
            name="bankName"
            defaultValue={initialData.bankDetails?.bankName}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Account Number</label>
          <input
            type="text"
            name="accountNumber"
            defaultValue={initialData.bankDetails?.accountNumber}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">IFSC Code</label>
          <input
            type="text"
            name="ifsc"
            defaultValue={initialData.bankDetails?.ifsc}
            maxLength={11}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm uppercase focus:ring-blue-500 focus:border-blue-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">UPI ID / VPA</label>
          <input
            type="text"
            name="upiId"
            defaultValue={initialData.upiId}
            placeholder="jmdcart@sbi"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-100">
        <SaveButton />
      </div>
    </form>
  );
}

export function DiscountLimitsForm({
  initialData,
}: {
  initialData: AllSettings["roleDiscountLimits"];
}) {
  const [state, formAction] = useFormState<SettingsActionResult | undefined, FormData>(
    updateRoleDiscountLimitsAction,
    undefined
  );

  return (
    <form action={formAction} className="space-y-6 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
      <div className="border-b border-gray-200 pb-4">
        <h3 className="text-lg font-semibold text-gray-900">Role Discount Limits</h3>
        <p className="text-sm text-gray-500">
          Maximum discount staff can apply at POS or on Van without owner PIN approval.
        </p>
      </div>

      {state?.error && (
        <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
          {state.error}
        </div>
      )}

      {state?.success && (
        <div className="p-3 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm">
          Discount limits updated successfully!
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Shop / Cashier Max Discount (%)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            name="SHOP"
            defaultValue={((initialData.SHOP ?? 500) / 100).toFixed(1)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">Default: 5% (500 bp)</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Van Salesperson Max Discount (%)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            name="SALESPERSON"
            defaultValue={((initialData.SALESPERSON ?? 300) / 100).toFixed(1)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">Default: 3% (300 bp)</p>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-100">
        <SaveButton />
      </div>
    </form>
  );
}

export function VerificationSettingsForm({
  initialData,
}: {
  initialData: AllSettings["verificationSettings"];
}) {
  const [state, formAction] = useFormState<SettingsActionResult | undefined, FormData>(
    updateVerificationSettingsAction,
    undefined
  );

  return (
    <form action={formAction} className="space-y-6 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
      <div className="border-b border-gray-200 pb-4">
        <h3 className="text-lg font-semibold text-gray-900">Buyer Phone Verification Mode</h3>
        <p className="text-sm text-gray-500">
          Control how newly registered online buyers verify their identity and phone numbers.
        </p>
      </div>

      {state?.error && (
        <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
          {state.error}
        </div>
      )}

      {state?.success && (
        <div className="p-3 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm">
          Buyer verification mode updated successfully!
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
          <input
            type="radio"
            id="mode-admin"
            name="mode"
            value="admin"
            defaultChecked={initialData.mode === "admin"}
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
          />
          <label htmlFor="mode-admin" className="text-sm cursor-pointer">
            <span className="font-semibold text-slate-900 block">Admin Phone Call (Default & Recommended)</span>
            <span className="text-slate-500 text-xs">
              Buyers register and place orders. Store owner or dispatcher calls the buyer to verify address and confirms verification on first dispatch. No SMS gateway charges.
            </span>
          </label>
        </div>

        <div className="flex items-start gap-3 p-3.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
          <input
            type="radio"
            id="mode-off"
            name="mode"
            value="off"
            defaultChecked={initialData.mode === "off"}
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
          />
          <label htmlFor="mode-off" className="text-sm cursor-pointer">
            <span className="font-semibold text-slate-900 block">Verification Off</span>
            <span className="text-slate-500 text-xs">
              Phone numbers are automatically marked verified upon registration. Ideal for frictionless B2B ordering or trusted local customers.
            </span>
          </label>
        </div>

        <div className="flex items-start gap-3 p-3.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
          <input
            type="radio"
            id="mode-sms"
            name="mode"
            value="sms"
            defaultChecked={initialData.mode === "sms"}
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
          />
          <label htmlFor="mode-sms" className="text-sm cursor-pointer">
            <span className="font-semibold text-slate-900 block">SMS OTP Adapter (Off / Console by default)</span>
            <span className="text-slate-500 text-xs">
              Sends 6-digit OTP code to buyer&apos;s phone. In development, OTP is logged to console; pluggable DLT gateway adapter when activated.
            </span>
          </label>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-100">
        <SaveButton />
      </div>
    </form>
  );
}

export function DeliverySettingsForm({
  initialData,
}: {
  initialData: AllSettings["deliverySettings"];
}) {
  const [state, formAction] = useFormState<SettingsActionResult | undefined, FormData>(
    updateDeliverySettingsAction,
    undefined
  );

  const [zones, setZones] = useState<DeliveryZone[]>(
    initialData.zones && initialData.zones.length > 0
      ? initialData.zones
      : [
          {
            code: "TOWN",
            name: "Saharsa Town (Within 5 km)",
            description: "Station Road, D.B. Road, Purab Bazar, Gangjala",
            minOrderPaise: 50000,
            freeDeliveryThresholdPaise: 200000,
            deliveryChargePaise: 5000,
            estimatedDeliveryHours: 4,
            active: true,
          },
          {
            code: "OUTSTATION",
            name: "Outstation & Beyond 5 km",
            description: "Suburban roads: Kahra, Biraul, Sattar Kataiya, Sonbarsa Raj",
            minOrderPaise: 100000,
            freeDeliveryThresholdPaise: 500000,
            deliveryChargePaise: 15000,
            estimatedDeliveryHours: 24,
            active: true,
          },
        ]
  );

  const [newZoneCode, setNewZoneCode] = useState("");
  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneDesc, setNewZoneDesc] = useState("");
  const [newZoneMinOrder, setNewZoneMinOrder] = useState("500");
  const [newZoneThreshold, setNewZoneThreshold] = useState("2000");
  const [newZoneCharge, setNewZoneCharge] = useState("50");
  const [newZoneHours, setNewZoneHours] = useState("24");

  const handleAddZone = () => {
    if (!newZoneCode.trim() || !newZoneName.trim()) {
      alert("Zone code and zone name are required.");
      return;
    }
    const cleanCode = newZoneCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    if (zones.some((z) => z.code === cleanCode)) {
      alert(`A delivery zone with code '${cleanCode}' already exists.`);
      return;
    }

    const created: DeliveryZone = {
      code: cleanCode,
      name: newZoneName.trim(),
      description: newZoneDesc.trim() || undefined,
      minOrderPaise: Math.round(Number(newZoneMinOrder || 0) * 100),
      freeDeliveryThresholdPaise: Math.round(Number(newZoneThreshold || 0) * 100),
      deliveryChargePaise: Math.round(Number(newZoneCharge || 0) * 100),
      estimatedDeliveryHours: Number(newZoneHours) || 24,
      active: true,
    };

    setZones([...zones, created]);
    setNewZoneCode("");
    setNewZoneName("");
    setNewZoneDesc("");
    setNewZoneMinOrder("500");
    setNewZoneThreshold("2000");
    setNewZoneCharge("50");
    setNewZoneHours("24");
  };

  const handleRemoveZone = (code: string) => {
    setZones(zones.filter((z) => z.code !== code));
  };

  const handleToggleZone = (code: string) => {
    setZones(
      zones.map((z) => (z.code === code ? { ...z, active: !z.active } : z))
    );
  };

  const handleUpdateZoneField = (
    code: string,
    field: keyof DeliveryZone,
    val: string | number | boolean
  ) => {
    setZones(
      zones.map((z) => {
        if (z.code !== code) return z;
        return { ...z, [field]: val };
      })
    );
  };

  return (
    <form action={formAction} className="space-y-6 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
      <div className="border-b border-gray-200 pb-4">
        <h3 className="text-lg font-semibold text-gray-900">Delivery Zones, Charges & Thresholds</h3>
        <p className="text-sm text-gray-500">
          Configure delivery charge rules and free delivery thresholds for Saharsa Town and outlying areas.
        </p>
      </div>

      {state?.error && (
        <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
          {state.error}
        </div>
      )}

      {state?.success && (
        <div className="p-3 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm">
          Delivery rules and zones updated successfully!
        </div>
      )}

      {/* Hidden input to pass reactive zones state to server action */}
      <input type="hidden" name="zonesJson" value={JSON.stringify(zones)} />

      {/* Default Quick Thresholds */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
          Quick Base Thresholds (Town vs Outstation)
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700">
              Saharsa Town - Free Delivery Minimum (₹)
            </label>
            <input
              type="number"
              step="1"
              min="0"
              name="freeDeliveryTownRupees"
              defaultValue={(initialData.freeDeliveryTownPaise / 100).toFixed(0)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">Default: ₹2,000</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700">
              Saharsa Town - Delivery Charge Below Threshold (₹)
            </label>
            <input
              type="number"
              step="1"
              min="0"
              name="deliveryChargeTownRupees"
              defaultValue={(initialData.deliveryChargeTownPaise / 100).toFixed(0)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">Default: ₹50</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700">
              Beyond 5 km / Outstation - Free Delivery Minimum (₹)
            </label>
            <input
              type="number"
              step="1"
              min="0"
              name="freeDeliveryOutstationRupees"
              defaultValue={(initialData.freeDeliveryOutstationPaise / 100).toFixed(0)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">Default: ₹5,000</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700">
              Beyond 5 km / Outstation - Delivery Charge Below Threshold (₹)
            </label>
            <input
              type="number"
              step="1"
              min="0"
              name="deliveryChargeOutstationRupees"
              defaultValue={(initialData.deliveryChargeOutstationPaise / 100).toFixed(0)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">Default: ₹150</p>
          </div>
        </div>
      </div>

      {/* Configured Delivery Zones List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
            Delivery Zones Directory ({zones.length} Zones)
          </h4>
          <span className="text-xs text-slate-500">Available to online buyers during checkout</span>
        </div>

        <div className="space-y-3">
          {zones.map((zone) => (
            <div
              key={zone.code}
              className={`p-4 rounded-xl border transition-colors ${
                zone.active
                  ? "bg-white border-slate-200"
                  : "bg-slate-50 border-slate-200 opacity-60"
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-black font-mono rounded-lg">
                    {zone.code}
                  </span>
                  <div>
                    <h5 className="text-sm font-bold text-slate-900">{zone.name}</h5>
                    {zone.description && (
                      <p className="text-xs text-slate-500">{zone.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleZone(zone.code)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
                      zone.active
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {zone.active ? "Active" : "Inactive"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveZone(zone.code)}
                    className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-bold"
                    title="Delete Zone"
                  >
                    ✕ Remove
                  </button>
                </div>
              </div>

              {/* Editable zone rule inputs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600">
                    Min Order (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={(zone.minOrderPaise / 100).toFixed(0)}
                    onChange={(e) =>
                      handleUpdateZoneField(
                        zone.code,
                        "minOrderPaise",
                        Math.round(Number(e.target.value || 0) * 100)
                      )
                    }
                    className="mt-0.5 block w-full px-2.5 py-1 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600">
                    Free Threshold (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={(zone.freeDeliveryThresholdPaise / 100).toFixed(0)}
                    onChange={(e) =>
                      handleUpdateZoneField(
                        zone.code,
                        "freeDeliveryThresholdPaise",
                        Math.round(Number(e.target.value || 0) * 100)
                      )
                    }
                    className="mt-0.5 block w-full px-2.5 py-1 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600">
                    Delivery Charge (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={(zone.deliveryChargePaise / 100).toFixed(0)}
                    onChange={(e) =>
                      handleUpdateZoneField(
                        zone.code,
                        "deliveryChargePaise",
                        Math.round(Number(e.target.value || 0) * 100)
                      )
                    }
                    className="mt-0.5 block w-full px-2.5 py-1 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600">
                    Est. Delivery (Hrs)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={zone.estimatedDeliveryHours || 24}
                    onChange={(e) =>
                      handleUpdateZoneField(
                        zone.code,
                        "estimatedDeliveryHours",
                        Number(e.target.value || 24)
                      )
                    }
                    className="mt-0.5 block w-full px-2.5 py-1 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add New Custom Zone Form */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
        <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
          + Add New Delivery Zone / Route
        </h5>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-600">
              Zone Code (e.g. SIMRI, NAUHATTA)
            </label>
            <input
              type="text"
              placeholder="e.g. SIMRI"
              value={newZoneCode}
              onChange={(e) => setNewZoneCode(e.target.value)}
              className="mt-0.5 block w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs uppercase font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600">Zone Name</label>
            <input
              type="text"
              placeholder="e.g. Simri Bakhtiarpur"
              value={newZoneName}
              onChange={(e) => setNewZoneName(e.target.value)}
              className="mt-0.5 block w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600">
              Description / Landmarks
            </label>
            <input
              type="text"
              placeholder="e.g. Main Chowk, High School Road"
              value={newZoneDesc}
              onChange={(e) => setNewZoneDesc(e.target.value)}
              className="mt-0.5 block w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-600">Min Order (₹)</label>
            <input
              type="number"
              min="0"
              value={newZoneMinOrder}
              onChange={(e) => setNewZoneMinOrder(e.target.value)}
              className="mt-0.5 block w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600">
              Free Delivery Above (₹)
            </label>
            <input
              type="number"
              min="0"
              value={newZoneThreshold}
              onChange={(e) => setNewZoneThreshold(e.target.value)}
              className="mt-0.5 block w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600">
              Delivery Charge (₹)
            </label>
            <input
              type="number"
              min="0"
              value={newZoneCharge}
              onChange={(e) => setNewZoneCharge(e.target.value)}
              className="mt-0.5 block w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600">
              Est. Delivery (Hours)
            </label>
            <input
              type="number"
              min="1"
              value={newZoneHours}
              onChange={(e) => setNewZoneHours(e.target.value)}
              className="mt-0.5 block w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
            />
          </div>
        </div>

        <div className="pt-1 flex justify-end">
          <button
            type="button"
            onClick={handleAddZone}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            + Add Zone to List
          </button>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-100">
        <SaveButton />
      </div>
    </form>
  );
}

export function PaymentModeSettingsForm({
  initialData,
}: {
  initialData: AllSettings["paymentModeSettings"];
}) {
  const [state, formAction] = useFormState<SettingsActionResult | undefined, FormData>(
    updatePaymentModeSettingsAction,
    undefined
  );

  const [onlineGatewayEnabled, setOnlineGatewayEnabled] = useState(
    initialData.onlineGatewayEnabled ?? false
  );
  const [gatewayProvider, setGatewayProvider] = useState(
    initialData.gatewayProvider ?? "none"
  );

  return (
    <form
      action={formAction}
      className="space-y-6 bg-white p-6 rounded-xl border border-gray-200 shadow-sm"
    >
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Payment Modes & Gateway Switch
            </h3>
            <p className="text-sm text-gray-500">
              Control customer payment options at checkout. Online gateway is kept OFF by default per FMCG distribution policy.
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold border ${
              onlineGatewayEnabled
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-slate-100 text-slate-700 border-slate-200"
            }`}
          >
            Gateway: {onlineGatewayEnabled ? "ONLINE" : "OFF (DEFAULT)"}
          </span>
        </div>
      </div>

      {state?.error && (
        <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
          {state.error}
        </div>
      )}

      {state?.success && (
        <div className="p-3 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm">
          Payment mode settings updated successfully!
        </div>
      )}

      {/* Core Payment Channels */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">
          Storefront Payment Options
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50/50 cursor-pointer transition">
            <input
              type="checkbox"
              name="codEnabled"
              defaultChecked={initialData.codEnabled ?? true}
              className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <div>
              <span className="text-sm font-semibold text-gray-900 block">
                Cash on Delivery (COD)
              </span>
              <span className="text-xs text-gray-500">
                Customers pay cash to the runner when delivery arrives at destination.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50/50 cursor-pointer transition">
            <input
              type="checkbox"
              name="upiDeliveryEnabled"
              defaultChecked={initialData.upiDeliveryEnabled ?? true}
              className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <div>
              <span className="text-sm font-semibold text-gray-900 block">
                UPI QR on Delivery
              </span>
              <span className="text-xs text-gray-500">
                Runner displays store UPI QR on their phone/receipt for instant scan & pay.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50/50 cursor-pointer transition">
            <input
              type="checkbox"
              name="creditEnabledForCreditParties"
              defaultChecked={initialData.creditEnabledForCreditParties ?? true}
              className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <div>
              <span className="text-sm font-semibold text-gray-900 block">
                Party Credit (Tally Approved)
              </span>
              <span className="text-xs text-gray-500">
                Verified retailers with existing Tally credit limit may place orders on ledger credit.
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Payment Gateway Master Switch */}
      <div className="pt-2 border-t border-gray-200 space-y-4">
        <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">
                Online Payment Gateway (Razorpay / PhonePe)
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                Kept OFF in v1
              </span>
            </div>
            <p className="text-xs text-slate-500 max-w-xl">
              Enable online card, netbanking, and online UPI payment prior to dispatch. When turned off, the checkout only shows pay-on-delivery and approved credit.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              name="onlineGatewayEnabled"
              checked={onlineGatewayEnabled}
              onChange={(e) => setOnlineGatewayEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none ring-0 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Gateway Configuration Fields (Revealed when switch is ON) */}
        {onlineGatewayEnabled && (
          <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl space-y-4 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Gateway Provider
                </label>
                <select
                  name="gatewayProvider"
                  value={gatewayProvider}
                  onChange={(e) => setGatewayProvider(e.target.value as any)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="none">-- Select Provider --</option>
                  <option value="razorpay">Razorpay (India PG)</option>
                  <option value="phonepe">PhonePe Payment Gateway</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Merchant Key ID
                </label>
                <input
                  type="text"
                  name="gatewayKeyId"
                  defaultValue={initialData.gatewayKeyId || ""}
                  placeholder="rzp_live_xxxxxxxxxxxxxx"
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-blue-500 focus:border-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Key Secret / Salt
                </label>
                <input
                  type="password"
                  name="gatewayKeySecret"
                  defaultValue={initialData.gatewayKeySecret || ""}
                  placeholder="••••••••••••••••"
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-blue-500 focus:border-blue-500 bg-white"
                />
              </div>
            </div>
            <p className="text-[11px] text-blue-700">
              Note: Key secrets are strictly masked and encrypted in system audit logs.
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-100">
        <SaveButton />
      </div>
    </form>
  );
}

