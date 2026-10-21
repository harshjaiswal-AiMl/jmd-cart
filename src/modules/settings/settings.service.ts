import { UserRole } from "@prisma/client";
import { settingsRepository } from "./settings.repository";
import {
  businessDetailsSchema,
  BusinessDetails,
  roleDiscountLimitsSchema,
  RoleDiscountLimits,
  deliverySettingsSchema,
  DeliverySettings,
  verificationSettingsSchema,
  VerificationSettings,
  paymentModeSettingsSchema,
  PaymentModeSettings,
  eInvoiceSettingsSchema,
  EInvoiceSettings,
  pricingSettingsSchema,
  PricingSettings,
  AllSettings,
} from "./settings.types";
import { assertPermission, Permission } from "@/modules/auth/permissions";
import { auditService } from "@/modules/audit/audit.service";

export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  enableQuantityTierPricing: false,
};

export const DEFAULT_EINVOICE_SETTINGS: EInvoiceSettings = {
  enabled: false,
  provider: "noop",
  gspClientId: "",
  gspClientSecret: "",
  gspUsername: "",
  gspBaseUrl: "",
  autoGenerateOnFinalize: true,
};

export const DEFAULT_PAYMENT_MODE_SETTINGS: PaymentModeSettings = {
  codEnabled: true,
  upiDeliveryEnabled: true,
  creditEnabledForCreditParties: true,
  onlineGatewayEnabled: false, // Online payment gateway OFF by default per client requirement
  gatewayProvider: "none",
  gatewayKeyId: "",
  gatewayKeySecret: "",
};

export const DEFAULT_BUSINESS_DETAILS: BusinessDetails = {
  legalName: "",
  tradeName: "",
  gstin: "",
  fssai: "",
  address: "",
  phone: "",
  email: "",
  bankDetails: {
    bankName: "",
    accountNumber: "",
    ifsc: "",
    branch: "",
  },
  upiId: "",
};

export const DEFAULT_DISCOUNT_LIMITS: RoleDiscountLimits = {
  SUPER_ADMIN: 10000,
  ADMIN: 10000,
  SHOP: 500,
  SALESPERSON: 300,
  GODOWN: 0,
  ACCOUNTS: 0,
  DELIVERY: 0,
  CUSTOMER: 0,
};

export const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  freeDeliveryTownPaise: 200000, // Rs 2,000
  freeDeliveryOutstationPaise: 500000, // Rs 5,000
  deliveryChargeTownPaise: 5000, // Rs 50
  deliveryChargeOutstationPaise: 15000, // Rs 150
  zones: [
    {
      code: "TOWN",
      name: "Saharsa Town (Within 5 km)",
      description: "Local Saharsa municipality & town limits (Station Road, D.B. Road, Purab Bazar, Gangjala)",
      minOrderPaise: 50000, // Rs 500
      freeDeliveryThresholdPaise: 200000, // Rs 2,000
      deliveryChargePaise: 5000, // Rs 50
      estimatedDeliveryHours: 4,
      active: true,
    },
    {
      code: "OUTSTATION",
      name: "Outstation & Beyond 5 km",
      description: "Suburban and connecting roads (Kahra, Biraul, Sattar Kataiya, Sonbarsa Raj)",
      minOrderPaise: 100000, // Rs 1,000
      freeDeliveryThresholdPaise: 500000, // Rs 5,000
      deliveryChargePaise: 15000, // Rs 150
      estimatedDeliveryHours: 24,
      active: true,
    },
    {
      code: "SIMRI_BAKHTIARPUR",
      name: "Simri Bakhtiarpur Sub-Division",
      description: "Simri Bakhtiarpur market and surrounding rural distribution routes",
      minOrderPaise: 200000, // Rs 2,000
      freeDeliveryThresholdPaise: 750000, // Rs 7,500
      deliveryChargePaise: 25000, // Rs 250
      estimatedDeliveryHours: 48,
      active: true,
    },
  ],
};

export const DEFAULT_VERIFICATION_SETTINGS: VerificationSettings = {
  mode: "admin",
};

export class SettingsService {
  async getBusinessDetails(): Promise<BusinessDetails> {
    const data = await settingsRepository.getSetting<BusinessDetails>("business_details");
    return data ? { ...DEFAULT_BUSINESS_DETAILS, ...data } : DEFAULT_BUSINESS_DETAILS;
  }

