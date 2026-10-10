import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { settingsService } from "@/modules/settings/settings.service";
import {
  BusinessDetailsForm,
  DiscountLimitsForm,
  VerificationSettingsForm,
  DeliverySettingsForm,
  PaymentModeSettingsForm,
} from "./settings-forms";

export default async function AdminSettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== UserRole.SUPER_ADMIN) {
    redirect("/login");
  }

  const settings = await settingsService.getAllSettings();

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
          <p className="text-sm text-gray-600">
            Configure business information, delivery zones, operational limits, and payment gateway switches.
          </p>
        </div>

        <div className="space-y-6">
          <BusinessDetailsForm initialData={settings.businessDetails} />
          <PaymentModeSettingsForm initialData={settings.paymentModeSettings} />
          <DeliverySettingsForm initialData={settings.deliverySettings} />
          <DiscountLimitsForm initialData={settings.roleDiscountLimits} />
          <VerificationSettingsForm initialData={settings.verificationSettings} />
        </div>
      </div>
    </div>
  );
}
