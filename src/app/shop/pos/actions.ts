"use server";

import { auth } from "@/auth";
import { pricingService } from "@/modules/pricing/pricing.service";
import { billingService } from "@/modules/billing/billing.service";
import { authService } from "@/modules/auth/auth.service";
import { InvoiceChannel, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function calculateOrderPricingAction(
  items: Array<{ productId: string; qty: number }>,
  orderDiscountBp: number = 0,
  isInterState: boolean = false,
  partyId?: string | null,
  buyerType?: any
) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  return pricingService.calculateOrderPricing({
    items,
    partyId: partyId ?? null,
    buyerType: buyerType ?? null,
    orderDiscountBp,
    isInterState,
    userRole: session.user.role,
  });
}

export async function setAdminManualRateAction(input: {
  productId: string;
  ratePaise: number;
  reason: string;
}) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  if (session.user.role !== UserRole.SUPER_ADMIN && session.user.role !== UserRole.ADMIN) {
    throw new Error("Only Admin or Super Admin can enter a manual rate for unpriced items.");
  }

  const { prisma } = await import("@/lib/prisma");
  const { auditService } = await import("@/modules/audit/audit.service");

  const product = await prisma.product.findUnique({
    where: { id: input.productId },
  });

  if (!product) {
    throw new Error("Product not found");
  }

  const updated = await prisma.product.update({
    where: { id: input.productId },
    data: {
      priceCPaise: input.ratePaise,
      mrpPaise: product.mrpPaise && product.mrpPaise > 0 ? product.mrpPaise : input.ratePaise,
    },
  });

  await auditService.log({
    actorId: session.user.id,
    action: "POS_MANUAL_RATE_SET",
    entity: "Product",
    entityId: input.productId,
    before: {
      mrpPaise: product.mrpPaise,
      priceCPaise: product.priceCPaise,
    },
    after: {
      ratePaise: input.ratePaise,
      reason: input.reason,
    },
  });

  return { success: true, product: updated };
}


export async function finalizeBillAction(input: {
  locationId: string;
  partyId?: string | null;
  buyerType?: any;
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
    return { success: false, error: "Session expired or unauthorized. Please re-login." };
  }

  try {
    const invoice = await billingService.finalizeInvoice(
      session.user.role,
      {
        channel: InvoiceChannel.SHOP,
        locationId: input.locationId,
        partyId: input.partyId ?? null,
        buyerType: input.buyerType ?? undefined,
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

    return {
      success: true,
      invoice: {
        id: invoice.id,
        number: invoice.number,
        totalPaise: invoice.totalPaise,
        status: invoice.status,
        channel: invoice.channel,
        paymentStatus: invoice.paymentStatus,
        paymentMode:
          invoice.payments.find((p) => p.mode === "CREDIT")?.mode ||
          invoice.payments[0]?.mode ||
          "CASH",
      },
    };
  } catch (err: any) {
    console.error("[finalizeBillAction error]:", err);
    return {
      success: false,
      error: err.message || "Failed to finalize invoice",
    };
  }
}

export async function createQuickPartyAction(input: {
  name: string;
  phone?: string;
  type?: "CUSTOMER" | "RETAILER" | "WHOLESALER";
  address?: string;
  gstin?: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Authentication required" };
  }

  try {
    const { partyRepository } = await import("@/modules/party/party.repository");
    const party = await partyRepository.createParty({
      name: input.name,
      phone: input.phone || undefined,
      type: (input.type as any) || "CUSTOMER",
      address: input.address || undefined,
      gstin: input.gstin || undefined,
      creditEnabled: false,
      creditLimitPaise: 0,
      creditDays: 0,
      active: true,
    });

    return { success: true, party };
  } catch (err: any) {
    return { error: err.message || "Failed to create customer" };
  }
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

export async function getPartyBillHistoryAction(partyId: string, limit: number = 20) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Authentication required" };
  }

  try {
    const invoices = await prisma.invoice.findMany({
      where: { partyId },
      orderBy: { finalizedAt: "desc" },
      take: limit,
      select: {
        id: true,
        number: true,
        channel: true,
        status: true,
        totalPaise: true,
        finalizedAt: true,
        createdAt: true,
        paymentStatus: true,
        items: {
          select: {
            id: true,
            qty: true,
            unitPricePaise: true,
            taxablePaise: true,
            product: {
              select: {
                name: true,
              },
            },
          },
        },
        payments: {
          select: {
            id: true,
            mode: true,
            amountPaise: true,
          },
        },
      },
    });

    const sanitized = invoices.map((inv: any) => ({
      ...inv,
      finalizedAt: inv.finalizedAt ? inv.finalizedAt.toISOString() : null,
      createdAt: inv.createdAt.toISOString(),
      lines: (inv.items || []).map((it: any) => ({
        id: it.id,
        productName: it.product?.name || "Product",
        qty: it.qty,
        unitPricePaise: it.unitPricePaise,
        lineTotalPaise: it.taxablePaise,
      })),
    }));

    return { success: true, invoices: sanitized };
  } catch (err: any) {
    return { error: err.message || "Failed to fetch party invoices" };
  }
}

export async function getPartyLastItemPurchaseAction(partyId: string, productId: string) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, lastPurchase: null };
  }

  try {
    const lastLine = await prisma.invoiceItem.findFirst({
      where: {
        productId,
        invoice: {
          partyId,
          status: "FINAL",
        },
      },
      orderBy: {
        invoice: {
          finalizedAt: "desc",
        },
      },
      include: {
        invoice: {
          select: {
            number: true,
            finalizedAt: true,
          },
        },
      },
    });

    if (!lastLine) {
      return { success: true, lastPurchase: null };
    }

    return {
      success: true,
      lastPurchase: {
        ratePaise: lastLine.unitPricePaise,
        qty: lastLine.qty,
        invoiceNumber: lastLine.invoice.number,
        date: lastLine.invoice.finalizedAt ? lastLine.invoice.finalizedAt.toISOString() : null,
      },
    };
  } catch {
    return { success: false, lastPurchase: null };
  }
}

