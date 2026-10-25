"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { receivingService } from "@/modules/ocr/receiving.service";

export async function createBillScanAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const locationId = formData.get("locationId") as string;
  const supplierPartyId = (formData.get("supplierPartyId") as string) || null;
  const companyId = (formData.get("companyId") as string) || null;

  if (!locationId) {
    return { error: "Receiving location is required" };
  }

  const files: Array<{ buffer: Buffer; mimeType: string; originalName: string }> = [];
  const formFiles = formData.getAll("files") as File[];

  for (const f of formFiles) {
    if (f.size > 0) {
      const arrayBuffer = await f.arrayBuffer();
      files.push({
        buffer: Buffer.from(arrayBuffer),
        mimeType: f.type,
        originalName: f.name,
      });
    }
  }

  if (files.length === 0) {
    return { error: "Please capture or select at least one bill photo or PDF document" };
  }

  try {
    const scan = await receivingService.createScan(session.user.role, session.user.id, {
      locationId,
      supplierPartyId,
      companyId,
      files,
    });

    revalidatePath("/godown/receive-goods");
    return { success: true, scanId: scan.id };
  } catch (err: unknown) {
    console.error("Failed to create bill scan:", err);
    return { error: (err as Error).message || "Failed to process bill scan" };
  }
}

export async function updateLineCountAction(
  lineId: string,
  data: {
    productId?: string | null;
    countedCartons: number;
    countedLoose: number;
    varianceReason?: string | null;
  }
) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  try {
    const updated = await receivingService.updateLineCount(session.user.role, lineId, data);
    return { success: true, line: updated };
  } catch (err: unknown) {
    return { error: (err as Error).message || "Failed to update item count" };
  }
}

export async function updateLineBilledQtyAction(
  lineId: string,
  data: {
    billedQty: number;
    billedUnit?: string;
  }
) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  try {
    const updated = await receivingService.updateLineBilledQty(session.user.role, lineId, data);
    return { success: true, line: updated };
  } catch (err: unknown) {
    return { error: (err as Error).message || "Failed to update billed quantity" };
  }
}

export async function deleteLineAction(lineId: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  try {
    await receivingService.deleteLine(session.user.role, lineId);
    return { success: true };
  } catch (err: unknown) {
    return { error: (err as Error).message || "Failed to remove line" };
  }
}

export async function confirmAllAsBilledAction(scanId: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  try {
    const scan = await receivingService.confirmAllAsBilled(session.user.role, scanId);
    revalidatePath(`/godown/receive-goods/${scanId}`);
    return { success: true, scan };
  } catch (err: unknown) {
    return { error: (err as Error).message || "Failed to confirm all as billed" };
  }
}

export async function postGoodsReceiptAction(scanId: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  try {
    const scan = await receivingService.postGoodsReceipt(
      session.user.role,
      session.user.id,
      scanId
    );

    revalidatePath("/godown/receive-goods");
    revalidatePath(`/godown/receive-goods/${scanId}`);
    revalidatePath("/godown/stock");
    revalidatePath("/godown/purchases");

    return { success: true, scan };
  } catch (err: unknown) {
    return { error: (err as Error).message || "Failed to post goods receipt" };
  }
}
