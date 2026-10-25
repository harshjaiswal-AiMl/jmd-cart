import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { settingsService, DEFAULT_PAYMENT_MODE_SETTINGS } from "@/modules/settings/settings.service";
import { UserRole } from "@prisma/client";
import { ForbiddenError } from "@/modules/auth/permissions";

describe("Payment Mode Switch & Settings (Task 3.9)", () => {
  beforeEach(async () => {
    // Clean up payment mode setting in DB before each test
    await prisma.setting.deleteMany({
      where: { key: "payment_mode_settings" },
    });
  });

  describe("Default Settings Behavior", () => {
    it("returns default payment mode settings with onlineGatewayEnabled = false", async () => {
      const settings = await settingsService.getPaymentModeSettings();

      expect(settings).toBeDefined();
      expect(settings.codEnabled).toBe(true);
      expect(settings.upiDeliveryEnabled).toBe(true);
      expect(settings.creditEnabledForCreditParties).toBe(true);
      expect(settings.onlineGatewayEnabled).toBe(false);
      expect(settings.gatewayProvider).toBe("none");
      expect(settings.gatewayKeyId).toBe("");
      expect(settings.gatewayKeySecret).toBe("");
    });
  });

  describe("RBAC Permissions for Payment Mode Updates", () => {
    it("allows SUPER_ADMIN to update payment mode configuration", async () => {
      const adminUser = await prisma.user.findFirst({
        where: { role: UserRole.SUPER_ADMIN },
      });

      if (!adminUser) {
        throw new Error("Seed super admin user not found in database");
      }

      const updated = await settingsService.updatePaymentModeSettings(
        UserRole.SUPER_ADMIN,
        adminUser.id,
        {
          codEnabled: true,
          upiDeliveryEnabled: true,
          creditEnabledForCreditParties: false,
          onlineGatewayEnabled: true,
          gatewayProvider: "phonepe",
          gatewayKeyId: "MERCHANT_12345",
          gatewayKeySecret: "SECRET_PASS_999",
        },
        "127.0.0.1"
      );

      expect(updated.codEnabled).toBe(true);
      expect(updated.creditEnabledForCreditParties).toBe(false);
      expect(updated.onlineGatewayEnabled).toBe(true);
      expect(updated.gatewayProvider).toBe("phonepe");
      expect(updated.gatewayKeyId).toBe("MERCHANT_12345");
      expect(updated.gatewayKeySecret).toBe("SECRET_PASS_999");

      // Verify persistence in DB
      const persisted = await settingsService.getPaymentModeSettings();
      expect(persisted.onlineGatewayEnabled).toBe(true);
      expect(persisted.gatewayProvider).toBe("phonepe");
    });

    it("prevents non-admin roles (e.g. SHOP, DELIVERY, CUSTOMER) from updating payment settings", async () => {
      let nonAdminUser = await prisma.user.findFirst({
        where: {
          role: {
            notIn: [UserRole.SUPER_ADMIN],
          },
        },
      });

      if (!nonAdminUser) {
        nonAdminUser = await prisma.user.create({
          data: {
            phone: "9800099999",
            name: "Test Staff",
            role: UserRole.SHOP,
            passwordHash: "$2b$10$ep1QZz9gN9VnJ8bW0qjZauoZ9tU2cTqmXmXW",
          },
        });
      }

      await expect(
        settingsService.updatePaymentModeSettings(
          nonAdminUser.role,
          nonAdminUser.id,
          {
            ...DEFAULT_PAYMENT_MODE_SETTINGS,
            onlineGatewayEnabled: true,
          }
        )
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("Audit Trail & Secret Masking", () => {
    it("masks gatewayKeySecret in audit log when payment settings are updated", async () => {
      const adminUser = await prisma.user.findFirst({
        where: { role: UserRole.SUPER_ADMIN },
      });

      if (!adminUser) {
        throw new Error("Super admin required for audit test");
      }

      await settingsService.updatePaymentModeSettings(
        UserRole.SUPER_ADMIN,
        adminUser.id,
        {
          codEnabled: true,
          upiDeliveryEnabled: false,
          creditEnabledForCreditParties: true,
          onlineGatewayEnabled: true,
          gatewayProvider: "razorpay",
          gatewayKeyId: "rzp_live_key123",
          gatewayKeySecret: "super_confidential_secret_777",
        },
        "192.168.1.100"
      );

      // Verify audit log
      const auditEntry = await prisma.auditLog.findFirst({
        where: {
          action: "SETTINGS_PAYMENT_MODE_UPDATED",
          entity: "Setting",
        },
        orderBy: { createdAt: "desc" },
      });

      expect(auditEntry).not.toBeNull();
      expect(auditEntry?.after).toBeDefined();

      const after = auditEntry?.after as Record<string, unknown>;
      expect(after.gatewayKeyId).toBe("rzp_live_key123");
      // The secret MUST be masked in the audit log
      expect(after.gatewayKeySecret).toBe("[REDACTED]");
      expect(JSON.stringify(auditEntry)).not.toContain("super_confidential_secret_777");
    });
  });
});
