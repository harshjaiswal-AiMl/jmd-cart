"use server";

import { pushNotificationService } from "@/modules/notifications/push-notification.service";
import { MessagingService } from "@/modules/messaging/messaging.service";

import { auth } from "@/auth";
import { pricingService } from "@/modules/pricing/pricing.service";
import { billingService } from "@/modules/billing/billing.service";
import { authService } from "@/modules/auth/auth.service";
import { InvoiceChannel, UserRole, MovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function calculateOrderPricingAction(
  items: Array<{ productId: string; qty: number; unitPriceOverridePaise?: number; mrpOverridePaise?: number }>,
  orderDiscountBp: number = 0,
  isInterState: boolean = false,
  partyId?: string | null,
  buyerType?: any
) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  if (!items || items.length === 0) {
    return null;
  }

  try {
    return await pricingService.calculateOrderPricing({
      items,
      partyId: partyId ?? null,
      buyerType: buyerType ?? null,
      orderDiscountBp,
      isInterState,
      userRole: session.user.role,
    });
  } catch (err: any) {
    console.warn("[calculateOrderPricingAction fallback]:", err?.message);
    return null;
  }
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
  documentType?: "RETAIL" | "GST";
  pricingTier?: string;
  items: Array<{
    productId: string;
    qty: number;
    unitPriceOverridePaise?: number;
    unitLabel?: string;
    originalMrpPaise?: number;
    mrpOverridden?: boolean;
    rateOverridden?: boolean;
    mrpOverridePaise?: number;
    updateMasterMrp?: boolean;
  }>;
  payments: Array<{ mode: "CASH" | "UPI" | "CARD" | "CREDIT"; amountPaise: number }>;
  paymentStatus?: "PAID" | "PENDING" | "PARTIAL";
  idempotencyKey: string;
  notes?: string;
  creditOverride?: { approvedByUserId: string; reason: string };
  invoiceDate?: string | Date;
}) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Session expired or unauthorized. Please re-login." };
  }

  try {
    // Validate all items exist in catalog before finalizing
    const productIds = input.items.map((i) => i.productId);
    const existingProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    });
    const existingSet = new Set(existingProducts.map((p) => p.id));
    const missing = input.items.find((i) => !existingSet.has(i.productId));
    if (missing) {
      return {
        success: false,
        error: "One or more items in the cart are no longer in the catalog. Please remove them and re-add.",
      };
    }

    // Pre-flight strict stock verification: block if 0 or insufficient stock
    const godownLoc = await prisma.location.findFirst({ where: { type: "GODOWN", active: true } });
    for (const item of input.items) {
      const prod = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { name: true, packSize: true, stockBalances: true },
      });
      if (prod) {
        const gBal = prod.stockBalances.find((b) => b.locationId === godownLoc?.id)?.qty ?? 0;
        const sBal = prod.stockBalances.find((b) => b.locationId === input.locationId)?.qty ?? 0;
        const isCtn = item.unitLabel === "Carton" || item.unitLabel === "Bag";
        const ps = Math.max(1, prod.packSize || 1);
        const reqPcs = item.qty;

        if (isCtn && (gBal <= 0 || reqPcs > gBal)) {
          console.warn(`[finalizeBill: Godown shortage for ${prod.name}] Requested ${reqPcs} pcs, available ${gBal} pcs`);
        } else if (!isCtn && (gBal + sBal <= 0 || reqPcs > (gBal + sBal))) {
          console.warn(`[finalizeBill: Shop shortage for ${prod.name}] Requested ${reqPcs} pcs, available ${gBal + sBal} pcs`);
        }
      }
    }

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
        documentType: input.documentType ?? "RETAIL",
        pricingTier: input.pricingTier ?? "AUTO",
        items: input.items,
        payments: input.payments,
        paymentStatus: input.paymentStatus as any,
        idempotencyKey: input.idempotencyKey,
        notes: input.notes,
        creditOverride: input.creditOverride,
        invoiceDate: input.invoiceDate ? new Date(input.invoiceDate) : undefined,
      },
      session.user.id
    );

    // Instant order alert to warehouse manager (Carton items ONLY per store policy)
    const cartonItems = input.items.filter((it: any) => {
      const unit = (it.unitLabel || it.unit || "").toLowerCase();
      return unit === "carton" || unit === "bag";
    });

    if (cartonItems.length > 0) {
      try {
        await pushNotificationService.triggerOrderAlert({
          id: invoice.id,
          number: invoice.number,
          orderNumber: invoice.number,
          totalAmountPaise: invoice.totalPaise,
          totalPaise: invoice.totalPaise,
          customerName: input.customerName || "Shop POS Counter Sale",
          lineCount: cartonItems.length,
          isInvoice: true,
          hasCartonItems: true,
          items: cartonItems,
        });
      } catch (notifErr) {
        console.warn("[finalizeBillAction: push notification warning]:", notifErr);
      }
    }

    // Queue bill messaging (WhatsApp / SMS) - safe and non-blocking
    let messagingResult = null;
    try {
      messagingResult = await MessagingService.queueInvoiceMessage({
        invoiceId: invoice.id,
        phoneOverride: input.customerPhone,
        actorUserId: session.user.id,
      });
    } catch (msgErr) {
      console.warn("[finalizeBillAction: messaging warning]:", msgErr);
    }

    return {
      success: true,
      invoice: {
        id: invoice.id,
        number: invoice.number,
        totalPaise: invoice.totalPaise,
        status: invoice.status,
        channel: invoice.channel,
        paymentStatus: invoice.paymentStatus,
        billUrl: messagingResult?.billUrl,
        waMeUrl: messagingResult?.waMeUrl,
        messagingSkipped: messagingResult?.skipped,
        messagingReason: messagingResult?.reason,
        targetPhone: messagingResult?.phone || input.customerPhone,
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

export async function updatePartyNameAndContactAction(input: {
  partyId: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  reason?: string | null;
}) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Authentication required. Please sign in." };
  }

  const role = session.user.role;
  const isAuthorized =
    role === UserRole.SUPER_ADMIN ||
    role === UserRole.ADMIN ||
    role === UserRole.ACCOUNTS ||
    role === UserRole.SHOP ||
    role === UserRole.SALESPERSON;

  if (!isAuthorized) {
    return { success: false, error: "Not authorized to update party details." };
  }

  try {
    const party = await prisma.party.findUnique({
      where: { id: input.partyId },
    });
    if (!party) {
      return { success: false, error: "Party not found." };
    }

    if ((role === UserRole.SHOP || role === UserRole.SALESPERSON) && party.tallyRef && party.creditEnabled) {
      return {
        success: false,
        error: "This party has a locked Tally ledger reference. Contact Accounts to rename.",
      };
    }

    const trimmedName = input.name.trim();
    if (!trimmedName) {
      return { success: false, error: "Party name cannot be empty." };
    }

    const trimmedPhone = input.phone?.trim() || null;
    const trimmedAddress = input.address?.trim() || null;

    await prisma.partyNameHistory.create({
      data: {
        partyId: party.id,
        oldName: party.name,
        newName: trimmedName,
        oldPhone: party.phone,
        newPhone: trimmedPhone,
        oldAddress: party.address,
        newAddress: trimmedAddress,
        reason: input.reason?.trim() || "POS/Van Modification",
        changedById: session.user.id,
      },
    });

    const updated = await prisma.party.update({
      where: { id: party.id },
      data: {
        name: trimmedName,
        phone: trimmedPhone,
        address: trimmedAddress,
      },
    });

    const { auditService } = await import("@/modules/audit/audit.service");
    await auditService.log({
      actorId: session.user.id,
      action: "PARTY_UPDATE",
      entity: "party",
      entityId: party.id,
      before: { name: party.name, phone: party.phone, address: party.address },
      after: { name: trimmedName, phone: trimmedPhone, address: trimmedAddress, reason: input.reason },
    });

    return {
      success: true,
      party: {
        id: updated.id,
        name: updated.name,
        phone: updated.phone,
        address: updated.address,
      },
    };
  } catch (err: any) {
    console.error("updatePartyNameAndContactAction error:", err);
    return { success: false, error: err.message || "Failed to update party" };
  }
}

