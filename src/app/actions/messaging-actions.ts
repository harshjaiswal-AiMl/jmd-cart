"use server";

import { auth } from "@/auth";
import { MessageChannel } from "@prisma/client";
import { MessagingService } from "@/modules/messaging/messaging.service";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

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

export async function saveMessagingConfigAction(config: {
  whatsappProvider?: string;
  smsProvider?: string;
  fast2smsApiKey?: string;
  twilioSid?: string;
  twilioToken?: string;
  twilioFrom?: string;
  metaWaPhoneNumberId?: string;
  metaWaAccessToken?: string;
  openWaGatewayUrl?: string;
}) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN")) {
    return { success: false, error: "Admin authorization required" };
  }

  try {
    const updates: Array<{ key: string; value: string }> = [];

    if (config.whatsappProvider !== undefined) updates.push({ key: "messaging_whatsapp_provider", value: config.whatsappProvider });
    if (config.smsProvider !== undefined) updates.push({ key: "messaging_sms_provider", value: config.smsProvider });
    if (config.fast2smsApiKey !== undefined) updates.push({ key: "messaging_fast2sms_api_key", value: config.fast2smsApiKey.trim() });
    if (config.twilioSid !== undefined) updates.push({ key: "messaging_twilio_sid", value: config.twilioSid.trim() });
    if (config.twilioToken !== undefined) updates.push({ key: "messaging_twilio_token", value: config.twilioToken.trim() });
    if (config.twilioFrom !== undefined) updates.push({ key: "messaging_twilio_from", value: config.twilioFrom.trim() });
    if (config.metaWaPhoneNumberId !== undefined) updates.push({ key: "messaging_whatsapp_phone_number_id", value: config.metaWaPhoneNumberId.trim() });
    if (config.metaWaAccessToken !== undefined) updates.push({ key: "messaging_whatsapp_access_token", value: config.metaWaAccessToken.trim() });
    if (config.openWaGatewayUrl !== undefined) updates.push({ key: "messaging_openwa_gateway_url", value: config.openWaGatewayUrl.trim() });

    for (const u of updates) {
      await prisma.setting.upsert({
        where: { key: u.key },
        update: { value: u.value },
        create: { key: u.key, value: u.value },
      });
    }

    revalidatePath("/admin/settings");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to save configuration" };
  }
}
