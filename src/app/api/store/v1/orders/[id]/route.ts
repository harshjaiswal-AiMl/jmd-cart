import { NextRequest, NextResponse } from "next/server";
import { orderService } from "@/modules/order/order.service";
import { getMobileAuthUser } from "@/modules/mobile/mobile-auth.middleware";
import { prisma } from "@/lib/prisma";

export async function GET(
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

    // Check if invoice exists and has a bill token
    let billLink: string | null = null;
    let deliveryPerson: { name: string; phone: string | null } | null = null;

    const dbOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        assignedDeliveryUser: { select: { name: true, phone: true } },
      },
    });

    if (dbOrder?.assignedDeliveryUser && dbOrder.status === "DISPATCHED") {
      deliveryPerson = {
        name: dbOrder.assignedDeliveryUser.name,
        phone: dbOrder.assignedDeliveryUser.phone || null,
      };
    }

    // Check for invoice bill token
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: dbOrder?.invoiceId || undefined,
      },
      include: {
        billToken: true,
      },
    });

    if (invoice?.billToken) {
      billLink = `/b/${invoice.billToken.tokenHash}`;
    }

    // Map order status to customer tracking stages:
    // PENDING -> Booked
    // CONFIRMED -> Accepted
    // PROCESSING -> Packing
    // READY_FOR_DISPATCH -> Packed
    // DISPATCHED -> Out for Delivery
    // DELIVERED -> Delivered
    // CANCELLED -> Cancelled
    const stages = [
      { key: "BOOKED", label: "Booked", completed: true, current: order.status === "PENDING" },
      {
        key: "ACCEPTED",
        label: "Accepted",
        completed: ["CONFIRMED", "PROCESSING", "PICKING", "PACKED", "DISPATCHED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status),
        current: order.status === "CONFIRMED",
      },
      {
        key: "PACKING",
        label: "Packing",
        completed: ["PROCESSING", "PICKING", "PACKED", "DISPATCHED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status),
        current: order.status === "PROCESSING" || order.status === "PICKING",
      },
      {
        key: "PACKED",
        label: "Packed",
        completed: ["PACKED", "DISPATCHED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status),
        current: order.status === "PACKED",
      },
      {
        key: "OUT_FOR_DELIVERY",
        label: "Out for Delivery",
        completed: ["DISPATCHED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status),
        current: order.status === "DISPATCHED" || order.status === "OUT_FOR_DELIVERY",
      },
      {
        key: "DELIVERED",
        label: "Delivered",
        completed: order.status === "DELIVERED",
        current: order.status === "DELIVERED",
      },
    ];

    const canCancel = order.status === "PENDING" || order.status === "CONFIRMED";

    return NextResponse.json({
      order,
      stages,
      canCancel,
      deliveryPerson,
      billLink,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to fetch order" }, { status: 500 });
  }
}
