import { NextRequest, NextResponse } from "next/server";
import { MobileDeviceService } from "@/modules/mobile/mobile-device.service";
import { getMobileAuthUser } from "@/modules/mobile/mobile-auth.middleware";

export async function POST(req: NextRequest) {
  try {
    const user = await getMobileAuthUser(req);
    const body = await req.json().catch(() => ({}));
    const { deviceId, platform, fcmToken, appVersion, locale, notificationPreferences } = body;

    if (!deviceId || !platform) {
      return NextResponse.json({ error: "deviceId and platform are required" }, { status: 400 });
    }

    const device = await MobileDeviceService.registerDevice({
      deviceId,
      platform,
      fcmToken,
      appVersion,
      locale,
      notificationPreferences,
      userId: user?.id || null,
    });

    return NextResponse.json({
      success: true,
      device: {
        id: device.id,
        deviceId: device.deviceId,
        platform: device.platform,
        locale: device.locale,
        notificationPreferences: device.notificationPreferences,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to register device" }, { status: 400 });
  }
}
