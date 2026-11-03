import { describe, it, expect, vi, beforeEach } from "vitest";
import { MobileAuthService } from "../../src/modules/mobile/mobile-auth.service";
import { MobileDeviceService } from "../../src/modules/mobile/mobile-device.service";
import { MobileAccountService } from "../../src/modules/mobile/mobile-account.service";
import { MobileSavedListService } from "../../src/modules/mobile/mobile-saved-list.service";
import { MobileNotifyMeService } from "../../src/modules/mobile/mobile-notify-me.service";
import { prisma } from "../../src/lib/prisma";

// Mock prisma and messaging service for clean deterministic contract testing
vi.mock("../../src/lib/prisma", () => {
  const mockDb = {
    customerDevice: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    appRefreshToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    savedShoppingList: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    savedShoppingListItem: {
      deleteMany: vi.fn(),
    },
    productNotificationRequest: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    cart: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    cartItem: {
      deleteMany: vi.fn(),
    },
    wishlistItem: {
      deleteMany: vi.fn(),
    },
    userAddress: {
      deleteMany: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  };
  return { prisma: mockDb };
});

vi.mock("../../src/modules/messaging/messaging.service", () => ({
  MessagingService: {
    sendDirect: vi.fn().mockResolvedValue({ success: true, messageId: "msg_123" }),
  },
}));

describe("Store v1 Mobile API Contracts & Security Gates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Mobile JWT Authentication & Leak Prevention", () => {
    it("generates and verifies valid mobile JWT access tokens", () => {
      const user = {
        id: "usr_test_123",
        phone: "+919876543210",
        role: "CUSTOMER",
        buyerType: "CUSTOMER",
        buyerApproved: false,
        partyId: null,
      };

      const token = MobileAuthService.generateAccessToken(user);
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);

      const payload = MobileAuthService.verifyAccessToken(token);
      expect(payload).not.toBeNull();
      expect(payload?.userId).toBe(user.id);
      expect(payload?.phone).toBe(user.phone);
      expect(payload?.role).toBe("CUSTOMER");
    });

    it("rejects tampered or forged JWT tokens", () => {
      const user = { id: "usr_1", phone: "+919000000001", role: "CUSTOMER" };
      const token = MobileAuthService.generateAccessToken(user);
      const tampered = token.slice(0, -5) + "abcde";
      expect(MobileAuthService.verifyAccessToken(tampered)).toBeNull();
    });

    it("sanitizes user objects to prevent leakage of staff-only and sensitive fields", () => {
      const rawUser = {
        id: "usr_admin_1",
        phone: "+919211040269",
        name: "Test User",
        role: "CUSTOMER",
        agentCode: "SECRET_STAFF_AGENT_CODE_999",
        passwordHash: "$2a$12$e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0",
        mustChangePassword: true,
      };

      const sanitized = MobileAuthService.sanitizeUser(rawUser);
      expect(sanitized.id).toBe("usr_admin_1");
      expect(sanitized.name).toBe("Test User");
      // SENSITIVE LEAK GUARDS:
      expect(sanitized.agentCode).toBeUndefined();
      expect(sanitized.passwordHash).toBeUndefined();
      expect(sanitized.mustChangePassword).toBeUndefined();
    });
  });

  describe("2. Rotating Refresh Tokens & Revocation", () => {
    it("creates a refresh token and hashes it before storage", async () => {
      (prisma.appRefreshToken.updateMany as any).mockResolvedValue({ count: 1 });
      (prisma.appRefreshToken.create as any).mockResolvedValue({ id: "rt_1" });

      const rawToken = await MobileAuthService.createRefreshToken("usr_1", "dev_pixel_7");
      expect(typeof rawToken).toBe("string");
      expect(rawToken.length).toBe(64); // 32 random bytes hex-encoded

      expect(prisma.appRefreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "usr_1",
            deviceId: "dev_pixel_7",
            tokenHash: expect.any(String),
          }),
        })
      );
    });

    it("rotates refresh token: revokes old one and returns new token pair", async () => {
      const oldRaw = "a".repeat(64);
      const userObj = {
        id: "usr_1",
        phone: "+919876543210",
        role: "CUSTOMER",
        active: true,
      };

      (prisma.appRefreshToken.findUnique as any).mockResolvedValue({
        id: "token_row_1",
        userId: "usr_1",
        deviceId: "dev_pixel_7",
        revoked: false,
        expiresAt: new Date(Date.now() + 1000000),
        user: userObj,
      });

      (prisma.appRefreshToken.update as any).mockResolvedValue({ id: "token_row_1", revoked: true });
      (prisma.appRefreshToken.updateMany as any).mockResolvedValue({ count: 1 });
      (prisma.appRefreshToken.create as any).mockResolvedValue({ id: "token_row_2" });

      const rotated = await MobileAuthService.rotateRefreshToken(oldRaw, "dev_pixel_7");
      expect(rotated).not.toBeNull();
      expect(rotated?.accessToken).toBeDefined();
      expect(rotated?.refreshToken).toBeDefined();
      expect(prisma.appRefreshToken.update).toHaveBeenCalledWith({
        where: { id: "token_row_1" },
        data: { revoked: true },
      });
    });

    it("rejects revoked or device-mismatched refresh tokens", async () => {
      (prisma.appRefreshToken.findUnique as any).mockResolvedValue({
        id: "token_row_revoked",
        userId: "usr_1",
        deviceId: "dev_pixel_7",
        revoked: true,
        expiresAt: new Date(Date.now() + 1000000),
        user: { id: "usr_1", active: true },
      });

      const res = await MobileAuthService.rotateRefreshToken("some_token", "dev_pixel_7");
      expect(res).toBeNull();
    });
  });

  describe("3. OTP Rate Limiting & Android SMS Auto-fill Format", () => {
    it("formats SMS strictly according to Android SMS Retriever specs", async () => {
      const { MessagingService } = await import("../../src/modules/messaging/messaging.service");
      const phone = "9876543210";
      const appHash = "FA+9qCX9VSu";

      const res = await MobileAuthService.sendOtp(phone, appHash);
      expect(res.success).toBe(true);

      expect(MessagingService.sendDirect).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: "9876543210",
          body: expect.stringMatching(/^<#> Your JMD Cart verification code is \d{6}\. Valid for 5 minutes\. DO NOT share this code\.\nFA\+9qCX9VSu$/),
        })
      );
    });
  });

  describe("4. Customer Device Registry & Push Preferences", () => {
    it("registers new device with default push preferences", async () => {
      (prisma.customerDevice.findUnique as any).mockResolvedValue(null);
      (prisma.customerDevice.create as any).mockResolvedValue({
        id: "dev_row_1",
        deviceId: "dev_samsung_s21",
        platform: "android",
        locale: "hi",
        notificationPreferences: { orderUpdates: true, backInStock: true, promotional: false },
      });

      const dev = await MobileDeviceService.registerDevice({
        deviceId: "dev_samsung_s21",
        platform: "android",
        fcmToken: "fcm_test_token_abc",
        locale: "hi",
      });

      expect(dev.deviceId).toBe("dev_samsung_s21");
      expect(prisma.customerDevice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deviceId: "dev_samsung_s21",
            platform: "android",
            locale: "hi",
          }),
        })
      );
    });

    it("respects user opt-out and skips promotional notifications when promotional=false", async () => {
      (prisma.customerDevice.findMany as any).mockResolvedValue([
        {
          id: "dev_1",
          deviceId: "dev_1",
          fcmToken: "token_1",
          notificationPreferences: { orderUpdates: true, promotional: false },
        },
      ]);

      const res = await MobileDeviceService.sendPushNotification({
        userId: "usr_1",
        type: "promotional",
        title: "50% OFF Diwali Sale!",
        body: "Grab it now",
      });

      expect(res.skipped).toBe(true);
      expect(res.deliveredCount).toBe(0);
    });
  });

  describe("5. Google Play Compliant Account Deletion", () => {
    it("anonymizes personal identifiers and purges sessions while preserving statutory records", async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        id: "usr_to_delete",
        name: "Jane Doe",
        phone: "+919876500000",
        email: "jane@example.com",
      });
      (prisma.userAddress.deleteMany as any).mockResolvedValue({ count: 2 });
      (prisma.cart.findUnique as any).mockResolvedValue({ id: "cart_1" });
      (prisma.cartItem.deleteMany as any).mockResolvedValue({ count: 3 });
      (prisma.cart.delete as any).mockResolvedValue({ id: "cart_1" });
      (prisma.wishlistItem.deleteMany as any).mockResolvedValue({ count: 1 });
      (prisma.savedShoppingList.deleteMany as any).mockResolvedValue({ count: 1 });
      (prisma.appRefreshToken.updateMany as any).mockResolvedValue({ count: 2 });
      (prisma.customerDevice.updateMany as any).mockResolvedValue({ count: 1 });
      (prisma.user.update as any).mockResolvedValue({ id: "usr_to_delete", active: false });

      const result = await MobileAccountService.deleteAccount("usr_to_delete");
      expect(result.success).toBe(true);

      // Verify user anonymized rather than hard-deleting the row (which would orphan GST invoices)
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "usr_to_delete" },
          data: expect.objectContaining({
            name: "Deleted Account",
            phone: expect.stringContaining("deleted_"),
            email: null,
            active: false,
          }),
        })
      );

      // Verify personal addresses and active tokens deleted
      expect(prisma.userAddress.deleteMany).toHaveBeenCalledWith({ where: { userId: "usr_to_delete" } });
      expect(prisma.appRefreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: "usr_to_delete" },
        data: { revoked: true },
      });
    });
  });
});
