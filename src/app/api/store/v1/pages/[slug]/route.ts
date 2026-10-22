import { NextRequest } from "next/server";
import { storeService } from "@/modules/store/store.service";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug;
    if (!slug) {
      return apiError("Page slug is required", 400, "MISSING_SLUG");
    }

    const page = await storeService.getStorePageBySlug(slug);
    if (!page) {
      return apiError("Page not found", 404, "NOT_FOUND");
    }

    return apiSuccess(page, undefined, {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1200",
    });
  } catch (err: any) {
    return apiError(err.message || "Failed to fetch store page", 500, "SERVER_ERROR");
  }
}
