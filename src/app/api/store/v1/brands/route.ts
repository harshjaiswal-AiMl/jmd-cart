import { NextResponse } from "next/server";
import { storeService } from "@/modules/store/store.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const filterOptions = await storeService.getFilterOptions();
  return NextResponse.json({
    brands: filterOptions.companies.map((comp: any) => ({
      id: comp.id,
      name: comp.name,
      productCount: comp.productCount || 0,
    })),
  }, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
    },
  });
}
