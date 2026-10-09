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
      className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
    >
      {pending ? "Processing..." : label}
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-xl shadow-md border border-gray-100">
          <div className="text-center">
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 text-xl font-bold mb-3">
              📱
            </span>
            <h2 className="text-2xl font-bold text-gray-900">Verify Phone Number</h2>
            <p className="mt-1 text-sm text-gray-600">
              We sent a 6-digit verification code to{" "}
              <strong className="text-gray-900">{state.phone}</strong>
            </p>
          </div>

          {otpState?.error && (
            <div className="rounded-lg bg-red-50 p-4 border border-red-200 text-sm text-red-800">
              {otpState.error}
            </div>
          )}

          <form action={otpFormAction} className="space-y-4">
            <input type="hidden" name="phone" value={state.phone} />
            <input type="hidden" name="password" value={cachedPassword} />

            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-700">
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
                className="mt-1 tracking-widest text-center text-2xl font-mono block w-full px-3 py-2.5 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              />
            </div>

            <div>
              <SubmitButton label="Verify & Log In" />
            </div>

            <div className="text-center text-xs text-gray-500 pt-2">
              In test / console mode, check the server terminal for your OTP.
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-xl shadow-md border border-gray-100">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900 tracking-tight">
            IDMS Saharsa
          </h2>
          <p className="mt-1 text-center text-sm text-gray-600">
            Create Buyer Account (Retailer / Customer)
          </p>
        </div>

        {state?.error && (
          <div className="rounded-md bg-red-50 p-4 border border-red-200 text-sm text-red-800">
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
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Customer / Shop Name *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="e.g. Maa Durga Kirana or Ramesh Kumar"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              Mobile Number (10 digits) *
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              pattern="[6-9][0-9]{9}"
              placeholder="9876543210"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 font-mono"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password (min 6 characters) *
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="••••••••"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-gray-600">
                Email (Optional)
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="shop@example.com"
                className="mt-1 block w-full px-2.5 py-1.5 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-xs text-gray-900"
              />
            </div>
            <div>
              <label htmlFor="gstin" className="block text-xs font-medium text-gray-600">
                GSTIN (Optional)
              </label>
              <input
                id="gstin"
                name="gstin"
                type="text"
                maxLength={15}
                placeholder="10AAAAA0000A1Z5"
                className="mt-1 block w-full px-2.5 py-1.5 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-xs text-gray-900 font-mono uppercase"
              />
            </div>
          </div>

          <div>
            <label htmlFor="address" className="block text-xs font-medium text-gray-600">
              Delivery Address (Saharsa Town / Market)
            </label>
            <textarea
              id="address"
              name="address"
              rows={2}
              placeholder="Shop No. 4, Main Road, Saharsa"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-xs text-gray-900"
            />
          </div>

          <div className="pt-2">
            <SubmitButton label="Create Account & Continue" />
          </div>

          <div className="pt-2 text-center text-sm text-gray-600 border-t border-gray-100">
            <span>Already have an account? </span>
            <Link
              href="/login"
              className="font-medium text-blue-600 hover:text-blue-500 hover:underline"
            >
              Sign in here →
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
