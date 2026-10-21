"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { authService } from "@/modules/auth/auth.service";
import { getDefaultDashboard } from "@/modules/auth/permissions";

export interface LoginActionState {
  error?: string;
}

export async function loginAction(
  prevState: LoginActionState | undefined,
  formData: FormData
): Promise<LoginActionState | undefined> {
  const isRedirectError = (err: unknown): boolean => {
    if (!err || typeof err !== "object") return false;
    const digest = (err as { digest?: unknown }).digest;
    return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
  };

  const phoneOrEmail = (formData.get("phone") as string)?.trim();
  const password = formData.get("password") as string;
  const callbackUrl = (formData.get("callbackUrl") as string)?.trim() || "/";

  if (!phoneOrEmail || phoneOrEmail.length < 3) {
    return { error: "Please enter a valid mobile number or email address" };
  }

  if (!password) {
    return { error: "Please enter your password" };
  }

  try {
    const user = await authService.authenticateWithCredentials(phoneOrEmail, password);
    const targetUrl =
      callbackUrl && callbackUrl !== "/"
        ? callbackUrl
        : getDefaultDashboard(user.role);

    await signIn("credentials", {
      phone: user.phone,
      password,
      redirectTo: targetUrl,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Invalid mobile number/email or password" };
        default:
          return {
            error: "Authentication failed. Please check credentials or contact administrator.",
          };
      }
    }
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: "Invalid mobile number/email or password" };
  }

  return undefined;
}

