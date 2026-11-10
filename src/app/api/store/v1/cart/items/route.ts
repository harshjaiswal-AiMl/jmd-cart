import { NextRequest, NextResponse } from "next/server";
import { cartService } from "@/modules/cart/cart.service";
import { getMobileAuthUser } from "@/modules/mobile/mobile-auth.middleware";

export async function POST(req: NextRequest) {
  const user = await getMobileAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { productId, quantity = 1 } = body;

    if (!productId || typeof quantity !== "number") {
      return NextResponse.json({ error: "productId and numeric quantity are required" }, { status: 400 });
    }

    if (quantity <= 0) {
      await cartService.removeFromCart(user.id, productId);
    } else {
      // If item already in cart, updateQuantity, otherwise addToCart
      const cart = await cartService.getOrCreateCart(user.id);
      const existingLine = await (cartService as any).getCartItem?.(cart.id, productId).catch(() => null);

      if (existingLine) {
        await cartService.updateQuantity(user.id, productId, quantity);
      } else {
        await cartService.addToCart(user.id, productId, quantity);
      }
    }

    const updatedSummary = await cartService.getCartSummary(user.id);
    return NextResponse.json({
      success: true,
      cart: updatedSummary,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update cart item" }, { status: 400 });
  }
}
