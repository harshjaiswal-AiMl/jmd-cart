import { prisma } from "@/lib/prisma";
import { pricingService } from "@/modules/pricing/pricing.service";
import { BuyerTier, ResolvedLinePrice, OrderPriceResult } from "@/modules/pricing/pricing.types";

export interface CartLineDetail {
  id: string; // cart item id
  productId: string;
  productName: string;
  shortCode: string;
  weight: string | null;
  companyName: string | null;
  categoryName: string | null;
  imageUrl: string | null;
  packSize: number;
  packLabel: string;
  cartonsCount: number;
  looseCount: number;
  qty: number;
  mrpPaise: number;
  gstRateBp: number;
  pricing: ResolvedLinePrice;
}

export interface CartSummary {
  id: string;
  userId: string;
  totalPieces: number;
  itemsCount: number;
  buyerTag: BuyerTier;
  subtotalPaise: number; // MRP sum
  lineDiscountPaise: number;
  taxablePaise: number;
  totalTaxPaise: number;
  roundOffPaise: number;
  totalPaise: number;
  lines: CartLineDetail[];
}

export class CartService {
  /**
   * Get user's cart or create an empty one if not existing.
   */
  async getOrCreateCart(userId: string) {
    let cart = await prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId },
      });
    }

    return cart;
  }

  /**
   * Add a product to the user's cart or increment quantity if already present.
   */
  async addToCart(userId: string, productId: string, qty: number = 1) {
    if (qty <= 0) {
      throw new Error("Quantity must be greater than zero");
    }

    const cart = await this.getOrCreateCart(userId);

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || !product.active) {
      throw new Error("Product is not available for purchase");
    }

    const existingItem = await prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId,
        },
      },
    });

    if (existingItem) {
      return prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { qty: existingItem.qty + qty },
      });
    } else {
      return prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          qty,
        },
      });
    }
  }

  /**
   * Update quantity of an item in the cart.
   * If qty <= 0, item is removed from the cart.
   */
  async updateQuantity(userId: string, productId: string, qty: number) {
    const cart = await this.getOrCreateCart(userId);

    if (qty <= 0) {
      await prisma.cartItem.deleteMany({
        where: {
          cartId: cart.id,
          productId,
        },
      });
      return null;
    }

    return prisma.cartItem.upsert({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId,
        },
      },
      update: { qty },
      create: {
        cartId: cart.id,
        productId,
        qty,
      },
    });
  }

  /**
   * Remove a product from user's cart.
   */
  async removeFromCart(userId: string, productId: string) {
    const cart = await this.getOrCreateCart(userId);
    return prisma.cartItem.deleteMany({
      where: {
        cartId: cart.id,
        productId,
      },
    });
  }

  /**
   * Clear all items in user's cart.
   */
  async clearCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);
    return prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });
  }

  /**
   * Get user's cart with live slab calculations, order buyer tag, GST, and totals.
   */
  async getCartSummary(userId: string): Promise<CartSummary> {
    const cart = await this.getOrCreateCart(userId);

    const [cartItems, user] = await Promise.all([
      prisma.cartItem.findMany({
        where: { cartId: cart.id },
        include: {
          product: {
            include: {
              company: true,
              category: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        include: { party: true },
      }),
    ]);

    if (cartItems.length === 0) {
      return {
        id: cart.id,
        userId,
        totalPieces: 0,
        itemsCount: 0,
        buyerTag: BuyerTier.CUSTOMER,
        subtotalPaise: 0,
        lineDiscountPaise: 0,
        taxablePaise: 0,
        totalTaxPaise: 0,
        roundOffPaise: 0,
        totalPaise: 0,
        lines: [],
      };
    }

    // Prepare items for pricing engine calculation
    const pricingItems = cartItems.map((item) => ({
      productId: item.productId,
      qty: item.qty,
    }));

    const userBuyerType = (user?.party?.type ?? user?.buyerType ?? "CUSTOMER") as BuyerTier;
    const isApprovedBuyer = Boolean(
      user?.buyerApproved ||
      user?.phoneVerifiedAt ||
      (user?.role && user.role !== "CUSTOMER")
    );

    const orderPricing = await pricingService.calculateOrderPricing({
      items: pricingItems,
      partyId: user?.partyId ?? null,
      buyerType: userBuyerType,
      buyerApproved: isApprovedBuyer,
    });

    // Map calculated lines back to cart items with product metadata
    const lineMap = new Map(orderPricing.lines.map((l) => [l.productId, l]));

    const lines: CartLineDetail[] = cartItems.map((item) => {
      const linePricing = lineMap.get(item.productId)!;
      const cartonsCount = Math.floor(item.qty / item.product.packSize);
      const looseCount = item.qty % item.product.packSize;
      const effectiveMrp =
        item.product.mrpPaise ??
        item.product.priceCPaise ??
        item.product.priceBPaise ??
        item.product.priceAPaise ??
        0;

      return {
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        shortCode: item.product.shortCode,
        weight: item.product.weight,
        companyName: item.product.company?.name ?? null,
        categoryName: item.product.category?.name ?? null,
        imageUrl: item.product.imageUrl,
        packSize: item.product.packSize,
        packLabel: item.product.packLabel,
        cartonsCount,
        looseCount,
        qty: item.qty,
        mrpPaise: effectiveMrp,
        gstRateBp: item.product.gstRateBp,
        pricing: linePricing,
      };
    });

    const totalPieces = cartItems.reduce((sum, item) => sum + item.qty, 0);

    return {
      id: cart.id,
      userId,
      totalPieces,
      itemsCount: cartItems.length,
      buyerTag: orderPricing.buyerTag,
      subtotalPaise: orderPricing.subtotalPaise,
      lineDiscountPaise: orderPricing.lineDiscountPaise,
      taxablePaise: orderPricing.taxablePaise,
      totalTaxPaise: orderPricing.totalTaxPaise,
      roundOffPaise: orderPricing.roundOffPaise,
      totalPaise: orderPricing.totalPaise,
      lines,
    };
  }
}

export const cartService = new CartService();