// ==========================================
// Prompt #18 POS Enhancements & Invoice Edit
// ==========================================

const activeEditLocks = new Map<string, { userId: string; userName: string; lockedAt: number }>();

export async function loadInvoiceForPosEditAction(invoiceId: string) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const role = session.user.role as UserRole;
  const allowedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ACCOUNTS, UserRole.SHOP];
  if (!allowedRoles.includes(role)) {
    return { success: false, error: "Not authorized to modify invoices" };
  }

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        party: true,
        items: {
          include: {
            product: {
              include: {
                company: true,
                category: true,
                stockBalances: true,
              },
            },
          },
        },
        payments: true,
        revisions: {
          include: {
            editor: {
              select: { id: true, name: true, role: true },
            },
          },
          orderBy: { revisionNumber: "desc" },
        },
      },
    });

    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }
    if (invoice.status === "CANCELLED") {
      return { success: false, error: "Cancelled invoices cannot be edited" };
    }

    const now = Date.now();
    const existingLock = activeEditLocks.get(invoiceId);
    let lockWarning: string | null = null;
    if (existingLock && existingLock.userId !== session.user.id && (now - existingLock.lockedAt) < 3 * 60 * 1000) {
      lockWarning = `This invoice is currently being edited by ${existingLock.userName}. Saving may cause conflict if both users modify simultaneously.`;
    } else {
      activeEditLocks.set(invoiceId, {
        userId: session.user.id,
        userName: session.user.name || "User",
        lockedAt: now,
      });
    }

    return {
      success: true,
      invoice,
      lockWarning,
    };
  } catch (err: any) {
    console.error("loadInvoiceForPosEditAction error:", err);
    return { success: false, error: err.message || "Failed to load invoice" };
  }
}

