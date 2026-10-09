"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  updateBusinessDetailsAction,
  updateRoleDiscountLimitsAction,
  SettingsActionResult,
} from "./actions";
import { AllSettings } from "@/modules/settings/settings.types";

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
