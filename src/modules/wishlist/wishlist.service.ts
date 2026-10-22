import { prisma } from "@/lib/prisma";
import { WishlistItemDto } from "./wishlist.types";
import { cartService } from "@/modules/cart/cart.service";
import { resolvePrice } from "@/modules/pricing/pricing.service";

export class WishlistService {
  async getUserWishlist(userId: string): Promise<WishlistItemDto[]> {
    if (!prisma.wishlistItem) {
      return [];
    }

    const [user, items] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { buyerType: true, buyerApproved: true },
      }),
      prisma.wishlistItem.findMany({
        where: { userId },
        include: {
          product: {
            include: {
              company: true,
              category: true,
              stockBalances: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const buyerType = user?.buyerApproved ? user.buyerType : "CUSTOMER";

    return items
      .filter((item) => item.product && item.product.active)
      .map((item) => {
        const prod = item.product;
        const totalStock = prod.stockBalances.reduce((acc, sb) => acc + sb.qty, 0);
        const resolved = resolvePrice(prod, buyerType);
        const unitPricePaise = resolved.unitPricePaise;
        const mrpPaise = prod.mrpPaise || unitPricePaise;
        const priceRupees = unitPricePaise / 100;
        const mrpRupees = mrpPaise / 100;
        const savingsRupees = Math.max(0, mrpRupees - priceRupees);
        const discountPercent = mrpRupees > 0 ? Math.round((savingsRupees / mrpRupees) * 100) : 0;

        return {
          id: item.id,
          productId: prod.id,
          name: prod.name,
          shortCode: prod.shortCode,
          weight: prod.weight,
          imageUrl: prod.imageUrl,
          companyName: prod.company?.name || null,
          categoryName: prod.category?.name || null,
          priceRupees,
          mrpRupees,
          savingsRupees,
          discountPercent,
          packSize: prod.packSize || 1,
          packLabel: prod.packLabel || "Carton",
          stockQty: totalStock,
          addedAt: item.createdAt,
          inStock: totalStock > 0,
        };
      })
      .sort((a, b) => {
        if (a.inStock !== b.inStock) {
          return a.inStock ? -1 : 1;
        }
        return b.addedAt.getTime() - a.addedAt.getTime();
      });
  }


  async getWishlistProductIds(userId: string): Promise<string[]> {
    if (!prisma.wishlistItem) {
      return [];
    }

    const list = await prisma.wishlistItem.findMany({
      where: { userId },
      select: { productId: true },
    });

    return list.map((i) => i.productId);
  }

  async getWishlistCount(userId: string): Promise<number> {
    if (!prisma.wishlistItem) {
      return 0;
    }

    return prisma.wishlistItem.count({
      where: { userId },
    });
  }

  async toggleWishlist(
    userId: string,
    productId: string
  ): Promise<{ inWishlist: boolean; count: number }> {
    if (!prisma.wishlistItem) {
      return { inWishlist: false, count: 0 };
    }

    const existing = await prisma.wishlistItem.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });

    if (existing) {
      await prisma.wishlistItem.delete({
        where: { id: existing.id },
      });
      const count = await this.getWishlistCount(userId);
      return { inWishlist: false, count };
    } else {
      await prisma.wishlistItem.create({
        data: {
          userId,
          productId,
        },
      });
      const count = await this.getWishlistCount(userId);
      return { inWishlist: true, count };
    }
  }

  async removeFromWishlist(userId: string, productId: string): Promise<number> {
    if (!prisma.wishlistItem) {
      return 0;
    }

    await prisma.wishlistItem.deleteMany({
      where: { userId, productId },
    });

    return this.getWishlistCount(userId);
  }

  async moveToCart(
    userId: string,
    productId: string,
    qty: number = 1
  ): Promise<{ success: boolean; cartCount: number; wishlistCount: number }> {
    await cartService.addToCart(userId, productId, qty);
    const wishlistCount = await this.removeFromWishlist(userId, productId);
    const cartSummary = await cartService.getCartSummary(userId);

    return {
      success: true,
      cartCount: cartSummary.itemsCount,
      wishlistCount,
    };
  }
}

export const wishlistService = new WishlistService();
