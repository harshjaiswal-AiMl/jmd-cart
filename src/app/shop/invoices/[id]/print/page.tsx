import { notFound } from "next/navigation";
import { billingService } from "@/modules/billing/billing.service";
import { settingsService } from "@/modules/settings/settings.service";
import { PrintViewer, PrintFormat } from "./print-viewer";

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

  // Smart format detection:
  let selectedFormat: PrintFormat;
  if (
    format === "demand_bill" ||
    format === "cash_receipt" ||
    format === "thermal" ||
    format === "a4"
  ) {
    selectedFormat = format as PrintFormat;
  } else {
    // Determine whether credit/unpaid or cash/upi
    const totalPaid = invoice.payments.reduce(
      (sum, p) => sum + p.amountPaise,
      0
    );
    const isCreditOrUnpaid =
      invoice.payments.some((p) => p.mode === "CREDIT") ||
      totalPaid < invoice.totalPaise ||
      invoice.paymentStatus !== "PAID";

    selectedFormat = isCreditOrUnpaid ? "demand_bill" : "cash_receipt";
  }

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
