import { NextRequest, NextResponse } from "next/server";
import { MessagingService } from "@/modules/messaging/messaging.service";

export const dynamic = "force-dynamic";

/**
 * Inbound webhook for open-wa gateway events (incoming messages / STOP opt-out)
 */
export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get("x-api-key");
    const expectedKey = process.env.OPENWA_SECRET_KEY || "jmd_openwa_secret_2026";

    if (apiKey !== expectedKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Check if incoming text is an opt-out keyword
    const content = (body.body || body.content || body.message?.body || "").toString().trim().toUpperCase();
    const fromPhone = (body.from || body.sender?.id || "").toString().replace(/\D/g, "");

    if (fromPhone && (content === "STOP" || content === "UNSUBSCRIBE" || content === "BLOCK")) {
      await MessagingService.handleOptOut(fromPhone, "INBOUND_WA_STOP");
      return NextResponse.json({ success: true, action: "OPT_OUT_RECORDED" });
    }

    return NextResponse.json({ success: true, action: "IGNORED" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
