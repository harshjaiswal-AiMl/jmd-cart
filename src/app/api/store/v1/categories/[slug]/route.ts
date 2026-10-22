import { NextRequest } from "next/server";
import { storeService } from "@/modules/store/store.service";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug;
    if (!slug) {
      return apiError("Category slug is required", 400, "MISSING_SLUG");
    }

    const category = await storeService.getCategoryBySlug(slug);
    if (!category) {
      return apiError("Category not found", 404, "NOT_FOUND");
    }

    return apiSuccess(category, undefined, {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
    });
  } catch (err: any) {
    return apiError(err.message || "Failed to fetch category", 500, "SERVER_ERROR");
  }
}
