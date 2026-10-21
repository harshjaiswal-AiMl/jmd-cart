import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cartService } from "@/modules/cart/cart.service";
import { deliveryService } from "@/modules/delivery/delivery.service";
import { storeService } from "@/modules/store/store.service";
import { CartViewClient } from "./cart-view-client";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shopping Cart — JMD Cart Saharsa",
  description: "View and manage your grocery wholesale shopping cart with volume slab discounts in Saharsa.",
};

export default async function CartPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/store/cart");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { party: true },
  });

  const [cart, deliveryZones, filterOptions] = await Promise.all([
    cartService.getCartSummary(session.user.id),
    deliveryService.getDeliveryZones(),
    storeService.getFilterOptions(),
  ]);

  return (
    <CartViewClient
      cart={cart}
      deliveryZones={deliveryZones}
      categories={filterOptions.categories}
      userPhone={user?.phone || ""}
      userName={user?.party?.name || user?.name || ""}
    />
  );
}
