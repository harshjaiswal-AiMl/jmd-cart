import { notFound } from "next/navigation";
import { billingService } from "@/modules/billing/billing.service";
import { settingsService } from "@/modules/settings/settings.service";
import { PrintViewer } from "./print-viewer";

interface PrintPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ format?: string; autoprint?: string }>;
}

export const dynamic = "force-dynamic";

export default async function InvoicePrintPage({
  params,
  searchParams,
}: PrintPageProps) {
  const { id } = await params;
  const { format, autoprint } = await searchParams;

  const invoice = await billingService.getInvoiceById(id);
  if (!invoice) {
    notFound();
  }

  const business = await settingsService.getBusinessDetails();

  const selectedFormat: "a4" | "thermal" =
    format === "thermal" ? "thermal" : "a4";

  const shouldAutoPrint = autoprint === "1" || autoprint === "true";

  return (
    <PrintViewer
      invoice={invoice}
      business={business}
      initialFormat={selectedFormat}
      autoPrint={shouldAutoPrint}
    />
  );
}
