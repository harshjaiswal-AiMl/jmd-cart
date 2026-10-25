"use server";

import { auth } from "@/auth";
import { cartService } from "@/modules/cart/cart.service";
import { revalidatePath } from "next/cache";

export interface CartActionResult {
  success?: boolean;
  error?: string;
}

export async function addToCartAction(productId: string, qty: number = 1): Promise<CartActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Please log in to add items to your cart" };
  }

  try {
    await cartService.addToCart(session.user.id, productId, qty);
    revalidatePath("/store");
    revalidatePath("/store/cart");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add item to cart";
    return { error: message };
  }
}

export async function updateCartQtyAction(productId: string, qty: number): Promise<CartActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Please log in to update your cart" };
  }

  try {
    await cartService.updateQuantity(session.user.id, productId, qty);
    revalidatePath("/store");
    revalidatePath("/store/cart");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update quantity";
    return { error: message };
  }
}

export async function removeFromCartAction(productId: string): Promise<CartActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Please log in to modify your cart" };
  }

  try {
    await cartService.removeFromCart(session.user.id, productId);
    revalidatePath("/store");
    revalidatePath("/store/cart");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to remove item from cart";
    return { error: message };
  }
}

export async function clearCartAction(): Promise<CartActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Please log in to clear your cart" };
  }

  try {
    await cartService.clearCart(session.user.id);
    revalidatePath("/store");
    revalidatePath("/store/cart");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to clear cart";
    return { error: message };
  }
}
