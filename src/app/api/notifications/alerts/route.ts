import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { pushNotificationService } from "@/modules/notifications/push-notification.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const alerts = await pushNotificationService.getActiveAlertsForUser(session.user.id);
  return NextResponse.json({ alerts });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }

    const res = await pushNotificationService.acceptOrderAlert(orderId, session.user.id);
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to accept alert" }, { status: 500 });
  }
}
