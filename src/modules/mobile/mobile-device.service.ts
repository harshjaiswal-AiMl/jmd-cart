import { prisma } from "@/lib/prisma";

export interface DeviceRegistrationInput {
  deviceId: string;
  platform: "android" | "ios";
  fcmToken?: string | null;
  appVersion?: string | null;
  locale?: string;
  notificationPreferences?: {
    orderUpdates?: boolean;
    backInStock?: boolean;
    promotional?: boolean;
  };
  userId?: string | null;
}

export class MobileDeviceService {
  /**
   * Registers or updates a customer device.
   */
  static async registerDevice(input: DeviceRegistrationInput) {
    const {
      deviceId,
      platform,
      fcmToken,
      appVersion,
      locale = "en",
      notificationPreferences = {
        orderUpdates: true,
        backInStock: true,
        promotional: false,
      },
      userId,
    } = input;

    // Check if device exists
    const existing = await prisma.customerDevice.findUnique({
      where: { deviceId },
    });

    if (existing) {
      return prisma.customerDevice.update({
        where: { deviceId },
        data: {
          platform,
          fcmToken: fcmToken !== undefined ? fcmToken : existing.fcmToken,
          appVersion: appVersion !== undefined ? appVersion : existing.appVersion,
          locale: locale || existing.locale,
          notificationPreferences: {
            ...(typeof existing.notificationPreferences === "object" && existing.notificationPreferences
              ? (existing.notificationPreferences as any)
              : {}),
            ...notificationPreferences,
          },
          userId: userId !== undefined ? userId : existing.userId,
          lastSeenAt: new Date(),
        },
      });
    }

    return prisma.customerDevice.create({
      data: {
        deviceId,
        platform,
        fcmToken: fcmToken || null,
        appVersion: appVersion || null,
        locale,
        notificationPreferences,
        userId: userId || null,
        lastSeenAt: new Date(),
      },
    });
  }

  /**
   * Updates last-seen timestamp (heartbeat).
   */
  static async heartbeat(deviceId: string) {
    try {
      await prisma.customerDevice.update({
        where: { deviceId },
        data: { lastSeenAt: new Date() },
      });
      return { success: true };
    } catch {
      return { success: false, error: "Device not found" };
    }
  }

  /**
   * Unregisters FCM push token on logout or permission revocation.
   */
  static async unregisterDevice(deviceId: string) {
    try {
      await prisma.customerDevice.update({
        where: { deviceId },
        data: {
          fcmToken: null,
          userId: null,
          lastSeenAt: new Date(),
        },
      });
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  /**
   * Dispatches push notification to customer devices for a specific user or device.
   */
  static async sendPushNotification(params: {
    userId?: string;
    deviceId?: string;
    type: "orderUpdates" | "backInStock" | "promotional";
    title: string;
    body: string;
    data?: Record<string, string>;
  }) {
    const { userId, deviceId, type, title, body, data = {} } = params;

    // Find eligible devices
    const devices = await prisma.customerDevice.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(deviceId ? { deviceId } : {}),
        fcmToken: { not: null },
      },
    });

    const activeDevices = devices.filter((dev) => {
      if (!dev.fcmToken) return false;
      const prefs = dev.notificationPreferences as any;
      if (prefs && typeof prefs === "object") {
        if (type === "promotional" && !prefs.promotional) return false;
        if (type === "orderUpdates" && prefs.orderUpdates === false) return false;
        if (type === "backInStock" && prefs.backInStock === false) return false;
      }
      return true;
    });

    if (activeDevices.length === 0) {
      return { deliveredCount: 0, skipped: true };
    }

    // Official FCM messaging dispatcher (or fallback)
    const serverKey = process.env.FCM_SERVER_KEY || process.env.FIREBASE_SERVER_KEY;
    let deliveredCount = 0;

    for (const dev of activeDevices) {
      if (serverKey) {
        try {
          const res = await fetch("https://fcm.googleapis.com/fcm/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `key=${serverKey}`,
            },
            body: JSON.stringify({
              to: dev.fcmToken,
              notification: {
                title,
                body,
                sound: "default",
                channel_id: type === "orderUpdates" ? "order_updates" : "general_notifications",
              },
              data: {
                ...data,
                type,
                click_action: "FLUTTER_NOTIFICATION_CLICK",
              },
              priority: type === "orderUpdates" ? "high" : "normal",
            }),
          });

          if (res.ok) {
            deliveredCount++;
          } else {
            const errBody = await res.text();
            if (errBody.includes("NotRegistered") || errBody.includes("InvalidRegistration")) {
              // Token invalid, clean up automatically
              await prisma.customerDevice.update({
                where: { id: dev.id },
                data: { fcmToken: null },
              });
            }
          }
        } catch (err) {
          console.error(`[MobilePush] Failed sending push to ${dev.deviceId}:`, err);
        }
      } else {
        // Safe mock / logging mode when no FCM server key is set
        console.log(`[MobilePush-Mock] To: ${dev.deviceId} (${dev.fcmToken?.slice(0, 10)}...): "${title}" - "${body}"`);
        deliveredCount++;
      }
    }

    return { deliveredCount, skipped: false };
  }
}
