import { prisma } from "@/lib/prisma";
import webpush from "web-push";
import { OrderAlertState, UserRole } from "@prisma/client";

// Stable fallback development keys if not set in environment
const DEFAULT_DEV_VAPID = {
  publicKey:
    process.env.VAPID_PUBLIC_KEY ||
    "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXY25Athq8o",
  privateKey:
    process.env.VAPID_PRIVATE_KEY ||
    "u4j_m9yA6B63Y9nK6g3T_y27wHqN43k1L7o2X7_N1m8",
};

try {
  webpush.setVapidDetails(
    "mailto:admin@jmdcart.com",
    DEFAULT_DEV_VAPID.publicKey,
    DEFAULT_DEV_VAPID.privateKey
  );
} catch (err: any) {
  console.warn("[PushNotificationService VAPID init]:", err?.message);
}

export interface SendPushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  orderId?: string;
  data?: any;
}

export class PushNotificationService {
  getPublicKey(): string {
    return DEFAULT_DEV_VAPID.publicKey;
  }

  /**
   * Save or update a push subscription for a user.
   */
  async saveSubscription(
    userId: string,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    deviceLabel?: string
  ) {
    return prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        deviceLabel: deviceLabel || "Mobile Device",
        active: true,
      },
      update: {
        userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        deviceLabel: deviceLabel || "Mobile Device",
        active: true,
        lastSeenAt: new Date(),
      },
    });
  }

  /**
   * Remove a push subscription.
   */
  async removeSubscription(endpoint: string) {
    try {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint },
      });
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  /**
   * Deliver push notification payload to active subscriptions of target users.
   */
  async sendToUsers(userIds: string[], payload: SendPushPayload) {
    if (userIds.length === 0) return { sentCount: 0 };

    const subs = await prisma.pushSubscription.findMany({
      where: {
        userId: { in: userIds },
        active: true,
      },
    });

    const stringified = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || "/icons/icon-192.png",
      badge: payload.badge || "/icons/icon-192.png",
      tag: payload.tag || `order-${payload.orderId || Date.now()}`,
      data: {
        url: payload.url || "/app/godown",
        orderId: payload.orderId,
        ...payload.data,
      },
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 600],
      actions: [
        { action: "accept", title: "Accept Order" },
        { action: "open", title: "View Details" },
      ],
    });

    let sentCount = 0;
    const staleEndpoints: string[] = [];

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            stringified,
            {
              urgency: "high",
              TTL: 60 * 60, // 1 hour
            }
          );
          sentCount++;
        } catch (err: any) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            // Subscription expired or invalid
            staleEndpoints.push(sub.endpoint);
          }
        }
      })
    );

    if (staleEndpoints.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint: { in: staleEndpoints } },
      });
    }

    return { sentCount };
  }

  /**
   * Dispatches instant order alerts to warehouse manager(s) when an order is created.
   */
  async triggerOrderAlert(order: {
    id: string;
    number?: string | null;
    orderNumber?: string | null;
    totalAmountPaise?: number;
    totalPaise?: number;
    customerName?: string | null;
    lineCount?: number;
    party?: { name?: string | null } | null;
    items?: any[];
  }) {
    // 1. Find warehouse managers and godown users
    const warehouseUsers = await prisma.user.findMany({
      where: {
        role: { in: [UserRole.WAREHOUSE_MANAGER, UserRole.GODOWN, UserRole.ADMIN, UserRole.SUPER_ADMIN] },
        active: true,
      },
      select: { id: true, name: true, role: true },
    });

    if (warehouseUsers.length === 0) {
      return { success: false, reason: "No warehouse users found" };
    }

    const orderRef = order.number || order.orderNumber || "Godown Dispatch";
    const title = `🚨 New Order: ${orderRef}`;
    const totalAmount = order.totalAmountPaise || order.totalPaise || 0;
    const amountStr = totalAmount > 0
      ? ` · ₹${(totalAmount / 100).toFixed(0)}`
      : "";
    const body = `${order.lineCount || 1} item(s)${amountStr} · ${order.customerName || "Customer"}`;

    // 2. Create OrderAlert records
    const alerts = await Promise.all(
      warehouseUsers.map((u) =>
        prisma.orderAlert.create({
          data: {
            orderId: order.id,
            userId: u.id,
            state: OrderAlertState.NOTIFIED,
            title,
            body,
            deepLink: `/app/godown?order=${order.id}`,
          },
        })
      )
    );

    // 3. Send Web Push
    await this.sendToUsers(
      warehouseUsers.map((u) => u.id),
      {
        title,
        body,
        orderId: order.id,
        tag: `order-${order.id}`,
        url: `/app/godown?order=${order.id}`,
      }
    );

    return { success: true, alertCount: alerts.length };
  }

  /**
   * Accept an order alert (stops ring and escalation across all warehouse managers).
   */
  async acceptOrderAlert(orderId: string, acceptedByUserId: string) {
    const updated = await prisma.orderAlert.updateMany({
      where: {
        orderId,
        state: { in: [OrderAlertState.NOTIFIED, OrderAlertState.SEEN] },
      },
      data: {
        state: OrderAlertState.ACCEPTED,
        acceptedAt: new Date(),
      },
    });

    return { success: true, updatedCount: updated.count };
  }

  /**
   * Fetch active, unaccepted alerts for a user or role.
   */
  async getActiveAlertsForUser(userId: string) {
    return prisma.orderAlert.findMany({
      where: {
        userId,
        state: { in: [OrderAlertState.NOTIFIED, OrderAlertState.SEEN] },
      },
      include: {
        order: {
          select: {
            id: true,
            status: true,
            orderNumber: true,
            customerNotes: true,
            totalPaise: true,
            createdAt: true,
            party: { select: { id: true, name: true, phone: true } },
            items: {
              select: {
                id: true,
                qty: true,
                product: { select: { name: true, weight: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
  }

  /**
   * Sends a test alert specifically to the requesting user's registered device.
   */
  async sendTestAlert(userId: string) {
    const subs = await prisma.pushSubscription.findMany({
      where: { userId, active: true },
    });

    if (subs.length === 0) {
      return { success: false, error: "No active push subscriptions found for your device. Please enable notifications first." };
    }

    await this.sendToUsers([userId], {
      title: "🔔 JMD Cart Alert Test",
      body: "High-urgency warehouse order notifications are working correctly on your phone!",
      tag: "test-alert",
      url: "/app/godown",
    });

    return { success: true, devicesCount: subs.length };
  }
}

export const pushNotificationService = new PushNotificationService();
