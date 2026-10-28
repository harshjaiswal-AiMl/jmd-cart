"use server";

import { auth } from "@/auth";
import { pricingService } from "@/modules/pricing/pricing.service";
import { billingService } from "@/modules/billing/billing.service";
import { authService } from "@/modules/auth/auth.service";
import { InvoiceChannel, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function calculateOrderPricingAction(
  items: Array<{ productId: string; qty: number; unitPriceOverridePaise?: number }>,
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

  if (
    session.user.role !== UserRole.SUPER_ADMIN &&
    session.user.role !== UserRole.ADMIN &&
    session.user.role !== UserRole.SHOP
  ) {
    throw new Error("Only Admin, Super Admin, or Cashier can enter a manual rate for items.");
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
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  buyerType?: any;
  orderDiscountBp?: number;
  isInterState?: boolean;
  items: Array<{ productId: string; qty: number; unitPriceOverridePaise?: number }>;
  payments: Array<{ mode: "CASH" | "UPI" | "CARD" | "CREDIT"; amountPaise: number }>;
  paymentStatus?: "PAID" | "PENDING" | "PARTIAL";
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
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerAddress: input.customerAddress,
        buyerType: input.buyerType ?? undefined,
        orderDiscountBp: input.orderDiscountBp ?? 0,
        isInterState: input.isInterState ?? false,
        items: input.items,
        payments: input.payments,
        paymentStatus: input.paymentStatus as any,
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
    let errorMessage = err.message || "Failed to finalize invoice";

    // Enrich InsufficientStockError with human-readable Product name & Location details
    if (err.name === "InsufficientStockError" || errorMessage.includes("Insufficient stock for product")) {
      try {
        const prodId = err.productId || errorMessage.match(/Insufficient stock for product ([^\s]+)/)?.[1];
        const locId = err.locationId || errorMessage.match(/at location ([^\s\.]+)/)?.[1];
        const available = err.availableQty !== undefined ? err.availableQty : Number(errorMessage.match(/Available:\s*(\d+)/)?.[1] || 0);
        const requested = err.requestedQty !== undefined ? err.requestedQty : Number(errorMessage.match(/Requested:\s*(\d+)/)?.[1] || 0);

        if (prodId) {
          const product = await prisma.product.findUnique({
            where: { id: prodId },
            select: { name: true, shortCode: true, packSize: true, packLabel: true },
          });
          const location = locId ? await prisma.location.findUnique({
            where: { id: locId },
            select: { name: true, type: true },
          }) : null;

          const prodTitle = product ? `${product.name} (${product.shortCode})` : prodId;
          const locTitle = location ? location.name : "Shop";
          const deficit = Math.max(0, requested - available);
          errorMessage = `Insufficient stock for "${prodTitle}" at ${locTitle}. Available: ${available} pcs, Requested: ${requested} pcs (Short by ${deficit} pcs).`;

          return {
            success: false,
            error: errorMessage,
            insufficientStock: {
              productId: prodId,
              productName: product?.name || prodId,
              shortCode: product?.shortCode || "",
              availableQty: Number(available),
              requestedQty: Number(requested),
              deficit,
            },
          };
        }
      } catch (enrichErr) {
        console.error("Enrich stock error failed:", enrichErr);
      }
    }

    return {
      success: false,
      error: errorMessage,
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


export async function saveProductPriceAction(input: {
  productId: string;
  mrpPaise?: number;
  ratePaise: number;
}) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  if (
    session.user.role !== UserRole.SUPER_ADMIN &&
    session.user.role !== UserRole.ADMIN &&
    session.user.role !== UserRole.SHOP
  ) {
    throw new Error("Only Admin, Super Admin, or Cashier can save product price.");
  }

  const product = await prisma.product.findUnique({
    where: { id: input.productId },
  });

  if (!product) {
    throw new Error("Product not found");
  }

  const effectiveMrp = input.mrpPaise && input.mrpPaise > 0 
    ? input.mrpPaise 
    : (product.mrpPaise && product.mrpPaise > 0 ? product.mrpPaise : input.ratePaise);

  const updated = await prisma.product.update({
    where: { id: input.productId },
    data: {
      mrpPaise: effectiveMrp,
      priceCPaise: input.ratePaise,
    },
  });

  return { success: true, product: updated };
}
export async function quickAddShopStockAction(input: {
  productId: string;
  locationId: string;
  qtyPcs: number;
  reason?: string;
}) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  if (
    session.user.role !== UserRole.SUPER_ADMIN &&
    session.user.role !== UserRole.ADMIN &&
    session.user.role !== UserRole.SHOP
  ) {
    throw new Error("Only Admin or Cashier can add stock.");
  }

  const { stockService } = await import("@/modules/stock/stock.service");
  const { MovementType } = await import("@prisma/client");

  await stockService.postMovement({
    type: MovementType.ADJUSTMENT,
    productId: input.productId,
    toLocationId: input.locationId,
    qty: input.qtyPcs,
    reason: input.reason || "POS counter quick stock add",
    idempotencyKey: `pos-stock-${input.productId}-${Date.now()}`,
    actorId: session.user.id,
  });

  const balance = await prisma.stockBalance.findUnique({
    where: {
      productId_locationId: {
        productId: input.productId,
        locationId: input.locationId,
      },
    },
  });

  return { success: true, newShopQty: balance?.qty ?? input.qtyPcs };
}
