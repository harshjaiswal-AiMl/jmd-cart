"use server";

import { auth } from "@/auth";
import { vanService } from "@/modules/van/van.service";
import { ReconcileVanDayInput, reconcileVanDaySchema } from "@/modules/van/van.types";
import { revalidatePath } from "next/cache";

export async function reconcileVanDayAction(input: ReconcileVanDayInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized. Please sign in." };
    }

    const parsed = reconcileVanDaySchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const report = await vanService.reconcileVanDay(
      session.user.role,
      session.user.id,
      parsed.data
    );

    revalidatePath("/van");
    revalidatePath("/van/reconciliation");
    revalidatePath("/godown/van-issues");
    revalidatePath(`/godown/van-issues/${report.vanDay.id}/reconcile`);

    return { success: true, data: report };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to reconcile van day";
    return { success: false, error: message };
  }
}

export async function confirmCashHandoverAction(input: {
  vanDayId: string;
  receivedCashPaise: number;
  notes?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized. Please sign in." };
    }

    const handover = await vanService.confirmCashHandover(
      session.user.role,
      session.user.id,
      input
    );

    revalidatePath("/van");
    revalidatePath("/van/reconciliation");
    revalidatePath("/godown/van-issues");
    revalidatePath(`/godown/van-issues/${handover.vanDayId}/reconcile`);

    return { success: true, data: handover };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to confirm cash handover";
    return { success: false, error: message };
  }
}

