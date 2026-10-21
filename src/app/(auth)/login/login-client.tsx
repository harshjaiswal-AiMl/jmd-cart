"use client";

import Link from "next/link";
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

export function LoginClient({
  callbackUrl = "/",
  setupRequired = false,
  setupComplete = false,
}: {
  callbackUrl?: string;
  setupRequired?: boolean;
  setupComplete?: boolean;
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

        {setupRequired && (
          <div className="rounded-xl bg-[#FFF1D6] p-4 border border-[#FDAF18] space-y-2">
            <div className="text-xs font-black text-[#790E11] uppercase tracking-wider">
              First-Run System Setup Required
            </div>
            <p className="text-xs text-[#2A1010]">
              No Owner (Super Admin) account exists yet. Initialize the system and set your business details first.
            </p>
            <Link
              href="/setup"
              className="inline-block w-full text-center py-2 px-3 bg-[#790E11] hover:bg-[#5E0A0D] text-white font-bold text-xs rounded-lg transition-colors"
            >
              Start First-Run Setup →
            </Link>
          </div>
        )}

        {setupComplete && (
          <div className="rounded-xl bg-[#E3F3E6] p-4 border border-[#075828]/30 text-xs font-bold text-[#075828]">
            ✓ First-run setup completed! Sign in below with your Owner mobile number and password.
          </div>
        )}

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

        <form className="mt-6 space-y-5" action={formAction}>
          <input
            type="hidden"
            name="callbackUrl"
            value={callbackUrl}
          />

          <div className="space-y-4">
            <div>
              <label
                htmlFor="phone"
                className="block text-xs font-bold text-[#2A1010]"
              >
                Mobile Number or Email
              </label>
              <div className="mt-1">
                <input
                  id="phone"
                  name="phone"
                  type="text"
                  required
                  autoComplete="username"
                  placeholder="10-digit mobile number or email"
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
                  placeholder="Enter your password"
                  className="appearance-none block w-full px-3 py-2 border border-[#EAD9CC] rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#790E11] focus:border-[#790E11] text-xs text-[#2A1010]"
                />
              </div>
            </div>
          </div>

          <div>
            <SubmitButton />
          </div>

          <div className="pt-3 text-center text-xs text-gray-600 border-t border-[#EAD9CC]">
            <span>New Retailer or Customer? </span>
            <Link
              href="/register"
              className="font-bold text-[#790E11] hover:underline"
            >
              Create an account →
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
