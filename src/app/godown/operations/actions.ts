"use server";

import { auth } from "@/auth";
import { godownService } from "@/modules/godown/godown.service";
import { autoConvertService } from "@/modules/godown/auto-convert.service";
import { revalidatePath } from "next/cache";

export interface OperationActionResult {
  success?: boolean;
  error?: string;
  movementId?: string;
  message?: string;
}

export async function manualConvertGodownAction(
  prevState: OperationActionResult | undefined,
  formData: FormData
): Promise<OperationActionResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  try {
    const productId = formData.get("productId") as string;
    const cartonsToOpen = parseInt(formData.get("cartonsToOpen") as string, 10);
    const reason = (formData.get("reason") as string) || undefined;

    const entry = await autoConvertService.manualConvertInGodown(
      session.user.role,
      session.user.id,
      { productId, cartons: cartonsToOpen, reason }
    );

    revalidatePath("/godown");
    revalidatePath("/godown/operations");
    revalidatePath("/management");
    return {
      success: true,
      movementId: entry.id,
      message: `Converted ${entry.cartonsOpened} carton(s) → +${entry.looseGenerated} loose pieces in Godown (${entry.logText})`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to convert carton in Godown";
    return { error: message };
  }
}

export async function reverseConversionAction(auditLogId: string): Promise<OperationActionResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  try {
    await autoConvertService.reverseConversion(
      session.user.role,
      session.user.id,
      auditLogId,
      "Reversed by Admin/Godown Keeper from Daily Auto-Converted Cartons Report"
    );

    revalidatePath("/godown");
    revalidatePath("/godown/operations");
    revalidatePath("/management");
    return { success: true, message: "Conversion entry reversed successfully." };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reverse conversion";
    return { error: message };
  }
}

export async function transferStockAction(
  prevState: OperationActionResult | undefined,
  formData: FormData
): Promise<OperationActionResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  try {
    const rawData = {
      productId: formData.get("productId") as string,
      fromLocationId: formData.get("fromLocationId") as string,
      toLocationId: formData.get("toLocationId") as string,
      qty: parseInt(formData.get("qty") as string, 10),
      reason: (formData.get("reason") as string) || undefined,
    };

    const res = await godownService.transferStock(
      session.user.role,
      session.user.id,
      rawData
    );

    revalidatePath("/godown/operations");
    return { success: true, movementId: res.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to transfer stock";
    return { error: message };
  }
}

export async function cartonBreakAction(
  prevState: OperationActionResult | undefined,
  formData: FormData
): Promise<OperationActionResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  try {
    const rawData = {
      productId: formData.get("productId") as string,
      fromLocationId: formData.get("fromLocationId") as string,
      toLocationId: formData.get("toLocationId") as string,
      cartons: parseInt(formData.get("cartons") as string, 10),
      reason: (formData.get("reason") as string) || undefined,
    };

    const res = await godownService.cartonBreak(
      session.user.role,
      session.user.id,
      rawData
    );

    revalidatePath("/godown/operations");
    return { success: true, movementId: res.movement.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to break cartons";
    return { error: message };
  }
}

export async function recordDamageAction(
  prevState: OperationActionResult | undefined,
  formData: FormData
): Promise<OperationActionResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  try {
    const rawData = {
      productId: formData.get("productId") as string,
      locationId: formData.get("locationId") as string,
      qty: parseInt(formData.get("qty") as string, 10),
      reason: formData.get("reason") as string,
    };

    const res = await godownService.recordDamage(
      session.user.role,
      session.user.id,
      rawData
    );

    revalidatePath("/godown/operations");
    return { success: true, movementId: res.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record damage";
    return { error: message };
  }
}

export async function adjustStockAction(
  prevState: OperationActionResult | undefined,
  formData: FormData
): Promise<OperationActionResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  try {
    const rawData = {
      productId: formData.get("productId") as string,
      locationId: formData.get("locationId") as string,
      adjustmentQty: parseInt(formData.get("adjustmentQty") as string, 10),
      reason: formData.get("reason") as string,
    };

    const res = await godownService.adjustStock(
      session.user.role,
      session.user.id,
      rawData
    );

    revalidatePath("/godown/operations");
    return { success: true, movementId: res.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to adjust stock";
    return { error: message };
  }
}
