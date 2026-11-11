import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { Permission } from "@/modules/auth/permissions";
import { assertPermissionAsync } from "@/modules/auth/role-matrix.service";
import { billingService } from "@/modules/billing/billing.service";

const voidBodySchema = z.object({
  reason: z.string().trim().min(5, "Cancellation reason must be at least 5 characters"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const role = session.user.role as UserRole;
    await assertPermissionAsync(role, Permission.INVOICE_VOID);

    const { id } = await Promise.resolve(params);
    const body = await req.json().catch(() => ({}));
    const parsed = voidBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid void reason" },
        { status: 400 }
      );
    }

    const result = await billingService.cancelInvoice(
      role,
      { invoiceId: id, reason: parsed.data.reason },
      session.user.id,
      req.headers.get("x-forwarded-for") || undefined
    );

    revalidatePath("/shop/invoices");
    revalidatePath(`/shop/invoices/${id}`);
    revalidatePath(`/shop/invoices/${id}/print`);
    revalidatePath("/godown/stock");

    return NextResponse.json({
      success: true,
      creditNoteId: result.creditNoteId,
      invoiceNumber: result.invoice.number,
    });
  } catch (err: any) {
    const status = err?.statusCode === 403 ? 403 : 400;
    return NextResponse.json(
      { error: err?.message || "Failed to void invoice" },
      { status }
    );
  }
}
