import { NextRequest, NextResponse } from "next/server";
import { storeService } from "@/modules/store/store.service";
import { getMobileAuthUser } from "@/modules/mobile/mobile-auth.middleware";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || undefined;
  const categoryId = url.searchParams.get("categoryId") || undefined;
  const companyId = url.searchParams.get("companyId") || url.searchParams.get("brandId") || undefined;
  const inStockOnly = url.searchParams.get("inStockOnly") === "true";
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));

  const user = await getMobileAuthUser(req);
  const buyerType = user?.buyerApproved ? user.buyerType : "CUSTOMER";
  const buyerApproved = Boolean(user?.buyerApproved);

  const result = await storeService.getCatalogue({
    q,
    categoryId,
    companyId,
    inStockOnly,
    limit,
    offset,
    buyerType,
    buyerApproved,
  });

  return NextResponse.json({
    items: result.products,
    total: result.total,
    hasMore: offset + limit < result.total,
    offset,
    limit,
  }, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
    },
  });
}
