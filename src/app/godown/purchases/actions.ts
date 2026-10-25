"use server";

import { auth } from "@/auth";
import { purchaseService } from "@/modules/purchase/purchase.service";
import { revalidatePath } from "next/cache";

export interface PurchaseActionResult {
  success?: boolean;
  error?: string;
  purchaseId?: string;
}

export async function recordPurchaseAction(
  prevState: PurchaseActionResult | undefined,
  formData: FormData
): Promise<PurchaseActionResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  const rawJson = (formData.get("purchaseData") || formData.get("payload")) as string;
  if (!rawJson) {
    return { error: "Purchase details are required" };
  }

  try {
    const parsed = JSON.parse(rawJson);
    const result = await purchaseService.recordPurchaseReceive(
      session.user.role,
      session.user.id,
      parsed
    );

    revalidatePath("/godown/purchases");
    return { success: true, purchaseId: result.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record purchase";
    return { error: message };
  }
}

export async function cancelPurchaseAction(purchaseId: string, reason: string) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.role) {
      return { success: false, error: "Unauthorized" };
    }

    await purchaseService.cancelPurchase(
      session.user.role,
      session.user.id,
      purchaseId,
      reason
    );

    revalidatePath("/godown/purchases");
    revalidatePath("/godown/stock");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to cancel purchase receipt",
    };
  }
}

export async function updatePurchaseAction(
  purchaseId: string,
  data: {
    billNo?: string;
    billDate?: string;
    supplierId?: string | null;
  }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.role) {
      return { success: false, error: "Unauthorized" };
    }

    await purchaseService.updatePurchase(
      session.user.role,
      session.user.id,
      purchaseId,
      {
        billNo: data.billNo,
        billDate: data.billDate ? new Date(data.billDate) : undefined,
        supplierId: data.supplierId,
      }
    );

    revalidatePath("/godown/purchases");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update purchase details",
    };
  }
}
