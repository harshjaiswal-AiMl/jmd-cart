import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PushSubscriptionType, UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Admin endpoint returning health status of warehouse Android devices and active alerts
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== UserRole.ADMIN && role !== UserRole.SUPER_ADMIN && role !== UserRole.WAREHOUSE_MANAGER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const nativeDevices = await prisma.pushSubscription.findMany({
      where: {
        type: PushSubscriptionType.NATIVE,
      },
      include: {
        user: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { lastSeenAt: "desc" },
    });

    const devices = nativeDevices.map((d) => {
      const isOnline = d.lastSeenAt >= fiveMinutesAgo;
      const issues: string[] = [];

      if (!d.notificationPermitted) issues.push("Notifications Blocked");
      if (!d.batteryOptDisabled) issues.push("Battery Optimization Active (May delay alarms)");
      if (!d.fullScreenPermitted) issues.push("Full Screen Intent Blocked (Screen won't turn on over lockscreen)");
      if (!isOnline) issues.push("Device Offline (No heartbeat in 5 min)");

      return {
        id: d.id,
        deviceLabel: d.deviceLabel || "Android Phone",
        assignedUser: d.user?.name || "Warehouse Staff",
        appVersion: d.appVersion || "1.0.0",
        isOnline,
        lastSeenAt: d.lastSeenAt.toISOString(),
        notificationPermitted: d.notificationPermitted,
        batteryOptDisabled: d.batteryOptDisabled,
        fullScreenPermitted: d.fullScreenPermitted,
        healthStatus: issues.length === 0 ? "HEALTHY" : isOnline ? "WARNING" : "OFFLINE",
        issues,
      };
    });

    const pendingAlerts = await prisma.orderAlert.count({
      where: {
        state: "NOTIFIED",
      },
    });

    return NextResponse.json({
      success: true,
      totalDevices: devices.length,
      onlineCount: devices.filter((d) => d.isOnline).length,
      pendingAlerts,
      devices,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch alert health" }, { status: 500 });
  }
}
