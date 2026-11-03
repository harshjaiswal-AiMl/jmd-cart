import { NextRequest, NextResponse } from "next/server";
import { MessagingService } from "@/modules/messaging/messaging.service";

export const dynamic = "force-dynamic";

const VERIFY_TOKEN = process.env.META_WA_VERIFY_TOKEN || "jmd_cart_meta_2026";

/**
 * Meta WhatsApp Cloud API Webhook
 * GET: Hub verification by Meta
 * POST: Inbound messages (opt-out keywords) and message delivery status updates
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[Meta Webhook] Successfully verified webhook subscription");
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Check if this is a WhatsApp status/message payload
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (value) {
      // 1. Process inbound customer messages (Check STOP / UNSUBSCRIBE)
      const messages = value.messages;
      if (Array.isArray(messages)) {
        for (const msg of messages) {
          const fromPhone = (msg.from || "").replace(/\D/g, "");
          const textBody = (msg.text?.body || "").trim().toUpperCase();

          if (fromPhone && (textBody === "STOP" || textBody === "UNSUBSCRIBE" || textBody === "BLOCK")) {
            await MessagingService.handleOptOut(fromPhone, "META_WA_INBOUND_STOP");
            console.log(`[Meta Webhook] Opt-out recorded for phone: ${fromPhone}`);
          }
        }
      }

      // 2. Process message delivery statuses
      const statuses = value.statuses;
      if (Array.isArray(statuses)) {
        for (const st of statuses) {
          console.log(`[Meta Webhook] Message ${st.id} status update: ${st.status}`);
        }
      }
    }

    // Always acknowledge Meta with 200 OK within 3 seconds
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[Meta Webhook Error]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
