import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { billingService } from "@/modules/billing/billing.service";
import { settingsService } from "@/modules/settings/settings.service";
import { UserRole } from "@prisma/client";
import { InvoiceDetailClient } from "./invoice-detail-client";

interface InvoiceDetailPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: InvoiceDetailPageProps) {
  const { id } = await params;
  const [session, invoice, posSettings] = await Promise.all([
    auth(),
    billingService.getInvoiceById(id),
    settingsService.getPosOperationalSettings(),
  ]);

  if (!invoice) {
    notFound();
  }

  const canCancel =
    session?.user?.role === UserRole.SUPER_ADMIN ||
    (posSettings.managerCanDelete && session?.user?.role === UserRole.ADMIN);

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6">
      <InvoiceDetailClient invoice={invoice} canCancel={canCancel} />
    </div>
  );
}
