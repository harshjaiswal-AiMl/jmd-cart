"use server";

import { auth } from "@/auth";
import { pricingService } from "@/modules/pricing/pricing.service";
import { CreatePriceSlabInput } from "@/modules/pricing/pricing.types";

export async function getPricingSlabsAction() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  return pricingService.getSlabs();
}

export async function createPricingSlabAction(input: CreatePriceSlabInput) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  return pricingService.createSlab(session.user.role, input, session.user.id);
}

export async function deletePricingSlabAction(slabId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  await pricingService.deleteSlab(session.user.role, slabId, session.user.id);
  return { success: true };
}
