"use server";

import { auth } from "@/auth";
import { diwaliService } from "@/modules/diwali/diwali.service";
import { DiwaliStoreConfig, diwaliStoreConfigSchema } from "@/modules/diwali/diwali.types";
import { revalidatePath } from "next/cache";

export interface DiwaliActionResult {
  success?: boolean;
  error?: string;
  config?: DiwaliStoreConfig;
}

export async function saveDiwaliConfigAction(
  config: DiwaliStoreConfig
): Promise<DiwaliActionResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized: Please log in." };
  }

  const role = session.user.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
    return { error: "Forbidden: You do not have permission to manage storefront settings." };
  }

  try {
    const validated = diwaliStoreConfigSchema.parse(config);
    const saved = await diwaliService.saveConfig(validated);

    revalidatePath("/store");
    revalidatePath("/admin/diwali");
    return { success: true, config: saved };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to save Diwali configuration";
    return { error: msg };
  }
}
