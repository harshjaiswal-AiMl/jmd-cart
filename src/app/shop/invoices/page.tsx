import { auth } from "@/auth";
import { UserRole } from "@prisma/client";
import { billingService } from "@/modules/billing/billing.service";
import { settingsService } from "@/modules/settings/settings.service";
import { InvoicesClient } from "./invoices-client";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const [session, result, posSettings] = await Promise.all([
    auth(),
    billingService.listInvoices({ limit: 1500 }),
    settingsService.getPosOperationalSettings(),
  ]);

  const role = session?.user?.role;
  const canCancel =
    role === UserRole.SUPER_ADMIN ||
    (posSettings.managerCanDelete && role === UserRole.ADMIN);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6">
      <InvoicesClient initialInvoices={result.items} canCancel={canCancel} />
    </div>
  );
}
