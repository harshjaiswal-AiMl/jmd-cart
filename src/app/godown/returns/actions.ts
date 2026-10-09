"use server";

import { auth } from "@/auth";
import { UserRole } from "@prisma/client";
import { returnsService } from "@/modules/returns/returns.service";
import { CreateDebitNoteInput } from "@/modules/returns/returns.types";
import { revalidatePath } from "next/cache";

export async function createDebitNoteAction(input: CreateDebitNoteInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Authentication required" };
    }

    const role = session.user.role as UserRole;
    const debitNote = await returnsService.createDebitNote(
      role,
      session.user.id,
      input
    );

    revalidatePath("/godown/returns");
    revalidatePath("/godown/stock");
    revalidatePath("/admin/reports");

    return { success: true, data: debitNote };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create debit note";
    return { success: false, error: message };
  }
}
