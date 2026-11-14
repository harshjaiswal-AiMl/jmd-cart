"use server";

import { auth } from "@/auth";
import { purchaseService } from "@/modules/purchase/purchase.service";
import { revalidatePath } from "next/cache";

export interface PurchaseActionResult {
  success?: boolean;
  error?: string;
  purchaseId?: string;
}

export async function recordPurchaseAction(
  prevState: PurchaseActionResult | undefined,
  formData: FormData
): Promise<PurchaseActionResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  const rawJson = (formData.get("purchaseData") || formData.get("payload")) as string;
  if (!rawJson) {
    return { error: "Purchase details are required" };
  }

  try {
    const parsed = JSON.parse(rawJson);
    const result = await purchaseService.recordPurchaseReceive(
      session.user.role,
      session.user.id,
      parsed
    );

    revalidatePath("/godown/purchases");
    return { success: true, purchaseId: result.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record purchase";
    return { error: message };
  }
}

export async function cancelPurchaseAction(purchaseId: string, reason: string) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.role) {
      return { success: false, error: "Unauthorized" };
    }

    await purchaseService.cancelPurchase(
      session.user.role,
      session.user.id,
      purchaseId,
      reason
    );

    revalidatePath("/godown/purchases");
    revalidatePath("/godown/stock");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to cancel purchase receipt",
    };
  }
}

export async function updatePurchaseAction(
  purchaseId: string,
  data: {
    billNo?: string;
    billDate?: string;
    supplierId?: string | null;
  }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.role) {
      return { success: false, error: "Unauthorized" };
    }

    await purchaseService.updatePurchase(
      session.user.role,
      session.user.id,
      purchaseId,
      {
        billNo: data.billNo,
        billDate: data.billDate ? new Date(data.billDate) : undefined,
        supplierId: data.supplierId,
      }
    );

    revalidatePath("/godown/purchases");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update purchase details",
    };
  }
}


export async function checkDuplicateSupplierBillAction(supplierId: string, billNo: string) {
  if (!supplierId || !billNo?.trim()) {
    return { isDuplicate: false };
  }
  try {
    const { prisma } = await import("@/lib/prisma");
    const existing = await prisma.purchase.findFirst({
      where: {
        supplierId,
        billNo: { equals: billNo.trim(), mode: "insensitive" },
        status: { not: "CANCELLED" },
      },
      select: {
        id: true,
        billNo: true,
        billDate: true,
        totalPaise: true,
      },
    });

    if (existing) {
      return {
        isDuplicate: true,
        existingId: existing.id,
        existingBillNo: existing.billNo,
        billDate: existing.billDate.toISOString().split("T")[0],
        totalPaise: existing.totalPaise,
      };
    }
    return { isDuplicate: false };
  } catch (err) {
    console.error("checkDuplicateSupplierBillAction error:", err);
    return { isDuplicate: false };
  }
}

export async function getSupplierPreviousPurchasesAction(supplierId: string) {
  if (!supplierId) return [];
  try {
    const { prisma } = await import("@/lib/prisma");
    const purchases = await prisma.purchase.findMany({
      where: {
        supplierId,
        status: { not: "CANCELLED" },
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                shortCode: true,
                packSize: true,
                mrpPaise: true,
                gstRateBp: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return purchases.map((p) => ({
      id: p.id,
      billNo: p.billNo,
      billDate: p.billDate.toISOString().split("T")[0],
      totalPaise: p.totalPaise,
      itemCount: p.items.length,
      items: p.items.map((it) => ({
        productId: it.productId,
        name: it.product.name,
        shortCode: it.product.shortCode,
        qty: it.qty,
        packSize: it.product.packSize,
        ratePaise: it.ratePaise,
        gstRateBp: it.gstRateBp,
      })),
    }));
  } catch (err) {
    console.error("getSupplierPreviousPurchasesAction error:", err);
    return [];
  }
}

export async function getSupplierRateHistoryAction(supplierId: string) {
  if (!supplierId) return {};
  try {
    const { prisma } = await import("@/lib/prisma");
    const recentItems = await prisma.purchaseItem.findMany({
      where: {
        purchase: {
          supplierId,
          status: { not: "CANCELLED" },
        },
      },
      select: {
        productId: true,
        ratePaise: true,
        purchase: {
          select: {
            billDate: true,
          },
        },
      },
      orderBy: {
        purchase: {
          billDate: "desc",
        },
      },
      take: 200,
    });

    const map: Record<string, { lastRatePaise: number; lastDate: string }> = {};
    for (const it of recentItems) {
      if (!map[it.productId]) {
        map[it.productId] = {
          lastRatePaise: it.ratePaise,
          lastDate: it.purchase.billDate.toISOString().split("T")[0],
        };
      }
    }
    return map;
  } catch (err) {
    console.error("getSupplierRateHistoryAction error:", err);
    return {};
  }
}

export async function getSupplierReorderItemsAction(supplierCompanyId: string) {
  if (!supplierCompanyId) return [];
  try {
    const { prisma } = await import("@/lib/prisma");
    const products = await prisma.product.findMany({
      where: {
        companyId: supplierCompanyId,
        active: true,
      },
      select: {
        id: true,
        name: true,
        shortCode: true,
        packSize: true,
        reorderLevel: true,
        mrpPaise: true,
        gstRateBp: true,
        stockBalances: {
          select: {
            qty: true,
            location: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return products
      .map((p) => {
        const godownQty = p.stockBalances
          .filter((sb) => sb.location.name.toLowerCase().includes("godown"))
          .reduce((sum, sb) => sum + sb.qty, 0);
        return {
          id: p.id,
          name: p.name,
          shortCode: p.shortCode,
          packSize: p.packSize,
          reorderLevel: p.reorderLevel,
          godownStockQty: godownQty,
          mrpPaise: p.mrpPaise ?? 0,
          gstRateBp: p.gstRateBp,
          suggestedQtyCartons: Math.max(1, Math.ceil(((p.reorderLevel * 2) - godownQty) / (p.packSize || 1))),
        };
      })
      .filter((p) => p.godownStockQty <= p.reorderLevel);
  } catch (err) {
    console.error("getSupplierReorderItemsAction error:", err);
    return [];
  }
}
