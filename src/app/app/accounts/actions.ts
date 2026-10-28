"use server";

import { auth } from "@/auth";
import { UserRole, PaymentMode, PaymentStatus, LedgerKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getNextSequenceNumber } from "@/lib/invoice-number";
import { revalidatePath } from "next/cache";

export type ReceivePaymentResult =
  | { success: true; paymentId: string; receiptNo: string; newStatus: PaymentStatus }
  | { success: false; error: string };

export async function receiveInvoicePaymentAction(input: {
  invoiceId: string;
  amountPaise: number;
  mode: "CASH" | "UPI" | "CARD";
  notes?: string;
  reference?: string;
}): Promise<ReceivePaymentResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Authentication required" };
  }

  const allowedRoles = ["SUPER_ADMIN", "ADMIN", "ACCOUNTS", "SHOP", "SALESPERSON", "DELIVERY"];
  if (!allowedRoles.includes(session.user.role)) {
    return { success: false, error: "Permission denied" };
  }

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: input.invoiceId },
      include: { payments: true },
    });

    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    const res = await prisma.$transaction(async (tx) => {
      // 1. Get receipt voucher number
      const seq = await getNextSequenceNumber(tx, "REC");
      const receiptNo = `REC/${seq.fy}/${String(seq.sequenceValue).padStart(6, "0")}`;

      // 2. Create Payment record
      const payment = await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          partyId: invoice.partyId,
          receiptNo,
          mode: input.mode as PaymentMode,
          amountPaise: input.amountPaise,
          notes: input.notes || input.reference || "Payment received against pending invoice",
          receivedBy: session.user.id,
        },
      });

      // 3. Post LedgerEntry (RECEIPT) if party is linked
      if (invoice.partyId) {
        await tx.ledgerEntry.create({
          data: {
            partyId: invoice.partyId,
            kind: LedgerKind.RECEIPT,
            debitPaise: 0,
            creditPaise: input.amountPaise,
            referenceType: "INVOICE",
            referenceId: invoice.id,
          },
        });
      }

      // 4. Update Invoice paymentStatus
      const prevPaid = invoice.payments.reduce((s, p) => s + p.amountPaise, 0);
      const totalPaid = prevPaid + input.amountPaise;
      const newStatus = totalPaid >= invoice.totalPaise ? PaymentStatus.PAID : PaymentStatus.PARTIAL;

      await tx.invoice.update({
        where: { id: invoice.id },
        data: { paymentStatus: newStatus },
      });

      return { paymentId: payment.id, receiptNo, newStatus };
    });

    revalidatePath("/app/accounts");
    revalidatePath("/shop/invoices");
    revalidatePath("/admin/parties");

    return { success: true, ...res };
  } catch (err: any) {
    console.error("[receiveInvoicePaymentAction error]:", err);
    return { success: false, error: err.message || "Failed to receive payment" };
  }
}
