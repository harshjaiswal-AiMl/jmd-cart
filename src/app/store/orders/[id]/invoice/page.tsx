import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { orderService } from "@/modules/order/order.service";
import { billingService } from "@/modules/billing/billing.service";
import { settingsService } from "@/modules/settings/settings.service";
import { BuyerInvoiceViewer } from "./buyer-invoice-viewer";

interface BuyerInvoicePageProps {
  params: { id: string };
  searchParams?: { format?: string; autoprint?: string };
}

export const dynamic = "force-dynamic";

export default async function BuyerInvoicePage({
  params,
  searchParams,
}: BuyerInvoicePageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/store/orders/${params.id}/invoice`);
  }

  const order = await orderService.getOrderById(params.id);

  if (!order) {
    notFound();
  }

  // Authorization check
  const isOwner = order.userId === session.user.id;
  const isSuperAdmin = session.user.role === UserRole.SUPER_ADMIN;

  if (!isOwner && !isSuperAdmin) {
    redirect("/store/orders");
  }

  // If no invoice yet generated, redirect back to order tracking
  if (!order.invoiceId) {
    redirect(`/store/orders/${order.id}`);
  }

  const invoice = await billingService.getInvoiceById(order.invoiceId);
  if (!invoice) {
    notFound();
  }

  const business = await settingsService.getBusinessDetails();

  const selectedFormat: "a4" | "thermal" =
    searchParams?.format === "thermal" ? "thermal" : "a4";
  const shouldAutoPrint =
    searchParams?.autoprint === "1" || searchParams?.autoprint === "true";

  return (
    <BuyerInvoiceViewer
      orderId={order.id}
      orderNumber={order.orderNumber}
      invoice={invoice}
      business={business}
      initialFormat={selectedFormat}
      autoPrint={shouldAutoPrint}
    />
  );
}