  async updateBusinessDetails(
    actorRole: UserRole,
    actorId: string,
    data: unknown,
    ip?: string
  ): Promise<BusinessDetails> {
    assertPermission(actorRole, Permission.MANAGE_SETTINGS);
    const parsed = businessDetailsSchema.parse(data);

    const before = await this.getBusinessDetails();
    await settingsRepository.setSetting("business_details", parsed);

    await auditService.log({
      actorId,
      action: "SETTINGS_BUSINESS_DETAILS_UPDATED",
      entity: "Setting",
      entityId: "business_details",
      before,
      after: parsed,
      ip,
    });

    return parsed;
  }

  async getRoleDiscountLimits(): Promise<RoleDiscountLimits> {
    const data = await settingsRepository.getSetting<RoleDiscountLimits>("role_discount_limits");
    return data ? { ...DEFAULT_DISCOUNT_LIMITS, ...data } : DEFAULT_DISCOUNT_LIMITS;
  }

  async updateRoleDiscountLimits(
    actorRole: UserRole,
    actorId: string,
    data: unknown,
    ip?: string
  ): Promise<RoleDiscountLimits> {
    assertPermission(actorRole, Permission.MANAGE_SETTINGS);
    const parsed = roleDiscountLimitsSchema.parse(data);

    const before = await this.getRoleDiscountLimits();
    await settingsRepository.setSetting("role_discount_limits", parsed);

    await auditService.log({
      actorId,
      action: "SETTINGS_DISCOUNT_LIMITS_UPDATED",
      entity: "Setting",
      entityId: "role_discount_limits",
      before,
      after: parsed,
      ip,
    });

    return parsed;
  }

  async getDeliverySettings(): Promise<DeliverySettings> {
    const data = await settingsRepository.getSetting<DeliverySettings>("delivery_settings");
    if (!data) return DEFAULT_DELIVERY_SETTINGS;

    const zones = data.zones && data.zones.length > 0 ? data.zones : DEFAULT_DELIVERY_SETTINGS.zones;
    return {
      freeDeliveryTownPaise: data.freeDeliveryTownPaise ?? DEFAULT_DELIVERY_SETTINGS.freeDeliveryTownPaise,
      freeDeliveryOutstationPaise: data.freeDeliveryOutstationPaise ?? DEFAULT_DELIVERY_SETTINGS.freeDeliveryOutstationPaise,
      deliveryChargeTownPaise: data.deliveryChargeTownPaise ?? DEFAULT_DELIVERY_SETTINGS.deliveryChargeTownPaise,
      deliveryChargeOutstationPaise: data.deliveryChargeOutstationPaise ?? DEFAULT_DELIVERY_SETTINGS.deliveryChargeOutstationPaise,
      zones,
    };
  }

  async updateDeliverySettings(
    actorRole: UserRole,
    actorId: string,
    data: unknown,
    ip?: string
  ): Promise<DeliverySettings> {
    assertPermission(actorRole, Permission.MANAGE_SETTINGS);
    const parsed = deliverySettingsSchema.parse(data);

    const before = await this.getDeliverySettings();
    await settingsRepository.setSetting("delivery_settings", parsed);

    await auditService.log({
      actorId,
      action: "SETTINGS_DELIVERY_UPDATED",
      entity: "Setting",
      entityId: "delivery_settings",
      before,
      after: parsed,
      ip,
    });

    return parsed;
  }

  async getVerificationSettings(): Promise<VerificationSettings> {
    const data = await settingsRepository.getSetting<VerificationSettings>("verification_mode");
    return data ? { ...DEFAULT_VERIFICATION_SETTINGS, ...data } : DEFAULT_VERIFICATION_SETTINGS;
  }

  async updateVerificationSettings(
    actorRole: UserRole,
    actorId: string,
    data: unknown,
    ip?: string
  ): Promise<VerificationSettings> {
    assertPermission(actorRole, Permission.MANAGE_SETTINGS);
    const parsed = verificationSettingsSchema.parse(data);

    const before = await this.getVerificationSettings();
    await settingsRepository.setSetting("verification_mode", parsed);

    await auditService.log({
      actorId,
      action: "SETTINGS_VERIFICATION_MODE_UPDATED",
      entity: "Setting",
      entityId: "verification_mode",
      before,
      after: parsed,
      ip,
    });

    return parsed;
  }

