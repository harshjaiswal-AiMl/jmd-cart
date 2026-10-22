import { NextRequest } from "next/server";
import { storeService } from "@/modules/store/store.service";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(
  _req: NextRequest,
  { params }: { params: { menu: string } }
) {
  try {
    const menu = params.menu;
    if (!menu) {
      return apiError("Menu identifier is required", 400, "MISSING_MENU");
    }

    const items = await storeService.getMenuItems(menu);
    return apiSuccess(items, undefined, {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1200",
    });
  } catch (err: any) {
    return apiError(err.message || "Failed to fetch menu items", 500, "SERVER_ERROR");
  }
}
