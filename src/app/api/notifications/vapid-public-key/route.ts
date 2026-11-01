import { NextResponse } from "next/server";
import { pushNotificationService } from "@/modules/notifications/push-notification.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const publicKey = pushNotificationService.getPublicKey();
  return NextResponse.json({ publicKey });
}
