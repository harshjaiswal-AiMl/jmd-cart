"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { dataQualityService } from "@/modules/catalog/data-quality.service";

export async function bulkDeactivateProductsAction(input: {
  productIds: string[];
  reason: string;
}) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const res = await dataQualityService.bulkDeactivateProducts(
    session.user.role,
    session.user.id,
    input.productIds,
    input.reason || "Catalog data-quality cleanup"
  );

  revalidatePath("/admin/catalog");
  revalidatePath("/admin/catalog/data-quality");
  revalidatePath("/shop/pos");

  return res;
}
