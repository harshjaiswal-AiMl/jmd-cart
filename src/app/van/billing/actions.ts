"use server";

import { auth } from "@/auth";
import { UserRole, InvoiceChannel, PaymentMode } from "@prisma/client";
import { billingService } from "@/modules/billing/billing.service";
import { assertPermission, Permission } from "@/modules/auth/permissions";
import { z } from "zod";

const vanInvoiceActionSchema = z.object({
  locationId: z.string().min(1, "Van location is required"),
  partyId: z.string().nullable().optional(),
  idempotencyKey: z.string().min(1, "Idempotency key is required"),
  orderDiscountBp: z.number().int().min(0).max(10000).optional().default(0),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty: z.number().int().positive(),
      })
    )
    .min(1, "At least one item is required"),
  payments: z
    .array(
      z.object({
        mode: z.nativeEnum(PaymentMode),
        amountPaise: z.number().int().nonnegative(),
      })
    )
    .min(1, "At least one payment tender is required"),
});

export type VanInvoiceActionInput = z.input<typeof vanInvoiceActionSchema>;

export async function createVanInvoiceAction(input: VanInvoiceActionInput) {
  const session = await auth();

  if (!session?.user) {
    return { success: false, error: "Authentication required" };
  }

  try {
    assertPermission(session.user.role as UserRole, Permission.VAN_BILL);

    const validated = vanInvoiceActionSchema.parse(input);

    // Extract actual received payments (Cash/UPI/Card); CREDIT mode represents unpaid credit ledger balance
    const actualPayments = validated.payments.filter(
      (p) => p.mode !== PaymentMode.CREDIT && p.amountPaise > 0
    );

    const invoice = await billingService.finalizeInvoice(
      session.user.role as UserRole,
      {
        channel: InvoiceChannel.VAN,
        locationId: validated.locationId,
        partyId: validated.partyId ?? null,
        idempotencyKey: validated.idempotencyKey,
        orderDiscountBp: validated.orderDiscountBp,
        items: validated.items,
        payments: actualPayments,
      },
      session.user.id
    );

    return {
      success: true,
      invoice: {
        id: invoice.id,
        number: invoice.number,
        totalPaise: invoice.totalPaise,
        buyerType: invoice.buyerType,
        paymentStatus: invoice.paymentStatus,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create van invoice";
    return { success: false, error: message };
  }
}
