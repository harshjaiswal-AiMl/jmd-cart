import { NextRequest, NextResponse } from "next/server";
import { pushNotificationService } from "@/modules/notifications/push-notification.service";

export const dynamic = "force-dynamic";

/**
 * Native Android Godown app acknowledges order alert, stopping ringtone across all devices
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("x-device-token");
    const body = await req.json();
    const orderId = body.orderId;
    const deviceToken = token || body.deviceToken;

    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }

    const res = await pushNotificationService.acceptOrderAlert(orderId, undefined, deviceToken);
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to acknowledge alert" }, { status: 500 });
  }
}
