import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { pushNotificationService } from "@/modules/notifications/push-notification.service";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await pushNotificationService.sendTestAlert(session.user.id);
  return NextResponse.json(result);
}
