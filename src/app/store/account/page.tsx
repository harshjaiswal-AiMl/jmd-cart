import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { addressService } from "@/modules/address/address.service";
import { orderService } from "@/modules/order/order.service";
import { cartService } from "@/modules/cart/cart.service";
import { storeService } from "@/modules/store/store.service";
import { wishlistService } from "@/modules/wishlist/wishlist.service";
import { AccountClient } from "./account-client";

export const metadata: Metadata = {
  title: "My Account & Orders | JMD Cart Saharsa",
  description:
    "Manage your profile, delivery addresses, GST credentials, wishlist, and track live Saharsa grocery orders.",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams?: {
    tab?: "orders" | "addresses" | "profile" | "wishlist";
  };
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/store/account");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { party: true },
  });

  if (!user) {
    redirect("/login?callbackUrl=/store/account");
  }

  const [initialAddresses, initialOrders, cart, filterOptions, wishlistItems] =
    await Promise.all([
      addressService.getUserAddresses(user.id),
      orderService.listUserOrders(user.id),
      cartService.getCartSummary(user.id),
      storeService.getFilterOptions(),
      wishlistService.getUserWishlist(user.id),
    ]);

  let addresses = initialAddresses;
  if (addresses.length === 0) {
    const defaultAddr = await addressService.saveAddress(user.id, {
      name: user.party?.name || user.name || "Customer",
      phone: user.phone || "9431400000",
      addressLine: user.party?.address || "D.B. Road, Near Shankar Chowk",
      area: "Purab Bazar",
      city: "Saharsa",
      state: "Bihar",
      pincode: "852201",
      type: "SHOP",
      isDefault: true,
    });
    addresses = [defaultAddr];
  }

  const accountUser = {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    buyerType: user.buyerType || "CUSTOMER",
    buyerApproved: user.buyerApproved ?? false,
    partyGstin: user.party?.gstin || null,
    createdAt: user.createdAt,
  };

  const validTabs = ["orders", "addresses", "profile", "wishlist"] as const;
  const initialTab =
    searchParams?.tab && validTabs.includes(searchParams.tab)
      ? searchParams.tab
      : "orders";

  return (
    <AccountClient
      user={accountUser}
      initialAddresses={addresses}
      initialOrders={initialOrders}
      initialWishlistItems={wishlistItems}
      cartCount={cart.itemsCount}
      cartTotalRupees={cart.totalPaise / 100}
      wishlistCount={wishlistItems.length}
      categories={filterOptions.categories}
      initialTab={initialTab}
    />
  );
}
