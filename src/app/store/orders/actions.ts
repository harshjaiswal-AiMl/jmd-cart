"use server";

import { auth } from "@/auth";
import { orderService } from "@/modules/order/order.service";
import { revalidatePath } from "next/cache";

export interface ReorderActionResult {
  success?: boolean;
  error?: string;
  addedCount?: number;
  skippedCount?: number;
  skippedNames?: string[];
}

export async function reorderOrderAction(orderId: string): Promise<ReorderActionResult> {
  const session = await auth();

  if (!session?.user?.id || !session.user.role) {
    return { error: "Please log in to reorder items" };
  }

  try {
    const result = await orderService.reorderItems(
      session.user.role,
      session.user.id,
      orderId
    );

    revalidatePath("/store/cart");
    revalidatePath("/store/orders");
    revalidatePath(`/store/orders/${orderId}`);
    return {
      success: true,
      addedCount: result.addedCount,
      skippedCount: result.skippedCount,
      skippedNames: result.skippedNames,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reorder items";
    return { error: message };
  }
}
