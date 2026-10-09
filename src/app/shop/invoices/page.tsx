import { billingService } from "@/modules/billing/billing.service";
import { InvoicesClient } from "./invoices-client";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const result = await billingService.listInvoices({ limit: 100 });

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6">
      <InvoicesClient initialInvoices={result.items} />
    </div>
  );
}
