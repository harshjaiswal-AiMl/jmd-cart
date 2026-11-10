import { NextRequest, NextResponse } from "next/server";
import { MobileNotifyMeService } from "@/modules/mobile/mobile-notify-me.service";
import { getMobileAuthUser } from "@/modules/mobile/mobile-auth.middleware";

export async function POST(req: NextRequest) {
  try {
    const user = await getMobileAuthUser(req);
    const body = await req.json().catch(() => ({}));
    const { productId, phone, deviceId, fcmToken } = body;

    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    const result = await MobileNotifyMeService.requestBackInStockNotification({
      productId,
      userId: user?.id || null,
      phone: phone || user?.phone || null,
      deviceId: deviceId || null,
      fcmToken: fcmToken || null,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to register request" }, { status: 400 });
  }
}
