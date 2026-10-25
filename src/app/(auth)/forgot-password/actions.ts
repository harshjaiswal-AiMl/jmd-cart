"use server";

import { authService } from "@/modules/auth/auth.service";
import { signIn } from "@/auth";
import { isRedirectError } from "next/dist/client/components/redirect";

export interface ForgotPasswordState {
  error?: string;
  success?: boolean;
  step?: "REQUEST_OTP" | "ENTER_OTP_AND_NEW_PASSWORD" | "SUCCESS";
  userId?: string;
  maskedEmail?: string;
}

export async function requestResetOtpAction(
  prevState: ForgotPasswordState | undefined,
  formData: FormData
): Promise<ForgotPasswordState | undefined> {
  const emailOrPhone = (formData.get("emailOrPhone") as string)?.trim();

  if (!emailOrPhone) {
    return { error: "Please enter your registered mobile number or email address", step: "REQUEST_OTP" };
  }

  try {
    const result = await authService.requestPasswordReset(emailOrPhone);
    return {
      success: true,
      step: "ENTER_OTP_AND_NEW_PASSWORD",
      userId: result.userId,
      maskedEmail: result.maskedEmail,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send reset code";
    return { error: message, step: "REQUEST_OTP" };
  }
}

export async function resetPasswordWithOtpAction(
  prevState: ForgotPasswordState | undefined,
  formData: FormData
): Promise<ForgotPasswordState | undefined> {
  const userId = (formData.get("userId") as string)?.trim();
  const otp = (formData.get("otp") as string)?.trim();
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!userId || !otp) {
    return { error: "Reset verification code is required", step: "ENTER_OTP_AND_NEW_PASSWORD", userId };
  }

  if (!newPassword || newPassword.length < 6) {
    return { error: "New password must be at least 6 characters long", step: "ENTER_OTP_AND_NEW_PASSWORD", userId };
  }

  if (newPassword !== confirmPassword) {
    return { error: "New password and confirmation do not match", step: "ENTER_OTP_AND_NEW_PASSWORD", userId };
  }

  try {
    const { phone } = await authService.verifyPasswordResetAndSetNewPassword(userId, otp, newPassword);

    // Auto sign-in with newly set credentials
    await signIn("credentials", {
      phone,
      password: newPassword,
      redirectTo: "/store",
    });

    return { success: true, step: "SUCCESS" };
  } catch (err) {
    if (
      isRedirectError(err) ||
      (err as any)?.message === "NEXT_REDIRECT" ||
      (err as any)?.digest?.includes("NEXT_REDIRECT")
    ) {
      throw err;
    }
    const message = err instanceof Error ? err.message : "Failed to reset password";
    return { error: message, step: "ENTER_OTP_AND_NEW_PASSWORD", userId };
  }
}
