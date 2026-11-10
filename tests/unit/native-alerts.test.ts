import { describe, it, expect, beforeEach } from "vitest";
import { pushNotificationService } from "@/modules/notifications/push-notification.service";
import { prisma } from "@/lib/prisma";
import { OrderAlertState, PushSubscriptionType, UserRole } from "@prisma/client";

describe("Part C — Native Godown Alerts & Always-On Looping Architecture", () => {
  let testUserId: string;

  beforeEach(async () => {
    await prisma.orderAlert.deleteMany().catch(() => {});
    await prisma.pushSubscription.deleteMany().catch(() => {});

    // Ensure warehouse manager exists
    let user = await prisma.user.findFirst({
      where: { role: UserRole.WAREHOUSE_MANAGER },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: "Godown Head",
          phone: "9876543219",
          passwordHash: "hash",
          role: UserRole.WAREHOUSE_MANAGER,
        },
      });
    }
    testUserId = user.id;
  });

  const createTestOrder = async () => {
    return prisma.order.create({
      data: {
        orderNumber: `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        userId: testUserId,
        deliveryZoneCode: "SAHARSA_TOWN",
        deliveryZoneName: "Saharsa Town",
        deliveryAddress: "Main Road, Saharsa, Bihar",
        contactPhone: "9876543210",
        subtotalPaise: 500000,
        taxablePaise: 500000,
        totalPaise: 500000,
      },
    });
  };

  describe("C1 & C2. Native FCM Dispatch & Cancel Broadcast", () => {
    it("dispatches high-priority alert to native devices on orders with carton items", async () => {
      // 1. Register a native Godown Android device
      const nativeDeviceToken = "dev_test_device_token_123";
      const fcmToken = "fcm_test_registration_token_456";

      const sub = await prisma.pushSubscription.create({
        data: {
          userId: testUserId,
          endpoint: fcmToken,
          deviceToken: nativeDeviceToken,
          deviceLabel: "Xiaomi Redmi Note 12",
          p256dh: "fcm_native",
          auth: "fcm_native",
          type: PushSubscriptionType.NATIVE,
          appVersion: "1.0.0",
          batteryOptDisabled: true,
          notificationPermitted: true,
          fullScreenPermitted: true,
          active: true,
        },
      });
      expect(sub.type).toBe(PushSubscriptionType.NATIVE);

      // 2. Trigger order alert with carton item
      const order = await createTestOrder();
      const res = await pushNotificationService.triggerOrderAlert({
        id: order.id,
        orderNumber: order.orderNumber,
        totalAmountPaise: 500000,
        customerName: "Sharma Kirana Store",
        hasCartonItems: true,
      });

      expect(res.success).toBe(true);

      // Verify alert record created
      const alert = await prisma.orderAlert.findFirst({
        where: { orderId: order.id },
      });
      expect(alert).not.toBeNull();
      expect(alert?.state).toBe(OrderAlertState.NOTIFIED);
      expect(alert?.title).toContain(order.orderNumber);
      expect(alert?.body).toContain("Sharma Kirana Store");
    });

    it("enforces carton-only policy: ignores orders without carton items", async () => {
      const order = await createTestOrder();
      const res = await pushNotificationService.triggerOrderAlert({
        id: order.id,
        orderNumber: order.orderNumber,
        hasCartonItems: false,
      });

      expect(res.success).toBe(false);
      expect(res.reason).toContain("Carton-only policy");

      const alert = await prisma.orderAlert.findFirst({
        where: { orderId: order.id },
      });
      expect(alert).toBeNull();
    });

    it("acceptOrderAlert marks alert ACCEPTED and attributes acknowledging device", async () => {
      const order = await createTestOrder();

      // Create alert
      await prisma.orderAlert.create({
        data: {
          orderId: order.id,
          userId: testUserId,
          state: OrderAlertState.NOTIFIED,
          title: "New Dispatch",
          body: "1 Carton",
        },
      });

      // Acknowledge by device
      const ackRes = await pushNotificationService.acceptOrderAlert(
        order.id,
        undefined,
        "dev_device_token_xyz"
      );
      expect(ackRes.success).toBe(true);

      const updated = await prisma.orderAlert.findFirst({
        where: { orderId: order.id },
      });
      expect(updated?.state).toBe(OrderAlertState.ACCEPTED);
      expect(updated?.acknowledgedByDeviceId).toBe("dev_device_token_xyz");
      expect(updated?.acceptedAt).not.toBeNull();
    });

    it("supports 1-minute snooze", async () => {
      const order = await createTestOrder();
      await prisma.orderAlert.create({
        data: {
          orderId: order.id,
          userId: testUserId,
          state: OrderAlertState.NOTIFIED,
          title: "New Dispatch",
          body: "1 Carton",
        },
      });

      const snoozedUntil = new Date(Date.now() + 60000);
      await prisma.orderAlert.updateMany({
        where: { orderId: order.id },
        data: { snoozedUntil, seenAt: new Date() },
      });

      const updated = await prisma.orderAlert.findFirst({
        where: { orderId: order.id },
      });
      expect(updated?.snoozedUntil).not.toBeNull();
      expect(updated?.snoozedUntil?.getTime()).toBeGreaterThan(Date.now() + 50000);
    });
  });
});
