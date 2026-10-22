import { NextRequest } from "next/server";
import { storeService } from "@/modules/store/store.service";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const featuredParam = url.searchParams.get("featured");
    const parentIdParam = url.searchParams.get("parentId");

    const categories = await storeService.getCategories({
      featured: featuredParam !== null ? featuredParam === "true" || featuredParam === "1" : undefined,
      parentId: parentIdParam !== null ? parentIdParam : undefined,
    });

    return apiSuccess(categories, undefined, {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
    });
  } catch (err: any) {
    return apiError(err.message || "Failed to fetch categories", 500, "SERVER_ERROR");
  }
}
