import { z } from "zod";

export const userAddressTypeSchema = z.enum(["SHOP", "HOME", "WORK", "OTHER"]);
export type UserAddressType = z.infer<typeof userAddressTypeSchema>;

export const userAddressSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Full Name must be at least 2 characters"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit mobile number"),
  addressLine: z.string().min(5, "Street / Shop address must be at least 5 characters"),
  area: z.string().min(2, "Market / Ward / Area is required"),
  city: z.string().default("Saharsa"),
  state: z.string().default("Bihar"),
  pincode: z.string().regex(/^\d{6}$/, "Pincode must be 6 digits").default("852201"),
  type: userAddressTypeSchema.default("SHOP"),
  isDefault: z.boolean().default(false),
});

export type UserAddressInput = z.infer<typeof userAddressSchema>;

export interface SavedAddressDto {
  id: string;
  name: string;
  phone: string;
  addressLine: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  type: UserAddressType;
  isDefault: boolean;
  formattedAddress: string;
}