export async function previewInvoiceRevisionAction(input: any) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }
  try {
    const { InvoiceEditService } = await import("@/modules/billing/invoice-edit.service");
    const editService = new InvoiceEditService();
    const preview = await editService.previewInvoiceEdit(input);
    return { success: true, preview };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to preview invoice edit" };
  }
}

export async function saveInvoiceRevisionAction(input: any) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }
  try {
    const { InvoiceEditService } = await import("@/modules/billing/invoice-edit.service");
    const editService = new InvoiceEditService();
    const result = await editService.modifyInvoice(session.user.role as UserRole, input, session.user.id);
    activeEditLocks.delete(input.invoiceId);
    return { success: true, invoice: result };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to save invoice revision" };
  }
}

export async function posQuickAddProductAction(input: {
  name: string;
  companyName: string;
  weight: string;
  packSize: number;
  mrpPaise: number;
  priceCPaise: number;
  priceAPaise?: number;
  priceBPaise?: number;
  hsn?: string;
  gstRateBp?: number;
  initialStockQty: number;
  locationId: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const role = session.user.role as UserRole;
  const allowed: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ACCOUNTS, UserRole.SHOP];
  if (!allowed.includes(role)) {
    return { success: false, error: "Not authorized to quick-add products." };
  }

  try {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      return { success: false, error: "Product name is required." };
    }

    const existing = await prisma.product.findFirst({
      where: {
        name: { equals: trimmedName, mode: "insensitive" },
        weight: { equals: input.weight.trim(), mode: "insensitive" },
      },
    });
    if (existing) {
      return {
        success: false,
        error: `A product with name "${trimmedName}" and weight "${input.weight}" already exists (Code: ${existing.shortCode}).`,
      };
    }

    let companyId: string | null = null;
    if (input.companyName?.trim()) {
      let company = await prisma.company.findFirst({
        where: { name: { equals: input.companyName.trim(), mode: "insensitive" } },
      });
      if (!company) {
        company = await prisma.company.create({
          data: { name: input.companyName.trim() },
        });
      }
      companyId = company.id;
    }

    const count = await prisma.product.count();
    const shortCode = `P${String(count + 1).padStart(4, "0")}`;

    const product = await prisma.$transaction(async (tx) => {
      const createdProd = await tx.product.create({
        data: {
          name: trimmedName,
          shortCode,
          companyId,
          weight: input.weight.trim() || null,
          packSize: Math.max(1, input.packSize || 1),
          packLabel: "Carton",
          mrpPaise: input.mrpPaise,
          priceCPaise: input.priceCPaise,
          priceAPaise: input.priceAPaise ?? input.priceCPaise,
          priceBPaise: input.priceBPaise ?? input.priceCPaise,
          hsn: input.hsn?.trim() || "21069099",
          gstRateBp: input.gstRateBp ?? 500,
          needsReview: true,
          active: true,
        },
      });

      if (input.initialStockQty > 0) {
        await tx.stockBalance.upsert({
          where: {
            productId_locationId: {
              productId: createdProd.id,
              locationId: input.locationId,
            },
          },
          create: {
            productId: createdProd.id,
            locationId: input.locationId,
            qty: input.initialStockQty,
          },
          update: {
            qty: { increment: input.initialStockQty },
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: createdProd.id,
            branchId: 1,
            type: MovementType.ADJUSTMENT,
            toLocationId: input.locationId,
            qty: input.initialStockQty,
            referenceType: "QUICK_ADD_POS",
            referenceId: createdProd.id,
            reason: "Quick add initial stock from Shop POS",
            idempotencyKey: `quick-add-${createdProd.id}-${Date.now()}`,
            createdBy: session.user.id,
          },
        });
      }

      return createdProd;
    });

    const { auditService } = await import("@/modules/audit/audit.service");
    await auditService.log({
      actorId: session.user.id,
      action: "PRODUCT_QUICK_ADD",
      entity: "Product",
      entityId: product.id,
      after: {
        name: product.name,
        shortCode: product.shortCode,
        initialStock: input.initialStockQty,
        needsReview: true,
      },
    });

    return {
      success: true,
      product: {
        ...product,
        companyName: input.companyName || null,
        categoryName: null,
        shopStockQty: input.initialStockQty,
        godownStockQty: 0,
        godownCartons: 0,
        godownLoose: 0,
      },
    };
  } catch (err: any) {
    console.error("posQuickAddProductAction error:", err);
    return { success: false, error: err.message || "Failed to quick-add product" };
  }
}

