import { NextRequest } from "next/server";
import { storeService } from "@/modules/store/store.service";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") || "";

    const suggestions = await storeService.getSearchSuggestions(q);

    return apiSuccess(suggestions, undefined, {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
    });
  } catch (err: any) {
    return apiError(err.message || "Failed to get search suggestions", 500, "SERVER_ERROR");
  }
}
