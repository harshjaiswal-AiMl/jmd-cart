"use server";

import { auth } from "@/auth";
import { dayDispatchService, DayDispatchSummary } from "@/modules/dispatch/day-dispatch.service";

export async function getDayDispatchDataAction(
  dateStr?: string
): Promise<DayDispatchSummary> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  return dayDispatchService.getDayDispatchData(session.user.role, dateStr);
}
