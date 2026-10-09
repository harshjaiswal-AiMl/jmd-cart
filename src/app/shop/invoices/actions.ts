"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { billingService } from "@/modules/billing/billing.service";
import { UserRole } from "@prisma/client";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function cancelInvoiceAction(
  invoiceId: string,
  reason: string
): Promise<ActionResult<{ creditNoteId: string; invoiceNumber: string }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Authentication required" };
    }

    if (session.user.role !== UserRole.SUPER_ADMIN) {
      return {
        success: false,
        error: "Only Super Admin can cancel finalized invoices",
      };
    }

    if (!reason || reason.trim().length < 5) {
      return {
        success: false,
        error: "Cancellation reason must be at least 5 characters",
      };
    }

    const result = await billingService.cancelInvoice(
      session.user.role,
      { invoiceId, reason: reason.trim() },
      session.user.id
    );

    revalidatePath("/shop/invoices");
    revalidatePath(`/shop/invoices/${invoiceId}`);
    revalidatePath(`/shop/invoices/${invoiceId}/print`);
    revalidatePath("/godown/stock");

    return {
      success: true,
      data: {
        creditNoteId: result.creditNoteId,
        invoiceNumber: result.invoice.number,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to cancel invoice";
    return { success: false, error: message };
  }
}
