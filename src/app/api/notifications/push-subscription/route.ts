import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { pushNotificationService } from "@/modules/notifications/push-notification.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { subscription, deviceLabel } = body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 });
    }

    const saved = await pushNotificationService.saveSubscription(
      session.user.id,
      subscription,
      deviceLabel
    );

    return NextResponse.json({ success: true, subscription: saved });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to save subscription" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    if (!body?.endpoint) {
      return NextResponse.json({ error: "Endpoint required" }, { status: 400 });
    }

    const res = await pushNotificationService.removeSubscription(body.endpoint);
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete subscription" }, { status: 500 });
  }
}
