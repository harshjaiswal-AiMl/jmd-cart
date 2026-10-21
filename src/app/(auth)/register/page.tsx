"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { registerAction, verifyOtpAction, RegisterActionState } from "./actions";

function SubmitButton({ label = "Register Account" }: { label?: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-[#790E11] hover:bg-[#5E0A0D] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#790E11] disabled:opacity-50 transition-colors cursor-pointer"
    >
      {pending ? "Creating account..." : label}
    </button>
  );
}

export default function RegisterPage() {
  const [state, formAction] = useFormState<RegisterActionState | undefined, FormData>(
    registerAction,
    undefined
  );

  const [otpState, otpFormAction] = useFormState(verifyOtpAction, undefined);
  const [cachedPassword, setCachedPassword] = useState("");

  if (state?.requiresOtp && state.phone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FEFDF7] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-[#EAD9CC]">
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/jmd-cart-logo.png"
              alt="JMD Cart"
              className="h-16 w-16 mx-auto object-contain mb-3"
            />
            <h2 className="text-2xl font-black text-[#2A1010]">Verify Mobile Number</h2>
            <p className="mt-1 text-xs text-gray-600">
              We sent a 6-digit verification code to{" "}
              <strong className="text-[#790E11]">{state.phone}</strong>
            </p>
          </div>

          {otpState?.error && (
            <div className="rounded-xl bg-[#FEE2E2] p-3.5 border border-red-200 text-xs text-[#991B1B]">
              {otpState.error}
            </div>
          )}

          <form action={otpFormAction} className="space-y-4">
            <input type="hidden" name="phone" value={state.phone} />
            <input type="hidden" name="password" value={cachedPassword} />

            <div>
              <label htmlFor="otp" className="block text-xs font-bold text-[#2A1010] uppercase tracking-wider">
                6-Digit OTP Code
              </label>
              <input
                id="otp"
                name="otp"
                type="text"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                placeholder="123456"
                className="mt-1 tracking-widest text-center text-2xl font-mono block w-full px-3 py-2.5 border border-[#EAD9CC] rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#790E11] text-[#2A1010]"
              />
            </div>

            <div>
              <SubmitButton label="Verify & Sign In" />
            </div>

            <div className="text-center text-xs text-gray-500 pt-2">
              In test mode, your OTP is displayed in the server terminal logs.
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FEFDF7] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-[#EAD9CC]">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/jmd-cart-logo.png"
            alt="JMD Cart"
            className="h-16 w-16 mx-auto object-contain mb-2"
          />
          <h2 className="text-2xl font-black text-[#790E11] tracking-tight">
            JMD Cart
          </h2>
          <p className="text-xs font-semibold text-[#2A1010]/70">
            Bharosa Ghar Tak.
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Create Buyer Account (Retailer / Wholesaler / Customer)
          </p>
        </div>

        {state?.error && (
          <div className="rounded-xl bg-[#FEE2E2] p-3.5 border border-red-200 text-xs text-[#991B1B]">
            {state.error}
          </div>
        )}

        <form
          className="space-y-4"
          action={formAction}
          onSubmit={(e) => {
            const form = e.currentTarget;
            const pwd = (form.elements.namedItem("password") as HTMLInputElement)?.value;
            if (pwd) setCachedPassword(pwd);
          }}
        >
          <div>
            <label htmlFor="name" className="block text-xs font-bold text-[#2A1010]">
              Customer / Shop Name *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="e.g. Maa Durga Kirana or Ramesh Kumar"
              className="mt-1 block w-full px-3 py-2 border border-[#EAD9CC] rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#790E11] text-xs text-[#2A1010]"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-xs font-bold text-[#2A1010]">
              Mobile Number (10 digits) *
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              pattern="[6-9][0-9]{9}"
              placeholder="Enter 10-digit mobile number"
              className="mt-1 block w-full px-3 py-2 border border-[#EAD9CC] rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#790E11] text-xs text-[#2A1010] font-mono"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-bold text-[#2A1010]">
              Password (min 6 characters) *
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="••••••••"
              className="mt-1 block w-full px-3 py-2 border border-[#EAD9CC] rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#790E11] text-xs text-[#2A1010]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-[#2A1010]">
                Email (Optional)
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="shop@example.com"
                className="mt-1 block w-full px-2.5 py-1.5 border border-[#EAD9CC] rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#790E11] text-xs text-[#2A1010]"
              />
            </div>
            <div>
              <label htmlFor="gstin" className="block text-xs font-bold text-[#2A1010]">
                GSTIN (Optional)
              </label>
              <input
                id="gstin"
                name="gstin"
                type="text"
                maxLength={15}
                placeholder="10AAAAA0000A1Z5"
                className="mt-1 block w-full px-2.5 py-1.5 border border-[#EAD9CC] rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#790E11] text-xs text-[#2A1010] font-mono uppercase"
              />
            </div>
          </div>

          <div>
            <label htmlFor="address" className="block text-xs font-bold text-[#2A1010]">
              Delivery Address (Saharsa Town / Market)
            </label>
            <textarea
              id="address"
              name="address"
              rows={2}
              placeholder="Shop No. 4, Main Bazar, Saharsa"
              className="mt-1 block w-full px-3 py-2 border border-[#EAD9CC] rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#790E11] text-xs text-[#2A1010]"
            />
          </div>

          <div className="pt-2">
            <SubmitButton label="Create Account & Continue" />
          </div>

          <div className="pt-2 text-center text-xs text-gray-600 border-t border-[#EAD9CC]">
            <span>Already have an account? </span>
            <Link
              href="/login"
              className="font-bold text-[#790E11] hover:underline"
            >
              Sign in here →
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
