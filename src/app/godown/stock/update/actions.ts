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

export async function bulkUpdateStockAction(data: {
  locationId: string;
  mode: "OPENING" | "COUNT" | "ADJUST";
  reason: string;
  adjustDirection?: "add" | "subtract";
  items: Array<{
    productId: string;
    qty: number;
  }>;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.role) {
      return { success: false, error: "Unauthorized" };
    }

    const res = await godownService.bulkUpdateStock(
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
      count: res.count,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to bulk update stock",
    };
  }
}

export async function updateProductStockBothLocationsAction(data: {
  productId: string;
  godownLocationId: string;
  godownQty?: number | null;
  shopLocationId?: string;
  shopQty?: number | null;
  reason?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.role) {
      return { success: false, error: "Unauthorized" };
    }

    const reason = (data.reason && data.reason.trim().length >= 3)
      ? data.reason.trim()
      : "Physical stock count verification (Godown & Shop)";

    if (data.godownQty != null && data.godownQty >= 0) {
      await godownService.setStockCount(session.user.role, session.user.id, {
        productId: data.productId,
        locationId: data.godownLocationId,
        countedQty: data.godownQty,
        reason: `${reason} [Godown]`,
      });
    }

    if (data.shopLocationId && data.shopQty != null && data.shopQty >= 0) {
      await godownService.setStockCount(session.user.role, session.user.id, {
        productId: data.productId,
        locationId: data.shopLocationId,
        countedQty: data.shopQty,
        reason: `${reason} [Shop]`,
      });
    }

    revalidatePath("/godown/stock");
    revalidatePath("/godown/stock/update");
    revalidatePath("/admin");
    revalidatePath("/store");
    revalidatePath("/");

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update stock",
    };
  }
}

export async function bulkUpdateProductsStockBothLocationsAction(data: {
  godownLocationId: string;
  shopLocationId?: string;
  reason?: string;
  updates: Array<{
    productId: string;
    godownQty?: number | null;
    shopQty?: number | null;
  }>;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.role) {
      return { success: false, error: "Unauthorized" };
    }

    const baseReason = (data.reason && data.reason.trim().length >= 3)
      ? data.reason.trim()
      : "Bulk physical stock count verification (Godown & Shop)";

    for (const update of data.updates) {
      if (update.godownQty != null && update.godownQty >= 0) {
        await godownService.setStockCount(session.user.role, session.user.id, {
          productId: update.productId,
          locationId: data.godownLocationId,
          countedQty: update.godownQty,
          reason: `${baseReason} [Godown]`,
        });
      }
      if (data.shopLocationId && update.shopQty != null && update.shopQty >= 0) {
        await godownService.setStockCount(session.user.role, session.user.id, {
          productId: update.productId,
          locationId: data.shopLocationId,
          countedQty: update.shopQty,
          reason: `${baseReason} [Shop]`,
        });
      }
    }

    revalidatePath("/godown/stock");
    revalidatePath("/godown/stock/update");
    revalidatePath("/admin");
    revalidatePath("/store");
    revalidatePath("/");

    return { success: true, count: data.updates.length };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to bulk update stock",
    };
  }
}

