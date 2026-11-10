import { NextRequest, NextResponse } from "next/server";
import { cartService } from "@/modules/cart/cart.service";
import { settingsService } from "@/modules/settings/settings.service";
import { addressService } from "@/modules/address/address.service";
import { getMobileAuthUser } from "@/modules/mobile/mobile-auth.middleware";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = await getMobileAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [cartSummary, deliverySettings, savedAddresses, fullUser] = await Promise.all([
      cartService.getCartSummary(user.id),
      settingsService.getDeliverySettings().catch(() => null),
      addressService.getUserAddresses(user.id).catch(() => []),
      prisma.user.findUnique({
        where: { id: user.id },
        include: { party: true },
      }),
    ]);

    const freeThreshold = deliverySettings?.freeDeliveryTownPaise ?? 49900;
    const baseDeliveryCharge = deliverySettings?.deliveryChargeTownPaise ?? 4000;
    const deliveryChargePaise =
      cartSummary.totalPaise >= freeThreshold || cartSummary.totalPaise === 0
        ? 0
        : baseDeliveryCharge;

    const grandTotalPaise = cartSummary.totalPaise + deliveryChargePaise;

    // Check payment modes
    const paymentModes = [
      {
        id: "COD",
        label: "Cash on Delivery (COD)",
        description: "Pay with cash or UPI scanner upon delivery",
        enabled: true,
      },
    ];

    if (fullUser?.party && (fullUser.party.creditLimitPaise || 0) > 0) {
      paymentModes.push({
        id: "CREDIT",
        label: "Store Credit / Khata",
        description: `Credit available up to ₹${((fullUser.party.creditLimitPaise || 0) / 100).toFixed(0)}`,
        enabled: true,
      });
    }

    const deliverySlots = [
      { id: "slot_morning", label: "Morning", time: "8:00 AM - 12:00 PM" },
      { id: "slot_afternoon", label: "Afternoon", time: "12:00 PM - 4:00 PM" },
      { id: "slot_evening", label: "Evening", time: "4:00 PM - 8:00 PM" },
    ];

    return NextResponse.json({
      cartSummary,
      savedAddresses,
      deliveryChargePaise,
      grandTotalPaise,
      freeDeliveryThresholdPaise: freeThreshold,
      canPlaceOrder: cartSummary.totalPaise >= 10000 && cartSummary.itemsCount > 0,
      paymentModes,
      deliverySlots,
      userGstin: fullUser?.party?.gstin || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to generate checkout quote" }, { status: 500 });
  }
}
