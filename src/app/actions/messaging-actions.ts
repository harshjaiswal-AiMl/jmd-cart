"use server";

import { auth } from "@/auth";
import { MessageChannel } from "@prisma/client";
import { MessagingService } from "@/modules/messaging/messaging.service";

export async function sendBillMessageAction(params: {
  invoiceId: string;
  phone?: string;
  channels?: MessageChannel[];
}) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Authentication required" };
  }

  try {
    const result = await MessagingService.queueInvoiceMessage({
      invoiceId: params.invoiceId,
      phoneOverride: params.phone,
      channels: params.channels,
      actorUserId: session.user.id,
    });
    return { success: true, ...result };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to send message" };
  }
}
