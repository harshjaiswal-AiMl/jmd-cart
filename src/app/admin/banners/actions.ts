"use server";

import { auth } from "@/auth";
import { bannerService } from "@/modules/banners/banner.service";
import { StoreBanner, storeBannerSchema } from "@/modules/banners/banner.types";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export interface BannerActionResult {
  success?: boolean;
  error?: string;
}

export async function saveBannersAction(banners: StoreBanner[]): Promise<BannerActionResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: "Unauthorized" };
  }

  const role = session.user.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
    return { error: "Forbidden: insufficient permissions" };
  }

  try {
    const validated = z.array(storeBannerSchema).parse(banners);
    await bannerService.saveBanners(validated);

    revalidatePath("/store");
    revalidatePath("/admin/banners");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to save banners";
    return { error: msg };
  }
}
