"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address").optional().nullable().or(z.literal("")),
  gstin: z.string().optional().nullable().or(z.literal("")),
});

export async function updateProfileAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Please sign in to update profile" };
  }

  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim() || null;
  const gstin = (formData.get("gstin") as string)?.trim()?.toUpperCase() || null;

  try {
    const validated = updateProfileSchema.parse({ name, email, gstin });

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { party: true },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Update User record
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: validated.name,
        email: validated.email || null,
      },
    });

    // Update linked Party record if exists
    if (user.partyId) {
      await prisma.party.update({
        where: { id: user.partyId },
        data: {
          name: validated.name,
          email: validated.email || null,
          gstin: validated.gstin || null,
        },
      });
    }

    revalidatePath("/store/account");
    revalidatePath("/store");
    revalidatePath("/store/checkout");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update profile" };
  }
}

export async function changeUserPasswordAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Please sign in to change password" };
  }

  const currentPassword = (formData.get("currentPassword") as string) || "";
  const newPassword = (formData.get("newPassword") as string) || "";
  const confirmPassword = (formData.get("confirmPassword") as string) || "";

  if (!currentPassword || !newPassword) {
    return { success: false, error: "Please provide both current and new password" };
  }

  if (newPassword.length < 6) {
    return { success: false, error: "New password must be at least 6 characters long" };
  }

  if (newPassword !== confirmPassword) {
    return { success: false, error: "New password and confirm password do not match" };
  }

  try {
    const { authService } = await import("@/modules/auth/auth.service");
    await authService.changePassword(session.user.id, currentPassword, newPassword);
    revalidatePath("/store/account");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to change password";
    return { success: false, error: message };
  }
}
