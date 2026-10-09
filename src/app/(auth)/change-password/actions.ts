"use server";

import { auth } from "@/auth";
import { authService } from "@/modules/auth/auth.service";
import { redirect } from "next/navigation";
import { getDefaultDashboard } from "@/middleware";

export interface ChangePasswordState {
  error?: string;
  success?: boolean;
}

export async function changePasswordAction(
  prevState: ChangePasswordState | undefined,
  formData: FormData
): Promise<ChangePasswordState | undefined> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!currentPassword || !newPassword) {
    return { error: "Please fill in all required fields" };
  }

  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters long" };
  }

  if (newPassword !== confirmPassword) {
    return { error: "New password and confirmation do not match" };
  }

  try {
    await authService.changePassword(session.user.id, currentPassword, newPassword);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to change password";
    return { error: message };
  }

  // Redirect to dashboard after successful password update
  redirect(getDefaultDashboard(session.user.role));
}
