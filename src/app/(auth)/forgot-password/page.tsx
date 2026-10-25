"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import {
  requestResetOtpAction,
  resetPasswordWithOtpAction,
  ForgotPasswordState,
} from "./actions";

function SubmitButton({ label = "Send Reset Code" }: { label?: string }) {
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
          <span>Verifying...</span>
        </>
      ) : (
        <span>{label}</span>
      )}
    </button>
  );
}

export default function ForgotPasswordPage() {
  const [requestState, requestAction] = useFormState<ForgotPasswordState | undefined, FormData>(
    requestResetOtpAction,
    undefined
  );

  const [resetState, resetAction] = useFormState<ForgotPasswordState | undefined, FormData>(
    resetPasswordWithOtpAction,
    undefined
  );

  const isOtpStep = requestState?.step === "ENTER_OTP_AND_NEW_PASSWORD" && requestState.userId;

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-surface-container-lowest p-6 sm:p-8 rounded-3xl shadow-xl border border-surface-container-high/90">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-[28px]">lock_reset</span>
          </div>
          <h2 className="text-2xl font-black font-headline text-on-surface tracking-tight">
            {isOtpStep ? "Set New Password" : "Reset Your Password"}
          </h2>
          <p className="mt-1 text-xs text-on-surface-variant leading-relaxed">
            {isOtpStep
              ? `Enter the 6-digit verification code sent to ${requestState.maskedEmail} and create your new password.`
              : "Enter your registered email address or mobile number to receive a secure password reset code."}
          </p>
        </div>

        {(requestState?.error || resetState?.error) && (
          <div className="rounded-xl bg-error-container/40 p-3.5 border border-error/20 text-xs text-error font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
            <span>{resetState?.error || requestState?.error}</span>
          </div>
        )}

        {isOtpStep ? (
          <form action={resetAction} className="space-y-4">
            <input type="hidden" name="userId" value={requestState.userId} />

            <div>
              <label htmlFor="otp" className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1 text-center">
                6-Digit Reset Code
              </label>
              <input
                id="otp"
                name="otp"
                type="text"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                placeholder="••••••"
                className="tracking-[10px] text-center text-2xl font-mono block w-full px-4 py-2.5 bg-white border border-outline-variant/60 rounded-xl placeholder:text-outline/40 focus:outline-none focus:ring-2 focus:ring-primary text-on-surface font-black"
              />
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-xs font-bold text-on-surface mb-1">
                New Password (min 6 characters) *
              </label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-white border border-outline-variant/60 rounded-xl placeholder:text-outline/60 focus:outline-none focus:ring-2 focus:ring-primary text-xs text-on-surface"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-bold text-on-surface mb-1">
                Confirm New Password *
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-white border border-outline-variant/60 rounded-xl placeholder:text-outline/60 focus:outline-none focus:ring-2 focus:ring-primary text-xs text-on-surface"
              />
            </div>

            <div className="pt-2">
              <SubmitButton label="Update Password & Sign In" />
            </div>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="text-xs text-outline hover:text-primary transition-colors cursor-pointer"
              >
                ← Back to enter another email/mobile
              </button>
            </div>
          </form>
        ) : (
          <form action={requestAction} className="space-y-4">
            <div>
              <label htmlFor="emailOrPhone" className="block text-xs font-bold text-on-surface mb-1">
                Registered Email or Mobile Number
              </label>
              <input
                id="emailOrPhone"
                name="emailOrPhone"
                type="text"
                required
                autoFocus
                placeholder="e.g. 9431400000 or customer@gmail.com"
                className="w-full px-3.5 py-2.5 bg-white border border-outline-variant/60 rounded-xl placeholder:text-outline/60 focus:outline-none focus:ring-2 focus:ring-primary text-xs text-on-surface"
              />
            </div>

            <div className="pt-2">
              <SubmitButton label="Send 6-Digit Verification Code" />
            </div>

            <div className="pt-2 text-center text-xs text-on-surface-variant border-t border-surface-container-high/60">
              <span>Remember your password? </span>
              <Link
                href="/login"
                className="font-bold text-primary hover:underline ml-1"
              >
                Back to Sign In →
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
