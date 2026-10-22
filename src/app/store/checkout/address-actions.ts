"use server";

import { auth } from "@/auth";
import { addressService } from "@/modules/address/address.service";
import { UserAddressInput, SavedAddressDto } from "@/modules/address/address.types";
import { revalidatePath } from "next/cache";

export async function getUserAddressesAction(): Promise<SavedAddressDto[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  return addressService.getUserAddresses(session.user.id);
}

export async function saveUserAddressAction(
  input: UserAddressInput
): Promise<{ success: boolean; address?: SavedAddressDto; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Please sign in to save addresses" };
    }

    const saved = await addressService.saveAddress(session.user.id, input);
    revalidatePath("/store/checkout");
    revalidatePath("/store/cart");
    return { success: true, address: saved };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to save address" };
  }
}

export async function deleteUserAddressAction(
  addressId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const ok = await addressService.deleteAddress(session.user.id, addressId);
    if (!ok) return { success: false, error: "Address not found" };

    revalidatePath("/store/checkout");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete address" };
  }
}

export async function setDefaultAddressAction(
  addressId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const ok = await addressService.setDefaultAddress(session.user.id, addressId);
    if (!ok) return { success: false, error: "Address not found" };

    revalidatePath("/store/checkout");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to set default address" };
  }
}
