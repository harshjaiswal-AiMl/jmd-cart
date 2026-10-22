import { NextRequest } from "next/server";
import { storeService } from "@/modules/store/store.service";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { auth } from "@/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug;
    if (!slug) {
      return apiError("Product slug is required", 400, "MISSING_SLUG");
    }

    const session = await auth();
    let buyerType = "CUSTOMER";
    let buyerApproved = false;

    if (session?.user?.id) {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { buyerType: true, buyerApproved: true },
      });
      if (dbUser?.buyerApproved && dbUser.buyerType) {
        buyerType = dbUser.buyerType;
        buyerApproved = true;
      }
    }

    const product = await storeService.getProductBySlug(slug, {
      buyerType,
      buyerApproved,
    });

    if (!product) {
      return apiError("Product not found", 404, "NOT_FOUND");
    }

    return apiSuccess(product, undefined, {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    });
  } catch (err: any) {
    return apiError(err.message || "Failed to fetch product", 500, "SERVER_ERROR");
  }
}
