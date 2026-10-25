import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { deliveryService } from "@/modules/delivery/delivery.service";
import { settingsService, DEFAULT_DELIVERY_SETTINGS } from "@/modules/settings/settings.service";
import { UserRole } from "@prisma/client";

describe("Delivery Zones, Charges and Thresholds (Task 3.4)", () => {
  beforeEach(async () => {
    // Reset settings in DB to standard defaults before each test
    await prisma.setting.deleteMany({
      where: { key: "delivery_settings" },
    });
  });

  describe("Delivery Zones Retrieval and Defaults", () => {
    it("returns default pre-configured delivery zones (Saharsa Town, Outstation, Simri)", async () => {
      const zones = await deliveryService.getDeliveryZones();
      expect(zones.length).toBeGreaterThanOrEqual(2);

      const townZone = zones.find((z) => z.code === "TOWN");
      expect(townZone).toBeDefined();
      expect(townZone?.name).toContain("Saharsa Town");
      expect(townZone?.freeDeliveryThresholdPaise).toBe(200000); // Rs 2,000
      expect(townZone?.deliveryChargePaise).toBe(5000); // Rs 50

      const outstationZone = zones.find((z) => z.code === "OUTSTATION");
      expect(outstationZone).toBeDefined();
      expect(outstationZone?.freeDeliveryThresholdPaise).toBe(500000); // Rs 5,000
      expect(outstationZone?.deliveryChargePaise).toBe(15000); // Rs 150
    });

    it("retrieves a specific zone by case-insensitive code", async () => {
      const zone = await deliveryService.getZoneByCode("town");
      expect(zone).not.toBeNull();
      expect(zone?.code).toBe("TOWN");
      expect(zone?.freeDeliveryThresholdPaise).toBe(200000);

      const invalidZone = await deliveryService.getZoneByCode("NON_EXISTENT_CODE");
      expect(invalidZone).toBeNull();
    });
  });

  describe("Delivery Fee Calculation", () => {
    it("charges town delivery fee (Rs 50) when cart subtotal is below Rs 2,000", async () => {
      // Cart subtotal = Rs 1,450 (145000 paise)
      const calculation = await deliveryService.calculateDeliveryFee("TOWN", 145000);

      expect(calculation.isFree).toBe(false);
      expect(calculation.deliveryFeePaise).toBe(5000); // Rs 50
      expect(calculation.thresholdPaise).toBe(200000);
      expect(calculation.deficitToFreePaise).toBe(55000); // Rs 550 to reach Rs 2,000
    });

    it("grants FREE delivery for town when cart subtotal meets or exceeds Rs 2,000", async () => {
      // Cart subtotal = Rs 2,000 exactly (200000 paise)
      const exactCalc = await deliveryService.calculateDeliveryFee("TOWN", 200000);
      expect(exactCalc.isFree).toBe(true);
      expect(exactCalc.deliveryFeePaise).toBe(0);
      expect(exactCalc.deficitToFreePaise).toBe(0);

      // Cart subtotal = Rs 3,500 (350000 paise)
      const overCalc = await deliveryService.calculateDeliveryFee("TOWN", 350000);
      expect(overCalc.isFree).toBe(true);
      expect(overCalc.deliveryFeePaise).toBe(0);
      expect(overCalc.deficitToFreePaise).toBe(0);
    });

    it("charges outstation delivery fee (Rs 150) when below Rs 5,000 threshold", async () => {
      // Cart subtotal = Rs 3,200 (320000 paise)
      const calculation = await deliveryService.calculateDeliveryFee("OUTSTATION", 320000);

      expect(calculation.isFree).toBe(false);
      expect(calculation.deliveryFeePaise).toBe(15000); // Rs 150
      expect(calculation.thresholdPaise).toBe(500000); // Rs 5,000
      expect(calculation.deficitToFreePaise).toBe(180000); // Rs 1,800 to reach free threshold
    });

    it("grants FREE delivery for outstation when cart subtotal reaches Rs 5,000", async () => {
      // Cart subtotal = Rs 5,000 (500000 paise)
      const calculation = await deliveryService.calculateDeliveryFee("OUTSTATION", 500000);

      expect(calculation.isFree).toBe(true);
      expect(calculation.deliveryFeePaise).toBe(0);
      expect(calculation.deficitToFreePaise).toBe(0);
    });

    it("supports fallback calculation for legacy zone codes not in zones array", async () => {
      // Unknown outstation code
      const calculation = await deliveryService.calculateDeliveryFee("CUSTOM_OUTSTATION_ROUTE", 400000);
      expect(calculation.isFree).toBe(false);
      expect(calculation.deliveryFeePaise).toBe(15000); // uses outstation charge Rs 150
    });
  });

  describe("Admin Updates & Custom Delivery Zones", () => {
    it("allows Super Admin to edit thresholds and add custom rural zones", async () => {
      const superAdminUser = await prisma.user.findFirst({
        where: { role: UserRole.SUPER_ADMIN },
      });
      const adminId = superAdminUser?.id || "super-admin-test-id";

      const updatedSettingsPayload = {
        freeDeliveryTownPaise: 150000, // Reduced to Rs 1,500
        deliveryChargeTownPaise: 4000, // Reduced to Rs 40
        freeDeliveryOutstationPaise: 600000, // Rs 6,000
        deliveryChargeOutstationPaise: 200000, // Rs 200
        zones: [
          {
            code: "TOWN",
            name: "Saharsa Town Central",
            minOrderPaise: 30000,
            freeDeliveryThresholdPaise: 150000,
            deliveryChargePaise: 4000,
            estimatedDeliveryHours: 2,
            active: true,
          },
          {
            code: "NAUHATTA",
            name: "Nauhatta Block Route",
            description: "Nauhatta market center and eastern panchayats",
            minOrderPaise: 250000, // Rs 2,500 min order
            freeDeliveryThresholdPaise: 800000, // Rs 8,000 free threshold
            deliveryChargePaise: 30000, // Rs 300 delivery fee
            estimatedDeliveryHours: 48,
            active: true,
          },
        ],
      };

      await deliveryService.updateDeliverySettings(
        UserRole.SUPER_ADMIN,
        adminId,
        updatedSettingsPayload
      );

      // Verify settings persisted
      const currentSettings = await settingsService.getDeliverySettings();
      expect(currentSettings.freeDeliveryTownPaise).toBe(150000);
      expect(currentSettings.deliveryChargeTownPaise).toBe(4000);

      // Verify custom zone was created and evaluates correctly
      const nauhattaCalc = await deliveryService.calculateDeliveryFee("NAUHATTA", 500000);
      expect(nauhattaCalc.zoneName).toBe("Nauhatta Block Route");
      expect(nauhattaCalc.isFree).toBe(false);
      expect(nauhattaCalc.deliveryFeePaise).toBe(30000); // Rs 300
      expect(nauhattaCalc.deficitToFreePaise).toBe(300000); // Rs 3,000 to reach Rs 8,000

      // Nauhatta above Rs 8,000 -> Free delivery
      const nauhattaFreeCalc = await deliveryService.calculateDeliveryFee("NAUHATTA", 850000);
      expect(nauhattaFreeCalc.isFree).toBe(true);
      expect(nauhattaFreeCalc.deliveryFeePaise).toBe(0);

      // Verify audit log was recorded
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: "SETTINGS_DELIVERY_UPDATED",
          entityId: "delivery_settings",
        },
        orderBy: { createdAt: "desc" },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.actorId).toBe(adminId);
    });

    it("blocks non-admin roles (e.g. SHOP or SALESPERSON) from modifying delivery settings", async () => {
      const payload = {
        freeDeliveryTownPaise: 100000,
        deliveryChargeTownPaise: 2000,
        freeDeliveryOutstationPaise: 300000,
        deliveryChargeOutstationPaise: 5000,
      };

      await expect(
        deliveryService.updateDeliverySettings(
          UserRole.SHOP,
          "shop-user-id",
          payload
        )
      ).rejects.toThrow();

      await expect(
        deliveryService.updateDeliverySettings(
          UserRole.SALESPERSON,
          "salesperson-user-id",
          payload
        )
      ).rejects.toThrow();
    });
  });
});
