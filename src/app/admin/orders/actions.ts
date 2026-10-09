"use server";

import { auth } from "@/auth";
import { orderService } from "@/modules/order/order.service";
import { OrderStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

export interface OrderAdminActionResult {
  success?: boolean;
  error?: string;
}

export async function updateOrderStatusAction(
  orderId: string,
  newStatus: OrderStatus
): Promise<OrderAdminActionResult> {
  const session = await auth();

  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  try {
    await orderService.updateOrderStatus(
      session.user.role,
      session.user.id,
      orderId,
      newStatus
    );

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath(`/admin/orders/${orderId}/pick-list`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update order status";
    return { error: message };
  }
}
