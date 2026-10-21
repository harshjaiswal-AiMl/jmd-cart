"use server";

import { auth } from "@/auth";
import { godownService } from "@/modules/godown/godown.service";
import { revalidatePath } from "next/cache";

export async function enterOpeningStockAction(data: {
  productId: string;
  locationId: string;
  qty: number;
  reason: string;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const res = await godownService.enterOpeningStock(
      session.user.role,
      session.user.id,
      data
    );

    revalidatePath("/godown/stock");
    revalidatePath("/godown/stock/update");
    revalidatePath("/admin");
    revalidatePath("/store");
    revalidatePath("/");

    return {
      success: true,
      resultingBalance: res.resultingBalance,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to enter opening stock",
    };
  }
}

export async function setStockCountAction(data: {
  productId: string;
  locationId: string;
  countedQty: number;
  reason: string;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const res = await godownService.setStockCount(
      session.user.role,
      session.user.id,
      data
    );

    revalidatePath("/godown/stock");
    revalidatePath("/godown/stock/update");
    revalidatePath("/admin");
    revalidatePath("/store");
    revalidatePath("/");

    return {
      success: true,
      systemQty: res.systemQty,
      countedQty: res.countedQty,
      delta: res.delta,
      resultingBalance: res.resultingBalance,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update stock count",
    };
  }
}

export async function adjustStockAction(data: {
  productId: string;
  locationId: string;
  adjustmentQty: number;
  reason: string;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    await godownService.adjustStock(session.user.role, session.user.id, data);

    revalidatePath("/godown/stock");
    revalidatePath("/godown/stock/update");
    revalidatePath("/admin");
    revalidatePath("/store");
    revalidatePath("/");

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to record adjustment",
    };
  }
}

export async function bulkStockCsvAction(params: {
  locationId: string;
  mode: "OPENING_STOCK" | "STOCK_COUNT" | "ADJUSTMENT";
  rawCsv: string;
  previewOnly: boolean;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const res = await godownService.previewOrApplyBulkStockCsv(
      session.user.role,
      session.user.id,
      params
    );

    if (res.applied) {
      revalidatePath("/godown/stock");
      revalidatePath("/godown/stock/update");
      revalidatePath("/admin");
      revalidatePath("/store");
      revalidatePath("/");
    }

    return {
      success: true,
      ...res,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to process bulk CSV",
    };
  }
}

export async function uploadStockExcelAction(params: {
  base64Data: string;
  filename: string;
  locationId: string;
  mode: "OPENING_STOCK" | "STOCK_COUNT" | "ADD" | "DEDUCT";
}) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.role) {
      return { success: false, error: "Unauthorized" };
    }

    const { stockExcelUploadService } = await import(
      "@/modules/godown/stock-excel-upload.service"
    );

    const buffer = Buffer.from(params.base64Data, "base64");
    const result = await stockExcelUploadService.uploadAndApplyStockWorkbook(
      session.user.role,
      session.user.id,
      {
        buffer,
        filename: params.filename,
        defaultLocationId: params.locationId,
        mode: params.mode,
      }
    );

    revalidatePath("/godown/stock");
    revalidatePath("/godown/stock/update");
    revalidatePath("/admin");
    revalidatePath("/store");
    revalidatePath("/");

    return {
      success: true,
      result,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to upload stock Excel",
    };
  }
}

export async function undoStockUploadBatchAction(batchId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.role) {
      return { success: false, error: "Unauthorized" };
    }

    const { stockExcelUploadService } = await import(
      "@/modules/godown/stock-excel-upload.service"
    );

    const res = await stockExcelUploadService.undoStockUploadBatch(
      session.user.role,
      session.user.id,
      batchId
    );

    revalidatePath("/godown/stock");
    revalidatePath("/godown/stock/update");
    revalidatePath("/admin");
    revalidatePath("/store");
    revalidatePath("/");

    return {
      success: true,
      ...res,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to undo stock upload",
    };
  }
}

export async function downloadCurrentStockExcelAction(locationId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.role) {
      return { success: false, error: "Unauthorized" };
    }

    const { stockExcelUploadService } = await import(
      "@/modules/godown/stock-excel-upload.service"
    );

    const buf = await stockExcelUploadService.generateCurrentStockExcelBuffer(
      session.user.role,
      locationId
    );

    return {
      success: true,
      base64: buf.toString("base64"),
      filename: `jmd_current_stock_${locationId}.xlsx`,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to export stock Excel",
    };
  }
}

