import { z } from "zod";
import { UserRole } from "@prisma/client";

export const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const fssaiRegex = /^[0-9]{14}$/;

export const businessDetailsSchema = z.object({
  legalName: z.string().min(2, "Legal name is required"),
  tradeName: z.string().min(2, "Trade name is required"),
  gstin: z.string().regex(gstinRegex, "Invalid 15-digit GSTIN format").or(z.literal("")),
  fssai: z.string().regex(fssaiRegex, "FSSAI license must be 14 numeric digits").or(z.literal("")),
  address: z.string().min(5, "Address must be at least 5 characters"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  email: z.string().email("Invalid email address").or(z.literal("")),
  bankDetails: z
    .object({
      bankName: z.string().optional().default(""),
      accountNumber: z.string().optional().default(""),
      ifsc: z.string().optional().default(""),
      branch: z.string().optional().default(""),
    })
    .optional(),
  upiId: z.string().optional().default(""),
});

export type BusinessDetails = z.infer<typeof businessDetailsSchema>;

export const roleDiscountLimitsSchema = z.record(
  z.nativeEnum(UserRole),
  z.number().int().min(0).max(10000)
);

export type RoleDiscountLimits = z.infer<typeof roleDiscountLimitsSchema>;

export const deliverySettingsSchema = z.object({
  freeDeliveryTownPaise: z.number().int().min(0),
  freeDeliveryOutstationPaise: z.number().int().min(0),
  deliveryChargeTownPaise: z.number().int().min(0),
  deliveryChargeOutstationPaise: z.number().int().min(0),
});

export type DeliverySettings = z.infer<typeof deliverySettingsSchema>;

export const verificationModeSchema = z.enum(["admin", "off", "sms"]);

export const verificationSettingsSchema = z.object({
  mode: verificationModeSchema,
});

export type VerificationSettings = z.infer<typeof verificationSettingsSchema>;

export interface AllSettings {
  businessDetails: BusinessDetails;
  roleDiscountLimits: RoleDiscountLimits;
  deliverySettings: DeliverySettings;
  verificationSettings: VerificationSettings;
}
