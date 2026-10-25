import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cartService } from "@/modules/cart/cart.service";
import { deliveryService } from "@/modules/delivery/delivery.service";
import { storeService } from "@/modules/store/store.service";
import { BuyerTier } from "@/modules/pricing/pricing.types";
import { CartViewClient } from "./cart-view-client";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shopping Cart — JMD Cart Saharsa",
  description: "View and manage your grocery wholesale shopping cart with volume slab discounts in Saharsa.",
};

export default async function CartPage() {
  const session = await auth();

  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { party: true },
      })
    : null;

  const [cart, deliveryZones, filterOptions] = await Promise.all([
    session?.user?.id
      ? cartService.getCartSummary(session.user.id)
      : Promise.resolve({
          id: "",
          userId: "",
          totalPieces: 0,
          itemsCount: 0,
          buyerTag: BuyerTier.CUSTOMER,
          subtotalPaise: 0,
          lineDiscountPaise: 0,
          taxablePaise: 0,
          totalTaxPaise: 0,
          roundOffPaise: 0,
          totalPaise: 0,
          lines: [],
        }),
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
