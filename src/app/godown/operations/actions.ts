"use server";

import { auth } from "@/auth";
import { godownService } from "@/modules/godown/godown.service";
import { revalidatePath } from "next/cache";

export interface OperationActionResult {
  success?: boolean;
  error?: string;
  movementId?: string;
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
