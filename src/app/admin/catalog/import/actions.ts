"use server";

import { auth } from "@/auth";
import { catalogImportService } from "@/modules/catalog/import/import.service";
import { ImportResult } from "@/modules/catalog/import/import.types";
import { revalidatePath } from "next/cache";

export interface ImportActionResult {
  success?: boolean;
  error?: string;
  result?: ImportResult;
}

export async function importCatalogAction(
  prevState: ImportActionResult | undefined,
  formData: FormData
): Promise<ImportActionResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  const file = formData.get("file") as File | null;
  const rawText = formData.get("rawText") as string | null;

  let content = "";
  if (file && file.size > 0) {
    content = await file.text();
  } else if (rawText && rawText.trim().length > 0) {
    content = rawText;
  } else {
    return { error: "Please choose a CSV file or paste CSV content" };
  }

  try {
    const result = await catalogImportService.importCsv(
      session.user.role,
      session.user.id,
      content
    );

    revalidatePath("/admin/catalog");
    return { success: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to import catalog";
    return { error: message };
  }
}
