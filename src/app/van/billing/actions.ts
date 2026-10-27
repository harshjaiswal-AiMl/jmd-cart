"use server";

import { auth } from "@/auth";
import { UserRole, InvoiceChannel, PaymentMode } from "@prisma/client";
import { billingService } from "@/modules/billing/billing.service";
import { settingsService } from "@/modules/settings/settings.service";
import { authService } from "@/modules/auth/auth.service";
import { assertPermission, Permission } from "@/modules/auth/permissions";
import { z } from "zod";

const vanInvoiceActionSchema = z.object({
  locationId: z.string().min(1, "Van location is required"),
  partyId: z.string().nullable().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
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
  notes: z.string().optional(),
  creditOverride: z
    .object({
      approvedByUserId: z.string().min(1),
      reason: z.string().min(3),
    })
    .optional(),
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
        customerName: validated.customerName,
        customerPhone: validated.customerPhone,
        customerAddress: validated.customerAddress,
        idempotencyKey: validated.idempotencyKey,
        orderDiscountBp: validated.orderDiscountBp,
        items: validated.items,
        payments: actualPayments,
        notes: validated.notes,
        creditOverride: validated.creditOverride,
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

export async function getInvoiceForPrintAction(invoiceId: string) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Authentication required" };
  }

  try {
    const invoice = await billingService.getInvoiceById(invoiceId);
    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    const business = await settingsService.getBusinessDetails();
    return { success: true, invoice, business };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch invoice details";
    return { success: false, error: message };
  }
}

export async function getBusinessDetailsForPrintAction() {
  try {
    const business = await settingsService.getBusinessDetails();
    return { success: true, business };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load business details";
    return { success: false, error: message };
  }
}

export async function checkVanPartyCreditStatusAction(
  partyId: string,
  additionalDebitPaise: number = 0
) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Authentication required" };
  }

  try {
    const status = await billingService.checkPartyCreditStatus(
      session.user.role as UserRole,
      partyId,
      additionalDebitPaise
    );
    return { success: true, status };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to check credit status";
    return { success: false, error: message };
  }
}

export async function verifyOwnerOverrideForVanAction(
  phoneOrEmail: string,
  password: string
) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Authentication required" };
  }

  return authService.verifyOwnerCredentials(phoneOrEmail, password);
}
