import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PushSubscriptionType, UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Native Android Godown app registers its device token and FCM token
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      deviceToken,
      fcmToken,
      deviceLabel,
      appVersion,
      batteryOptDisabled,
      notificationPermitted,
      fullScreenPermitted,
    } = body;

    if (!deviceToken || !fcmToken) {
      return NextResponse.json({ error: "deviceToken and fcmToken required" }, { status: 400 });
    }

    // Associate with default godown staff user if not authenticated
    const godownUser = await prisma.user.findFirst({
      where: {
        role: { in: [UserRole.GODOWN, UserRole.WAREHOUSE_MANAGER, UserRole.ADMIN] },
        active: true,
      },
    });

    if (!godownUser) {
      return NextResponse.json({ error: "No warehouse user available" }, { status: 500 });
    }

    // Upsert native subscription
    const sub = await prisma.pushSubscription.upsert({
      where: { deviceToken },
      update: {
        endpoint: fcmToken,
        p256dh: "fcm_native",
        auth: "fcm_native",
        deviceLabel: deviceLabel || "Android Godown Device",
        type: PushSubscriptionType.NATIVE,
        appVersion: appVersion || "1.0.0",
        batteryOptDisabled: Boolean(batteryOptDisabled),
        notificationPermitted: Boolean(notificationPermitted),
        fullScreenPermitted: Boolean(fullScreenPermitted),
        active: true,
        lastSeenAt: new Date(),
      },
      create: {
        userId: godownUser.id,
        deviceToken,
        endpoint: fcmToken,
        p256dh: "fcm_native",
        auth: "fcm_native",
        deviceLabel: deviceLabel || "Android Godown Device",
        type: PushSubscriptionType.NATIVE,
        appVersion: appVersion || "1.0.0",
        batteryOptDisabled: Boolean(batteryOptDisabled),
        notificationPermitted: Boolean(notificationPermitted),
        fullScreenPermitted: Boolean(fullScreenPermitted),
        active: true,
        lastSeenAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      subscriptionId: sub.id,
      deviceToken,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to register native device" }, { status: 500 });
  }
}
