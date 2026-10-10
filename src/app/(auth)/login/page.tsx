"use client";

import { useFormState, useFormStatus } from "react-dom";
import { loginAction, LoginActionState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-[#790E11] hover:bg-[#5E0A0D] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#790E11] disabled:opacity-50 transition-colors cursor-pointer"
    >
      {pending ? "Signing in..." : "Sign in"}
    </button>
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { callbackUrl?: string };
}) {
  const [state, formAction] = useFormState<LoginActionState | undefined, FormData>(
    loginAction,
    undefined
  );

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
          <p className="mt-1 text-xs text-gray-500">
            Sign in to your IDMS distribution account
          </p>
        </div>

        {state?.error && (
          <div className="rounded-md bg-red-50 p-4 border border-red-200">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  {state.error}
                </h3>
              </div>
            </div>
          </div>
        )}

        <form className="mt-8 space-y-6" action={formAction}>
          <input
            type="hidden"
            name="callbackUrl"
            value={searchParams?.callbackUrl || "/"}
          />

          <div className="space-y-4">
            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-gray-700"
              >
                Mobile Number
              </label>
              <div className="mt-1">
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  placeholder="10-digit mobile number"
                  className="appearance-none block w-full px-3 py-2 border border-[#EAD9CC] rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#790E11] focus:border-[#790E11] text-xs text-[#2A1010]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold text-[#2A1010]"
              >
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="appearance-none block w-full px-3 py-2 border border-[#EAD9CC] rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#790E11] focus:border-[#790E11] text-xs text-[#2A1010]"
                />
              </div>
            </div>
          </div>

          <div>
            <SubmitButton />
          </div>

          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              1-Click Demo Fill:
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  const p = document.getElementById("phone") as HTMLInputElement;
                  const w = document.getElementById("password") as HTMLInputElement;
                  if (p && w) { p.value = "9876543210"; w.value = "admin123"; }
                }}
                className="p-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 text-left font-medium transition cursor-pointer"
              >
                👑 Super Admin
              </button>
              <button
                type="button"
                onClick={() => {
                  const p = document.getElementById("phone") as HTMLInputElement;
                  const w = document.getElementById("password") as HTMLInputElement;
                  if (p && w) { p.value = "9876543212"; w.value = "shop123"; }
                }}
                className="p-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200 text-left font-medium transition cursor-pointer"
              >
                🛒 Shop Cashier
              </button>
              <button
                type="button"
                onClick={() => {
                  const p = document.getElementById("phone") as HTMLInputElement;
                  const w = document.getElementById("password") as HTMLInputElement;
                  if (p && w) { p.value = "9876543211"; w.value = "godown123"; }
                }}
                className="p-2 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg border border-amber-200 text-left font-medium transition cursor-pointer"
              >
                🏭 Godown Manager
              </button>
              <button
                type="button"
                onClick={() => {
                  const p = document.getElementById("phone") as HTMLInputElement;
                  const w = document.getElementById("password") as HTMLInputElement;
                  if (p && w) { p.value = "9876543213"; w.value = "van123"; }
                }}
                className="p-2 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg border border-purple-200 text-left font-medium transition cursor-pointer"
              >
                🚐 Van Sales
              </button>
              <button
                type="button"
                onClick={() => {
                  const p = document.getElementById("phone") as HTMLInputElement;
                  const w = document.getElementById("password") as HTMLInputElement;
                  if (p && w) { p.value = "9876543214"; w.value = "delivery123"; }
                }}
                className="p-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg border border-indigo-200 text-left font-medium transition cursor-pointer"
              >
                🚚 Delivery Staff
              </button>
              <button
                type="button"
                onClick={() => {
                  const p = document.getElementById("phone") as HTMLInputElement;
                  const w = document.getElementById("password") as HTMLInputElement;
                  if (p && w) { p.value = "9876543215"; w.value = "accounts123"; }
                }}
                className="p-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg border border-rose-200 text-left font-medium transition cursor-pointer"
              >
                📊 Accounts / CA
              </button>
            </div>
          </div>

          <div className="pt-2 text-center text-xs text-gray-600 border-t border-[#EAD9CC]">
            <span>New Retailer or Customer? </span>
            <a
              href="/register"
              className="font-bold text-[#790E11] hover:underline"
            >
              Create an account →
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
