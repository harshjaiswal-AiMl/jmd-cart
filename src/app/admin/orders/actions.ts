"use server";

import { auth } from "@/auth";
import { orderService } from "@/modules/order/order.service";
import { OrderStatus, PaymentMode, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface OrderAdminActionResult {
  success?: boolean;
  error?: string;
  invoiceId?: string;
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
    revalidatePath("/delivery");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update order status";
    return { error: message };
  }
}

export async function generateOrderInvoiceAction(
  orderId: string
): Promise<OrderAdminActionResult> {
  const session = await auth();

  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  try {
    const summary = await orderService.generateOrderInvoice(
      session.user.role,
      session.user.id,
      orderId
    );

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath(`/admin/orders/${orderId}/pick-list`);
    revalidatePath("/delivery");
    revalidatePath("/shop/invoices");
    return { success: true, invoiceId: summary.invoiceId || undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate order invoice";
    return { error: message };
  }
}

export async function assignDeliveryStaffAction(
  orderId: string,
  deliveryStaffId: string
): Promise<OrderAdminActionResult> {
  const session = await auth();

  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  try {
    await orderService.assignDeliveryStaff(
      session.user.role,
      session.user.id,
      { orderId, deliveryStaffId }
    );

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath(`/admin/orders/${orderId}/pick-list`);
    revalidatePath("/delivery");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to assign delivery staff";
    return { error: message };
  }
}

export async function recordDeliveryPaymentAction(input: {
  orderId: string;
  paymentMode: PaymentMode;
  paymentReference?: string;
  notes?: string;
}): Promise<OrderAdminActionResult> {
  const session = await auth();

  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  try {
    await orderService.recordOrderDeliveryAndPayment(
      session.user.role,
      session.user.id,
      input
    );

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${input.orderId}`);
    revalidatePath("/delivery");
    revalidatePath("/van");
    revalidatePath("/shop/invoices");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record delivery payment";
    return { error: message };
  }
}

export async function getDeliveryStaffListAction() {
  const session = await auth();

  if (!session?.user?.id || !session.user.role) {
    return [];
  }

  const staff = await prisma.user.findMany({
    where: {
      role: { in: [UserRole.DELIVERY, UserRole.SALESPERSON, UserRole.SUPER_ADMIN] },
      active: true,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
    },
    orderBy: { name: "asc" },
  });

  return staff;
}
