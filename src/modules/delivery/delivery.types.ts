import { z } from "zod";

export interface DeliveryZone {
  code: string;
  name: string;
  description?: string;
  minOrderPaise: number;
  freeDeliveryThresholdPaise: number;
  deliveryChargePaise: number;
  estimatedDeliveryHours?: number;
  active: boolean;
}

export const deliveryZoneSchema = z.object({
  code: z.string().min(1, "Zone code is required"),
  name: z.string().min(1, "Zone name is required"),
  description: z.string().optional(),
  minOrderPaise: z.number().int().min(0, "Minimum order must be non-negative"),
  freeDeliveryThresholdPaise: z.number().int().min(0, "Free delivery threshold must be non-negative"),
  deliveryChargePaise: z.number().int().min(0, "Delivery charge must be non-negative"),
  estimatedDeliveryHours: z.number().int().min(1).optional(),
  active: z.boolean().default(true),
});

export const deliverySettingsSchema = z.object({
  freeDeliveryTownPaise: z.number().int().min(0),
  freeDeliveryOutstationPaise: z.number().int().min(0),
  deliveryChargeTownPaise: z.number().int().min(0),
  deliveryChargeOutstationPaise: z.number().int().min(0),
  zones: z.array(deliveryZoneSchema).optional(),
});

export type DeliverySettings = z.infer<typeof deliverySettingsSchema>;

export interface DeliveryFeeCalculation {
  zoneCode: string;
  zoneName: string;
  orderTotalPaise: number;
  deliveryFeePaise: number;
  isFree: boolean;
  minOrderMet: boolean;
  minOrderPaise: number;
  thresholdPaise: number;
  deficitToFreePaise: number;
  estimatedDeliveryHours?: number;
}
