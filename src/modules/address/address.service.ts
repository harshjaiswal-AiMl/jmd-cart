import { prisma } from "@/lib/prisma";
import { UserAddressInput, SavedAddressDto, userAddressSchema } from "./address.types";

export class AddressService {
  async getUserAddresses(userId: string): Promise<SavedAddressDto[]> {
    if (!prisma.userAddress) {
      return [];
    }

    const list = await prisma.userAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    return list.map((addr) => ({
      id: addr.id,
      name: addr.name,
      phone: addr.phone,
      addressLine: addr.addressLine,
      area: addr.area,
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
      type: addr.type as any,
      isDefault: addr.isDefault,
      formattedAddress: `${addr.addressLine}, ${addr.area}, ${addr.city}, ${addr.state} - ${addr.pincode}`,
    }));
  }

  async saveAddress(userId: string, input: UserAddressInput): Promise<SavedAddressDto> {
    const validated = userAddressSchema.parse(input);

    // If marked default, or if it's the user's first address, ensure other addresses are not default
    const existingCount = await prisma.userAddress.count({ where: { userId } });
    const shouldBeDefault = validated.isDefault || existingCount === 0;

    if (shouldBeDefault) {
      await prisma.userAddress.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    if (validated.id) {
      const updated = await prisma.userAddress.update({
        where: { id: validated.id, userId },
        data: {
          name: validated.name,
          phone: validated.phone,
          addressLine: validated.addressLine,
          area: validated.area,
          city: validated.city,
          state: validated.state,
          pincode: validated.pincode,
          type: validated.type,
          isDefault: shouldBeDefault,
        },
      });

      return {
        id: updated.id,
        name: updated.name,
        phone: updated.phone,
        addressLine: updated.addressLine,
        area: updated.area,
        city: updated.city,
        state: updated.state,
        pincode: updated.pincode,
        type: updated.type as any,
        isDefault: updated.isDefault,
        formattedAddress: `${updated.addressLine}, ${updated.area}, ${updated.city}, ${updated.state} - ${updated.pincode}`,
      };
    }

    const created = await prisma.userAddress.create({
      data: {
        userId,
        name: validated.name,
        phone: validated.phone,
        addressLine: validated.addressLine,
        area: validated.area,
        city: validated.city,
        state: validated.state,
        pincode: validated.pincode,
        type: validated.type,
        isDefault: shouldBeDefault,
      },
    });

    return {
      id: created.id,
      name: created.name,
      phone: created.phone,
      addressLine: created.addressLine,
      area: created.area,
      city: created.city,
      state: created.state,
      pincode: created.pincode,
      type: created.type as any,
      isDefault: created.isDefault,
      formattedAddress: `${created.addressLine}, ${created.area}, ${created.city}, ${created.state} - ${created.pincode}`,
    };
  }

  async deleteAddress(userId: string, addressId: string): Promise<boolean> {
    const existing = await prisma.userAddress.findFirst({
      where: { id: addressId, userId },
    });
    if (!existing) return false;

    await prisma.userAddress.delete({ where: { id: addressId } });

    // If deleted address was default, promote another address if one exists
    if (existing.isDefault) {
      const next = await prisma.userAddress.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      if (next) {
        await prisma.userAddress.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }
    return true;
  }

  async setDefaultAddress(userId: string, addressId: string): Promise<boolean> {
    const target = await prisma.userAddress.findFirst({
      where: { id: addressId, userId },
    });
    if (!target) return false;

    await prisma.userAddress.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });

    await prisma.userAddress.update({
      where: { id: addressId },
      data: { isDefault: true },
    });

    return true;
  }
}

export const addressService = new AddressService();