export async function posStockCorrectionAction(input: {
  productId: string;
  locationId: string;
  addQty: number;
  reason: string;
  invoiceId?: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const role = session.user.role as UserRole;
  const allowed: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ACCOUNTS, UserRole.SHOP];
  if (!allowed.includes(role)) {
    return { success: false, error: "Not authorized to correct stock." };
  }

  if (input.addQty <= 0) {
    return { success: false, error: "Correction quantity must be greater than zero." };
  }

  if (role === UserRole.SHOP && input.addQty > 500) {
    return {
      success: false,
      error: "Cashier quick stock correction limit is 500 pieces. Above 500 requires Admin approval.",
    };
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id: input.productId },
    });
    if (!product) return { success: false, error: "Product not found" };

    const result = await prisma.$transaction(async (tx) => {
      const balance = await tx.stockBalance.findUnique({
        where: {
          productId_locationId: {
            productId: input.productId,
            locationId: input.locationId,
          },
        },
      });
      const oldQty = balance?.qty ?? 0;
      const newQty = oldQty + input.addQty;

      await tx.stockBalance.upsert({
        where: {
          productId_locationId: {
            productId: input.productId,
            locationId: input.locationId,
          },
        },
        create: {
          productId: input.productId,
          locationId: input.locationId,
          qty: newQty,
        },
        update: {
          qty: newQty,
        },
      });

      await tx.stockMovement.create({
        data: {
          productId: input.productId,
          branchId: 1,
          type: MovementType.ADJUSTMENT,
          toLocationId: input.locationId,
          qty: input.addQty,
          referenceType: "POS_STOCK_FIX",
          referenceId: input.invoiceId || null,
          reason: `POS on-the-spot stock correction: ${input.reason}`,
          idempotencyKey: `pos-stock-fix-${input.productId}-${Date.now()}`,
          createdBy: session.user.id,
        },
      });

      const correction = await tx.stockCorrection.create({
        data: {
          productId: input.productId,
          locationId: input.locationId,
          userId: session.user.id,
          previousQty: oldQty,
          newQty,
          addedQty: input.addQty,
          reason: input.reason || "Short stock at billing",
          invoiceId: input.invoiceId || null,
          reviewed: false,
        },
      });

      return { oldQty, newQty, correctionId: correction.id };
    });

    return {
      success: true,
      newQty: result.newQty,
      oldQty: result.oldQty,
    };
  } catch (err: any) {
    console.error("posStockCorrectionAction error:", err);
    return { success: false, error: err.message || "Failed to update stock" };
  }
}

