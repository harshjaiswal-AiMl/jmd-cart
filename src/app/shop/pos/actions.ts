"use server";

import { auth } from "@/auth";
import { pricingService } from "@/modules/pricing/pricing.service";
import { billingService } from "@/modules/billing/billing.service";
import { FinalizeInvoiceInput } from "@/modules/billing/billing.types";
import { InvoiceChannel } from "@prisma/client";

export async function calculateOrderPricingAction(
  items: Array<{ productId: string; qty: number }>,
  orderDiscountBp: number = 0,
  isInterState: boolean = false
) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  return pricingService.calculateOrderPricing({
    items,
    orderDiscountBp,
    isInterState,
    userRole: session.user.role,
  });
}

export async function finalizeBillAction(input: {
  locationId: string;
  partyId?: string | null;
  orderDiscountBp?: number;
  isInterState?: boolean;
  items: Array<{ productId: string; qty: number }>;
  payments: Array<{ mode: "CASH" | "UPI" | "CARD" | "CREDIT"; amountPaise: number }>;
  idempotencyKey: string;
  notes?: string;
}) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const invoice = await billingService.finalizeInvoice(
    session.user.role,
    {
      channel: InvoiceChannel.SHOP,
      locationId: input.locationId,
      partyId: input.partyId ?? null,
      orderDiscountBp: input.orderDiscountBp ?? 0,
      isInterState: input.isInterState ?? false,
      items: input.items,
      payments: input.payments,
      idempotencyKey: input.idempotencyKey,
      notes: input.notes,
    },
    session.user.id
  );

  return invoice;
}
