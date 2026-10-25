"use server";

import { auth } from "@/auth";
import { UserRole } from "@prisma/client";
import { tallyExportService } from "@/modules/tally/tally.service";
import { TallyExportFilter, TallyExportResult } from "@/modules/tally/tally.types";

export async function exportTallyVouchersAction(
  filter: TallyExportFilter
): Promise<{ success: boolean; result?: TallyExportResult; error?: string }> {
  const session = await auth();

  if (!session?.user) {
    return { success: false, error: "Please log in to export Tally data." };
  }

  const role = session.user.role as UserRole;

  try {
    const result = await tallyExportService.exportVouchers(role, filter);
    return { success: true, result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to export Tally data",
    };
  }
}
