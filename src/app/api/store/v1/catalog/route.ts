import { NextRequest } from "next/server";
import { z } from "zod";
import { storeService } from "@/modules/store/store.service";
import { apiSuccess, apiError } from "@/lib/api-response";

const querySchema = z.object({
  q: z.string().optional(),
  companyId: z.string().optional(),
  categoryId: z.string().optional(),
  companySlug: z.string().optional(),
  categorySlug: z.string().optional(),
  inStockOnly: z.enum(["true", "false", "1", "0"]).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  sort: z.enum(["name_asc", "price_asc", "price_desc", "newest"]).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));

    if (!parsed.success) {
      return apiError("Invalid query parameters", 400, "VALIDATION_ERROR", parsed.error.format());
    }

    const { inStockOnly, ...rest } = parsed.data;
    const result = await storeService.getCatalogue({
      ...rest,
      inStockOnly: inStockOnly === "true" || inStockOnly === "1",
    });

    return apiSuccess(result, undefined, {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    });
  } catch (err: any) {
    return apiError(err.message || "Failed to fetch catalogue", 500, "SERVER_ERROR");
  }
}
