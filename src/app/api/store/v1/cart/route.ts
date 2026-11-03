import { NextRequest, NextResponse } from "next/server";
import { cartService } from "@/modules/cart/cart.service";
import { settingsService } from "@/modules/settings/settings.service";
import { getMobileAuthUser } from "@/modules/mobile/mobile-auth.middleware";

export async function GET(req: NextRequest) {
  const user = await getMobileAuthUser(req);
  if (!user) {
    // Unauthenticated guest user
    return NextResponse.json({
      cart: null,
      items: [],
      itemsCount: 0,
      subtotalPaise: 0,
      deliveryChargePaise: 0,
      totalPaise: 0,
      freeDeliveryThresholdPaise: 49900,
      amountNeededForFreeDeliveryPaise: 49900,
    });
  }

  try {
    const cartSummary = await cartService.getCartSummary(user.id);
    const deliverySettings = await settingsService.getDeliverySettings().catch(() => null);

    const freeThreshold = deliverySettings?.freeDeliveryTownPaise ?? 49900;
    const baseDeliveryCharge = deliverySettings?.deliveryChargeTownPaise ?? 4000;

    const deliveryChargePaise =
      cartSummary.totalPaise >= freeThreshold || cartSummary.totalPaise === 0
        ? 0
        : baseDeliveryCharge;

    const amountNeededForFreeDeliveryPaise = Math.max(0, freeThreshold - cartSummary.totalPaise);
    const grandTotalPaise = cartSummary.totalPaise + deliveryChargePaise;

    return NextResponse.json({
      cart: cartSummary,
      items: cartSummary.lines,
      itemsCount: cartSummary.itemsCount,
      totalPieces: cartSummary.totalPieces,
      subtotalPaise: cartSummary.subtotalPaise,
      discountPaise: cartSummary.lineDiscountPaise,
      taxablePaise: cartSummary.taxablePaise,
      taxPaise: cartSummary.totalTaxPaise,
      deliveryChargePaise,
      totalPaise: grandTotalPaise,
      freeDeliveryThresholdPaise: freeThreshold,
      amountNeededForFreeDeliveryPaise,
      minOrderPaise: 10000, // ₹100 minimum order
      canCheckout: grandTotalPaise >= 10000,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to fetch cart" }, { status: 500 });
  }
}