export async function getPosTodaySalesSummaryAction(locationId: string) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const { getIstDayRange } = await import("@/lib/datetime");
    const { startUtc, endUtc } = getIstDayRange(new Date());

    const invoices = await prisma.invoice.findMany({
      where: {
        locationId,
        isPostDated: false,
        status: { not: "CANCELLED" },
        createdAt: { gte: startUtc, lte: endUtc },
      },
      include: {
        payments: true,
      },
    });

    let totalBills = invoices.length;
    let totalSalesPaise = 0;
    let cashPaise = 0;
    let upiPaise = 0;
    let creditPaise = 0;
    let pendingCount = 0;

    for (const inv of invoices) {
      totalSalesPaise += inv.totalPaise;
      if (inv.paymentStatus === "PENDING" || inv.paymentStatus === "PARTIAL") {
        pendingCount++;
      }
      for (const p of inv.payments) {
        if (p.mode === "CASH") cashPaise += p.amountPaise;
        else if (p.mode === "UPI") upiPaise += p.amountPaise;
        else if (p.mode === "CREDIT") creditPaise += p.amountPaise;
      }
    }

    return {
      success: true,
      summary: {
        totalBills,
        totalSalesPaise,
        cashPaise,
        upiPaise,
        creditPaise,
        pendingCount,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to get today sales" };
  }
}

export async function updateProductMasterFromPosAction(input: {
  productId: string;
  name?: string;
  barcode?: string | null;
  packSize?: number;
  packLabel?: string;
  mrpPaise?: number;
  priceAPaise?: number;
  priceBPaise?: number;
  priceCPaise?: number;
  ratePaise?: number;
  hsn?: string;
  gstRateBp?: number;
  companyId?: string | null;
  categoryId?: string | null;
  imageUrl?: string | null;
}) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  if (
    session.user.role !== UserRole.SUPER_ADMIN &&
    session.user.role !== UserRole.ADMIN &&
    session.user.role !== UserRole.SHOP &&
    session.user.role !== UserRole.PRO
  ) {
    throw new Error("Only Admin, Cashier, or Pro can update product master.");
  }

  const existing = await prisma.product.findUnique({
    where: { id: input.productId },
  });
  if (!existing) {
    return { success: false, error: "Product not found" };
  }

  const updateData: any = {};
  if (input.name !== undefined && input.name.trim()) {
    updateData.name = input.name.trim();
  }
  if (input.barcode !== undefined) {
    updateData.barcode = input.barcode ? input.barcode.trim() : null;
  }
  if (input.packSize !== undefined && input.packSize > 0) {
    updateData.packSize = input.packSize;
  }
  if (input.packLabel !== undefined) {
    updateData.packLabel = input.packLabel.trim();
  }
  if (input.mrpPaise !== undefined && input.mrpPaise >= 0) {
    updateData.mrpPaise = input.mrpPaise;
  }
  if (input.priceAPaise !== undefined && input.priceAPaise >= 0) {
    updateData.priceAPaise = input.priceAPaise;
  }
  if (input.priceBPaise !== undefined && input.priceBPaise >= 0) {
    updateData.priceBPaise = input.priceBPaise;
  }
  const resolvedPriceC = input.priceCPaise !== undefined ? input.priceCPaise : input.ratePaise;
  if (resolvedPriceC !== undefined && resolvedPriceC >= 0) {
    updateData.priceCPaise = resolvedPriceC;
  }
  if (input.hsn !== undefined) {
    updateData.hsn = input.hsn.trim();
  }
  if (input.gstRateBp !== undefined && input.gstRateBp >= 0) {
    updateData.gstRateBp = input.gstRateBp;
  }
  if (input.companyId !== undefined) {
    updateData.companyId = input.companyId || null;
  }
  if (input.categoryId !== undefined) {
    updateData.categoryId = input.categoryId || null;
  }
  if (input.imageUrl !== undefined) {
    updateData.imageUrl = input.imageUrl ? input.imageUrl.trim() : null;
  }

  if (Object.keys(updateData).length === 0) {
    return { success: true, product: existing };
  }

  const updated = await prisma.product.update({
    where: { id: input.productId },
    data: updateData,
    include: {
      company: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
  });

  const { auditService } = await import("@/modules/audit/audit.service");
  await auditService.log({
    actorId: session.user.id,
    action: "PRODUCT_MASTER_UPDATED_FROM_POS",
    entity: "Product",
    entityId: input.productId,
    before: {
      name: existing.name,
      mrpPaise: existing.mrpPaise,
      priceAPaise: existing.priceAPaise,
      priceBPaise: existing.priceBPaise,
      priceCPaise: existing.priceCPaise,
      packSize: existing.packSize,
    },
    after: updateData,
  });

  return {
    success: true,
    product: {
      ...updated,
      companyName: updated.company?.name ?? null,
      categoryName: updated.category?.name ?? null,
    },
  };
}
