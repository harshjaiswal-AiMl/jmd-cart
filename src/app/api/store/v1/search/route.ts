import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { queryRankedProductIds } from "@/modules/stock/availability";
import { getMobileAuthUser } from "@/modules/mobile/mobile-auth.middleware";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "15", 10)));

    if (!q || q.length < 1) {
      return NextResponse.json({
        suggestions: [],
        products: [],
      });
    }

    const user = await getMobileAuthUser(req);
    const buyerType = user?.buyerApproved ? user.buyerType : "CUSTOMER";

    const tokens = q.trim().split(/\s+/).filter(Boolean);
    const tokenConditions = tokens.map((token) => {
      const pattern = `%${token}%`;
      return Prisma.sql`(
        p.short_code ILIKE ${pattern}
        OR p.name ILIKE ${pattern}
        OR COALESCE(p.weight, '') ILIKE ${pattern}
        OR EXISTS (
          SELECT 1 FROM companies c WHERE c.id = p.company_id AND c.name ILIKE ${pattern}
        )
        OR EXISTS (
          SELECT 1 FROM categories cat WHERE cat.id = p.category_id AND cat.name ILIKE ${pattern}
        )
      )`;
    });

    const whereSql = Prisma.sql`
      p.active = true
      AND (COALESCE(p.mrp_paise, 0) > 0 OR COALESCE(p.price_c_paise, 0) > 0)
      AND ${Prisma.join(tokenConditions, " AND ")}
    `;

    const { productIds } = await queryRankedProductIds("STOREFRONT", {
      whereSql,
      limit,
      offset: 0,
    });

    if (productIds.length === 0) {
      return NextResponse.json({
        suggestions: [],
        products: [],
      });
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
      .filter((p): p is (typeof productsRaw)[0] => Boolean(p))
      .map((p) => {
        const totalStock = p.stockBalances.reduce((sum, sb) => sum + (sb.qty || 0), 0);
        const inStock = totalStock > 0;

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
          inStock,
          imageUrl: p.imageUrl,
          companyName: p.company?.name ?? null,
          categoryName: p.category?.name ?? null,
          packSize: p.packSize,
          packLabel: p.packLabel,
        };
      });

    // Generate auto-complete suggestions from matched products/brands
    const suggestions = Array.from(
      new Set(
        products
          .slice(0, 5)
          .map((p) => p.name)
          .concat(products.filter((p) => p.companyName).map((p) => p.companyName!))
      )
    ).slice(0, 6);

    return NextResponse.json({
      suggestions,
      products,
    }, {
      headers: {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Search failed", products: [] }, { status: 500 });
  }
}
