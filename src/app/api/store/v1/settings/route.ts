import { NextRequest } from "next/server";
import { storeService } from "@/modules/store/store.service";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(_req: NextRequest) {
  try {
    const settings = await storeService.getStorefrontSettings();
    return apiSuccess(settings, undefined, {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1200",
    });
  } catch (err: any) {
    return apiError(err.message || "Failed to fetch settings", 500, "SERVER_ERROR");
  }
}
