"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export interface LoginActionState {
  error?: string;
}

export async function loginAction(
  prevState: LoginActionState | undefined,
  formData: FormData
): Promise<LoginActionState | undefined> {
  const phone = (formData.get("phone") as string)?.trim();
  const password = formData.get("password") as string;
  const callbackUrl = (formData.get("callbackUrl") as string)?.trim() || "/";

  if (!phone || phone.length < 10) {
    return { error: "Please enter a valid 10-digit mobile number" };
  }

  if (!password) {
    return { error: "Please enter your password" };
  }

  try {
    await signIn("credentials", {
      phone,
      password,
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Invalid phone number or password" };
        default:
          return { error: "Authentication failed. Please check credentials or contact administrator." };
      }
    }
    // Re-throw redirect errors so Next.js can navigate
    throw error;
  }

  return undefined;
}
