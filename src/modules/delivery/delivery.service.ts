import { UserRole } from "@prisma/client";
import { settingsService } from "@/modules/settings/settings.service";
import {
  DeliveryZone,
  DeliverySettings,
  DeliveryFeeCalculation,
} from "./delivery.types";

export class DeliveryService {
  /**
   * Returns all configured delivery zones (active by default or including inactive if specified).
   */
  async getDeliveryZones(includeInactive = false): Promise<DeliveryZone[]> {
    const settings = await settingsService.getDeliverySettings();
    const zones = settings.zones || [];
    if (includeInactive) {
      return zones;
    }
    return zones.filter((z) => z.active);
  }

  /**
   * Retrieves a specific delivery zone by unique code.
   */
  async getZoneByCode(code: string): Promise<DeliveryZone | null> {
    const zones = await this.getDeliveryZones(true);
    return zones.find((z) => z.code.toUpperCase() === code.trim().toUpperCase()) || null;
  }

  /**
   * Calculates the delivery fee for a given order total and target zone.
   * If the order reaches the zone's free delivery threshold, delivery fee is 0 paise.
   * Otherwise, the zone's deliveryChargePaise is applied.
   */
  async calculateDeliveryFee(
    zoneCode: string,
    orderTotalPaise: number
  ): Promise<DeliveryFeeCalculation> {
    const zone = await this.getZoneByCode(zoneCode);

    if (!zone) {
      // Fallback: if zone code is not found, check if it matches legacy TOWN vs OUTSTATION defaults
      const settings = await settingsService.getDeliverySettings();
      const isOutstation = zoneCode.toUpperCase().includes("OUTSTATION");

      const thresholdPaise = isOutstation
        ? settings.freeDeliveryOutstationPaise
        : settings.freeDeliveryTownPaise;
      const chargePaise = isOutstation
        ? settings.deliveryChargeOutstationPaise
        : settings.deliveryChargeTownPaise;

      const isFree = orderTotalPaise >= thresholdPaise;
      const deficitToFreePaise = isFree ? 0 : Math.max(0, thresholdPaise - orderTotalPaise);

      return {
        zoneCode,
        zoneName: isOutstation ? "Outstation / Beyond 5km" : "Saharsa Town",
        orderTotalPaise,
        deliveryFeePaise: isFree ? 0 : chargePaise,
        isFree,
        minOrderMet: true,
        minOrderPaise: 0,
        thresholdPaise,
        deficitToFreePaise,
      };
    }

    const minOrderMet = orderTotalPaise >= zone.minOrderPaise;
    const isFree = orderTotalPaise >= zone.freeDeliveryThresholdPaise;
    const deliveryFeePaise = isFree ? 0 : zone.deliveryChargePaise;
    const deficitToFreePaise = isFree
      ? 0
      : Math.max(0, zone.freeDeliveryThresholdPaise - orderTotalPaise);

    return {
      zoneCode: zone.code,
      zoneName: zone.name,
      orderTotalPaise,
      deliveryFeePaise,
      isFree,
      minOrderMet,
      minOrderPaise: zone.minOrderPaise,
      thresholdPaise: zone.freeDeliveryThresholdPaise,
      deficitToFreePaise,
      estimatedDeliveryHours: zone.estimatedDeliveryHours,
    };
  }

  /**
   * Updates all delivery settings, including town/outstation thresholds and custom zones.
   * Enforces Super Admin RBAC guard and audit logging via SettingsService.
   */
  async updateDeliverySettings(
    actorRole: UserRole,
    actorId: string,
    data: unknown,
    ip?: string
  ): Promise<DeliverySettings> {
    return settingsService.updateDeliverySettings(actorRole, actorId, data, ip);
  }
}

export const deliveryService = new DeliveryService();
