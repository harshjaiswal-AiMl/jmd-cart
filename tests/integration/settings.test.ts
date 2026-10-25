import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { settingsService } from "@/modules/settings/settings.service";
import { settingsRepository } from "@/modules/settings/settings.repository";
import { UserRole } from "@prisma/client";
import { ForbiddenError } from "@/modules/auth/permissions";
import { prisma } from "@/lib/prisma";
import { ZodError } from "zod";

describe("Task 1.3: Settings Module", () => {
  let adminUser: { id: string; role: UserRole };
  const seededBusinessDetails = {
    legalName: "JMD Cart Distributors",
    tradeName: "JMD Cart",
    gstin: "10AAAAA0000A1Z5",
    fssai: "10421000000001",
    address: "Station Road, Saharsa, Bihar - 852201",
    phone: "9876543210",
    email: "contact@jmdcart.local",
  };
  const seededDiscountLimits = {
    SHOP: 500,
    SALESPERSON: 300,
    GODOWN: 0,
    ACCOUNTS: 0,
    SUPER_ADMIN: 10000,
  };

  beforeAll(async () => {
    // Reset to pristine seeded state
    await settingsRepository.setSetting("business_details", seededBusinessDetails);
    await settingsRepository.setSetting("role_discount_limits", seededDiscountLimits);
  });

  afterAll(async () => {
    // Restore pristine seeded state after tests
    await settingsRepository.setSetting("business_details", seededBusinessDetails);
    await settingsRepository.setSetting("role_discount_limits", seededDiscountLimits);
  });

  beforeEach(async () => {
    adminUser = await prisma.user.findUniqueOrThrow({
      where: { phone: "9876543210" },
      select: { id: true, role: true },
    });
  });

  describe("Business Details", () => {
    it("should retrieve seeded business details", async () => {
      const details = await settingsService.getBusinessDetails();
      expect(details).toBeDefined();
      expect(details.legalName).toBe("JMD Cart Distributors");
      expect(details.gstin).toBe("10AAAAA0000A1Z5");
      expect(details.phone).toBe("9876543210");
    });

    it("should allow Super Admin to update business details and write an audit log", async () => {
      const updatePayload = {
        legalName: "JMD Enterprises Saharsa",
        tradeName: "JMD Cart Express",
        gstin: "10ABCDE1234F1Z5",
        fssai: "10421000000099",
        address: "Main Market, D.B. Road, Saharsa, Bihar - 852201",
        phone: "9876543219",
        email: "admin@jmdcart.local",
        bankDetails: {
          bankName: "HDFC Bank",
          accountNumber: "50100234567890",
          ifsc: "HDFC0001234",
          branch: "Saharsa",
        },
        upiId: "jmdexpress@hdfcbank",
      };

      const updated = await settingsService.updateBusinessDetails(
        adminUser.role,
        adminUser.id,
        updatePayload
      );

      expect(updated.legalName).toBe("JMD Enterprises Saharsa");
      expect(updated.gstin).toBe("10ABCDE1234F1Z5");

      // Verify DB persistence
      const fresh = await settingsService.getBusinessDetails();
      expect(fresh.legalName).toBe("JMD Enterprises Saharsa");

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: {
          action: "SETTINGS_BUSINESS_DETAILS_UPDATED",
          entityId: "business_details",
        },
        orderBy: { createdAt: "desc" },
      });

      expect(audit).not.toBeNull();
      expect(audit?.actorId).toBe(adminUser.id);
      expect((audit?.after as any).legalName).toBe("JMD Enterprises Saharsa");
    });

    it("should prevent non-admin roles from updating business details", async () => {
      await expect(
        settingsService.updateBusinessDetails(
          UserRole.SHOP,
          "shop-user-id",
          {
            legalName: "Hacked Name",
            tradeName: "Hacked Trade",
            gstin: "10ABCDE1234F1Z5",
            fssai: "10421000000099",
            address: "Nowhere",
            phone: "9999999999",
            email: "hacker@test.local",
          }
        )
      ).rejects.toThrow(ForbiddenError);
    });

    it("should reject invalid GSTIN format", async () => {
      await expect(
        settingsService.updateBusinessDetails(
          adminUser.role,
          adminUser.id,
          {
            legalName: "Invalid GST Test",
            tradeName: "Invalid GST",
            gstin: "INVALID_GSTIN_123", // invalid format
            fssai: "10421000000099",
            address: "Some address in Saharsa",
            phone: "9876543210",
            email: "test@jmdcart.local",
          }
        )
      ).rejects.toThrow(ZodError);
    });
  });

  describe("Role Discount Limits", () => {
    it("should retrieve seeded discount limits", async () => {
      const limits = await settingsService.getRoleDiscountLimits();
      expect(limits.SHOP).toBe(500); // 5%
      expect(limits.SALESPERSON).toBe(300); // 3%
      expect(limits.SUPER_ADMIN).toBe(10000); // 100%
    });

    it("should allow Super Admin to update discount limits", async () => {
      const updatedLimits = {
        SUPER_ADMIN: 10000,
        SHOP: 600, // 6%
        SALESPERSON: 400, // 4%
        GODOWN: 0,
        ACCOUNTS: 0,
        DELIVERY: 0,
        CUSTOMER: 0,
      };

      await settingsService.updateRoleDiscountLimits(
        adminUser.role,
        adminUser.id,
        updatedLimits
      );

      const fresh = await settingsService.getRoleDiscountLimits();
      expect(fresh.SHOP).toBe(600);
      expect(fresh.SALESPERSON).toBe(400);

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: { action: "SETTINGS_DISCOUNT_LIMITS_UPDATED" },
        orderBy: { createdAt: "desc" },
      });
      expect(audit).not.toBeNull();
      expect((audit?.after as any).SHOP).toBe(600);
    });

    it("should reject invalid basis points (> 10000 or negative)", async () => {
      await expect(
        settingsService.updateRoleDiscountLimits(
          adminUser.role,
          adminUser.id,
          {
            SHOP: 15000, // > 10000 bp (150%) invalid
          }
        )
      ).rejects.toThrow();
    });
  });
});
