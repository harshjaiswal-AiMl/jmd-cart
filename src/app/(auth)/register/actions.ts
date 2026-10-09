"use server";

import { authService } from "@/modules/auth/auth.service";
import { signIn } from "@/auth";

export interface RegisterActionState {
  error?: string;
  success?: boolean;
  requiresOtp?: boolean;
  phone?: string;
}

export async function registerAction(
  prevState: RegisterActionState | undefined,
  formData: FormData
): Promise<RegisterActionState | undefined> {
  const name = (formData.get("name") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const password = formData.get("password") as string;
  const email = (formData.get("email") as string)?.trim() || null;
  const gstin = (formData.get("gstin") as string)?.trim()?.toUpperCase() || null;
  const address = (formData.get("address") as string)?.trim() || null;

  if (!name || name.length < 2) {
    return { error: "Please enter your name or shop name (minimum 2 characters)" };
  }

  if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
    return { error: "Please enter a valid 10-digit Indian mobile number" };
  }

  if (!password || password.length < 6) {
    return { error: "Password must be at least 6 characters long" };
  }

  try {
    const result = await authService.registerBuyer({
      name,
      phone,
      password,
      email,
      gstin,
      address,
    });

    if (result.verificationMode === "sms") {
      return {
        success: true,
        requiresOtp: true,
        phone,
      };
    }

    // Auto sign-in if verification is off or admin-call mode (buyer can browse store immediately)
    await signIn("credentials", {
      phone,
      password,
      redirectTo: "/store",
    });

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to register account";
    return { error: message };
  }
}

export async function verifyOtpAction(
  prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData
) {
  const phone = (formData.get("phone") as string)?.trim();
  const otp = (formData.get("otp") as string)?.trim();
  const password = formData.get("password") as string;

  if (!phone || !otp) {
    return { error: "Phone number and 6-digit OTP code are required" };
  }

  try {
    await authService.verifyPhoneWithOtp(phone, otp);

    if (password) {
      await signIn("credentials", {
        phone,
        password,
        redirectTo: "/store",
      });
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "OTP verification failed";
    return { error: message };
  }
}
