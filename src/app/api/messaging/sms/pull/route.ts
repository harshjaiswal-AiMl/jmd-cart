import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MessageChannel, MessageStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * In-house Android SMS Gateway phone pulls pending SMS messages
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("x-device-token") || req.nextUrl.searchParams.get("deviceToken");
    if (!token) {
      return NextResponse.json({ error: "Missing x-device-token header" }, { status: 401 });
    }

    const device = await prisma.smsGatewayDevice.findUnique({
      where: { deviceToken: token },
    });

    if (!device || !device.active) {
      return NextResponse.json({ error: "Unauthorized device token" }, { status: 403 });
    }

    // Update last seen
    await prisma.smsGatewayDevice.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });

    // Fetch pending SMS
    const pending = await prisma.outboundMessage.findMany({
      where: {
        channel: MessageChannel.SMS,
        status: MessageStatus.QUEUED,
        scheduledFor: { lte: new Date() },
        attempts: { lt: 3 },
      },
      take: 10,
      orderBy: { scheduledFor: "asc" },
    });

    // Mark as SENDING so they aren't pulled twice
    if (pending.length > 0) {
      await prisma.outboundMessage.updateMany({
        where: { id: { in: pending.map((p) => p.id) } },
        data: {
          status: MessageStatus.SENDING,
          attempts: { increment: 1 },
        },
      });
    }

    return NextResponse.json({
      success: true,
      deviceId: device.id,
      deviceLabel: device.deviceLabel,
      messages: pending.map((p) => ({
        id: p.id,
        phone: p.phone,
        content: p.renderedContent,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
