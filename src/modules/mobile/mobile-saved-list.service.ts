import { prisma } from "@/lib/prisma";
import { cartService } from "../cart/cart.service";

export class MobileSavedListService {
  /**
   * Retrieves all saved shopping lists for a user.
   */
  static async getUserLists(userId: string) {
    return prisma.savedShoppingList.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                mrpPaise: true,
                priceCPaise: true,
                priceBPaise: true,
                priceAPaise: true,
                packSize: true,
                packLabel: true,
                weight: true,
                active: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  /**
   * Creates a new saved shopping list.
   */
  static async createList(userId: string, name: string, items: Array<{ productId: string; quantity: number; unit?: string }>) {
    return prisma.savedShoppingList.create({
      data: {
        userId,
        name: name.trim() || "My Shopping List",
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: Math.max(1, item.quantity),
            unit: item.unit || "Pcs",
          })),
        },
      },
      include: {
        items: true,
      },
    });
  }

  /**
   * Deletes a saved list.
   */
  static async deleteList(userId: string, listId: string) {
    const list = await prisma.savedShoppingList.findUnique({
      where: { id: listId },
    });
    if (!list || list.userId !== userId) {
      throw new Error("List not found or permission denied");
    }
    await prisma.savedShoppingList.delete({
      where: { id: listId },
    });
    return { success: true };
  }

  /**
   * One-tap add all items from a saved list directly into the user's active cart.
   */
  static async addAllToCart(userId: string, listId: string) {
    const list = await prisma.savedShoppingList.findUnique({
      where: { id: listId },
      include: { items: true },
    });

    if (!list || list.userId !== userId) {
      throw new Error("List not found");
    }

    const addedItems = [];
    for (const item of list.items) {
      try {
        await cartService.addToCart(userId, item.productId, item.quantity);
        addedItems.push(item.productId);
      } catch (err) {
        console.warn(`[SavedList] Could not add product ${item.productId} to cart:`, err);
      }
    }

    const cartSummary = await cartService.getCartSummary(userId);
    return {
      success: true,
      addedCount: addedItems.length,
      cart: cartSummary,
    };
  }
}
