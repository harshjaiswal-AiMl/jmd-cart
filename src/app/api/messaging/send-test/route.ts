import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { MessageChannel } from "@prisma/client";
import { WhatsAppOpenWaGateway } from "@/modules/messaging/providers/open-wa.provider";
import { SmsAndroidGateway } from "@/modules/messaging/providers/android-sms.provider";

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
    const { phone, channel } = await req.json();
    if (!phone) {
      return NextResponse.json({ error: "Phone number required" }, { status: 400 });
    }

    const cleanedDigits = phone.replace(/\D/g, "");
    if (cleanedDigits.length < 10) {
      return NextResponse.json({ error: "Invalid mobile number" }, { status: 400 });
    }

    const testTime = new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });
    const messageBody = `[JMD CART TEST] Hello! Your JMD Cart messaging gateway (${channel || "DEFAULT"}) is active and working properly. Timestamp: ${testTime}. Bharosa Ghar Tak.`;

    if (channel === "SMS") {
      const smsProvider = new SmsAndroidGateway();
      const result = await smsProvider.send({
        toPhone: cleanedDigits,
        body: messageBody,
      });
      return NextResponse.json({ success: result.success, error: result.error, channel: "SMS" });
    } else {
      const waProvider = new WhatsAppOpenWaGateway();
      const result = await waProvider.send({
        toPhone: cleanedDigits,
        body: messageBody,
      });
      return NextResponse.json({ success: result.success, error: result.error, channel: "WHATSAPP" });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to send test message" }, { status: 500 });
  }
}
