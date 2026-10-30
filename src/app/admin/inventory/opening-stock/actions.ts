"use server";

import { auth } from "@/auth";
import { UserRole } from "@prisma/client";
import { openingStockService } from "@/modules/stock/opening-stock.service";
import { revalidatePath } from "next/cache";

export async function updateOpeningStockAction(input: {
  productId: string;
  godownCartons: number;
  godownLoose: number;
  shopPieces: number;
  reason?: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Authentication required" };
  }

  const role = session.user.role as UserRole;
  if (
    role !== UserRole.SUPER_ADMIN &&
    role !== UserRole.ADMIN &&
    role !== UserRole.WAREHOUSE_MANAGER &&
    role !== UserRole.GODOWN
  ) {
    return { success: false, error: "Unauthorized to update opening stock" };
  }

  try {
    const res = await openingStockService.updateProductOpeningStock(
      role,
      session.user.id,
      input
    );
    revalidatePath("/admin/inventory/opening-stock");
    revalidatePath("/godown/stock");
    revalidatePath("/shop/pos");
    return { success: true, data: res };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update opening stock" };
  }
}
