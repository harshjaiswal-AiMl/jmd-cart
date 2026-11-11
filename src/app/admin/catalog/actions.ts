"use server";

import { auth } from "@/auth";
import { catalogService } from "@/modules/catalog/catalog.service";
import { settingsService } from "@/modules/settings/settings.service";
import { revalidatePath } from "next/cache";

export interface CatalogActionResult {
  success?: boolean;
  error?: string;
  productId?: string;
  updatedCount?: number;
  skippedMissingMrp?: number;
}

function parseOptionalRupeesToPaise(val: FormDataEntryValue | null): number | null {
  if (val == null || String(val).trim() === "") return null;
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
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
    const mrpPaise = parseOptionalRupeesToPaise(formData.get("mrpRupees"));
    const priceAPaise = parseOptionalRupeesToPaise(formData.get("priceARupees"));
    const priceBPaise = parseOptionalRupeesToPaise(formData.get("priceBRupees"));
    const priceCPaise = parseOptionalRupeesToPaise(formData.get("priceCRupees"));

    const nameHiRaw = ((formData.get("nameHi") as string) || "").trim() || null;
    const rawData = {
      name: formData.get("name") as string,
      nameHi: nameHiRaw,
      nameHiSource: nameHiRaw ? "MANUAL" : null,
      shortCode: formData.get("shortCode") as string,
      weight: (formData.get("weight") as string) || null,
      companyId: (formData.get("companyId") as string) || undefined,
      categoryId: (formData.get("categoryId") as string) || undefined,
      hsn: (formData.get("hsn") as string) || "0000",
      gstRateBp: Number(formData.get("gstRateBp") || 0),
      mrpPaise,
      priceAPaise,
      priceBPaise,
      priceCPaise,
      packSize: Number(formData.get("packSize") || 1),
      packLabel: (formData.get("packLabel") as string) || "Carton",
      reorderLevel: Number(formData.get("reorderLevel") || 0),
      imageUrl: (formData.get("imageUrl") as string)?.trim() || null,
      active: (() => {
        const raw = formData.get("active");
        return raw === null ? true : raw === "true" || raw === "on";
      })(),
    };

    const product = await catalogService.createProduct(
      session.user.role,
      session.user.id,
      rawData
    );

    revalidatePath("/admin/catalog");
    revalidatePath("/admin/catalog/price-lists");
    revalidatePath("/store");
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
    const hasNameHi = formData.has("nameHi");
    const nameHiRaw = hasNameHi ? (((formData.get("nameHi") as string) || "").trim() || null) : undefined;
    const rawData: Record<string, any> = {
      name: formData.get("name") as string,
      ...(hasNameHi ? { nameHi: nameHiRaw, nameHiSource: nameHiRaw ? "MANUAL" : null } : {}),
      shortCode: formData.get("shortCode") as string,
      weight: (formData.get("weight") as string) || null,
      companyId: (formData.get("companyId") as string) || null,
      categoryId: (formData.get("categoryId") as string) || null,
      hsn: formData.get("hsn") as string,
      gstRateBp: Number(formData.get("gstRateBp")),
      mrpPaise: parseOptionalRupeesToPaise(formData.get("mrpRupees")),
      priceAPaise: parseOptionalRupeesToPaise(formData.get("priceARupees")),
      priceBPaise: parseOptionalRupeesToPaise(formData.get("priceBRupees")),
      priceCPaise: parseOptionalRupeesToPaise(formData.get("priceCRupees")),
      packSize: Number(formData.get("packSize")),
      packLabel: formData.get("packLabel") as string,
      reorderLevel: Number(formData.get("reorderLevel")),
      imageUrl: (formData.get("imageUrl") as string)?.trim() || null,
      active: formData.get("active") === "true",
    };

    await catalogService.updateProduct(
      session.user.role,
      session.user.id,
      id,
      rawData
    );

    revalidatePath("/admin/catalog");
    revalidatePath("/admin/catalog/price-lists");
    revalidatePath("/store");
    return { success: true, productId: id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update product";
    return { error: message };
  }
}

export async function updateProductImageAction(
  id: string,
  imageUrl: string | null
): Promise<CatalogActionResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  try {
    await catalogService.updateProduct(
      session.user.role,
      session.user.id,
      id,
      { imageUrl: imageUrl ? imageUrl.trim() : null }
    );

    revalidatePath("/admin/catalog");
    revalidatePath("/store");
    return { success: true, productId: id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update image";
    return { error: message };
  }
}

