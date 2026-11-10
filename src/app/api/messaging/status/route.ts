import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { MessagingService } from "@/modules/messaging/messaging.service";

export const dynamic = "force-dynamic";

/**
 * Staff-only endpoint returning WhatsApp & SMS gateway health and queue metrics
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden: Staff only" }, { status: 403 });
  }

  try {
    const health = await MessagingService.getGatewaysHealth();
    return NextResponse.json(health);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to query health" }, { status: 500 });
  }
}
