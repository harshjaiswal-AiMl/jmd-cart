import { NextRequest, NextResponse } from "next/server";
import { MobileDeviceService } from "@/modules/mobile/mobile-device.service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { deviceId } = body;

    if (!deviceId) {
      return NextResponse.json({ error: "deviceId is required" }, { status: 400 });
    }

    const result = await MobileDeviceService.heartbeat(deviceId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update heartbeat" }, { status: 400 });
  }
}