  async getPaymentModeSettings(): Promise<PaymentModeSettings> {
    const data = await settingsRepository.getSetting<PaymentModeSettings>("payment_mode_settings");
    return data ? { ...DEFAULT_PAYMENT_MODE_SETTINGS, ...data } : DEFAULT_PAYMENT_MODE_SETTINGS;
  }

  async updatePaymentModeSettings(
    actorRole: UserRole,
    actorId: string,
    data: unknown,
    ip?: string
  ): Promise<PaymentModeSettings> {
    assertPermission(actorRole, Permission.MANAGE_SETTINGS);
    const parsed = paymentModeSettingsSchema.parse(data);

    const before = await this.getPaymentModeSettings();
    await settingsRepository.setSetting("payment_mode_settings", parsed);

    const maskedAfter = {
      ...parsed,
      gatewayKeySecret: parsed.gatewayKeySecret ? "***" : "",
    };
    const maskedBefore = {
      ...before,
      gatewayKeySecret: before.gatewayKeySecret ? "***" : "",
    };

    await auditService.log({
      actorId,
      action: "SETTINGS_PAYMENT_MODE_UPDATED",
      entity: "Setting",
      entityId: "payment_mode_settings",
      before: maskedBefore,
      after: maskedAfter,
      ip,
    });

    return parsed;
  }

  async getEInvoiceSettings(): Promise<EInvoiceSettings> {
    const data = await settingsRepository.getSetting<EInvoiceSettings>("einvoice_settings");
    return data ? { ...DEFAULT_EINVOICE_SETTINGS, ...data } : DEFAULT_EINVOICE_SETTINGS;
  }

  async updateEInvoiceSettings(
    actorRole: UserRole,
    actorId: string,
    data: unknown,
    ip?: string
  ): Promise<EInvoiceSettings> {
    assertPermission(actorRole, Permission.MANAGE_SETTINGS);
    const parsed = eInvoiceSettingsSchema.parse(data);

    const before = await this.getEInvoiceSettings();
    await settingsRepository.setSetting("einvoice_settings", parsed);

    const maskedAfter = {
      ...parsed,
      gspClientSecret: parsed.gspClientSecret ? "***" : "",
    };
    const maskedBefore = {
      ...before,
      gspClientSecret: before.gspClientSecret ? "***" : "",
    };

    await auditService.log({
      actorId,
      action: "SETTINGS_EINVOICE_UPDATED",
      entity: "Setting",
      entityId: "einvoice_settings",
      before: maskedBefore,
      after: maskedAfter,
      ip,
    });

    return parsed;
  }

  async getPricingSettings(): Promise<PricingSettings> {
    const data = await settingsRepository.getSetting<PricingSettings>("pricing_settings");
    return data ? { ...DEFAULT_PRICING_SETTINGS, ...data } : DEFAULT_PRICING_SETTINGS;
  }

  async updatePricingSettings(
    actorRole: UserRole,
    actorId: string | null,
    data: unknown,
    ip?: string
  ): Promise<PricingSettings> {
    assertPermission(actorRole, Permission.MANAGE_SETTINGS);
    const parsed = pricingSettingsSchema.parse(data);

    const before = await this.getPricingSettings();
    await settingsRepository.setSetting("pricing_settings", parsed);

    await auditService.log({
      actorId: actorId ?? null,
      action: "SETTINGS_PRICING_UPDATED",
      entity: "Setting",
      entityId: "pricing_settings",
      before,
      after: parsed,
      ip,
    });

    return parsed;
  }

  async getAllSettings(): Promise<AllSettings> {
    const [
      businessDetails,
      roleDiscountLimits,
      deliverySettings,
      verificationSettings,
      paymentModeSettings,
      eInvoiceSettings,
      pricingSettings,
    ] = await Promise.all([
      this.getBusinessDetails(),
      this.getRoleDiscountLimits(),
      this.getDeliverySettings(),
      this.getVerificationSettings(),
      this.getPaymentModeSettings(),
      this.getEInvoiceSettings(),
      this.getPricingSettings(),
    ]);

    return {
      businessDetails,
      roleDiscountLimits,
      deliverySettings,
      verificationSettings,
      paymentModeSettings,
      eInvoiceSettings,
      pricingSettings,
    };
  }
}

export const settingsService = new SettingsService();
