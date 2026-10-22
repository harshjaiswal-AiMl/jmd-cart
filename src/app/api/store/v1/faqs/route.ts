import { NextRequest } from "next/server";
import { storeService } from "@/modules/store/store.service";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const group = url.searchParams.get("group") || undefined;

    const faqs = await storeService.getFaqs(group);
    return apiSuccess(faqs, undefined, {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1200",
    });
  } catch (err: any) {
    return apiError(err.message || "Failed to fetch FAQs", 500, "SERVER_ERROR");
  }
}
