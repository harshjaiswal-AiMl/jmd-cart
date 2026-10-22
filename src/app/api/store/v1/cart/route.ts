import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cartService } from "@/modules/cart/cart.service";
import { apiSuccess, apiError } from "@/lib/api-response";
import { auth } from "@/auth";

const cartItemSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  qty: z.number().int(),
});

function getGuestCartFromCookies(req: NextRequest): Array<{ productId: string; qty: number }> {
  const cookie = req.cookies.get("jmd_guest_cart")?.value;
  if (!cookie) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(cookie));
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // ignore parse error
  }
  return [];
}

function setGuestCartCookie(res: NextResponse, items: Array<{ productId: string; qty: number }>) {
  res.cookies.set("jmd_guest_cart", encodeURIComponent(JSON.stringify(items)), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });
}

// GET: retrieve current cart summary
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (userId) {
      // Check if guest cart cookie exists and merge
      const guestItems = getGuestCartFromCookies(req);
      if (guestItems.length > 0) {
        await cartService.mergeGuestCart(userId, guestItems);
      }
      const summary = await cartService.getCartSummary(userId);
      const res = apiSuccess(summary);
      if (guestItems.length > 0) {
        res.cookies.delete("jmd_guest_cart");
      }
      return res;
    }

    const guestItems = getGuestCartFromCookies(req);
    const summary = await cartService.getGuestCartSummary(guestItems);
    return apiSuccess(summary);
  } catch (err: any) {
    return apiError(err.message || "Failed to get cart", 500, "SERVER_ERROR");
  }
}

// POST: Add item to cart or increment
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    const body = await req.json();
    const parsed = cartItemSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Invalid cart item payload", 400, "VALIDATION_ERROR", parsed.error.format());
    }

    const { productId, qty } = parsed.data;

    if (userId) {
      await cartService.addToCart(userId, productId, qty);
      const summary = await cartService.getCartSummary(userId);
      return apiSuccess(summary);
    }

    // Guest cart cookie
    const guestItems = getGuestCartFromCookies(req);
    const existingIndex = guestItems.findIndex((i) => i.productId === productId);
    if (existingIndex >= 0) {
      guestItems[existingIndex].qty += qty;
    } else {
      guestItems.push({ productId, qty });
    }

    const summary = await cartService.getGuestCartSummary(guestItems);
    const res = apiSuccess(summary);
    setGuestCartCookie(res, guestItems);
    return res;
  } catch (err: any) {
    return apiError(err.message || "Failed to add to cart", 500, "SERVER_ERROR");
  }
}

// PATCH: Update exact quantity
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    const body = await req.json();
    const parsed = cartItemSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Invalid cart item payload", 400, "VALIDATION_ERROR", parsed.error.format());
    }

    const { productId, qty } = parsed.data;

    if (userId) {
      await cartService.updateQuantity(userId, productId, qty);
      const summary = await cartService.getCartSummary(userId);
      return apiSuccess(summary);
    }

    let guestItems = getGuestCartFromCookies(req);
    if (qty <= 0) {
      guestItems = guestItems.filter((i) => i.productId !== productId);
    } else {
      const idx = guestItems.findIndex((i) => i.productId === productId);
      if (idx >= 0) {
        guestItems[idx].qty = qty;
      } else {
        guestItems.push({ productId, qty });
      }
    }

    const summary = await cartService.getGuestCartSummary(guestItems);
    const res = apiSuccess(summary);
    setGuestCartCookie(res, guestItems);
    return res;
  } catch (err: any) {
    return apiError(err.message || "Failed to update cart quantity", 500, "SERVER_ERROR");
  }
}

// DELETE: Clear entire cart or remove single item if ?productId=...
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    const url = new URL(req.url);
    const productId = url.searchParams.get("productId");

    if (userId) {
      if (productId) {
        await cartService.removeFromCart(userId, productId);
      } else {
        await cartService.clearCart(userId);
      }
      const summary = await cartService.getCartSummary(userId);
      return apiSuccess(summary);
    }

    let guestItems = getGuestCartFromCookies(req);
    if (productId) {
      guestItems = guestItems.filter((i) => i.productId !== productId);
    } else {
      guestItems = [];
    }

    const summary = await cartService.getGuestCartSummary(guestItems);
    const res = apiSuccess(summary);
    setGuestCartCookie(res, guestItems);
    return res;
  } catch (err: any) {
    return apiError(err.message || "Failed to clear/remove from cart", 500, "SERVER_ERROR");
  }
}
