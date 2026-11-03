import { NextRequest, NextResponse } from "next/server";
import { orderService } from "@/modules/order/order.service";
import { cartService } from "@/modules/cart/cart.service";
import { getMobileAuthUser } from "@/modules/mobile/mobile-auth.middleware";

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

    let addedCount = 0;
    for (const item of order.items) {
      try {
        await cartService.addToCart(user.id, item.productId, item.qty);
        addedCount++;
      } catch (e) {
        console.warn(`[Reorder] Could not add product ${item.productId}:`, e);
      }
    }

    const cartSummary = await cartService.getCartSummary(user.id);
    return NextResponse.json({
      success: true,
      addedCount,
      cart: cartSummary,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Reorder failed" }, { status: 400 });
  }
}
