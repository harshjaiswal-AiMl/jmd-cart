"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { LocationType, MovementType, UserRole } from "@prisma/client";
import { stockService } from "@/modules/stock/stock.service";
import { vanService } from "@/modules/van/van.service";
import { pushNotificationService } from "@/modules/notifications/push-notification.service";
import { revalidatePath } from "next/cache";

export async function completeGodownOrderAction(refId: string, isInvoice?: boolean) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    if (isInvoice) {
      // Find existing counterPickup or create one with COMPLETED
      const existing = await prisma.counterPickup.findFirst({
        where: { invoiceId: refId },
      });
      if (existing) {
        await prisma.counterPickup.update({
          where: { id: existing.id },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
          },
        });
      } else {
        const inv = await prisma.invoice.findUnique({
          where: { id: refId },
          include: {
            creator: { select: { name: true } },
            items: {
              include: {
                product: { select: { id: true, name: true, shortCode: true, packSize: true, packLabel: true } },
              },
            },
          },
        });
        if (inv) {
          await prisma.counterPickup.create({
            data: {
              invoiceId: inv.id,
              billNumber: inv.number,
              cashierName: inv.creator?.name || "Cashier",
              status: "COMPLETED",
              completedAt: new Date(),
              notes: `Packed & handed over by Godown (${session.user.name || "Staff"})`,
              items: inv.items.map((line) => {
                const packSize = line.product?.packSize || 1;
                return {
                  productId: line.productId,
                  productName: line.product?.name || line.productId,
                  shortCode: line.product?.shortCode || "",
                  packSize,
                  packLabel: line.product?.packLabel || "Carton",
                  qty: line.qty,
                  cartons: Math.floor(line.qty / packSize),
                  loose: line.qty % packSize,
                  packed: true,
                };
              }),
            },
          });
        }
      }
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
    revalidatePath("/godown/dispatch");
    return { success: true };
  } catch (err: any) {
    console.error("[completeGodownOrderAction error]:", err);
    return { success: false, error: err.message || "Failed to complete packing" };
  }
}

export async function issueVanLoadSheetAction(input: {
  vanLocationId: string;
  items: Array<{ productId: string; cartons: number; pieces: number }>;
  salespersonId?: string;
  notes?: string;
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
    include: { assignedUser: true },
  });

  if (!van) {
    return { success: false, error: "Van location not found" };
  }

  const validItems = input.items.filter((it) => it.cartons > 0 || it.pieces > 0);
  if (validItems.length === 0) {
    return { success: false, error: "Please select at least one item to load" };
  }

  try {
    // Check if Van already has an OPEN issue sheet today
    const existingOpen = await prisma.vanDay.findFirst({
      where: { vanLocationId: van.id, status: "OPEN" },
      include: {
        lines: {
          include: { product: true },
        },
      },
    });

    let vanDayResult;

    if (existingOpen) {
      // Append / merge incoming items with existing lines
      const lineMap = new Map<string, { cartons: number; pieces: number }>();

      // Populate existing lines
      for (const line of existingOpen.lines) {
        const packSize = line.product?.packSize > 0 ? line.product.packSize : 1;
        lineMap.set(line.productId, {
          cartons: Math.floor(line.issuedQty / packSize),
          pieces: line.issuedQty % packSize,
        });
      }

      // Merge new items
      for (const item of validItems) {
        const cur = lineMap.get(item.productId) || { cartons: 0, pieces: 0 };
        lineMap.set(item.productId, {
          cartons: cur.cartons + item.cartons,
          pieces: cur.pieces + item.pieces,
        });
      }

      const mergedItems = Array.from(lineMap.entries()).map(([productId, counts]) => ({
        productId,
        cartons: counts.cartons,
        pieces: counts.pieces,
      }));

      vanDayResult = await vanService.updateVanIssueSheet(
        session.user.role as UserRole,
        session.user.id,
        {
          vanDayId: existingOpen.id,
          notes: input.notes || existingOpen.notes || undefined,
          items: mergedItems,
        }
      );
    } else {
      // Create new van issue sheet
      const salespersonId =
        input.salespersonId || van.assignedUserId || session.user.id;

      vanDayResult = await vanService.createVanIssueSheet(
        session.user.role as UserRole,
        session.user.id,
        {
          vanLocationId: van.id,
          salespersonId,
          notes: input.notes || `Morning App Dispatch to ${van.name}`,
          items: validItems,
        }
      );
    }

    revalidatePath("/app/godown");
    revalidatePath("/godown/van-issues");
    revalidatePath("/godown/stock");
    revalidatePath("/van");

    return {
      success: true,
      count: validItems.length,
      vanDayId: vanDayResult.id,
      issueSheetNo: vanDayResult.issueSheetNo,
    };
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
