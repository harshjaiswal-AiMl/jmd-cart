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
