"use client";

import { useState, useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { registerAction, verifyEmailOtpAction, RegisterActionState } from "./actions";

function SubmitButton({ label = "Create Account" }: { label?: string }) {
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
          <span>Processing...</span>
        </>
      ) : (
        <span>{label}</span>
      )}
    </button>
  );
}

export default function RegisterPage() {
  const [state, formAction] = useFormState<RegisterActionState | undefined, FormData>(
    registerAction,
    undefined
  );

  const [otpState, otpFormAction] = useFormState(verifyEmailOtpAction, undefined);
  const [otp, setOtp] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (state?.requiresOtp && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [state?.requiresOtp, countdown]);

  if (state?.requiresOtp && state.email) {
    return (
      <div key="otp-verification-screen" className="min-h-screen flex items-center justify-center bg-surface py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-6 bg-surface-container-lowest p-6 sm:p-8 rounded-3xl shadow-xl border border-surface-container-high/90">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[32px]">mark_email_read</span>
            </div>
            <h2 className="text-2xl font-black font-headline text-on-surface tracking-tight">Verify Your Email</h2>
            <p className="mt-2 text-xs text-on-surface-variant leading-relaxed">
              We sent a 6-digit verification code to:
            </p>
            <div className="mt-1 px-3 py-1.5 bg-surface-container-low rounded-xl inline-block border border-outline-variant/50 text-xs font-bold text-primary">
              {state.email}
            </div>
          </div>

          {otpState?.error && (
            <div className="rounded-xl bg-error-container/40 p-3.5 border border-error/20 text-xs text-error font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
              <span>{otpState.error}</span>
            </div>
          )}

          <form action={otpFormAction} autoComplete="off" data-form-type="other" className="space-y-5">
            <input type="hidden" name="email" value={state.email} />

            <div>
              <label htmlFor="email_otp_field" className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-2 text-center">
                Enter 6-Digit Code
              </label>
              <input
                id="email_otp_field"
                name="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoCorrect="off"
                spellCheck={false}
                data-1p-ignore="true"
                data-lpignore="true"
                data-form-type="other"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                value={otp}
                onChange={(e) => {
                  // Only accept numbers; strip any letters, symbols, or browser autofilled password text
                  const cleanDigits = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setOtp(cleanDigits);
                }}
                placeholder="000000"
                className="tracking-[14px] text-center text-3xl font-mono block w-full px-4 py-3 bg-white border border-outline-variant/60 rounded-2xl placeholder:text-outline/30 focus:outline-none focus:ring-2 focus:ring-primary text-on-surface font-black"
              />
            </div>

            <div>
              <SubmitButton label="Verify & Activate Account" />
            </div>

            <div className="flex items-center justify-between text-xs text-on-surface-variant pt-2 border-t border-surface-container-high/60">
              <span className="text-outline">
                {canResend ? "Didn't receive code?" : `Resend in ${countdown}s`}
              </span>
              <button
                type="button"
                disabled={!canResend}
                onClick={() => {
                  setCountdown(60);
                  setCanResend(false);
                  window.location.reload();
                }}
                className={`font-bold transition-colors ${
                  canResend ? "text-primary hover:underline cursor-pointer" : "text-outline/50 cursor-not-allowed"
                }`}
              >
                Resend OTP
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div key="registration-form-screen" className="min-h-screen flex items-center justify-center bg-surface py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-surface-container-lowest p-6 sm:p-8 rounded-3xl shadow-xl border border-surface-container-high/90">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/jmd-cart-logo.png"
            alt="JMD Cart"
            className="h-14 w-14 mx-auto object-contain mb-3"
          />
          <h2 className="text-2xl font-black font-headline text-primary tracking-tight">
            Create Customer Account
          </h2>
          <p className="mt-1 text-xs text-on-surface-variant">
            Genuine wholesale rates, volume slabs &amp; 30-min Saharsa delivery
          </p>
        </div>

        {state?.error && (
          <div className="rounded-xl bg-error-container/40 p-3.5 border border-error/20 text-xs text-error font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
            <span>{state.error}</span>
          </div>
        )}

        <form className="space-y-4" action={formAction}>
          <div>
            <label htmlFor="name" className="block text-xs font-bold text-on-surface mb-1">
              Full Name / Kirana Shop Name *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              autoComplete="name"
              placeholder="e.g. Ramesh Kumar or Maa Durga Kirana"
              className="w-full px-3.5 py-2.5 bg-white border border-outline-variant/60 rounded-xl placeholder:text-outline/60 focus:outline-none focus:ring-2 focus:ring-primary text-xs text-on-surface"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="phone" className="block text-xs font-bold text-on-surface mb-1">
                Mobile Number *
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                autoComplete="tel"
                pattern="[6-9][0-9]{9}"
                placeholder="10-digit mobile"
                className="w-full px-3.5 py-2.5 bg-white border border-outline-variant/60 rounded-xl placeholder:text-outline/60 focus:outline-none focus:ring-2 focus:ring-primary text-xs text-on-surface font-mono"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-on-surface mb-1">
                Email Address * (for OTP)
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@gmail.com"
                className="w-full px-3.5 py-2.5 bg-white border border-outline-variant/60 rounded-xl placeholder:text-outline/60 focus:outline-none focus:ring-2 focus:ring-primary text-xs text-on-surface"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-bold text-on-surface mb-1">
              Create Password (min 6 characters) *
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 bg-white border border-outline-variant/60 rounded-xl placeholder:text-outline/60 focus:outline-none focus:ring-2 focus:ring-primary text-xs text-on-surface"
            />
          </div>

          <div className="pt-2">
            <SubmitButton label="Verify Email & Create Account" />
          </div>

          <div className="pt-2 text-center text-xs text-on-surface-variant border-t border-surface-container-high/60">
            <span>Already registered? </span>
            <Link
              href="/login"
              className="font-bold text-primary hover:underline ml-1"
            >
              Sign In Here →
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
