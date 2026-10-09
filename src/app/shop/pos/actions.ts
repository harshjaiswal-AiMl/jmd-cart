"use server";

import { auth } from "@/auth";
import { pricingService } from "@/modules/pricing/pricing.service";
import { billingService } from "@/modules/billing/billing.service";
import { authService } from "@/modules/auth/auth.service";
import { InvoiceChannel, UserRole } from "@prisma/client";

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
  creditOverride?: { approvedByUserId: string; reason: string };
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
      creditOverride: input.creditOverride,
    },
    session.user.id
  );

  return invoice;
}

export async function checkPartyCreditStatusAction(
  partyId: string,
  additionalDebitPaise: number = 0
) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  return billingService.checkPartyCreditStatus(
    session.user.role as UserRole,
    partyId,
    additionalDebitPaise
  );
}

export async function verifyOwnerOverrideAction(
  phoneOrEmail: string,
  password: string
): Promise<
  | { success: true; user: { id: string; name: string; role: UserRole } }
  | { success: false; error: string }
> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  return authService.verifyOwnerCredentials(phoneOrEmail, password);
}
