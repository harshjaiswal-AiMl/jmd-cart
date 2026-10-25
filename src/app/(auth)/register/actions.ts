"use server";

import { authService } from "@/modules/auth/auth.service";
import { signIn } from "@/auth";
import { isRedirectError } from "next/dist/client/components/redirect";

export interface RegisterActionState {
  error?: string;
  success?: boolean;
  requiresOtp?: boolean;
  email?: string;
  phone?: string;
}

export async function registerAction(
  prevState: RegisterActionState | undefined,
  formData: FormData
): Promise<RegisterActionState | undefined> {
  const name = (formData.get("name") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const password = formData.get("password") as string;
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const gstin = (formData.get("gstin") as string)?.trim()?.toUpperCase() || null;
  const address = (formData.get("address") as string)?.trim() || null;

  if (!name || name.length < 2) {
    return { error: "Please enter your full name or shop name (minimum 2 characters)" };
  }

  if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
    return { error: "Please enter a valid 10-digit Indian mobile number" };
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Please enter a valid email address for account verification" };
  }

  if (!password || password.length < 6) {
    return { error: "Password must be at least 6 characters long" };
  }

  try {
    const result = await authService.initiateRegistrationWithEmailOtp({
      name,
      phone,
      email,
      password,
      gstin,
      address,
    });

    return {
      success: true,
      requiresOtp: true,
      email: result.email,
      phone: result.phone,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to initiate registration";
    return { error: message };
  }
}

export async function verifyEmailOtpAction(
  prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData
) {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const otp = (formData.get("otp") as string)?.trim();
  const password =
    (formData.get("reg_auth_token") as string) ||
    (formData.get("password") as string);

  if (!email || !otp) {
    return { error: "Email address and 6-digit verification code are required" };
  }

  try {
    const { phone } = await authService.verifyRegistrationEmailOtp(email, otp);

    if (password) {
      await signIn("credentials", {
        phone,
        password,
        redirectTo: "/store",
      });
    }

    return { success: true };
  } catch (err) {
    if (
      isRedirectError(err) ||
      (err as any)?.message === "NEXT_REDIRECT" ||
      (err as any)?.digest?.includes("NEXT_REDIRECT")
    ) {
      throw err;
    }
    const message = err instanceof Error ? err.message : "Verification failed";
    return { error: message };
  }
}
