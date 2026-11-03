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

  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  try {
    const user = await authService.authenticateWithCredentials(phoneOrEmail, password);

    // Safeguard targetUrl: never redirect an authenticated user to /login
    const resolvedDefault = getDefaultDashboard(user.role);
    let targetUrl =
      callbackUrl && callbackUrl !== "/" && callbackUrl !== "/login"
        ? callbackUrl
        : resolvedDefault;

    if (!targetUrl || targetUrl === "/login") {
      targetUrl = resolvedDefault !== "/login" ? resolvedDefault : "/admin";
    }

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
          console.error(`[Login AuthError ${requestId}]`, error);
          return {
            error: `Authentication failed (Ref: ${requestId}). Please check credentials or contact administrator.`,
          };
      }
    }
    if (error instanceof Error) {
      // User inactive or invalid credentials from authService
      if (
        error.message.includes("deactivated") ||
        error.message.includes("Invalid") ||
        error.message.includes("password")
      ) {
        return { error: error.message };
      }
      console.error(`[Login Error ${requestId}]`, error);
      return { error: `${error.message} (Ref: ${requestId})` };
    }
    console.error(`[Login UnknownError ${requestId}]`, error);
    return { error: `Authentication error occurred (Ref: ${requestId}). Please try again.` };
  }

  return undefined;
}
