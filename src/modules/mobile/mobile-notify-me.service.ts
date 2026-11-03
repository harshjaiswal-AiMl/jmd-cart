import { prisma } from "@/lib/prisma";

export class MobileNotifyMeService {
  /**
   * Registers a back-in-stock notification request.
   */
  static async requestBackInStockNotification(params: {
    productId: string;
    userId?: string | null;
    phone?: string | null;
    deviceId?: string | null;
    fcmToken?: string | null;
  }) {
    const { productId, userId, phone, deviceId, fcmToken } = params;

    // Check if request already exists
    const existing = await prisma.productNotificationRequest.findFirst({
      where: {
        productId,
        status: "PENDING",
        OR: [
          ...(userId ? [{ userId }] : []),
          ...(deviceId ? [{ deviceId }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
    });

    if (existing) {
      return { success: true, message: "Notification already requested", request: existing };
    }

    const request = await prisma.productNotificationRequest.create({
      data: {
        productId,
        userId: userId || null,
        phone: phone || null,
        deviceId: deviceId || null,
        fcmToken: fcmToken || null,
        status: "PENDING",
      },
    });

    return { success: true, message: "We will notify you when this item is back in stock!", request };
  }

  /**
   * Checks pending requests for a product and notifies users (called when stock increases).
   */
  static async notifyBackInStock(productId: string) {
    const pending = await prisma.productNotificationRequest.findMany({
      where: {
        productId,
        status: "PENDING",
      },
      include: {
        product: { select: { name: true } },
      },
    });

    if (pending.length === 0) return { notifiedCount: 0 };

    const productTitle = pending[0]?.product?.name || "Product";

    for (const req of pending) {
      // Mark as SENT
      await prisma.productNotificationRequest.update({
        where: { id: req.id },
        data: {
          status: "SENT",
          notifiedAt: new Date(),
        },
      });
    }

    return { notifiedCount: pending.length, title: productTitle };
  }
}
