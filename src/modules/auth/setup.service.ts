import { z } from "zod";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "./permissions";
import { gstinRegex, fssaiRegex } from "@/modules/settings/settings.types";

export const firstRunSetupSchema = z.object({
  ownerName: z.string().trim().min(2, "Owner name must be at least 2 characters"),
  ownerPhone: z
    .string()
    .trim()
    .regex(/^[0-9]{10}$/, "Phone must be a valid 10-digit mobile number"),
  ownerEmail: z.string().trim().email("Invalid email address").or(z.literal("")).optional().default(""),
  ownerPassword: z
    .string()
    .min(8, "Password must be at least 8 characters"),
  legalName: z.string().trim().min(2, "Business legal name is required"),
  tradeName: z.string().trim().min(2, "Trade name is required"),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(gstinRegex, "Invalid 15-digit GSTIN format")
    .or(z.literal(""))
    .optional()
    .default(""),
  fssai: z
    .string()
    .trim()
    .regex(fssaiRegex, "FSSAI license must be 14 numeric digits")
    .or(z.literal(""))
    .optional()
    .default(""),
  address: z.string().trim().min(5, "Business address must be at least 5 characters"),
  businessPhone: z
    .string()
    .trim()
    .min(10, "Business phone must be at least 10 digits")
    .optional(),
  businessEmail: z
    .string()
    .trim()
    .email("Invalid business email")
    .or(z.literal(""))
    .optional()
    .default(""),
});

export type FirstRunSetupInput = z.input<typeof firstRunSetupSchema>;

export class SetupService {
  /**
   * Returns true ONLY while no SUPER_ADMIN account exists in the database.
   */
  async isSetupRequired(): Promise<boolean> {
    const adminCount = await prisma.user.count({
      where: { role: UserRole.SUPER_ADMIN },
    });
    return adminCount === 0;
  }

  /**
   * Completes first-run setup: creates the owner SUPER_ADMIN account with their chosen password
   * and saves the initial business details in a single database transaction.
   * Permanently unreachable once a SUPER_ADMIN exists.
   */
  async completeFirstRunSetup(rawInput: FirstRunSetupInput) {
    const parsed = firstRunSetupSchema.parse(rawInput);

    return prisma.$transaction(async (tx) => {
      const existingAdminCount = await tx.user.count({
        where: { role: UserRole.SUPER_ADMIN },
      });

      if (existingAdminCount > 0) {
        throw new ForbiddenError(
          "First-run setup has already been completed. An owner account already exists."
        );
      }

      const passwordHash = await bcrypt.hash(parsed.ownerPassword, 10);

      const user = await tx.user.create({
        data: {
          name: parsed.ownerName,
          phone: parsed.ownerPhone,
          email: parsed.ownerEmail || null,
          passwordHash,
          role: UserRole.SUPER_ADMIN,
          active: true,
          mustChangePassword: false,
          phoneVerifiedAt: new Date(),
        },
      });

      const businessDetailsValue = {
        legalName: parsed.legalName,
        tradeName: parsed.tradeName,
        gstin: parsed.gstin || "",
        fssai: parsed.fssai || "",
        address: parsed.address,
        phone: parsed.businessPhone || parsed.ownerPhone,
        email: parsed.businessEmail || parsed.ownerEmail || "",
        bankDetails: {
          bankName: "",
          accountNumber: "",
          ifsc: "",
          branch: "",
        },
        upiId: "",
      };

      await tx.setting.upsert({
        where: { key: "business_details" },
        update: { value: businessDetailsValue },
        create: {
          key: "business_details",
          value: businessDetailsValue,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "FIRST_RUN_SETUP_COMPLETED",
          entity: "User",
          entityId: user.id,
          before: Prisma.JsonNull,
          after: {
            ownerId: user.id,
            ownerName: user.name,
            role: user.role,
            tradeName: businessDetailsValue.tradeName,
            legalName: businessDetailsValue.legalName,
          },
        },
      });

      return { user, businessDetails: businessDetailsValue };
    });
  }
}

import { Prisma } from "@prisma/client";
export const setupService = new SetupService();
