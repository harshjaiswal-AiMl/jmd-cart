import { NextRequest, NextResponse } from "next/server";
import { MobileAuthService } from "@/modules/mobile/mobile-auth.service";
import { MobileDeviceService } from "@/modules/mobile/mobile-device.service";
import { getMobileAuthUser } from "@/modules/mobile/mobile-auth.middleware";

export async function POST(req: NextRequest) {
  try {
    const user = await getMobileAuthUser(req);
    const body = await req.json().catch(() => ({}));
    const { deviceId } = body;

    if (user && deviceId) {
      await MobileAuthService.revokeDeviceTokens(user.id, deviceId);
      await MobileDeviceService.unregisterDevice(deviceId);
    }

    return NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to log out" }, { status: 400 });
  }
}
