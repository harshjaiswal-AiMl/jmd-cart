import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MessageStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Android SMS Gateway reports back send result
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("x-device-token");
    if (!token) {
      return NextResponse.json({ error: "Missing x-device-token header" }, { status: 401 });
    }

    const device = await prisma.smsGatewayDevice.findUnique({
      where: { deviceToken: token },
    });

    if (!device || !device.active) {
      return NextResponse.json({ error: "Unauthorized device token" }, { status: 403 });
    }

    const body = await req.json();
    const { messageId, status, error } = body;

    if (!messageId || !status) {
      return NextResponse.json({ error: "Missing messageId or status" }, { status: 400 });
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const isNewDay = device.lastSentDate !== todayStr;

    await prisma.$transaction([
      prisma.outboundMessage.update({
        where: { id: messageId },
        data: {
          status: status === "SENT" ? MessageStatus.SENT : MessageStatus.FAILED,
          sentAt: status === "SENT" ? new Date() : undefined,
          lastError: error || null,
        },
      }),
      prisma.smsGatewayDevice.update({
        where: { id: device.id },
        data: {
          lastSeenAt: new Date(),
          dailySentCount: isNewDay ? 1 : { increment: 1 },
          lastSentDate: todayStr,
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
