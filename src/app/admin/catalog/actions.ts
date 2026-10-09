"use server";

import { auth } from "@/auth";
import { catalogService } from "@/modules/catalog/catalog.service";
import { revalidatePath } from "next/cache";

export interface CatalogActionResult {
  success?: boolean;
  error?: string;
  productId?: string;
}

export async function createProductAction(
  prevState: CatalogActionResult | undefined,
  formData: FormData
): Promise<CatalogActionResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  try {
    const rawData = {
      name: formData.get("name") as string,
      shortCode: formData.get("shortCode") as string,
      companyId: (formData.get("companyId") as string) || undefined,
      categoryId: (formData.get("categoryId") as string) || undefined,
      hsn: formData.get("hsn") as string,
      gstRateBp: Number(formData.get("gstRateBp")),
      mrpPaise: Math.round(Number(formData.get("mrpRupees")) * 100),
      packSize: Number(formData.get("packSize") || 1),
      packLabel: (formData.get("packLabel") as string) || "Carton",
      reorderLevel: Number(formData.get("reorderLevel") || 0),
      active: formData.get("active") === "true" || formData.get("active") === "on",
    };

    const product = await catalogService.createProduct(
      session.user.role,
      session.user.id,
      rawData
    );

    revalidatePath("/admin/catalog");
    return { success: true, productId: product.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create product";
    return { error: message };
  }
}

export async function updateProductAction(
  prevState: CatalogActionResult | undefined,
  formData: FormData
): Promise<CatalogActionResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  const id = formData.get("id") as string;
  if (!id) {
    return { error: "Product ID is required" };
  }

  try {
    const rawData: Record<string, any> = {
      name: formData.get("name") as string,
      shortCode: formData.get("shortCode") as string,
      companyId: (formData.get("companyId") as string) || null,
      categoryId: (formData.get("categoryId") as string) || null,
      hsn: formData.get("hsn") as string,
      gstRateBp: Number(formData.get("gstRateBp")),
      mrpPaise: Math.round(Number(formData.get("mrpRupees")) * 100),
      packSize: Number(formData.get("packSize")),
      packLabel: formData.get("packLabel") as string,
      reorderLevel: Number(formData.get("reorderLevel")),
      active: formData.get("active") === "true",
    };

    await catalogService.updateProduct(
      session.user.role,
      session.user.id,
      id,
      rawData
    );

    revalidatePath("/admin/catalog");
    return { success: true, productId: id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update product";
    return { error: message };
  }
}
