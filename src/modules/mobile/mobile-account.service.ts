import { prisma } from "@/lib/prisma";

export class MobileAccountService {
  /**
   * Google Play compliant account deletion.
   * Anonymizes user identifiers and deletes personal addresses and cart,
   * while safely preserving legal tax & invoice records as required by Indian accounting law.
   */
  static async deleteAccount(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // 1. Delete user addresses
    await prisma.userAddress.deleteMany({
      where: { userId },
    });

    // 2. Delete cart & cart items
    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (cart) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      await prisma.cart.delete({ where: { id: cart.id } });
    }

    // 3. Delete wishlist items
    await prisma.wishlistItem.deleteMany({
      where: { userId },
    });

    // 4. Delete saved shopping lists
    await prisma.savedShoppingList.deleteMany({
      where: { userId },
    });

    // 5. Revoke all refresh tokens
    await prisma.appRefreshToken.updateMany({
      where: { userId },
      data: { revoked: true },
    });

    // 6. Unregister all devices
    await prisma.customerDevice.updateMany({
      where: { userId },
      data: { userId: null, fcmToken: null },
    });

    // 7. Anonymize user record (preserve ID so foreign keys on legal invoices/orders don't break)
    const anonymizedPhone = `deleted_${Date.now()}_${user.id.slice(0, 6)}`;
    await prisma.user.update({
      where: { id: userId },
      data: {
        name: "Deleted Account",
        phone: anonymizedPhone,
        email: null,
        active: false,
        buyerApproved: false,
      },
    });

    return {
      success: true,
      message: "Your account and personal data have been deleted successfully. Financial and order history is retained for statutory tax compliance.",
    };
  }
}
