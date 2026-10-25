"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { dispatchService, CreateDispatchRunInput } from "@/modules/dispatch/dispatch.service";
import { manualOrderService, CreateManualOrderInput } from "@/modules/order/manual-order.service";
import { ForbiddenError } from "@/modules/auth/permissions";

export async function createDispatchRunAction(input: CreateDispatchRunInput) {
  const session = await auth();
  const user = session?.user;
  if (!user) {
    return { error: "Authentication required" };
  }

  try {
    const run = await dispatchService.createDispatchRun(input, {
      id: user.id,
      role: user.role,
      name: user.name || "Staff",
    });
    revalidatePath("/godown/dispatch");
    revalidatePath("/admin/orders");
    return { success: true, runId: run.id, runNumber: run.runNumber };
  } catch (err: any) {
    return { error: err.message || "Failed to create dispatch run" };
  }
}

export async function handoverDispatchRunAction(runId: string) {
  const session = await auth();
  const user = session?.user;
  if (!user) {
    return { error: "Authentication required" };
  }

  try {
    const res = await dispatchService.handoverDispatchRun(runId, {
      id: user.id,
      role: user.role,
      name: user.name || "Staff",
    });
    revalidatePath("/godown/dispatch");
    revalidatePath("/admin/orders");
    revalidatePath("/godown/stock");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to hand over dispatch run" };
  }
}

export async function handleFailedDeliveryAction(orderId: string, reason: string) {
  const session = await auth();
  const user = session?.user;
  if (!user) {
    return { error: "Authentication required" };
  }

  try {
    await dispatchService.handleFailedDelivery(orderId, reason, {
      id: user.id,
      role: user.role,
      name: user.name || "Staff",
    });
    revalidatePath("/godown/dispatch");
    revalidatePath("/admin/orders");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to process failed delivery" };
  }
}

export async function completeCounterPickupAction(pickupId: string) {
  const session = await auth();
  const user = session?.user;
  if (!user) {
    return { error: "Authentication required" };
  }

  try {
    await dispatchService.completeCounterPickup(pickupId, {
      id: user.id,
      name: user.name || "Staff",
    });
    revalidatePath("/godown/dispatch");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to complete counter pickup" };
  }
}

export async function updatePackingStatusAction(input: {
  pickupId?: string;
  invoiceId?: string;
  status: "PENDING" | "PACKING" | "PACKED" | "COMPLETED";
  items?: any;
  notes?: string;
}) {
  const session = await auth();
  const user = session?.user;
  if (!user) {
    return { error: "Authentication required" };
  }

  try {
    await dispatchService.updatePackingStatus(input, {
      id: user.id,
      name: user.name || "Staff",
    });
    revalidatePath("/godown/dispatch");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to update packing status" };
  }
}

export async function createManualOrderAction(input: CreateManualOrderInput) {
  const session = await auth();
  const user = session?.user;
  if (!user) {
    return { error: "Authentication required" };
  }

  try {
    const res = await manualOrderService.createManualOrder(input, {
      id: user.id,
      role: user.role,
      name: user.name || "Staff",
    });
    revalidatePath("/godown/dispatch");
    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    return { success: true, orderNumber: res.order.orderNumber, orderId: res.order.id };
  } catch (err: any) {
    return { error: err.message || "Failed to create manual order" };
  }
}