export async function updateProductPricesInlineAction(input: {
  id: string;
  mrpPaise: number | null;
  priceAPaise: number | null;
  priceBPaise: number | null;
  priceCPaise: number | null;
  packSize?: number;
  tierModes?: { a?: "PERCENT" | "RATE"; b?: "PERCENT" | "RATE"; c?: "PERCENT" | "RATE" };
}): Promise<CatalogActionResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  try {
    await catalogService.updateProductPrices(
      session.user.role,
      session.user.id,
      input.id,
      {
        mrpPaise: input.mrpPaise,
        priceAPaise: input.priceAPaise,
        priceBPaise: input.priceBPaise,
        priceCPaise: input.priceCPaise,
        ...(input.packSize !== undefined ? { packSize: input.packSize } : {}),
      }
    );

    if (input.tierModes) {
      await settingsService.mergeProductTierModes({
        [input.id]: input.tierModes,
      });
    }

    revalidatePath("/admin/catalog");
    revalidatePath("/admin/catalog/price-lists");
    revalidatePath("/store");
    return { success: true, productId: input.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update prices" };
  }
}

export async function bulkSetPricesPercentOffMrpAction(input: {
  productIds: string[];
  pctA: number;
  pctB: number;
  pctC: number;
}): Promise<CatalogActionResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  try {
    const res = await catalogService.bulkSetPricesPercentOffMrp(
      session.user.role,
      session.user.id,
      input
    );

    if (input.productIds.length > 0) {
      const modeMap: Record<string, { a: "PERCENT"; b: "PERCENT"; c: "PERCENT" }> = {};
      for (const pid of input.productIds) {
        modeMap[pid] = { a: "PERCENT", b: "PERCENT", c: "PERCENT" };
      }
      await settingsService.mergeProductTierModes(modeMap);
    }

    revalidatePath("/admin/catalog");
    revalidatePath("/admin/catalog/price-lists");
    revalidatePath("/store");
    return {
      success: true,
      updatedCount: res.updatedCount,
      skippedMissingMrp: res.skippedMissingMrp,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to apply bulk % off MRP" };
  }
}

export async function toggleQuantityTierPricingAction(
  enableQuantityTierPricing: boolean
): Promise<CatalogActionResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  try {
    await settingsService.updatePricingSettings(
      session.user.role,
      session.user.id,
      { enableQuantityTierPricing }
    );
    revalidatePath("/admin/catalog/price-lists");
    revalidatePath("/admin/pricing");
    revalidatePath("/store");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update pricing setting" };
  }
}

export async function deleteProductAction(id: string): Promise<CatalogActionResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  try {
    const res = await catalogService.deleteProduct(
      session.user.role,
      session.user.id,
      id
    );

    revalidatePath("/admin/catalog");
    revalidatePath("/admin/catalog/price-lists");
    revalidatePath("/store");
    return { success: true, error: undefined };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete product" };
  }
}

export async function bulkDeleteProductsAction(
  productIds: string[]
): Promise<CatalogActionResult & { deletedCount?: number; deactivatedCount?: number }> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  try {
    const res = await catalogService.bulkDeleteProducts(
      session.user.role,
      session.user.id,
      productIds
    );

    revalidatePath("/admin/catalog");
    revalidatePath("/admin/catalog/price-lists");
    revalidatePath("/store");
    return {
      success: true,
      deletedCount: res.deletedCount,
      deactivatedCount: res.deactivatedCount,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to bulk delete products" };
  }
}

export async function bulkUpdateProductsAction(input: {
  productIds: string[];
  companyId?: string | null;
  categoryId?: string | null;
  packSize?: number;
  packLabel?: string;
  gstRateBp?: number;
  active?: boolean;
  mrpPaise?: number | null;
  priceAPaise?: number | null;
  priceBPaise?: number | null;
  priceCPaise?: number | null;
}): Promise<CatalogActionResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  try {
    const res = await catalogService.bulkUpdateProducts(
      session.user.role,
      session.user.id,
      input
    );

    revalidatePath("/admin/catalog");
    revalidatePath("/admin/catalog/price-lists");
    revalidatePath("/store");
    return { success: true, updatedCount: res.updatedCount };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to bulk update products" };
  }
}

export async function bulkCreateProductsAction(items: Array<any>): Promise<{
  success?: boolean;
  error?: string;
  createdCount?: number;
  errors?: Array<{ index: number; name: string; error: string }>;
}> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  try {
    const res = await catalogService.bulkCreateProducts(
      session.user.role,
      session.user.id,
      items
    );

    revalidatePath("/admin/catalog");
    revalidatePath("/admin/catalog/price-lists");
    revalidatePath("/shop/pos");
    revalidatePath("/store");
    return { success: true, createdCount: res.createdCount, errors: res.errors };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to bulk create products" };
  }
}

