import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { MessageChannel, MessageProviderType } from "@prisma/client";
import { MessagingService } from "@/modules/messaging/messaging.service";

export const dynamic = "force-dynamic";

/**
 * Staff-only endpoint to send a live test message to an admin's phone
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden: Staff only" }, { status: 403 });
  }

  try {
    const { phone, channel, provider } = await req.json();
    if (!phone) {
      return NextResponse.json({ error: "Phone number required" }, { status: 400 });
    }

    const cleanedDigits = phone.replace(/\D/g, "");
    if (cleanedDigits.length < 10) {
      return NextResponse.json({ error: "Invalid mobile number" }, { status: 400 });
    }

    const testTime = new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });
    const messageBody = `[JMD CART TEST] Hello! Your JMD Cart automated messaging (${provider || channel || "DEFAULT"}) is active and working. Time: ${testTime}. Bharosa Ghar Tak.`;

    const targetChannel = channel === "SMS" ? MessageChannel.SMS : MessageChannel.WHATSAPP;
    let targetProviderType: MessageProviderType | undefined = undefined;

    if (provider === "FAST2SMS") targetProviderType = MessageProviderType.FAST2SMS;
    else if (provider === "TWILIO") targetProviderType = MessageProviderType.TWILIO;
    else if (provider === "ANDROID_SMS") targetProviderType = MessageProviderType.ANDROID_SMS;
    else if (provider === "CLOUD_API") targetProviderType = MessageProviderType.CLOUD_API;
    else if (provider === "OPEN_WA") targetProviderType = MessageProviderType.OPEN_WA;

    const result = await MessagingService.sendDirect({
      phone: cleanedDigits,
      body: messageBody,
      channel: targetChannel,
      providerType: targetProviderType,
    });

    return NextResponse.json({
      success: result.success,
      error: result.error,
      externalMessageId: result.externalMessageId,
      channel: targetChannel,
      provider: targetProviderType,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to send test message" }, { status: 500 });
  }
}
