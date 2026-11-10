import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderAlertState } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Snoozes an order alert for 5 minutes (300 seconds default)
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("x-device-token");
    const body = await req.json();
    const { orderId, snoozeSeconds = 300 } = body;

    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }

    const snoozedUntil = new Date(Date.now() + snoozeSeconds * 1000);

    const updated = await prisma.orderAlert.updateMany({
      where: {
        OR: [
          { orderId },
          { invoiceId: orderId },
          { id: orderId },
        ],
        state: { in: [OrderAlertState.NOTIFIED, OrderAlertState.SEEN] },
      },
      data: {
        snoozedUntil,
        seenAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      updatedCount: updated.count,
      snoozedUntil: snoozedUntil.toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to snooze alert" }, { status: 500 });
  }
}
