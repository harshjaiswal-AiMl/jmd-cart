import { NextRequest, NextResponse } from "next/server";
import { orderService } from "@/modules/order/order.service";
import { getMobileAuthUser } from "@/modules/mobile/mobile-auth.middleware";

export async function GET(req: NextRequest) {
  const user = await getMobileAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const orders = await orderService.listUserOrders(user.id);
    return NextResponse.json({
      orders,
      total: orders.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to fetch orders" }, { status: 500 });
  }
}
