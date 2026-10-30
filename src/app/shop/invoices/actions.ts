"use server";

import { invoiceEditService, EditInvoiceInput, InvoiceEditPreview } from "@/modules/billing/invoice-edit.service";
import { invoiceTotalsService, InvoiceTotalsFilter, InvoiceTotalsSummary } from "@/modules/billing/invoice-totals.service";

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

export async function previewInvoiceEditAction(
  input: EditInvoiceInput
): Promise<ActionResult<InvoiceEditPreview>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Authentication required" };
    }
    const preview = await invoiceEditService.previewInvoiceEdit(input);
    return { success: true, data: preview };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to preview invoice edit";
    return { success: false, error: message };
  }
}

export async function modifyInvoiceAction(
  input: EditInvoiceInput
): Promise<ActionResult<{ invoiceNumber: string; version: number }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Authentication required" };
    }

    const updated = await invoiceEditService.modifyInvoice(
      session.user.role as UserRole,
      input,
      session.user.id
    );

    revalidatePath("/shop/invoices");
    revalidatePath(`/shop/invoices/${input.invoiceId}`);
    revalidatePath(`/shop/invoices/${input.invoiceId}/print`);
    revalidatePath("/godown/stock");

    return {
      success: true,
      data: {
        invoiceNumber: updated.number,
        version: updated.version,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to modify invoice";
    return { success: false, error: message };
  }
}

export async function getInvoiceTotalsAction(
  filter: InvoiceTotalsFilter
): Promise<ActionResult<InvoiceTotalsSummary>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Authentication required" };
    }
    const totals = await invoiceTotalsService.getInvoiceTotals(filter);
    return { success: true, data: totals };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to compute invoice totals";
    return { success: false, error: message };
  }
}
