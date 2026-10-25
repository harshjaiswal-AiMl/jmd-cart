import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { billingService } from "@/modules/billing/billing.service";
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
  const session = await auth();

  const invoice = await billingService.getInvoiceById(id);
  if (!invoice) {
    notFound();
  }

  const canCancel = session?.user?.role === UserRole.SUPER_ADMIN;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6">
      <InvoiceDetailClient invoice={invoice} canCancel={canCancel} />
    </div>
  );
}
