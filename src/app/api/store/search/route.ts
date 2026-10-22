import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();

    if (!q || q.length < 1) {
      return NextResponse.json({ products: [] });
    }

    const tokens = q.split(/\s+/).filter(Boolean);
    const nameTokenClauses = tokens.map((token) => ({
      name: { contains: token, mode: "insensitive" as const },
    }));

    const products = await prisma.product.findMany({
      where: {
        active: true,
        OR: [
          { shortCode: { contains: q, mode: "insensitive" } },
          { AND: nameTokenClauses },
          { company: { name: { contains: q, mode: "insensitive" } } },
          { category: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      include: {
        company: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        stockBalances: {
          where: {
            location: {
              type: "GODOWN",
              active: true,
            },
          },
          select: { qty: true },
        },
      },
      take: 8,
      orderBy: { name: "asc" },
    });

    const formatted = products.map((p) => {
      const godownStock = p.stockBalances.reduce((sum, sb) => sum + sb.qty, 0);
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
        inStock: godownStock > 0,
        godownStock,
      };
    });

    return NextResponse.json({ products: formatted });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: msg, products: [] }, { status: 500 });
  }
}
