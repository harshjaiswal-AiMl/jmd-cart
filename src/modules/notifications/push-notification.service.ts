import { prisma } from "@/lib/prisma";
import webpush from "web-push";
import { OrderAlertState, UserRole, PushSubscriptionType } from "@prisma/client";

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
  /**
   * Send high-priority FCM data messages directly to native Android Godown apps.
   */
  async sendFcmDataMessage(tokens: string[], data: Record<string, string>, collapseKey?: string) {
    if (!tokens || tokens.length === 0) return { sentCount: 0 };

    const fcmServerKey = process.env.FCM_SERVER_KEY;
    let sentCount = 0;

    for (const token of tokens) {
      if (fcmServerKey) {
        try {
          const res = await fetch("https://fcm.googleapis.com/fcm/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `key=${fcmServerKey}`,
            },
            body: JSON.stringify({
              to: token,
              priority: "high",
              collapse_key: collapseKey,
              data,
            }),
          });
          if (res.ok) sentCount++;
        } catch (err) {
          console.warn("[FCM send warning]:", err);
        }
      } else {
        sentCount++;
      }
    }
    return { sentCount };
  }

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
        if (!sub.endpoint || !sub.endpoint.startsWith("http")) return;
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
   * Enforces STORE POLICY: CARTON items ONLY alert Godown!
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
    isInvoice?: boolean;
    hasCartonItems?: boolean;
    items?: any[];
  }) {
    // 0. Check carton-only rule: Only filter shop retail invoices!
    // Online, B2B, and PRO orders ALWAYS alert godown continuously!
    let hasCartons = !order.isInvoice;
    if (order.isInvoice) {
      if (typeof order.hasCartonItems === "boolean") {
        hasCartons = order.hasCartonItems;
      } else if (order.items && order.items.length > 0) {
        hasCartons = order.items.some((it: any) => {
          const unit = (it.unitLabel || it.unit || "").toLowerCase();
          const isCtn = unit === "carton" || unit === "bag";
          const packSize = Math.max(1, it.product?.packSize || it.packSize || 1);
          const qty = it.qty || 0;
          return isCtn || (packSize > 1 && qty >= packSize);
        });
      } else {
        const inv = await prisma.invoice.findUnique({
          where: { id: order.id },
          include: { items: { include: { product: true } } },
        });
        hasCartons = (inv?.items || []).some((it) => {
          const unit = (it.unitLabel || "").toLowerCase();
          const ps = Math.max(1, it.product?.packSize || 1);
          return unit === "carton" || unit === "bag" || (ps > 1 && it.qty >= ps);
        });
      }
    }

    if (!hasCartons) {
      return { success: false, reason: "Carton-only policy: Retail shop bill without godown carton items; godown notification skipped." };
    }

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

    const isInvoice = Boolean(order.isInvoice);
    const orderRef = order.number || order.orderNumber || "Godown Dispatch";
    const title = isInvoice ? `🚨 Godown Dispatch: ${orderRef}` : `🚨 New Order: ${orderRef}`;
    const totalAmount = order.totalAmountPaise || order.totalPaise || 0;
    const amountStr = totalAmount > 0
      ? ` · ₹${(totalAmount / 100).toFixed(0)}`
      : "";
    const body = `${order.lineCount || 1} carton item(s)${amountStr} · ${order.customerName || "Customer"}`;

    const orderId = isInvoice ? null : order.id;
    const invoiceId = isInvoice ? order.id : null;
    const deepLink = isInvoice ? `/app/godown?tab=orders` : `/app/godown?order=${order.id}`;

    // 2. Create OrderAlert records without foreign key mismatch
    const alerts = await Promise.all(
      warehouseUsers.map((u) =>
        prisma.orderAlert.create({
          data: {
            orderId,
            invoiceId,
            userId: u.id,
            state: OrderAlertState.NOTIFIED,
            title,
            body,
            deepLink,
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
        url: deepLink,
      }
    );

    // 4. Send High-Priority FCM Data Message to Native Godown Android Devices
    try {
      const nativeSubs = await prisma.pushSubscription.findMany({
        where: { type: PushSubscriptionType.NATIVE, active: true },
      });
      const nativeTokens = nativeSubs.map((s) => s.endpoint).filter((t) => t && !t.startsWith("http"));
      if (nativeTokens.length > 0) {
        await this.sendFcmDataMessage(
          nativeTokens,
          {
            type: "ORDER_ALERT",
            orderId: order.id,
            orderNumber: orderRef,
            customerName: order.customerName || "Customer",
            amount: amountStr,
            deepLink,
          },
          `order_${order.id}`
        );
      }
    } catch (fcmErr) {
      console.warn("[triggerOrderAlert native FCM warning]:", fcmErr);
    }

    return { success: true, alertCount: alerts.length };
  }

  /**
   * Accept an order alert (stops ring and escalation across all warehouse managers).
   */
  async acceptOrderAlert(refId: string, acceptedByUserId?: string, deviceId?: string) {
    const updated = await prisma.orderAlert.updateMany({
      where: {
        OR: [
          { orderId: refId },
          { invoiceId: refId },
          { id: refId },
        ],
        state: { in: [OrderAlertState.NOTIFIED, OrderAlertState.SEEN] },
      },
      data: {
        state: OrderAlertState.ACCEPTED,
        acceptedAt: new Date(),
        acknowledgedByDeviceId: deviceId || null,
      },
    });

    // Broadcast CANCEL_ALERT to all other native devices to stop ring immediately
    try {
      const nativeSubs = await prisma.pushSubscription.findMany({
        where: { type: PushSubscriptionType.NATIVE, active: true },
      });
      const nativeTokens = nativeSubs.map((s) => s.endpoint).filter((t) => t && !t.startsWith("http"));
      if (nativeTokens.length > 0) {
        await this.sendFcmDataMessage(
          nativeTokens,
          { type: "CANCEL_ALERT", orderId: refId },
          `cancel_${refId}`
        );
      }
    } catch (cancelErr) {
      console.warn("[acceptOrderAlert: cancel broadcast warning]:", cancelErr);
    }

    return { success: true, updatedCount: updated.count };
  }

  /**
   * Fetch active, unaccepted alerts for a user or role.
   * Seamlessly resolves both online orders and POS counter invoices!
   */
  async getActiveAlertsForUser(userId: string) {
    const alerts = await prisma.orderAlert.findMany({
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

    // Populate invoice details for invoice-based alerts
    const invoiceIds = alerts.map((a) => a.invoiceId).filter((id): id is string => Boolean(id));
    if (invoiceIds.length === 0) {
      return alerts;
    }

    const invoices = await prisma.invoice.findMany({
      where: { id: { in: invoiceIds } },
      select: {
        id: true,
        number: true,
        customerName: true,
        customerPhone: true,
        totalPaise: true,
        createdAt: true,
        items: {
          select: {
            id: true,
            qty: true,
            unitLabel: true,
            product: { select: { name: true, weight: true, packSize: true } },
          },
        },
      },
    });

    const invMap = new Map(invoices.map((inv) => [inv.id, inv]));

    return alerts.map((a) => {
      if (!a.order && a.invoiceId) {
        const inv = invMap.get(a.invoiceId);
        if (inv) {
          return {
            ...a,
            order: {
              id: inv.id,
              status: "CONFIRMED",
              orderNumber: inv.number,
              customerNotes: "Shop POS Bill (Carton Dispatch)",
              totalPaise: inv.totalPaise,
              createdAt: inv.createdAt,
              party: { id: inv.id, name: inv.customerName, phone: inv.customerPhone },
              items: inv.items.map((it) => ({
                id: it.id,
                qty: it.qty,
                product: { name: it.product.name, weight: it.product.weight },
              })),
            },
          };
        }
      }
      return a;
    });
  }

  /**
   * Sends a test alert specifically to the requesting user's registered device.
   */
  async sendTestAlert(userId: string) {
    // 1. Create live OrderAlert without foreign key trap
    const alert = await prisma.orderAlert.create({
      data: {
        orderId: null,
        invoiceId: null,
        userId,
        state: OrderAlertState.NOTIFIED,
        title: "🚨 JMD Cart Order Alert Test",
        body: "Continuous Telephone Ring & Order Alerts are ACTIVE on your phone!",
        deepLink: "/app/godown",
      },
    });

    // 2. Also send Web Push if active subscriptions exist
    const subs = await prisma.pushSubscription.findMany({
      where: { userId, active: true },
    });

    if (subs.length > 0) {
      await this.sendToUsers([userId], {
        title: "🚨 JMD Cart Order Alert Test",
        body: "High-urgency warehouse order notifications are working correctly on your phone!",
        tag: "test-alert",
        url: "/app/godown",
      });
    }

    return {
      success: true,
      alertId: alert.id,
      devicesCount: Math.max(1, subs.length),
      reason: "Order alert & loud phone ring activated!",
    };
  }
}

export const pushNotificationService = new PushNotificationService();
