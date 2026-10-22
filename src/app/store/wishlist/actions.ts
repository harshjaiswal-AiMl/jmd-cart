"use server";

import { auth } from "@/auth";
import { wishlistService } from "@/modules/wishlist/wishlist.service";
import { revalidatePath } from "next/cache";

export async function toggleWishlistAction(productId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Please sign in to add items to your wishlist.", inWishlist: false, count: 0 };
  }

  try {
    const res = await wishlistService.toggleWishlist(session.user.id, productId);
    revalidatePath("/store");
    revalidatePath("/store/wishlist");
    revalidatePath("/store/account");
    return { success: true, ...res };
  } catch (error: any) {
    console.error("toggleWishlistAction error:", error);
    return { success: false, error: error.message || "Failed to update wishlist", inWishlist: false, count: 0 };
  }
}

export async function removeFromWishlistAction(productId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized", count: 0 };
  }

  try {
    const count = await wishlistService.removeFromWishlist(session.user.id, productId);
    revalidatePath("/store/wishlist");
    revalidatePath("/store/account");
    return { success: true, count };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to remove item" };
  }
}

export async function moveToCartAction(productId: string, qty: number = 1) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Please sign in to move item to cart." };
  }

  try {
    const res = await wishlistService.moveToCart(session.user.id, productId, qty);
    revalidatePath("/store/cart");
    revalidatePath("/store/wishlist");
    revalidatePath("/store/account");
    return { ...res };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to move to cart" };
  }
}

export async function getWishlistSummaryAction() {
  const session = await auth();
  if (!session?.user?.id) {
    return { count: 0, productIds: [] };
  }

  const [count, productIds] = await Promise.all([
    wishlistService.getWishlistCount(session.user.id),
    wishlistService.getWishlistProductIds(session.user.id),
  ]);

  return { count, productIds };
}
