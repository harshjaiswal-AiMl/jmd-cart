"use server";

import { auth } from "@/auth";
import { settingsService } from "@/modules/settings/settings.service";
import { revalidatePath } from "next/cache";

export interface SettingsActionResult {
  success?: boolean;
  error?: string;
}

export async function updateBusinessDetailsAction(
  prevState: SettingsActionResult | undefined,
  formData: FormData
): Promise<SettingsActionResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  try {
    const rawData = {
      legalName: formData.get("legalName") as string,
      tradeName: formData.get("tradeName") as string,
      gstin: (formData.get("gstin") as string)?.toUpperCase(),
      fssai: formData.get("fssai") as string,
      address: formData.get("address") as string,
      phone: formData.get("phone") as string,
      email: formData.get("email") as string,
      bankDetails: {
        bankName: (formData.get("bankName") as string) || "",
        accountNumber: (formData.get("accountNumber") as string) || "",
        ifsc: (formData.get("ifsc") as string)?.toUpperCase() || "",
        branch: (formData.get("branch") as string) || "",
      },
      upiId: formData.get("upiId") as string,
    };

    await settingsService.updateBusinessDetails(
      session.user.role,
      session.user.id,
      rawData
    );

    revalidatePath("/admin/settings");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update business details";
    return { error: message };
  }
}

export async function updateRoleDiscountLimitsAction(
  prevState: SettingsActionResult | undefined,
  formData: FormData
): Promise<SettingsActionResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  try {
    const currentLimits = await settingsService.getRoleDiscountLimits();
    const updatedLimits = {
      ...currentLimits,
      SHOP: Math.round(Number(formData.get("SHOP") || 0) * 100), // convert % to basis points
      SALESPERSON: Math.round(Number(formData.get("SALESPERSON") || 0) * 100),
    };

    await settingsService.updateRoleDiscountLimits(
      session.user.role,
      session.user.id,
      updatedLimits
    );

    revalidatePath("/admin/settings");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update discount limits";
    return { error: message };
  }
}

export async function updateVerificationSettingsAction(
  prevState: SettingsActionResult | undefined,
  formData: FormData
): Promise<SettingsActionResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  try {
    const mode = formData.get("mode") as "admin" | "off" | "sms";

    await settingsService.updateVerificationSettings(
      session.user.role,
      session.user.id,
      { mode }
    );

    revalidatePath("/admin/settings");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update buyer verification settings";
    return { error: message };
  }
}
