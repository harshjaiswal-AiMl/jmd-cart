"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { loginAction, LoginActionState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs text-white bg-primary hover:bg-primary-container focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 transition-all shadow-md active:scale-95 cursor-pointer"
    >
      {pending ? (
        <>
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
          <span>Signing in...</span>
        </>
      ) : (
        <span>Sign In</span>
      )}
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

  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen flex flex-col justify-between bg-surface font-body text-on-surface antialiased">
      {/* 1. Sleek Navigation Header */}
      <header className="sticky top-0 z-40 bg-surface-container-lowest/95 backdrop-blur-md border-b border-surface-container-high/80 shadow-[0_1px_8px_rgba(92,12,30,0.04)]">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/jmd-cart-logo.png"
              alt="JMD Cart"
              className="h-9 w-auto object-contain transition-transform group-hover:scale-105 shrink-0"
            />
            <span className="font-headline text-xl sm:text-2xl font-bold tracking-tight text-primary">
              JMD<span className="text-secondary">Cart</span>
            </span>
          </Link>

          {/* Header Right Actions */}
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/store"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container text-xs font-bold text-on-surface border border-outline-variant/60 transition-colors shadow-2xs"
            >
              <span className="material-symbols-outlined text-[17px] text-primary">storefront</span>
              <span className="hidden sm:inline">Storefront</span>
            </Link>

            <a
              href="tel:+916278223400"
              className="hidden xs:flex items-center gap-1 text-xs font-semibold text-on-surface-variant hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[16px] text-primary">call</span>
              <span>Helpline: +91 6278 223400</span>
            </a>
          </div>
        </div>
      </header>

      {/* 2. Main Login Form Section */}
      <main className="flex-1 flex items-center justify-center py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-6 bg-surface-container-lowest p-6 sm:p-8 rounded-3xl shadow-xl border border-surface-container-high/90">
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/jmd-cart-logo.png"
              alt="JMD Cart"
              className="h-14 w-14 mx-auto object-contain mb-3 drop-shadow-sm"
            />
            <h1 className="text-2xl font-black font-headline text-primary tracking-tight">
              Welcome Back
            </h1>
            <p className="mt-1 text-xs text-on-surface-variant">
              Sign in to your JMD Cart account
            </p>
          </div>

          {setupRequired && (
            <div className="rounded-2xl bg-amber-50 p-4 border border-amber-200 space-y-2">
              <div className="text-xs font-black text-amber-900 uppercase tracking-wider">
                First-Run System Setup Required
              </div>
              <p className="text-xs text-amber-800">
                No Super Admin account exists yet. Initialize the system and set your business details first.
              </p>
              <Link
                href="/setup"
                className="inline-block w-full text-center py-2 px-3 bg-primary hover:bg-primary-container text-white font-bold text-xs rounded-xl transition-colors shadow-xs"
              >
                Start First-Run Setup →
              </Link>
            </div>
          )}

          {setupComplete && (
            <div className="rounded-2xl bg-emerald-50 p-4 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
              <span>First-run setup completed! Sign in below with your mobile number and password.</span>
            </div>
          )}

          {state?.error && (
            <div className="rounded-xl bg-error-container/40 p-3.5 border border-error/20 text-xs text-error font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
              <span>{state.error}</span>
            </div>
          )}

          <form className="space-y-4" action={formAction}>
            <input type="hidden" name="callbackUrl" value={callbackUrl} />

            <div>
              <label htmlFor="phone" className="block text-xs font-bold text-on-surface mb-1">
                Mobile Number or Email *
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-outline text-[18px] pointer-events-none">
                  person
                </span>
                <input
                  id="phone"
                  name="phone"
                  type="text"
                  required
                  autoComplete="username"
                  placeholder="10-digit mobile or email address"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-outline-variant/60 rounded-xl placeholder:text-outline/60 focus:outline-none focus:ring-2 focus:ring-primary text-xs text-on-surface font-medium transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="block text-xs font-bold text-on-surface">
                  Password *
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[11px] font-bold text-primary hover:underline transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-outline text-[18px] pointer-events-none">
                  lock
                </span>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="w-full pl-9 pr-10 py-2.5 bg-white border border-outline-variant/60 rounded-xl placeholder:text-outline/60 focus:outline-none focus:ring-2 focus:ring-primary text-xs text-on-surface font-medium transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 text-outline hover:text-on-surface p-0.5 rounded cursor-pointer transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            <div className="pt-2">
              <SubmitButton />
            </div>

            <div className="pt-3 text-center text-xs text-on-surface-variant border-t border-surface-container-high/60">
              <span>New to JMD Cart? </span>
              <Link
                href="/register"
                className="font-bold text-primary hover:underline ml-1"
              >
                Create an account →
              </Link>
            </div>
          </form>
        </div>
      </main>

      {/* 3. Clean Professional Footer */}
      <footer className="border-t border-surface-container-high/80 bg-surface-container-lowest/60 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1240px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-on-surface-variant">
          <div className="flex items-center gap-2 text-center sm:text-left">
            <span className="font-bold text-primary">JMD Cart Saharsa</span>
            <span>•</span>
            <span>Genuine FMCG &amp; Wholesale Grocery</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-semibold text-outline">
            <Link href="/privacy" className="hover:text-primary transition-colors">
              Privacy
            </Link>
            <span>•</span>
            <Link href="/terms" className="hover:text-primary transition-colors">
              Terms
            </Link>
            <span>•</span>
            <Link href="/refund-policy" className="hover:text-primary transition-colors">
              Refunds
            </Link>
            <span>•</span>
            <Link href="/cookie-policy" className="hover:text-primary transition-colors">
              Cookies
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
