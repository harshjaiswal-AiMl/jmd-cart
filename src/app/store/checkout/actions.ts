"use server";

import { auth } from "@/auth";
import { orderService } from "@/modules/order/order.service";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export interface CheckoutActionResult {
  success?: boolean;
  orderNumber?: string;
  orderId?: string;
  error?: string;
}

export async function checkoutCartAction(
  prevState: CheckoutActionResult | undefined,
  formData: FormData
): Promise<CheckoutActionResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "Please log in to complete your order." };
  }

  let orderIdToRedirect: string | null = null;

  try {
    const deliveryZoneCode = formData.get("deliveryZoneCode") as string;
    const deliveryAddress = formData.get("deliveryAddress") as string;
    const contactPhone = formData.get("contactPhone") as string;
    const customerNotes = formData.get("customerNotes") as string;

    if (!deliveryZoneCode) {
      return { error: "Please select a delivery destination zone." };
    }

    if (!deliveryAddress || deliveryAddress.trim().length < 5) {
      return { error: "Please enter a complete delivery address (minimum 5 characters)." };
    }

    if (!contactPhone || contactPhone.trim().length < 10) {
      return { error: "Please enter a valid 10-digit contact mobile number." };
    }

    const order = await orderService.createOrderFromCart(session.user.id, {
      deliveryZoneCode,
      deliveryAddress,
      contactPhone,
      customerNotes,
    });

    revalidatePath("/store/cart");
    revalidatePath("/store/orders");
    orderIdToRedirect = order.id;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to place order";
    return { error: message };
  }

  if (orderIdToRedirect) {
    redirect(`/store/orders/${orderIdToRedirect}?newOrder=true`);
  }

  return { success: true };
}
