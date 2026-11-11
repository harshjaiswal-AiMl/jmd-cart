import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/lib/search/product-search.server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    if (!q || q.length < 1) {
      return NextResponse.json({ products: [] });
    }
    const { items } = await searchProducts({
      q,
      limit: 8,
      offset: 0,
      storefrontOnly: true,
    });
    const formatted = items.map((p) => ({
      id: p.id,
      name: p.name,
      shortCode: p.shortCode,
      weight: p.weight,
      imageUrl: p.imageUrl,
      companyName: p.companyName,
      categoryName: p.categoryName,
      priceRupees: (p.priceCPaise ?? p.mrpPaise ?? 0) / 100,
      mrpRupees: (p.mrpPaise ?? 0) / 100,
      inStock: p.inStock,
      godownStock: p.availableStock,
    }));
    return NextResponse.json({ products: formatted });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: msg, products: [] }, { status: 500 });
  }
}
