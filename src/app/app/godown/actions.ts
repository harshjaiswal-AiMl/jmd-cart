"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { LocationType, MovementType, UserRole } from "@prisma/client";
import { stockService } from "@/modules/stock/stock.service";
import { pushNotificationService } from "@/modules/notifications/push-notification.service";
import { revalidatePath } from "next/cache";

export async function completeGodownOrderAction(refId: string, isInvoice?: boolean) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    if (isInvoice) {
      // Mark CounterPickup completed
      await prisma.counterPickup.updateMany({
        where: { invoiceId: refId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });
    } else {
      await prisma.order.update({
        where: { id: refId },
        data: {
          status: "DISPATCHED",
        },
      });
    }

    // Dismiss active alerts
    await pushNotificationService.acceptOrderAlert(refId, session.user.id);

    revalidatePath("/app/godown");
    return { success: true };
  } catch (err: any) {
    console.error("[completeGodownOrderAction error]:", err);
    return { success: false, error: err.message || "Failed to complete packing" };
  }
}

export async function issueVanLoadSheetAction(input: {
  vanLocationId: string;
  items: Array<{ productId: string; cartons: number; pieces: number }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const godown = await prisma.location.findFirst({
    where: { type: LocationType.GODOWN, active: true },
  });

  if (!godown) {
    return { success: false, error: "Godown location not found" };
  }

  const van = await prisma.location.findUnique({
    where: { id: input.vanLocationId },
  });

  if (!van) {
    return { success: false, error: "Van location not found" };
  }

  try {
    let transferredLines = 0;
    for (const item of input.items) {
      if (item.cartons <= 0 && item.pieces <= 0) continue;

      const prod = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { id: true, packSize: true, name: true },
      });
      if (!prod) continue;

      const packSize = Math.max(1, prod.packSize || 1);
      const totalPcs = item.cartons * packSize + item.pieces;
      if (totalPcs <= 0) continue;

      await stockService.postMovement({
        type: MovementType.TRANSFER,
        productId: prod.id,
        fromLocationId: godown.id,
        toLocationId: van.id,
        qty: totalPcs,
        reason: `Morning Van Load Issue to ${van.name}`,
        idempotencyKey: `van-issue-${van.id}-${prod.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        actorId: session.user.id,
        allowNegative: true,
      });

      transferredLines++;
    }

    revalidatePath("/app/godown");
    return { success: true, count: transferredLines };
  } catch (err: any) {
    console.error("[issueVanLoadSheetAction error]:", err);
    return { success: false, error: err.message || "Failed to issue load sheet" };
  }
}

export async function quickAddOrUpdateGodownProductAction(input: {
  id?: string;
  name: string;
  weight?: string;
  shortCode?: string;
  packSize: number;
  mrpPaise?: number;
  addCartons: number;
  addPieces: number;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const godown = await prisma.location.findFirst({
    where: { type: LocationType.GODOWN, active: true },
  });

  if (!godown) {
    return { success: false, error: "Central Godown location not found" };
  }

  try {
    let product;
    const packSize = Math.max(1, input.packSize || 1);

    if (input.id) {
      product = await prisma.product.findUnique({ where: { id: input.id } });
      if (!product) {
        return { success: false, error: "Product not found" };
      }
      if (input.weight || input.shortCode) {
        product = await prisma.product.update({
          where: { id: input.id },
          data: {
            weight: input.weight || product.weight,
            shortCode: input.shortCode || product.shortCode,
          },
        });
      }
    } else {
      const generatedCode =
        input.shortCode?.trim() ||
        input.name
          .replace(/[^a-zA-Z0-9]/g, "")
          .substring(0, 8)
          .toUpperCase() + `-${Math.floor(100 + Math.random() * 900)}`;

      product = await prisma.product.create({
        data: {
          name: input.name.trim(),
          shortCode: generatedCode,
          weight: input.weight?.trim() || null,
          packSize,
          packLabel: "Carton",
          mrpPaise: input.mrpPaise || 0,
          priceAPaise: input.mrpPaise || 0,
          active: true,
          branchId: 1,
        },
      });
    }

    const totalAddedPcs = Math.max(0, input.addCartons) * packSize + Math.max(0, input.addPieces);

    let updatedQty = 0;
    if (totalAddedPcs > 0) {
      const existingBalance = await prisma.stockBalance.findUnique({
        where: {
          productId_locationId: {
            productId: product.id,
            locationId: godown.id,
          },
        },
      });

      const prevQty = existingBalance?.qty || 0;
      updatedQty = prevQty + totalAddedPcs;

      await prisma.stockBalance.upsert({
        where: {
          productId_locationId: {
            productId: product.id,
            locationId: godown.id,
          },
        },
        create: {
          productId: product.id,
          locationId: godown.id,
          qty: updatedQty,
        },
        update: {
          qty: updatedQty,
        },
      });

      await prisma.stockCorrection.create({
        data: {
          productId: product.id,
          locationId: godown.id,
          userId: session.user.id,
          previousQty: prevQty,
          addedQty: totalAddedPcs,
          newQty: updatedQty,
          reason: `Morning Issue Quick Stock Addition (${input.addCartons} ctn, ${input.addPieces} loose pcs)`,
          reviewed: true,
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
        },
      });
    } else {
      const b = await prisma.stockBalance.findUnique({
        where: { productId_locationId: { productId: product.id, locationId: godown.id } },
      });
      updatedQty = b?.qty || 0;
    }

    revalidatePath("/app/godown");

    return {
      success: true,
      product: {
        id: product.id,
        name: product.name,
        shortCode: product.shortCode,
        weight: product.weight,
        packSize: product.packSize,
        packLabel: product.packLabel,
        mrpPaise: product.mrpPaise,
        godownQty: updatedQty,
        godownCartons: Math.floor(updatedQty / product.packSize),
        godownLoose: updatedQty % product.packSize,
      },
    };
  } catch (err: any) {
    console.error("[quickAddOrUpdateGodownProductAction error]:", err);
    return { success: false, error: err.message || "Failed to update product/stock" };
  }
}
