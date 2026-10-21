"use client";

import { useFormState, useFormStatus } from "react-dom";
import { completeSetupAction, SetupActionState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-3 px-4 rounded-xl bg-[#790E11] hover:bg-[#5E0A0D] text-white font-bold text-sm shadow-md transition-colors disabled:opacity-50 cursor-pointer"
    >
      {pending ? "Setting up system..." : "Complete First-Run Setup & Create Owner Account"}
    </button>
  );
}

export function SetupClient() {
  const [state, formAction] = useFormState<SetupActionState | undefined, FormData>(
    completeSetupAction,
    undefined
  );

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-800">
          {state.error}
        </div>
      )}

      {/* Section 1: Owner Super Admin Account */}
      <div className="space-y-4">
        <div className="border-b border-[#EAD9CC] pb-2">
          <h2 className="text-sm font-black text-[#790E11] uppercase tracking-wider">
            1. Owner / Super Admin Account
          </h2>
          <p className="text-xs text-gray-500">
            This account has full administrative control. Choose a strong password.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="ownerName" className="block text-xs font-bold text-[#2A1010]">
              Owner Full Name *
            </label>
            <input
              id="ownerName"
              name="ownerName"
              type="text"
              required
              placeholder="Owner full name"
              className="mt-1 block w-full px-3 py-2 border border-[#EAD9CC] rounded-xl text-xs text-[#2A1010] focus:ring-2 focus:ring-[#790E11] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="ownerPhone" className="block text-xs font-bold text-[#2A1010]">
              10-Digit Mobile Number *
            </label>
            <input
              id="ownerPhone"
              name="ownerPhone"
              type="tel"
              required
              pattern="[0-9]{10}"
              placeholder="10-digit mobile number"
              className="mt-1 block w-full px-3 py-2 border border-[#EAD9CC] rounded-xl text-xs text-[#2A1010] focus:ring-2 focus:ring-[#790E11] focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="ownerEmail" className="block text-xs font-bold text-[#2A1010]">
              Email Address (Optional)
            </label>
            <input
              id="ownerEmail"
              name="ownerEmail"
              type="email"
              placeholder="Email address"
              className="mt-1 block w-full px-3 py-2 border border-[#EAD9CC] rounded-xl text-xs text-[#2A1010] focus:ring-2 focus:ring-[#790E11] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="ownerPassword" className="block text-xs font-bold text-[#2A1010]">
              Password (Min 8 Characters) *
            </label>
            <input
              id="ownerPassword"
              name="ownerPassword"
              type="password"
              required
              minLength={8}
              placeholder="Choose a password"
              className="mt-1 block w-full px-3 py-2 border border-[#EAD9CC] rounded-xl text-xs text-[#2A1010] focus:ring-2 focus:ring-[#790E11] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-xs font-bold text-[#2A1010]">
              Confirm Password *
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              placeholder="Re-enter password"
              className="mt-1 block w-full px-3 py-2 border border-[#EAD9CC] rounded-xl text-xs text-[#2A1010] focus:ring-2 focus:ring-[#790E11] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Business Details */}
      <div className="space-y-4">
        <div className="border-b border-[#EAD9CC] pb-2">
          <h2 className="text-sm font-black text-[#790E11] uppercase tracking-wider">
            2. Business Details
          </h2>
          <p className="text-xs text-gray-500">
            Printed on GST tax invoices, thermal receipts, and storefront footer.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="tradeName" className="block text-xs font-bold text-[#2A1010]">
              Store / Trade Name *
            </label>
            <input
              id="tradeName"
              name="tradeName"
              type="text"
              required
              defaultValue="JMD Cart"
              placeholder="Trade name"
              className="mt-1 block w-full px-3 py-2 border border-[#EAD9CC] rounded-xl text-xs text-[#2A1010] focus:ring-2 focus:ring-[#790E11] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="legalName" className="block text-xs font-bold text-[#2A1010]">
              Legal Entity Name *
            </label>
            <input
              id="legalName"
              name="legalName"
              type="text"
              required
              defaultValue="JMD Cart"
              placeholder="Legal business name"
              className="mt-1 block w-full px-3 py-2 border border-[#EAD9CC] rounded-xl text-xs text-[#2A1010] focus:ring-2 focus:ring-[#790E11] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="gstin" className="block text-xs font-bold text-[#2A1010]">
              GSTIN (15-Character, Optional)
            </label>
            <input
              id="gstin"
              name="gstin"
              type="text"
              placeholder="15-character GSTIN"
              className="mt-1 block w-full px-3 py-2 border border-[#EAD9CC] rounded-xl text-xs font-mono uppercase text-[#2A1010] focus:ring-2 focus:ring-[#790E11] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="fssai" className="block text-xs font-bold text-[#2A1010]">
              FSSAI License (14-Digit, Optional)
            </label>
            <input
              id="fssai"
              name="fssai"
              type="text"
              placeholder="14-digit FSSAI number"
              className="mt-1 block w-full px-3 py-2 border border-[#EAD9CC] rounded-xl text-xs font-mono text-[#2A1010] focus:ring-2 focus:ring-[#790E11] focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="address" className="block text-xs font-bold text-[#2A1010]">
              Business Address *
            </label>
            <input
              id="address"
              name="address"
              type="text"
              required
              placeholder="Registered business address"
              className="mt-1 block w-full px-3 py-2 border border-[#EAD9CC] rounded-xl text-xs text-[#2A1010] focus:ring-2 focus:ring-[#790E11] focus:outline-none"
            />
          </div>
        </div>
      </div>

      <SubmitButton />
    </form>
  );
}
