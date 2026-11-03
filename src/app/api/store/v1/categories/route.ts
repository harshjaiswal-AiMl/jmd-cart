import { NextResponse } from "next/server";
import { storeService } from "@/modules/store/store.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const filterOptions = await storeService.getFilterOptions();
  return NextResponse.json({
    categories: filterOptions.categories.map((c: any) => ({
      id: c.id,
      name: c.name,
      imageUrl: c.imageUrl || null,
      productCount: c.productCount || 0,
    })),
  }, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
    },
  });
}
