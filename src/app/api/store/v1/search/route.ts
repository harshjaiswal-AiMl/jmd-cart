import { NextRequest, NextResponse } from "next/server";
import { getMobileAuthUser } from "@/modules/mobile/mobile-auth.middleware";
import { searchProducts } from "@/lib/search/product-search.server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "15", 10)));
    if (!q || q.length < 1) {
      return NextResponse.json({ suggestions: [], products: [] });
    }
    const user = await getMobileAuthUser(req);
    const buyerType = user?.buyerApproved ? user.buyerType : "CUSTOMER";
    const { items } = await searchProducts({ q, limit, offset: 0, storefrontOnly: true });
    const products = items.map((p) => {
      let effectivePricePaise = p.priceCPaise ?? p.mrpPaise ?? 0;
      if (buyerType === "WHOLESALER_A" && p.priceAPaise) {
        effectivePricePaise = p.priceAPaise;
      } else if (buyerType === "RETAILER_B" && p.priceBPaise) {
        effectivePricePaise = p.priceBPaise;
      }
      return {
        id: p.id,
        name: p.name,
        shortCode: p.shortCode,
        weight: p.weight,
        mrpPaise: p.mrpPaise,
        effectivePricePaise,
        inStock: p.inStock,
        imageUrl: p.imageUrl,
        companyName: p.companyName,
        categoryName: p.categoryName,
        packSize: p.packSize,
        packLabel: p.packLabel,
      };
    });
    const suggestions = Array.from(
      new Set(products.slice(0, 5).map((p) => p.name).concat(products.filter((p) => p.companyName).map((p) => p.companyName!)))
    ).slice(0, 6);
    return NextResponse.json({ suggestions, products }, {
      headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Search failed", products: [] }, { status: 500 });
  }
}
