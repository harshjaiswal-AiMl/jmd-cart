import { NextRequest, NextResponse } from "next/server";
import { orderService } from "@/modules/order/order.service";
import { getMobileAuthUser } from "@/modules/mobile/mobile-auth.middleware";
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getMobileAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const orderId = params.id;
    let order = await orderService.getOrderById(orderId);
    if (!order) {
      order = await orderService.getOrderByNumber(orderId);
    }

    if (!order || order.userId !== user.id) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CONFIRMED) {
      return NextResponse.json({
        error: `Order cannot be cancelled at this stage (current status: ${order.status}). It may already be packed or out for delivery.`,
      }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Release reservations
      await tx.stockReservation.deleteMany({
        where: { orderId: order.id },
      });

      // 2. Update order status
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CANCELLED },
      });
    });

    const updated = await orderService.getOrderById(order.id);
    return NextResponse.json({
      success: true,
      message: "Order cancelled successfully.",
      order: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Cancellation failed" }, { status: 400 });
  }
}
