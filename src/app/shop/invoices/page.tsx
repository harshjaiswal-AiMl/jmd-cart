import { auth } from "@/auth";
import { UserRole } from "@prisma/client";
import { billingService } from "@/modules/billing/billing.service";
import { hasPermission, Permission } from "@/modules/auth/permissions";
import { InvoicesClient } from "./invoices-client";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const [session, result] = await Promise.all([
    auth(),
    billingService.listInvoices({ limit: 1500 }),
  ]);

  const role = session?.user?.role as UserRole | undefined;
  const canCancel = role ? hasPermission(role, Permission.INVOICE_VOID) : false;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6">
      <InvoicesClient initialInvoices={result.items} canCancel={canCancel} />
    </div>
  );
}
