import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { SamplePreviewClient } from "./sample-preview-client";
import { settingsService } from "@/modules/settings/settings.service";

export const dynamic = "force-dynamic";

export default async function SampleInvoicePreviewPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/shop/invoices/sample/preview");
  }

  const staffRoles: UserRole[] = [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SHOP,
    UserRole.SALESPERSON,
    UserRole.ACCOUNTS,
    UserRole.GODOWN,
    UserRole.DELIVERY,
  ];

  if (!staffRoles.includes(session.user.role as UserRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="bg-white p-6 rounded-2xl border border-red-200 shadow-sm max-w-md text-center">
          <h1 className="text-base font-bold text-red-700">Access Restricted</h1>
          <p className="text-xs text-slate-600 mt-2">
            The sample invoice preview is reserved for internal staff members.
          </p>
        </div>
      </div>
    );
  }

  // Load real business settings if available, or use defaults
  const business = await settingsService.getBusinessDetails();

  return <SamplePreviewClient business={business} />;
}
