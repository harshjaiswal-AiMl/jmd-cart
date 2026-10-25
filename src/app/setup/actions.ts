"use server";

import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { setupService } from "@/modules/auth/setup.service";

export interface SetupActionState {
  error?: string;
}

export async function completeSetupAction(
  prevState: SetupActionState | undefined,
  formData: FormData
): Promise<SetupActionState> {
  const isRedirectError = (err: unknown): boolean => {
    if (!err || typeof err !== "object") return false;
    const digest = (err as { digest?: unknown }).digest;
    return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
  };

  const ownerPhone = ((formData.get("ownerPhone") as string) || "").trim();
  const ownerPassword = (formData.get("ownerPassword") as string) || "";
  const confirmPassword = (formData.get("confirmPassword") as string) || "";

  if (ownerPassword !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  try {
    await setupService.completeFirstRunSetup({
      ownerName: (formData.get("ownerName") as string) || "",
      ownerPhone,
      ownerEmail: (formData.get("ownerEmail") as string) || "",
      ownerPassword,
      legalName: (formData.get("legalName") as string) || "",
      tradeName: (formData.get("tradeName") as string) || "",
      gstin: (formData.get("gstin") as string) || "",
      fssai: (formData.get("fssai") as string) || "",
      address: (formData.get("address") as string) || "",
      businessPhone: ownerPhone,
      businessEmail: (formData.get("ownerEmail") as string) || "",
    });
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const message =
      err instanceof Error ? err.message : "Failed to complete first-run setup";
    return { error: message };
  }

  try {
    await signIn("credentials", {
      phone: ownerPhone,
      password: ownerPassword,
      redirectTo: "/admin",
    });
  } catch (err) {
    if (isRedirectError(err)) throw err;
  }

  redirect("/login?setup=complete");
}

