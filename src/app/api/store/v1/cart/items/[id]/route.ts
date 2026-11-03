import { NextRequest, NextResponse } from "next/server";
import { cartService } from "@/modules/cart/cart.service";
import { getMobileAuthUser } from "@/modules/mobile/mobile-auth.middleware";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getMobileAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const id = params.id;
    // Check if id is cartItemId or productId
    let productId = id;
    const cartItem = await prisma.cartItem.findUnique({
      where: { id },
    });
    if (cartItem) {
      productId = cartItem.productId;
    }

    await cartService.removeFromCart(user.id, productId);
    const updatedSummary = await cartService.getCartSummary(user.id);
    return NextResponse.json({
      success: true,
      cart: updatedSummary,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to remove item" }, { status: 400 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getMobileAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { quantity } = body;
    if (typeof quantity !== "number") {
      return NextResponse.json({ error: "Numeric quantity required" }, { status: 400 });
    }

    const id = params.id;
    let productId = id;
    const cartItem = await prisma.cartItem.findUnique({ where: { id } });
    if (cartItem) {
      productId = cartItem.productId;
    }

    if (quantity <= 0) {
      await cartService.removeFromCart(user.id, productId);
    } else {
      await cartService.updateQuantity(user.id, productId, quantity);
    }

    const updatedSummary = await cartService.getCartSummary(user.id);
    return NextResponse.json({
      success: true,
      cart: updatedSummary,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update quantity" }, { status: 400 });
  }
}
