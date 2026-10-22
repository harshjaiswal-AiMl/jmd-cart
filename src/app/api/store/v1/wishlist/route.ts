import { NextRequest } from "next/server";
import { z } from "zod";
import { wishlistService } from "@/modules/wishlist";
import { apiSuccess, apiError } from "@/lib/api-response";
import { auth } from "@/auth";

const addSchema = z.object({
  productId: z.string().min(1),
});

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiSuccess([]);
    }

    const items = await wishlistService.getUserWishlist(session.user.id);
    return apiSuccess(items);
  } catch (err: any) {
    return apiError(err.message || "Failed to get wishlist", 500, "SERVER_ERROR");
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError("Please log in to add items to your wishlist", 401, "UNAUTHORIZED");
    }

    const body = await req.json();
    const parsed = addSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid payload", 400, "VALIDATION_ERROR", parsed.error.format());
    }

    const item = await wishlistService.toggleWishlist(session.user.id, parsed.data.productId);
    return apiSuccess(item);
  } catch (err: any) {
    return apiError(err.message || "Failed to add to wishlist", 500, "SERVER_ERROR");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError("Please log in to manage your wishlist", 401, "UNAUTHORIZED");
    }

    const url = new URL(req.url);
    const productId = url.searchParams.get("productId");
    if (!productId) {
      return apiError("Product ID is required", 400, "MISSING_PRODUCT_ID");
    }

    await wishlistService.removeFromWishlist(session.user.id, productId);
    return apiSuccess({ removed: true });
  } catch (err: any) {
    return apiError(err.message || "Failed to remove from wishlist", 500, "SERVER_ERROR");
  }
}
