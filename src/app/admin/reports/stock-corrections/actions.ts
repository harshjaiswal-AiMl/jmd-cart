"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function markStockCorrectionReviewedAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const role = session.user.role as UserRole;
  if (role !== UserRole.SUPER_ADMIN && role !== UserRole.ADMIN && role !== UserRole.ACCOUNTS) {
    return { success: false, error: "Not authorized to review stock corrections." };
  }

  try {
    const updated = await prisma.stockCorrection.update({
      where: { id },
      data: {
        reviewed: true,
        reviewedAt: new Date(),
        reviewedBy: session.user.id,
      },
    });

    revalidatePath("/admin/reports/stock-corrections");
    return { success: true, correction: updated };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to mark reviewed" };
  }
}
