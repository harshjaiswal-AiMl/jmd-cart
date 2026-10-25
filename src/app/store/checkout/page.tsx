import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cartService } from "@/modules/cart/cart.service";
import { deliveryService } from "@/modules/delivery/delivery.service";
import { settingsService } from "@/modules/settings/settings.service";
import { storeService } from "@/modules/store/store.service";
import { addressService } from "@/modules/address/address.service";
import { CheckoutClient } from "./checkout-client";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Review Order & Checkout — Saharsa Express Delivery | JMD Cart",
  description:
    "Review your JMD Cart grocery and wholesale order. Express delivery across Saharsa Ward 1-20, GST input tax invoicing, and verified mandi wholesale rates.",
};

export default async function CheckoutPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/store/checkout");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { party: true },
  });

  const [cart, deliveryZones, paymentSettings, filterOptions, initialAddresses] = await Promise.all([
    cartService.getCartSummary(session.user.id),
    deliveryService.getDeliveryZones(),
    settingsService.getPaymentModeSettings(),
    storeService.getFilterOptions(),
    addressService.getUserAddresses(session.user.id),
  ]);

  if (!cart || cart.itemsCount === 0) {
    redirect("/store/cart");
  }

  let savedAddresses = initialAddresses;

  // Check if buyer has approved credit account with adequate limit
  let isCreditParty = false;
  let creditPartyName = "";
  if (user?.party && user.party.creditEnabled) {
    const ledger = await prisma.ledgerEntry.findMany({
      where: { partyId: user.party.id },
    });
    const outstandingPaise = ledger.reduce(
      (acc, e) => acc + e.debitPaise - e.creditPaise,
      0
    );
    const availableCreditPaise = user.party.creditLimitPaise - outstandingPaise;
    if (availableCreditPaise >= cart.totalPaise) {
      isCreditParty = true;
      creditPartyName = user.party.name;
    }
  }

  return (
    <CheckoutClient
      cart={cart}
      deliveryZones={deliveryZones}
      paymentSettings={paymentSettings}
      categories={filterOptions.categories}
      savedAddresses={savedAddresses}
      isCreditParty={isCreditParty}
      creditPartyName={creditPartyName}
      userPhone={user?.phone || ""}
      userName={user?.party?.name || user?.name || ""}
      userAddress={savedAddresses[0]?.formattedAddress || user?.party?.address || ""}
      userGstin={user?.party?.gstin || ""}
    />
  );
}
