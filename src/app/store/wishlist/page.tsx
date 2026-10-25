import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { wishlistService } from "@/modules/wishlist/wishlist.service";
import { cartService } from "@/modules/cart/cart.service";
import { storeService } from "@/modules/store/store.service";
import { WishlistClient } from "./wishlist-client";

export const metadata: Metadata = {
  title: "My Wishlist | JMD Cart Saharsa",
  description: "View and manage your saved products, mustard oils, and grocery staples at JMD Cart Saharsa.",
};

export default async function WishlistPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/store/wishlist");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true },
  });

  const [wishlistItems, cart, filterOptions] = await Promise.all([
    wishlistService.getUserWishlist(session.user.id),
    cartService.getCartSummary(session.user.id),
    storeService.getFilterOptions(),
  ]);

  return (
    <WishlistClient
      initialItems={wishlistItems}
      cartCount={cart.itemsCount}
      cartTotalRupees={cart.totalPaise / 100}
      categories={filterOptions.categories}
      userName={user?.name || "Customer"}
      isLoggedIn={true}
    />
  );
}
