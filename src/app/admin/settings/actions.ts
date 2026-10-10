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

export async function updateDeliverySettingsAction(
  prevState: SettingsActionResult | undefined,
  formData: FormData
): Promise<SettingsActionResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  try {
    const freeTownRupees = Number(formData.get("freeDeliveryTownRupees") || 0);
    const chargeTownRupees = Number(formData.get("deliveryChargeTownRupees") || 0);
    const freeOutstationRupees = Number(formData.get("freeDeliveryOutstationRupees") || 0);
    const chargeOutstationRupees = Number(formData.get("deliveryChargeOutstationRupees") || 0);

    const zonesJson = formData.get("zonesJson") as string;
    let zones: unknown[] = [];
    if (zonesJson) {
      zones = JSON.parse(zonesJson);
    }

    const payload = {
      freeDeliveryTownPaise: Math.round(freeTownRupees * 100),
      deliveryChargeTownPaise: Math.round(chargeTownRupees * 100),
      freeDeliveryOutstationPaise: Math.round(freeOutstationRupees * 100),
      deliveryChargeOutstationPaise: Math.round(chargeOutstationRupees * 100),
      zones,
    };

    await settingsService.updateDeliverySettings(
      session.user.role,
      session.user.id,
      payload
    );

    revalidatePath("/admin/settings");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update delivery settings";
    return { error: message };
  }
}

export async function updatePaymentModeSettingsAction(
  prevState: SettingsActionResult | undefined,
  formData: FormData
): Promise<SettingsActionResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  try {
    const codEnabled = formData.get("codEnabled") === "on" || formData.get("codEnabled") === "true";
    const upiDeliveryEnabled = formData.get("upiDeliveryEnabled") === "on" || formData.get("upiDeliveryEnabled") === "true";
    const creditEnabledForCreditParties = formData.get("creditEnabledForCreditParties") === "on" || formData.get("creditEnabledForCreditParties") === "true";
    const onlineGatewayEnabled = formData.get("onlineGatewayEnabled") === "on" || formData.get("onlineGatewayEnabled") === "true";
    const gatewayProvider = (formData.get("gatewayProvider") as "none" | "razorpay" | "phonepe") || "none";
    const gatewayKeyId = ((formData.get("gatewayKeyId") as string) || "").trim();
    const gatewayKeySecret = ((formData.get("gatewayKeySecret") as string) || "").trim();

    const payload = {
      codEnabled,
      upiDeliveryEnabled,
      creditEnabledForCreditParties,
      onlineGatewayEnabled,
      gatewayProvider: onlineGatewayEnabled ? gatewayProvider : "none",
      gatewayKeyId: onlineGatewayEnabled ? gatewayKeyId : "",
      gatewayKeySecret: onlineGatewayEnabled ? gatewayKeySecret : "",
    };

    await settingsService.updatePaymentModeSettings(
      session.user.role,
      session.user.id,
      payload
    );

    revalidatePath("/admin/settings");
    revalidatePath("/store/checkout");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update payment mode settings";
    return { error: message };
  }
}

export async function updateEInvoiceSettingsAction(
  prevState: SettingsActionResult | undefined,
  formData: FormData
): Promise<SettingsActionResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  try {
    const enabled = formData.get("enabled") === "on" || formData.get("enabled") === "true";
    const provider = (formData.get("provider") as "noop" | "clear_tax" | "cygnet" | "nic") || "noop";
    const gspClientId = ((formData.get("gspClientId") as string) || "").trim();
    const gspClientSecret = ((formData.get("gspClientSecret") as string) || "").trim();
    const gspUsername = ((formData.get("gspUsername") as string) || "").trim();
    const gspBaseUrl = ((formData.get("gspBaseUrl") as string) || "").trim();
    const autoGenerateOnFinalize = formData.get("autoGenerateOnFinalize") !== "false";

    const payload = {
      enabled,
      provider,
      gspClientId,
      gspClientSecret,
      gspUsername,
      gspBaseUrl,
      autoGenerateOnFinalize,
    };

    await settingsService.updateEInvoiceSettings(
      session.user.role,
      session.user.id,
      payload
    );

    revalidatePath("/admin/settings");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update e-invoice settings";
    return { error: message };
  }
}


