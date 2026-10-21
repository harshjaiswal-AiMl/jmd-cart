"use server";

import { auth } from "@/auth";
import { catalogImportService } from "@/modules/catalog/import/import.service";
import { ImportResult } from "@/modules/catalog/import/import.types";
import {
  brandSheetImportService,
  BrandWorkbookPreview,
  CommitBrandImportResult,
  ParsedBrandSheetRow,
  SheetPricingMode,
} from "@/modules/catalog/import/brand-sheet-import.service";
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

export async function previewBrandWorkbookAction(input: {
  base64Data: string;
  filename: string;
  sheetModeOverrides?: Record<string, SheetPricingMode>;
}): Promise<{
  success?: boolean;
  error?: string;
  preview?: BrandWorkbookPreview;
}> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  try {
    const buffer = Buffer.from(input.base64Data, "base64");
    const preview = await brandSheetImportService.previewWorkbook(
      session.user.role,
      buffer,
      input.filename,
      input.sheetModeOverrides
    );
    return { success: true, preview };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to parse workbook",
    };
  }
}

export async function commitBrandWorkbookAction(input: {
  filename: string;
  rows: ParsedBrandSheetRow[];
}): Promise<{
  success?: boolean;
  error?: string;
  result?: CommitBrandImportResult;
}> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  try {
    const result = await brandSheetImportService.commitImport(
      session.user.role,
      session.user.id,
      input
    );

    revalidatePath("/admin/catalog");
    revalidatePath("/admin/catalog/price-lists");
    revalidatePath("/admin/catalog/import");
    revalidatePath("/store");
    return { success: true, result };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to commit catalog import",
    };
  }
}

export async function downloadBlankCatalogTemplateAction(): Promise<{
  base64?: string;
  filename?: string;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  const buf = brandSheetImportService.generateBlankTemplateBuffer();
  return {
    base64: buf.toString("base64"),
    filename: "jmd_catalog_price_template.xlsx",
  };
}

export async function downloadReviewReportAction(
  rows: ParsedBrandSheetRow[]
): Promise<{
  base64?: string;
  filename?: string;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  const buf = brandSheetImportService.generateReviewReportBuffer(rows);
  return {
    base64: buf.toString("base64"),
    filename: "jmd_catalog_review_report.xlsx",
  };
}
