import { NextRequest, NextResponse } from "next/server";
import { orderService } from "@/modules/order/order.service";
import { getMobileAuthUser } from "@/modules/mobile/mobile-auth.middleware";
import { MobileDeviceService } from "@/modules/mobile/mobile-device.service";

export async function POST(req: NextRequest) {
  const user = await getMobileAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      deliveryAddress,
      contactPhone = user.phone,
      deliveryZoneCode = "TOWN",
      deliverySlot,
      customerNotes,
      idempotencyKey,
    } = body;

    if (!deliveryAddress || deliveryAddress.trim().length < 5) {
      return NextResponse.json({ error: "Complete delivery address is required (at least 5 characters)." }, { status: 400 });
    }

    const fullNotes = [
      deliverySlot ? `Slot: ${deliverySlot}` : null,
      customerNotes ? customerNotes.trim() : null,
    ]
      .filter(Boolean)
      .join(" | ");

    const order = await orderService.createOrderFromCart(
      user.id,
      {
        deliveryAddress: deliveryAddress.trim(),
        contactPhone: contactPhone.trim(),
        deliveryZoneCode: deliveryZoneCode.trim(),
        customerNotes: fullNotes || undefined,
        idempotencyKey: idempotencyKey || undefined,
      },
      req.headers.get("x-forwarded-for") || undefined
    );

    // Send FCM push notification
    MobileDeviceService.sendPushNotification({
      userId: user.id,
      type: "orderUpdates",
      title: "Order Placed Successfully! 🛒",
      body: `Your order #${order.orderNumber} for ₹${(order.totalPaise / 100).toFixed(0)} has been received and is being prepared.`,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        screen: "order_tracking",
      },
    }).catch((err) => console.warn("[OrderPush] Failed:", err));

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Order placement failed" }, { status: 400 });
  }
}
