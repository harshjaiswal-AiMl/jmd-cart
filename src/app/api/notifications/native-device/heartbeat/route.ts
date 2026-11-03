import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Native Android Godown app reports heartbeat, online status & permission diagnostics
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("x-device-token");
    const body = await req.json().catch(() => ({}));
    const deviceToken = token || body.deviceToken;

    if (!deviceToken) {
      return NextResponse.json({ error: "x-device-token required" }, { status: 401 });
    }

    const sub = await prisma.pushSubscription.findUnique({
      where: { deviceToken },
    });

    if (!sub) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    await prisma.pushSubscription.update({
      where: { id: sub.id },
      data: {
        lastSeenAt: new Date(),
        appVersion: body.appVersion || sub.appVersion,
        batteryOptDisabled: body.batteryOptDisabled !== undefined ? Boolean(body.batteryOptDisabled) : sub.batteryOptDisabled,
        notificationPermitted: body.notificationPermitted !== undefined ? Boolean(body.notificationPermitted) : sub.notificationPermitted,
        fullScreenPermitted: body.fullScreenPermitted !== undefined ? Boolean(body.fullScreenPermitted) : sub.fullScreenPermitted,
      },
    });

    return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Heartbeat error" }, { status: 500 });
  }
}
