import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OrderAlertState } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Snoozes an order alert for warehouse staff (default 5 minutes / 300 seconds)
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { orderId, snoozeSeconds = 300 } = await req.json();
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
      snoozeSeconds,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to snooze alert" },
      { status: 500 }
    );
  }
}
