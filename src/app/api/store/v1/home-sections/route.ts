import { NextRequest } from "next/server";
import { storeService } from "@/modules/store/store.service";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(_req: NextRequest) {
  try {
    const sections = await storeService.getHomeSections();
    return apiSuccess(sections, undefined, {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
    });
  } catch (err: any) {
    return apiError(err.message || "Failed to fetch home sections", 500, "SERVER_ERROR");
  }
}
