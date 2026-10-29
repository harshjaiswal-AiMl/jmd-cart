"use server";

import { auth } from "@/auth";
import { vanService } from "@/modules/van/van.service";
import {
  CreateVanIssueSheetInput,
  createVanIssueSheetSchema,
  UpdateVanIssueSheetInput,
  updateVanIssueSheetSchema,
} from "@/modules/van/van.types";
import { revalidatePath } from "next/cache";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function createVanIssueSheetAction(
  input: CreateVanIssueSheetInput
): Promise<ActionResult<{ id: string; issueSheetNo: string }>> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized. Please log in." };
  }

  try {
    const validated = createVanIssueSheetSchema.parse(input);
    const result = await vanService.createVanIssueSheet(
      session.user.role,
      session.user.id,
      validated
    );

    revalidatePath("/godown/van-issues");
    revalidatePath("/godown/stock");
    revalidatePath("/van");

    return {
      success: true,
      data: {
        id: result.id,
        issueSheetNo: result.issueSheetNo,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create van issue sheet";
    return { success: false, error: msg };
  }
}

export async function updateVanIssueSheetAction(
  input: UpdateVanIssueSheetInput
): Promise<ActionResult<{ id: string; issueSheetNo: string }>> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized. Please log in." };
  }

  try {
    const validated = updateVanIssueSheetSchema.parse(input);
    const result = await vanService.updateVanIssueSheet(
      session.user.role,
      session.user.id,
      validated
    );

    revalidatePath("/godown/van-issues");
    revalidatePath(`/godown/van-issues/${result.id}`);
    revalidatePath(`/godown/van-issues/${result.id}/edit`);
    revalidatePath(`/godown/van-issues/${result.id}/print`);
    revalidatePath("/godown/stock");
    revalidatePath("/van");

    return {
      success: true,
      data: {
        id: result.id,
        issueSheetNo: result.issueSheetNo,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update van issue sheet";
    return { success: false, error: msg };
  }
}
