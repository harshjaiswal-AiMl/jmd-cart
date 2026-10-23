import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { queryRankedProductIds } from "@/modules/stock/availability";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();

    if (!q || q.length < 1) {
      return NextResponse.json({ products: [] });
    }

    const pattern = `%${q}%`;
    const whereSql = Prisma.sql`
      p.active = true
      AND (COALESCE(p.mrp_paise, 0) > 0 OR COALESCE(p.price_c_paise, 0) > 0)
      AND (
        p.short_code ILIKE ${pattern}
        OR p.name ILIKE ${pattern}
        OR EXISTS (
          SELECT 1 FROM companies c WHERE c.id = p.company_id AND c.name ILIKE ${pattern}
        )
        OR EXISTS (
          SELECT 1 FROM categories cat WHERE cat.id = p.category_id AND cat.name ILIKE ${pattern}
        )
      )
    `;

    const { productIds } = await queryRankedProductIds("STOREFRONT", {
      whereSql,
      limit: 8,
      offset: 0,
    });

    if (productIds.length === 0) {
      return NextResponse.json({ products: [] });
    }

    const productsRaw = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        company: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        stockBalances: {
          where: {
            location: {
              type: { in: ["GODOWN", "SHOP"] },
              active: true,
            },
          },
          select: { qty: true },
        },
      },
    });

    const productMap = new Map(productsRaw.map((p) => [p.id, p]));
    const products = productIds
      .map((id) => productMap.get(id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));

    const formatted = products.map((p) => {
      const availableStock = p.stockBalances.reduce((sum, sb) => sum + sb.qty, 0);
      const priceRupees = (p.priceCPaise ?? p.mrpPaise ?? 0) / 100;
      const mrpRupees = (p.mrpPaise ?? 0) / 100;

      return {
        id: p.id,
        name: p.name,
        shortCode: p.shortCode,
        weight: p.weight,
        imageUrl: p.imageUrl,
        companyName: p.company?.name || null,
        categoryName: p.category?.name || null,
        priceRupees,
        mrpRupees,
        inStock: availableStock > 0,
        godownStock: availableStock,
      };
    });

    return NextResponse.json({ products: formatted });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: msg, products: [] }, { status: 500 });
  }
}
